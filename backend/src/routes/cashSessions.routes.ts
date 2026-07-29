import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const cashSessionsRoutes = Router();

cashSessionsRoutes.use(authMiddleware);

cashSessionsRoutes.get("/current", async (req: AuthenticatedRequest, res) => {
  const session = await prisma.cashSession.findFirst({
    where: { marketId: req.user!.marketId, status: "OPEN" },
    include: { movements: { orderBy: { createdAt: "desc" } } },
    orderBy: { openedAt: "desc" },
  });
  return res.json({ session });
});

cashSessionsRoutes.post("/open", async (req: AuthenticatedRequest, res) => {
  const current = await prisma.cashSession.findFirst({
    where: { marketId: req.user!.marketId, status: "OPEN" },
  });
  if (current) {
    return res.status(409).json({ message: "Já existe um caixa aberto." });
  }

  const openingAmount = Number(req.body.openingAmount || 0);
  if (Number.isNaN(openingAmount) || openingAmount < 0) {
    return res.status(400).json({ message: "Valor inicial inválido." });
  }

  const session = await prisma.cashSession.create({
    data: {
      marketId: req.user!.marketId,
      userId: req.user!.userId,
      operatorName: req.body.operatorName
        ? String(req.body.operatorName).trim()
        : null,
      openingAmount,
    },
  });
  return res.status(201).json({ session });
});

cashSessionsRoutes.post("/:id/close", async (req: AuthenticatedRequest, res) => {
  const session = await prisma.cashSession.findFirst({
    where: {
      id: req.params.id,
      marketId: req.user!.marketId,
      status: "OPEN",
    },
  });
  if (!session) {
    return res.status(404).json({ message: "Caixa aberto não encontrado." });
  }

  const closingAmount = Number(req.body.closingAmount);
  if (Number.isNaN(closingAmount) || closingAmount < 0) {
    return res.status(400).json({ message: "Valor final inválido." });
  }

  const closedSession = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      closingAmount,
      closedAt: new Date(),
    },
  });
  return res.json({ session: closedSession });
});
