import { Router } from "express";
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

    const sale = await prisma.$transaction(async (tx) => {
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

        if (item.quantity <= 0) {
          throw new HttpError(400, "Quantidade inválida.");
        }

        if (!product.allowBackorder && product.stock < item.quantity) {
          throw new HttpError(
            400,
            `Estoque insuficiente para o produto "${product.name}".`
          );
        }

        subtotal += product.salePrice * item.quantity;
      }

      const total = Math.max(subtotal - parsedDiscount, 0);

      const createdSale = await tx.productSale.create({
        data: {
          marketId: req.user!.marketId,
          userId: req.user!.userId,
          customerName: customerName ? String(customerName).trim() : null,
          paymentMethod: String(paymentMethod),
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
            total: product.salePrice * item.quantity,
          },
        });

        await tx.product.update({
          where: {
            id: product.id,
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
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
