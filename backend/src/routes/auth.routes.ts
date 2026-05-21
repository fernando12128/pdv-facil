import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
  try {
    const { name, marketName, email, password } = req.body;

    if (!marketName || !email || !password) {
      return res.status(400).json({
        message: "Nome do mercado, email e senha são obrigatórios.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const userAlreadyExists = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (userAlreadyExists) {
      return res.status(409).json({
        message: "Já existe uma conta com este email.",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "A senha precisa ter pelo menos 6 caracteres.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name || marketName,
          email: normalizedEmail,
          passwordHash,
          role: "OWNER",
        },
      });

      const market = await tx.market.create({
        data: {
          name: marketName,
          email: normalizedEmail,
          ownerId: user.id,
        },
      });

      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          marketId: market.id,
        },
        include: {
          market: true,
        },
      });

      return {
        user: updatedUser,
        market,
      };
    });

    const token = signToken({
      userId: result.user.id,
      marketId: result.market.id,
      role: result.user.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      market: {
        id: result.market.id,
        name: result.market.name,
        email: result.market.email,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao criar conta.",
    });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email e senha são obrigatórios.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: {
        market: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Email ou senha inválidos.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Email ou senha inválidos.",
      });
    }

    if (!user.marketId || !user.market) {
      return res.status(400).json({
        message: "Usuário sem mercado vinculado.",
      });
    }

    const token = signToken({
      userId: user.id,
      marketId: user.marketId,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      market: {
        id: user.market.id,
        name: user.market.name,
        email: user.market.email,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao fazer login.",
    });
  }
});

authRoutes.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        market: true,
      },
    });

    if (!user || !user.market) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
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

    return res.status(500).json({
      message: "Erro ao buscar usuário logado.",
    });
  }
});