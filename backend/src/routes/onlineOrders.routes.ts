import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const onlineOrdersRoutes = Router();

onlineOrdersRoutes.use(authMiddleware);

onlineOrdersRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  const orders = await prisma.onlineOrder.findMany({
    where: { marketId: req.user!.marketId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ orders });
});

const validStatuses = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

onlineOrdersRoutes.patch(
  "/:id/status",
  async (req: AuthenticatedRequest, res) => {
    const status = String(req.body.status || "").toUpperCase();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    const current = await prisma.onlineOrder.findFirst({
      where: { id: req.params.id, marketId: req.user!.marketId },
    });
    if (!current) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    const order = await prisma.onlineOrder.update({
      where: { id: current.id },
      data: { status: status as typeof current.status },
      include: { items: true },
    });
    return res.json({ order });
  }
);
