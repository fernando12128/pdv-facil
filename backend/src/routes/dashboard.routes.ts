import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware);

dashboardRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const startOfLast7Days = new Date(startOfToday);
    startOfLast7Days.setDate(startOfLast7Days.getDate() - 6);

    const [
      revenueTodayResult,
      revenueLast7DaysResult,
      salesToday,
      productsCount,
      lowStockProducts,
      salesLast7Days,
    ] = await Promise.all([
      prisma.productSale.aggregate({
        where: {
          marketId: req.user.marketId,
          status: "COMPLETED",
          createdAt: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
        },
        _sum: {
          total: true,
        },
      }),

      prisma.productSale.aggregate({
        where: {
          marketId: req.user.marketId,
          status: "COMPLETED",
          createdAt: {
            gte: startOfLast7Days,
            lt: startOfTomorrow,
          },
        },
        _sum: {
          total: true,
        },
      }),

      prisma.productSale.count({
        where: {
          marketId: req.user.marketId,
          status: "COMPLETED",
          createdAt: {
            gte: startOfToday,
            lt: startOfTomorrow,
          },
        },
      }),

      prisma.product.count({
        where: {
          marketId: req.user.marketId,
        },
      }),

      prisma.product.findMany({
        where: {
          marketId: req.user.marketId,
        },
        select: {
          stock: true,
          minStock: true,
        },
      }),

      prisma.productSale.findMany({
        where: {
          marketId: req.user.marketId,
          status: "COMPLETED",
          createdAt: {
            gte: startOfLast7Days,
            lt: startOfTomorrow,
          },
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    const lowStockCount = lowStockProducts.filter(
      (product) => product.stock <= product.minStock
    ).length;

    const chart = buildLast7DaysChart(startOfLast7Days, salesLast7Days);

    return res.json({
      revenueToday: revenueTodayResult._sum.total || 0,
      salesToday,
      revenueLast7Days: revenueLast7DaysResult._sum.total || 0,
      productsCount,
      lowStockCount,
      chart,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao carregar dashboard.",
    });
  }
});

function buildLast7DaysChart(
  startDate: Date,
  sales: {
    id: string;
    total: number;
    createdAt: Date;
  }[]
) {
  const days = [];

  for (let index = 0; index < 7; index++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    const key = getDateKey(date);

    days.push({
      key,
      label: formatWeekday(date),
      salesCount: 0,
      revenue: 0,
    });
  }

  for (const sale of sales) {
    const key = getDateKey(sale.createdAt);

    const day = days.find((item) => item.key === key);

    if (day) {
      day.salesCount += 1;
      day.revenue += sale.total;
    }
  }

  return days.map((day) => ({
    label: day.label,
    salesCount: day.salesCount,
    revenue: day.revenue,
  }));
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}