import { randomBytes } from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const cashSessionsRoutes = Router();

cashSessionsRoutes.use(authMiddleware);

type ConfirmedPayments = Record<string, number>;
type PaymentLine = {
  method: string;
  sales: number;
  expected: number;
  confirmed: number | null;
  difference: number | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isCashPayment(method: string) {
  const normalized = method.trim().toLowerCase();
  return normalized === "dinheiro" || normalized === "cash";
}

function closingCode() {
  return `FC-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function parseConfirmedPayments(value: unknown): ConfirmedPayments {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([method, amount]) => {
      const parsed = Number(amount);
      return Number.isFinite(parsed) && parsed >= 0
        ? [[method, roundMoney(parsed)]]
        : [];
    })
  );
}

function parseCountHistory(value: unknown, closingAmount: number) {
  if (!Array.isArray(value)) return [closingAmount];
  const entries = value
    .map(Number)
    .filter((amount) => Number.isFinite(amount) && amount >= 0)
    .map(roundMoney);

  return entries.length ? entries : [closingAmount];
}

async function getSessionDetails(sessionId: string, marketId: string) {
  const session = await prisma.cashSession.findFirst({
    where: { id: sessionId, marketId },
    include: {
      movements: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return null;

  const sales = await prisma.productSale.findMany({
    where: {
      marketId,
      OR: [
        { cashSessionId: session.id },
        {
          cashSessionId: null,
          createdAt: {
            gte: session.openedAt,
            lte: session.closedAt || new Date(),
          },
        },
      ],
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const completedSales = sales.filter(
    (sale) => sale.status === "COMPLETED"
  );
  const cancelledSales = sales.filter(
    (sale) => sale.status === "CANCELLED"
  );
  const grossSales = roundMoney(
    completedSales.reduce((sum, sale) => sum + sale.subtotal, 0)
  );
  const discounts = roundMoney(
    completedSales.reduce((sum, sale) => sum + sale.discount, 0)
  );
  const netSales = roundMoney(
    completedSales.reduce((sum, sale) => sum + sale.total, 0)
  );
  const cancelledTotal = roundMoney(
    cancelledSales.reduce((sum, sale) => sum + sale.total, 0)
  );
  const itemCount = completedSales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const supplies = roundMoney(
    session.movements
      .filter((movement) => movement.type === "SUPPLY")
      .reduce((sum, movement) => sum + movement.amount, 0)
  );
  const withdrawals = roundMoney(
    session.movements
      .filter((movement) => movement.type === "WITHDRAWAL")
      .reduce((sum, movement) => sum + movement.amount, 0)
  );

  const paymentMap = new Map<string, { sales: number; expected: number }>();
  for (const sale of completedSales) {
    const current = paymentMap.get(sale.paymentMethod) || {
      sales: 0,
      expected: 0,
    };
    current.sales += 1;
    current.expected = roundMoney(current.expected + sale.total);
    paymentMap.set(sale.paymentMethod, current);
  }

  const cashEntry = Array.from(paymentMap.entries()).find(([method]) =>
    isCashPayment(method)
  );
  const cashSales = cashEntry?.[1].expected || 0;
  const expectedCash = roundMoney(
    session.openingAmount + cashSales + supplies - withdrawals
  );

  if (cashEntry) {
    cashEntry[1].expected = expectedCash;
  } else {
    paymentMap.set("Dinheiro", { sales: 0, expected: expectedCash });
  }

  const persistedSummary: PaymentLine[] | null = Array.isArray(
    session.paymentSummary
  )
    ? (session.paymentSummary as unknown as PaymentLine[])
    : null;

  return {
    ...session,
    sales,
    summary: {
      saleCount: completedSales.length,
      itemCount,
      grossSales,
      discounts,
      cancelledSales: cancelledSales.length,
      cancelledTotal,
      refundedSales: 0,
      refundedTotal: 0,
      netSales,
      averageTicket: completedSales.length
        ? roundMoney(netSales / completedSales.length)
        : 0,
      supplies,
      withdrawals,
      cashSales,
      expectedCash,
      paymentMethods: persistedSummary ||
        Array.from(paymentMap.entries()).map(([method, value]) => ({
          method,
          sales: value.sales,
          expected: value.expected,
          confirmed: null,
          difference: null,
        })),
    },
  };
}

cashSessionsRoutes.get("/current", async (req: AuthenticatedRequest, res) => {
  const session = await prisma.cashSession.findFirst({
    where: { marketId: req.user!.marketId, status: "OPEN" },
    include: { movements: { orderBy: { createdAt: "desc" } } },
    orderBy: { openedAt: "desc" },
  });
  return res.json({ session });
});

cashSessionsRoutes.get("/history", async (req: AuthenticatedRequest, res) => {
  const sessions = await prisma.cashSession.findMany({
    where: { marketId: req.user!.marketId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 50,
  });
  return res.json({ sessions });
});

cashSessionsRoutes.get(
  "/:id/summary",
  async (req: AuthenticatedRequest, res) => {
    const session = await getSessionDetails(
      String(req.params.id),
      req.user!.marketId
    );
    if (!session) {
      return res.status(404).json({ message: "Fechamento não encontrado." });
    }
    return res.json({ session });
  }
);

cashSessionsRoutes.get(
  "/:id/preview",
  async (req: AuthenticatedRequest, res) => {
    const session = await getSessionDetails(
      String(req.params.id),
      req.user!.marketId
    );
    if (!session || session.status !== "OPEN") {
      return res.status(404).json({ message: "Caixa aberto não encontrado." });
    }
    return res.json({ session });
  }
);

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
      openingAmount: roundMoney(openingAmount),
    },
  });
  return res.status(201).json({ session });
});

cashSessionsRoutes.post(
  "/:id/close",
  async (req: AuthenticatedRequest, res) => {
    const details = await getSessionDetails(
      String(req.params.id),
      req.user!.marketId
    );
    if (!details || details.status !== "OPEN") {
      return res.status(404).json({ message: "Caixa aberto não encontrado." });
    }

    const closingAmount = Number(req.body.closingAmount);
    if (Number.isNaN(closingAmount) || closingAmount < 0) {
      return res.status(400).json({ message: "Valor final inválido." });
    }

    const confirmedPayments = parseConfirmedPayments(
      req.body.confirmedPayments
    );
    const paymentSummary = details.summary.paymentMethods.map((payment) => {
      const confirmed = isCashPayment(payment.method)
        ? roundMoney(closingAmount)
        : confirmedPayments[payment.method];

      if (confirmed === undefined) {
        return { ...payment, confirmed: null, difference: null };
      }

      return {
        ...payment,
        confirmed,
        difference: roundMoney(confirmed - payment.expected),
      };
    });

    const notConfirmed = paymentSummary.find(
      (payment) => payment.confirmed === null
    );
    if (notConfirmed) {
      return res.status(400).json({
        message: `Confira a forma de pagamento ${notConfirmed.method} antes de fechar.`,
      });
    }

    const hasDivergence = paymentSummary.some(
      (payment) => Math.abs(payment.difference || 0) >= 0.01
    );
    const discrepancyReason = req.body.discrepancyReason
      ? String(req.body.discrepancyReason).trim()
      : "";
    if (hasDivergence && !discrepancyReason) {
      return res.status(400).json({
        message: "Justifique as divergências antes de concluir o fechamento.",
      });
    }

    const totalDifference = roundMoney(
      paymentSummary.reduce(
        (sum, payment) => sum + (payment.difference || 0),
        0
      )
    );
    const status = hasDivergence
      ? "Fechado com divergência justificada"
      : "Fechado sem divergências";
    const code = closingCode();
    const closedAt = new Date();

    const closedSession = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashSession.updateMany({
        where: {
          id: details.id,
          marketId: req.user!.marketId,
          status: "OPEN",
        },
        data: {
          status: "CLOSED",
          closingAmount: roundMoney(closingAmount),
          expectedCash: details.summary.expectedCash,
          difference: totalDifference,
          closingCode: code,
          closingStatus: status,
          grossSales: details.summary.grossSales,
          discounts: details.summary.discounts,
          netSales: details.summary.netSales,
          discrepancyReason: discrepancyReason || null,
          discrepancyNote: req.body.discrepancyNote
            ? String(req.body.discrepancyNote).trim()
            : null,
          actionTaken: req.body.actionTaken
            ? String(req.body.actionTaken).trim()
            : null,
          finalNote: req.body.finalNote
            ? String(req.body.finalNote).trim()
            : null,
          countHistory: parseCountHistory(
            req.body.countHistory,
            roundMoney(closingAmount)
          ),
          paymentSummary,
          closedAt,
        },
      });

      if (updated.count !== 1) {
        throw new Error("CASH_SESSION_ALREADY_CLOSED");
      }

      return tx.cashSession.findUnique({
        where: { id: details.id },
      });
    });

    return res.json({ session: closedSession });
  }
);
