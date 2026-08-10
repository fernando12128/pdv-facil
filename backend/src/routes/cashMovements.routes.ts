import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";
import { parseMoney, roundMoney } from "../lib/money";
import { isCashPayment } from "../lib/paymentMethods";

export const cashMovementsRoutes = Router();

cashMovementsRoutes.use(authMiddleware);

const movementTypes = ["SUPPLY", "WITHDRAWAL"] as const;

type CashMovementTypeInput = (typeof movementTypes)[number];

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
    const parsedAmount = parseMoney(amount, { allowZero: false });

    if (!movementTypes.includes(normalizedType)) {
      return res.status(400).json({
        message: "Tipo de movimento inválido.",
      });
    }

    if (parsedAmount === null) {
      return res.status(400).json({
        message: "Informe um valor maior que zero.",
      });
    }

    const activeSession = await prisma.cashSession.findFirst({
      where: {
        id: cashSessionId ? String(cashSessionId) : undefined,
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
      const freshSession = await tx.cashSession.findFirst({
        where: {
          id: activeSession.id,
          marketId: req.user!.marketId,
          status: "OPEN",
        },
        include: { movements: true, sales: true },
      });

      if (!freshSession) {
        throw new MovementError(409, "O caixa não está mais aberto.");
      }

      if (normalizedType === "WITHDRAWAL") {
        const cashSales = freshSession.sales
          .filter((sale) => sale.status === "COMPLETED" && isCashPayment(sale.paymentMethod))
          .reduce((sum, sale) => sum + sale.total, 0);
        const supplies = freshSession.movements
          .filter((item) => item.type === "SUPPLY")
          .reduce((sum, item) => sum + item.amount, 0);
        const withdrawals = freshSession.movements
          .filter((item) => item.type === "WITHDRAWAL")
          .reduce((sum, item) => sum + item.amount, 0);
        const available = roundMoney(
          freshSession.openingAmount + cashSales + supplies - withdrawals
        );

        if (parsedAmount > available) {
          throw new MovementError(
            400,
            `A sangria não pode exceder o saldo disponível de R$ ${available.toFixed(2)}.`
          );
        }
      }

      const locked = await tx.cashSession.updateMany({
        where: { id: freshSession.id, status: "OPEN", revision: freshSession.revision },
        data: { revision: { increment: 1 } },
      });
      if (locked.count !== 1) {
        throw new MovementError(409, "O caixa mudou. Tente registrar o movimento novamente.");
      }

      return tx.cashMovement.create({
        data: {
          marketId: req.user!.marketId,
          userId: req.user!.userId,
          type: normalizedType,
          amount: parsedAmount,
          note: note ? String(note).trim() : null,
          cashSessionId: freshSession.id,
        },
      });
    });

    return res.status(201).json({
      movement,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof MovementError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Erro ao registrar movimento de caixa.",
    });
  }
});

class MovementError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
