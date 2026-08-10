import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

export const userRoles = ["OWNER", "MANAGER", "CASHIER", "STOCK"] as const;
export type UserRole = (typeof userRoles)[number];

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    marketId: string;
    role: UserRole;
  };
};

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Token não enviado.",
    });
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({
      message: "Token inválido.",
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, marketId: true, role: true },
    });

    if (!user || !user.marketId || user.marketId !== decoded.marketId) {
      return res.status(401).json({
        message: "Usuário não encontrado ou acesso revogado.",
      });
    }

    req.user = {
      userId: user.id,
      marketId: user.marketId,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Você não tem permissão para realizar esta ação.",
      });
    }

    return next();
  };
}
