import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
  marketId: string;
  role: string;
};

export type CashCorrectionTokenPayload = {
  kind: "CASH_CLOSING_CORRECTION";
  marketId: string;
  sessionId: string;
  managerId: string;
  managerName: string;
  requestedByUserId: string;
  authorizedRevision: number;
};

export function signToken(payload: TokenPayload) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return jwt.sign(payload, secret, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return jwt.verify(token, secret) as TokenPayload;
}

export function signCashCorrectionToken(payload: CashCorrectionTokenPayload) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return jwt.sign(payload, secret, { expiresIn: "10m" });
}

export function verifyCashCorrectionToken(token: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET não configurado.");
  }

  return jwt.verify(token, secret) as CashCorrectionTokenPayload;
}
