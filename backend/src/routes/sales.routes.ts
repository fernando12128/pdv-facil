import { Router } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const salesRoutes = Router();

salesRoutes.use(authMiddleware);

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type SaleItemInput = {
  productId: string;
  quantity: number;
};

salesRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const sales = await prisma.productSale.findMany({
      where: {
        marketId: req.user.marketId,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      sales,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao listar vendas.",
    });
  }
});

salesRoutes.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { id } = req.params;

    const sale = await prisma.productSale.findFirst({
      where: {
        id,
        marketId: req.user.marketId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return res.status(404).json({
        message: "Venda não encontrada.",
      });
    }

    return res.json({
      sale,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao buscar venda.",
    });
  }
});

salesRoutes.post("/", async (req: AuthenticatedRequest, res) => {
  let idempotencyKey = "";
  let idempotencyHash = "";
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { customerName, paymentMethod, discount, items } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        message: "Forma de pagamento é obrigatória.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "A venda precisa ter pelo menos um item.",
      });
    }

    const hasInvalidItem = items.some((item) => {
      const productId = String(item?.productId || "").trim();
      const quantity = Number(item?.quantity);
      return !productId || !Number.isSafeInteger(quantity) || quantity <= 0;
    });
    if (hasInvalidItem) {
      throw new HttpError(400, "Cada item precisa ter um produto e uma quantidade inteira positiva.");
    }

    const normalizedItems = normalizeItems(items);

    if (normalizedItems.length === 0) {
      return res.status(400).json({
        message: "Itens inválidos.",
      });
    }

    const parsedDiscount = Number(discount || 0);

    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0) {
      return res.status(400).json({
        message: "Desconto inválido.",
      });
    }

    if (!Number.isFinite(parsedDiscount) || Math.round(parsedDiscount * 100) !== parsedDiscount * 100) {
      throw new HttpError(400, "O desconto deve ter no máximo duas casas decimais.");
    }

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!normalizedPaymentMethod) {
      throw new HttpError(400, "Forma de pagamento inválida.");
    }

    const cashSessionId = String(req.body.cashSessionId || "").trim();
    if (!cashSessionId) {
      throw new HttpError(400, "Informe o caixa aberto que receberá a venda.");
    }

    idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim();
    if (!idempotencyKey) {
      throw new HttpError(400, "Chave de repetição da venda obrigatória.");
    }
    if (idempotencyKey && (idempotencyKey.length > 128 || !/^[\w:.-]+$/.test(idempotencyKey))) {
      throw new HttpError(400, "Chave de repetição inválida.");
    }
    idempotencyHash = createHash("sha256").update(JSON.stringify({
      customerName: customerName ? String(customerName).trim() : null,
      paymentMethod: normalizedPaymentMethod,
      discount: Math.round(parsedDiscount * 100),
      cashSessionId,
      items: normalizedItems,
    })).digest("hex");

    if (idempotencyKey) {
      const previous = await prisma.productSale.findFirst({
        where: { marketId: req.user?.marketId, idempotencyKey },
        include: { items: true },
      });
      if (previous) {
        if (previous.idempotencyHash !== idempotencyHash) {
          throw new HttpError(409, "A chave de repetição já foi usada em outra venda.");
        }
        return res.status(200).json({ sale: previous });
      }
    }

    const paymentSettings = await prisma.paymentSetting.findMany({
      where: { marketId: req.user.marketId },
      select: { type: true, isEnabled: true },
    });
    const cashSetting = paymentSettings.find(({ type }) => normalizePaymentMethod(type) === "CASH");
    const enabledPayments = [
      ...(!cashSetting || cashSetting.isEnabled ? ["CASH"] : []),
      ...paymentSettings.filter(({ isEnabled }) => isEnabled)
        .map(({ type }) => normalizePaymentMethod(type)).filter(Boolean),
    ];
    if (!enabledPayments.includes(normalizedPaymentMethod)) {
      throw new HttpError(400, "Esta forma de pagamento está desativada para a empresa.");
    }

    const sale = await prisma.$transaction(async (tx) => {
      const activeSession = await tx.cashSession.findFirst({
        where: {
          id: cashSessionId,
          marketId: req.user!.marketId,
          status: "OPEN",
        },
        orderBy: { openedAt: "desc" },
      });

      if (!activeSession) {
        throw new HttpError(400, "Abra o caixa antes de finalizar uma venda.");
      }

      const productIds = normalizedItems.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: {
          marketId: req.user!.marketId,
          id: {
            in: productIds,
          },
        },
      });

      if (products.length !== productIds.length) {
        throw new HttpError(404, "Um ou mais produtos não foram encontrados.");
      }

      const productsMap = new Map(
        products.map((product) => [product.id, product])
      );

      let subtotal = 0;

      for (const item of normalizedItems) {
        const product = productsMap.get(item.productId);

        if (!product) {
          throw new HttpError(404, "Produto não encontrado.");
        }

        if (!Number.isFinite(product.salePrice) || Math.round(product.salePrice * 100) !== product.salePrice * 100) {
          throw new HttpError(400, `O preço do produto "${product.name}" precisa ter no máximo duas casas decimais.`);
        }

        if (item.quantity <= 0) {
          throw new HttpError(400, "Quantidade inválida.");
        }

        if (!product.allowBackorder && product.stock < item.quantity) {
          throw new HttpError(
            400,
            `Estoque insuficiente para o produto "${product.name}".`
          );
        }

        subtotal = roundMoney(subtotal + product.salePrice * item.quantity);
      }

      if (parsedDiscount > subtotal) {
        throw new HttpError(
          400,
          "O desconto não pode ser maior que o subtotal da venda."
        );
      }

      const total = roundMoney(subtotal - parsedDiscount);

      if (total <= 0) {
        throw new HttpError(
          400,
          "Não é possível concluir uma venda com valor zerado."
        );
      }

      const createdSale = await tx.productSale.create({
        data: {
          marketId: req.user!.marketId,
          userId: req.user!.userId,
          cashSessionId: activeSession.id,
          customerName: customerName ? String(customerName).trim() : null,
          paymentMethod: normalizedPaymentMethod,
          idempotencyKey,
          idempotencyHash,
          discount: parsedDiscount,
          subtotal,
          total,
        },
      });

      for (const item of normalizedItems) {
        const product = productsMap.get(item.productId);

        if (!product) {
          throw new HttpError(404, "Produto não encontrado.");
        }

        await tx.saleItem.create({
          data: {
            saleId: createdSale.id,
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.salePrice,
            total: roundMoney(product.salePrice * item.quantity),
          },
        });

        const stockUpdate = await tx.product.updateMany({
          where: {
            id: product.id,
            marketId: req.user!.marketId,
            isActive: true,
            ...(product.allowBackorder ? {} : { stock: { gte: item.quantity } }),
          },
          data: { stock: { decrement: item.quantity } },
        });
        if (stockUpdate.count !== 1) {
          throw new HttpError(400, `Estoque insuficiente para o produto "${product.name}".`);
        }
      }

      const saleWithItems = await tx.productSale.findUnique({
        where: {
          id: createdSale.id,
        },
        include: {
          items: true,
        },
      });

      return saleWithItems;
    });

    return res.status(201).json({
      sale,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    if ((error as { code?: string }).code === "P2002" && idempotencyKey) {
      const previous = await prisma.productSale.findFirst({
        where: { marketId: req.user?.marketId, idempotencyKey },
        include: { items: true },
      });
      if (previous?.idempotencyHash === idempotencyHash) {
        return res.status(200).json({ sale: previous });
      }
      return res.status(409).json({ message: "A chave de repetição já foi usada em outra venda." });
    }

    return res.status(500).json({
      message: "Erro ao finalizar venda.",
    });
  }
});

