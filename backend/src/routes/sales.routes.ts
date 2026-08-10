import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";
import { parseMoney, roundMoney } from "../lib/money";
import { normalizePaymentMethod } from "../lib/paymentMethods";

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
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { customerName, paymentMethod, discount, items } = req.body;

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!normalizedPaymentMethod) {
      return res.status(400).json({
        message: "Forma de pagamento inválida.",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "A venda precisa ter pelo menos um item.",
      });
    }

    const normalizedItems = normalizeItems(items);

    if (normalizedItems.length === 0) {
      return res.status(400).json({
        message: "Itens inválidos.",
      });
    }

    const parsedDiscount = parseMoney(discount || 0);

    if (parsedDiscount === null) {
      return res.status(400).json({
        message: "Desconto inválido.",
      });
    }

    const sale = await prisma.$transaction(async (tx) => {
      const paymentSetting = await tx.paymentSetting.findUnique({
        where: {
          marketId_type: {
            marketId: req.user!.marketId,
            type: normalizedPaymentMethod,
          },
        },
      });
      if (paymentSetting?.isEnabled === false) {
        throw new HttpError(400, "Esta forma de pagamento está desativada.");
      }

      const activeSession = await tx.cashSession.findFirst({
        where: {
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

        if (!product.isActive) {
          throw new HttpError(400, `O produto "${product.name}" está inativo.`);
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

        subtotal = roundMoney(subtotal + roundMoney(product.salePrice * item.quantity));
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
            unitPrice: roundMoney(product.salePrice),
            total: roundMoney(product.salePrice * item.quantity),
          },
        });

        const updatedStock = await tx.product.updateMany({
          where: {
            id: product.id,
            marketId: req.user!.marketId,
            isActive: true,
            ...(product.allowBackorder ? {} : { stock: { gte: item.quantity } }),
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
        if (updatedStock.count !== 1) {
          throw new HttpError(409, `O estoque de "${product.name}" mudou. Tente novamente.`);
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

    return res.status(500).json({
      message: "Erro ao finalizar venda.",
    });
  }
});

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
