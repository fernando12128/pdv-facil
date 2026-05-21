import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    marketId: string;
    role: string;
  };
};

export function authMiddleware(
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

    req.user = {
      userId: decoded.userId,
      marketId: decoded.marketId,
      role: decoded.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }
}