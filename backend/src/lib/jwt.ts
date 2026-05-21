import jwt from "jsonwebtoken";

type TokenPayload = {
  userId: string;
  marketId: string;
  role: string;
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