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

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

onlineOrdersRoutes.patch(
  "/:id/status",
  async (req: AuthenticatedRequest, res) => {
    const status = String(req.body.status || "").toUpperCase();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    try {
      const order = await prisma.$transaction(async (tx) => {
        const current = await tx.onlineOrder.findFirst({
          where: { id: req.params.id, marketId: req.user!.marketId },
          include: { items: true },
        });
        if (!current) throw Object.assign(new Error("Pedido não encontrado."), { statusCode: 404 });
        if (!allowedTransitions[current.status]?.includes(status)) {
          throw Object.assign(new Error(`Transição de ${current.status} para ${status} não permitida.`), { statusCode: 409 });
        }
        if (status === "OUT_FOR_DELIVERY" && current.deliveryType !== "DELIVERY") {
          throw Object.assign(new Error("Pedidos para retirada não podem sair para entrega."), { statusCode: 409 });
        }

        const transition = await tx.onlineOrder.updateMany({
          where: { id: current.id, marketId: req.user!.marketId, status: current.status },
          data: { status: status as typeof current.status },
        });
        if (transition.count !== 1) {
          throw Object.assign(new Error("O pedido foi alterado por outra operação. Atualize e tente novamente."), { statusCode: 409 });
        }

        if (status === "DELIVERED") {
          for (const item of current.items) {
            if (!item.productId) {
              throw Object.assign(new Error(`O item "${item.productName}" não está vinculado a um produto do estoque.`), { statusCode: 409 });
            }
            const product = await tx.product.findFirst({
              where: { id: item.productId, marketId: req.user!.marketId, isActive: true },
            });
            if (!product) throw Object.assign(new Error("Produto do pedido não encontrado nesta empresa."), { statusCode: 409 });
            const updated = await tx.product.updateMany({
              where: {
                id: product.id,
                marketId: req.user!.marketId,
                isActive: true,
                ...(product.allowBackorder ? {} : { stock: { gte: item.quantity } }),
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count !== 1) {
              throw Object.assign(new Error(`Estoque insuficiente para "${product.name}".`), { statusCode: 409 });
            }
          }
        }

        return tx.onlineOrder.findFirst({
          where: { id: current.id, marketId: req.user!.marketId },
          include: { items: true },
        });
      });
      return res.json({ order });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode) return res.status(statusCode).json({ message: (error as Error).message });
      console.error(error);
      return res.status(500).json({ message: "Erro ao atualizar o pedido." });
    }
  }
);
