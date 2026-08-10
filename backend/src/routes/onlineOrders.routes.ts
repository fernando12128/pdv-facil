import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
  requireRoles,
} from "../middlewares/authMiddleware";

export const onlineOrdersRoutes = Router();

onlineOrdersRoutes.use(authMiddleware);

onlineOrdersRoutes.get("/", requireRoles("OWNER", "MANAGER"), async (req: AuthenticatedRequest, res) => {
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
  requireRoles("OWNER", "MANAGER"),
  async (req: AuthenticatedRequest, res) => {
    const status = String(req.body.status || "").toUpperCase();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    const current = await prisma.onlineOrder.findFirst({
      where: { id: req.params.id, marketId: req.user!.marketId },
      include: { items: true },
    });
    if (!current) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    if (status === current.status) {
      return res.json({ order: current });
    }

    if (!allowedTransitions[current.status]?.includes(status)) {
      return res.status(409).json({
        message: `Não é possível alterar o pedido de ${current.status} para ${status}.`,
      });
    }

    try {
      const order = await prisma.$transaction(async (tx) => {
        const changed = await tx.onlineOrder.updateMany({
          where: {
            id: current.id,
            marketId: req.user!.marketId,
            status: current.status,
          },
          data: { status: status as typeof current.status },
        });
        if (changed.count !== 1) {
          throw new OrderError(409, "O pedido foi alterado em outro dispositivo.");
        }

        if (status === "DELIVERED") {
          for (const item of current.items) {
            const candidates = item.productId
              ? await tx.product.findMany({
                  where: { id: item.productId, marketId: req.user!.marketId },
                })
              : await tx.product.findMany({
                  where: {
                    marketId: req.user!.marketId,
                    name: item.productName,
                  },
                });

            if (candidates.length !== 1) {
              throw new OrderError(
                409,
                `Não foi possível identificar o produto "${item.productName}" no estoque.`
              );
            }

            const product = candidates[0]!;
            const updated = await tx.product.updateMany({
              where: {
                id: product.id,
                marketId: req.user!.marketId,
                ...(product.allowBackorder ? {} : { stock: { gte: item.quantity } }),
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (updated.count !== 1) {
              throw new OrderError(
                409,
                `Estoque insuficiente para o produto "${product.name}".`
              );
            }

            if (!item.productId) {
              await tx.onlineOrderItem.update({
                where: { id: item.id },
                data: { productId: product.id },
              });
            }
          }
        }

        return tx.onlineOrder.findUnique({
          where: { id: current.id },
          include: { items: true },
        });
      });

      return res.json({ order });
    } catch (error) {
      if (error instanceof OrderError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error(error);
      return res.status(500).json({ message: "Não foi possível atualizar o pedido." });
    }
  }
);

class OrderError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
