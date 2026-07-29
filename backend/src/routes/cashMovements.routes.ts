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

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
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

    const movement = await prisma.cashMovement.create({
      data: {
        marketId: req.user.marketId,
        userId: req.user.userId,
        type: normalizedType,
        amount: parsedAmount,
        note: note ? String(note).trim() : null,
        cashSessionId: activeSession.id,
      },
    });

    return res.status(201).json({
      movement,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao registrar movimento de caixa.",
    });
  }
});
