import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const reportsRoutes = Router();

reportsRoutes.use(authMiddleware);

reportsRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  const range = String(req.query.range || "7");
  const days = range === "30" ? 30 : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const sales = await prisma.productSale.findMany({
    where: {
      marketId: req.user!.marketId,
      status: "COMPLETED",
      createdAt: { gte: start },
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, { sales: number; total: number }>();
  const byPayment = new Map<string, { count: number; total: number }>();
  const products = new Map<string, { quantity: number; total: number }>();

  for (const sale of sales) {
    const day = sale.createdAt.toISOString().slice(0, 10);
    const currentDay = byDay.get(day) || { sales: 0, total: 0 };
    currentDay.sales += 1;
    currentDay.total += sale.total;
    byDay.set(day, currentDay);

    const payment = byPayment.get(sale.paymentMethod) || {
      count: 0,
      total: 0,
    };
    payment.count += 1;
    payment.total += sale.total;
    byPayment.set(sale.paymentMethod, payment);

    for (const item of sale.items) {
      const product = products.get(item.productName) || {
        quantity: 0,
        total: 0,
      };
      product.quantity += item.quantity;
      product.total += item.total;
      products.set(item.productName, product);
    }
  }

  return res.json({
    daily: Array.from(byDay, ([date, value]) => ({ date, ...value })),
    payments: Array.from(byPayment, ([name, value]) => ({ name, ...value })),
    products: Array.from(products, ([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
  });
});
