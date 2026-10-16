import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    marketId: string;
    role: string;
  };
};

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      message: "Token não enviado.",
    });
    return;
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    res.status(401).json({
      message: "Token inválido.",
    });
    return;
  }

  let decoded: ReturnType<typeof verifyToken>;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({
      message: "Token inválido ou expirado.",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { marketId: true, authVersion: true, emailVerifiedAt: true },
    });
    if (
      !user ||
      !user.marketId ||
      user.marketId !== decoded.marketId ||
      user.authVersion !== (decoded.authVersion || 0) ||
      !user.emailVerifiedAt
    ) {
      res.status(401).json({ message: "Sessão inválida. Entre novamente." });
      return;
    }

    req.user = {
      userId: decoded.userId,
      marketId: decoded.marketId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Não foi possível validar sua sessão." });
  }
}
