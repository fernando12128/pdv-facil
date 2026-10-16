import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const cashMovementsRoutes = Router();

cashMovementsRoutes.use(authMiddleware);

const movementTypes = ["SUPPLY", "WITHDRAWAL"] as const;

type CashMovementTypeInput = (typeof movementTypes)[number];

class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

cashMovementsRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const movements = await prisma.cashMovement.findMany({
      where: {
        marketId: req.user.marketId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return res.json({
      movements,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao listar movimentos de caixa.",
    });
  }
});

cashMovementsRoutes.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { type, amount, note, cashSessionId } = req.body;
    const normalizedType = String(type || "").trim() as CashMovementTypeInput;
    const parsedAmount = Number(amount);

    if (!movementTypes.includes(normalizedType)) {
      return res.status(400).json({
        message: "Tipo de movimento inválido.",
      });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Math.round(parsedAmount * 100) !== parsedAmount * 100) {
      return res.status(400).json({
        message: "Informe um valor maior que zero.",
      });
    }

    if (!cashSessionId || typeof cashSessionId !== "string") {
      return res.status(400).json({ message: "Informe o caixa aberto do movimento." });
    }

    const activeSession = await prisma.cashSession.findFirst({
      where: {
        id: cashSessionId,
        marketId: req.user.marketId,
        status: "OPEN",
      },
      orderBy: {
        openedAt: "desc",
      },
    });

    if (!activeSession) {
      return res.status(400).json({
        message: "Abra o caixa antes de registrar movimentos.",
      });
    }

    const movement = await prisma.$transaction(async (tx) => {
      if (normalizedType === "WITHDRAWAL") {
        const [cashSales, supplies, withdrawals] = await Promise.all([
          tx.productSale.aggregate({
            where: { marketId: req.user!.marketId, cashSessionId: activeSession.id, status: "COMPLETED", paymentMethod: { in: ["CASH", "Dinheiro"] } },
            _sum: { total: true },
          }),
          tx.cashMovement.aggregate({
            where: { marketId: req.user!.marketId, cashSessionId: activeSession.id, type: "SUPPLY" },
            _sum: { amount: true },
          }),
          tx.cashMovement.aggregate({
            where: { marketId: req.user!.marketId, cashSessionId: activeSession.id, type: "WITHDRAWAL" },
            _sum: { amount: true },
          }),
        ]);
        const available = Math.round((activeSession.openingAmount + (cashSales._sum.total || 0) + (supplies._sum.amount || 0) - (withdrawals._sum.amount || 0)) * 100) / 100;
        if (parsedAmount > available) throw new HttpError(400, "A sangria não pode superar o dinheiro disponível no caixa.");
      }
      return tx.cashMovement.create({
        data: {
          marketId: req.user!.marketId,
          userId: req.user!.userId,
          type: normalizedType,
          amount: Math.round(parsedAmount * 100) / 100,
          note: note ? String(note).trim() : null,
          cashSessionId: activeSession.id,
        },
      });
    });

    return res.status(201).json({
      movement,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Erro ao registrar movimento de caixa.",
    });
  }
});
