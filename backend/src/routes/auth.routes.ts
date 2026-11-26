import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const authRoutes = Router();

type AccountTokenPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";
const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const TOKEN_RESEND_COOLDOWN_MS = 60 * 1000;
const TOKEN_HOURLY_LIMIT = 5;
const GENERIC_RECOVERY_MESSAGE =
  "Se os dados corresponderem a uma conta, as instruções estarão disponíveis para continuar.";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function mockEmailModeEnabled() {
  const configuredMode = process.env.ACCOUNT_EMAIL_MODE || "mock";
  return process.env.NODE_ENV !== "production" && configuredMode === "mock";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function issueAccountToken(
  tx: Prisma.TransactionClient,
  userId: string,
  purpose: AccountTokenPurpose,
  enforceLimits = true
) {
  const now = new Date();
  await tx.accountToken.deleteMany({
    where: { userId, createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
  });

  if (enforceLimits) {
    const [recentCount, latest] = await Promise.all([
      tx.accountToken.count({
        where: { userId, purpose, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
      }),
      tx.accountToken.findFirst({
        where: { userId, purpose },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    if (
      recentCount >= TOKEN_HOURLY_LIMIT ||
      (latest && now.getTime() - latest.createdAt.getTime() < TOKEN_RESEND_COOLDOWN_MS)
    ) {
      return null;
    }
  }

  const token = randomBytes(32).toString("base64url");
  await tx.accountToken.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: now },
  });
  await tx.accountToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
    },
  });
  return token;
}

function debugTokenResponse(token: string | null) {
  return mockEmailModeEnabled() && token ? { developmentToken: token } : {};
}

authRoutes.post("/register", async (req, res) => {
  try {
    if (!mockEmailModeEnabled()) {
      return res.status(503).json({ message: "Confirmação de conta indisponível no momento." });
    }

    const marketName = String(req.body.marketName || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const name = String(req.body.name || marketName).trim();

    if (!marketName || !email || !password) {
      return res.status(400).json({ message: "Nome do mercado, e-mail e senha são obrigatórios." });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ message: "Informe um e-mail válido." });
    }
    if (marketName.length > 120 || name.length > 120) {
      return res.status(400).json({ message: "O nome deve ter no máximo 120 caracteres." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "A senha precisa ter entre 8 e 128 caracteres." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "OWNER" },
      });
      const market = await tx.market.create({
        data: { name: marketName, email, ownerId: user.id },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { marketId: market.id },
      });
      const token = await issueAccountToken(tx, user.id, "EMAIL_VERIFICATION", false);
      return { userId: user.id, token };
    });

    return res.status(201).json({
      message: "Conta criada. Confirme seu e-mail para entrar.",
      email,
      ...debugTokenResponse(created.token),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return res.status(409).json({ message: "Já existe uma conta com este e-mail." });
    }
    console.error(error);
    return res.status(500).json({ message: "Erro ao criar conta." });
  }
});

authRoutes.post("/verify-email", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.token || "").trim();
  if (!validEmail(email) || token.length < 32 || token.length > 128) {
    return res.status(400).json({ message: "Código de confirmação inválido ou expirado." });
  }

  try {
    const now = new Date();
    const verified = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
      if (!user || user.emailVerifiedAt) return false;
      const changed = await tx.accountToken.updateMany({
        where: {
          userId: user.id,
          purpose: "EMAIL_VERIFICATION",
          tokenHash: hashToken(token),
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (changed.count !== 1) return false;
      await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      return true;
    });
    if (!verified) return res.status(400).json({ message: "Código de confirmação inválido ou expirado." });
    return res.json({ message: "E-mail confirmado. Agora você já pode entrar." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao confirmar o e-mail." });
  }
});

authRoutes.post("/verification/resend", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!mockEmailModeEnabled()) return res.json({ message: GENERIC_RECOVERY_MESSAGE });

  try {
    let token: string | null = null;
    if (validEmail(email)) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
      if (user && !user.emailVerifiedAt) {
        token = await prisma.$transaction((tx) => issueAccountToken(tx, user.id, "EMAIL_VERIFICATION"));
      }
    }
    return res.json({ message: GENERIC_RECOVERY_MESSAGE, ...debugTokenResponse(token) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Não foi possível processar a solicitação." });
  }
});

authRoutes.post("/password-reset/request", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!mockEmailModeEnabled()) return res.json({ message: GENERIC_RECOVERY_MESSAGE });

  try {
    let token: string | null = null;
    if (validEmail(email)) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
      if (user?.emailVerifiedAt) {
        token = await prisma.$transaction((tx) => issueAccountToken(tx, user.id, "PASSWORD_RESET"));
      }
    }
    return res.json({ message: GENERIC_RECOVERY_MESSAGE, ...debugTokenResponse(token) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Não foi possível processar a solicitação." });
  }
});

authRoutes.post("/password-reset/confirm", async (req, res) => {
  const token = String(req.body.token || "").trim();
  const password = String(req.body.password || "");
  if (token.length < 32 || token.length > 128) {
    return res.status(400).json({ message: "Link de recuperação inválido ou expirado." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: "A senha precisa ter entre 8 e 128 caracteres." });
  }

  try {
    const existingToken = await prisma.accountToken.findFirst({
      where: {
        purpose: "PASSWORD_RESET",
        tokenHash: hashToken(token),
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!existingToken) return res.status(400).json({ message: "Link de recuperação inválido ou expirado." });

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const changed = await prisma.$transaction(async (tx) => {
      const accountToken = await tx.accountToken.findFirst({
        where: {
          purpose: "PASSWORD_RESET",
          tokenHash: hashToken(token),
          consumedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, userId: true },
      });
      if (!accountToken) return false;
      const consumed = await tx.accountToken.updateMany({
        where: { id: accountToken.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({
        where: { id: accountToken.userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      await tx.accountToken.updateMany({
        where: { userId: accountToken.userId, purpose: "PASSWORD_RESET", id: { not: accountToken.id }, consumedAt: null },
        data: { consumedAt: now },
      });
      return true;
    });
    if (!changed) return res.status(400).json({ message: "Link de recuperação inválido ou expirado." });
    return res.json({ message: "Senha redefinida. Entre novamente com a nova senha." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao redefinir a senha." });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { market: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }
    if (!user.emailVerifiedAt) {
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        message: "Confirme seu e-mail antes de entrar. Você pode solicitar um novo código de confirmação.",
      });
    }
    if (!user.marketId || !user.market) {
      return res.status(400).json({ message: "Usuário sem empresa vinculada." });
    }

    const token = signToken({
      userId: user.id,
      marketId: user.marketId,
      role: user.role,
      authVersion: user.authVersion,
    });
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      market: { id: user.market.id, name: user.market.name, email: user.market.email },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao fazer login." });
  }
});

authRoutes.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Não autenticado." });
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { market: true } });
    if (!user || !user.market) return res.status(404).json({ message: "Usuário não encontrado." });
    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      market: {
        id: user.market.id,
        name: user.market.name,
        email: user.market.email,
        phone: user.market.phone,
        address: user.market.address,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao buscar usuário logado." });
  }
});