salesRoutes.patch("/:id/cancel", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Não autenticado." });
  const reason = String(req.body.reason || "").trim();
  if (!reason || reason.length > 500) {
    return res.status(400).json({ message: "Informe o motivo do cancelamento (até 500 caracteres)." });
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const current = await tx.productSale.findFirst({
        where: { id: req.params.id, marketId: req.user!.marketId },
        include: { items: true },
      });
      if (!current) throw new HttpError(404, "Venda não encontrada.");
      if (current.status !== "COMPLETED") throw new HttpError(409, "A venda já foi cancelada.");

      const changed = await tx.productSale.updateMany({
        where: { id: current.id, marketId: req.user!.marketId, status: "COMPLETED" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason },
      });
      if (changed.count !== 1) throw new HttpError(409, "A venda já foi cancelada.");

      for (const item of current.items) {
        await tx.product.updateMany({
          where: { id: item.productId, marketId: req.user!.marketId },
          data: { stock: { increment: item.quantity } },
        });
      }
      return tx.productSale.findFirst({
        where: { id: current.id, marketId: req.user!.marketId },
        include: { items: true },
      });
    });
    return res.json({ sale });
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: "Erro ao cancelar venda." });
  }
});

function normalizePaymentMethod(value: unknown): string | null {
  const normalized = String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const aliases: Record<string, string> = {
    CASH: "CASH", DINHEIRO: "CASH", PIX: "PIX", CREDIT: "CREDIT",
    CREDITO: "CREDIT", "CARTAO DE CREDITO": "CREDIT", DEBIT: "DEBIT",
    DEBITO: "DEBIT", "CARTAO DE DEBITO": "DEBIT",
  };
  return aliases[normalized] || null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeItems(items: SaleItemInput[]) {
  const map = new Map<string, number>();

  for (const item of items) {
    const productId = String(item.productId || "").trim();
    const quantity = Number(item.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }

    const currentQuantity = map.get(productId) || 0;

    map.set(productId, currentQuantity + quantity);
  }

  return Array.from(map.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}
