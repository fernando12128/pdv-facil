import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
  requireRoles,
} from "../middlewares/authMiddleware";
import { parseMoney } from "../lib/money";

export const productsRoutes = Router();

productsRoutes.use(authMiddleware);

productsRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const products = await prisma.product.findMany({
      where: {
        marketId: req.user.marketId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      products,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao listar produtos.",
    });
  }
});

productsRoutes.post(
  "/",
  requireRoles("OWNER", "MANAGER", "STOCK"),
  async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const {
      name,
      sku,
      barcode,
      category,
      brand,

      isActive,

      salePrice,
      cost,
      useSameOnlinePrice,
      onlinePrice,

      stock,
      minStock,
      allowBackorder,

      isVisibleOnline,
      description,
      imageUrl,
      isFeatured,
      allowPickup,
      allowDelivery,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: "Nome do produto é obrigatório.",
      });
    }

    const parsedSalePrice = parseMoney(salePrice);
    const parsedCost = parseMoney(cost || 0);
    const parsedStock = Number(stock || 0);
    const parsedMinStock = Number(minStock || 0);

    const parsedUseSameOnlinePrice =
      typeof useSameOnlinePrice === "boolean" ? useSameOnlinePrice : true;

    const parsedOnlinePrice = parsedUseSameOnlinePrice
      ? parsedSalePrice
      : parseMoney(onlinePrice || 0);

    if (parsedSalePrice === null) {
      return res.status(400).json({
        message: "Preço de venda inválido.",
      });
    }

    if (parsedCost === null) {
      return res.status(400).json({
        message: "Custo inválido.",
      });
    }

    if (parsedOnlinePrice === null) {
      return res.status(400).json({
        message: "Preço online inválido.",
      });
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        message: "Estoque inválido.",
      });
    }

    if (!Number.isInteger(parsedMinStock) || parsedMinStock < 0) {
      return res.status(400).json({
        message: "Estoque mínimo inválido.",
      });
    }

    const product = await prisma.product.create({
      data: {
        marketId: req.user.marketId,

        name: String(name).trim(),
        sku: sku ? String(sku).trim() : null,
        barcode: barcode ? String(barcode).trim() : null,
        category: category ? String(category).trim() : null,
        brand: brand ? String(brand).trim() : null,

        isActive: typeof isActive === "boolean" ? isActive : true,

        salePrice: parsedSalePrice,
        cost: parsedCost,
        useSameOnlinePrice: parsedUseSameOnlinePrice,
        onlinePrice: parsedOnlinePrice,

        stock: parsedStock,
        minStock: parsedMinStock,
        allowBackorder:
          typeof allowBackorder === "boolean" ? allowBackorder : false,

        isVisibleOnline:
          typeof isVisibleOnline === "boolean" ? isVisibleOnline : false,
        description: description ? String(description).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        isFeatured: typeof isFeatured === "boolean" ? isFeatured : false,
        allowPickup: typeof allowPickup === "boolean" ? allowPickup : true,
        allowDelivery:
          typeof allowDelivery === "boolean" ? allowDelivery : true,
      },
    });

    return res.status(201).json({
      product,
    });
  } catch (error) {
    console.error(error);

    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        message: "Já existe um produto com este SKU ou código de barras.",
      });
    }

    return res.status(500).json({
      message: "Erro ao cadastrar produto.",
    });
  }
  }
);

productsRoutes.put(
  "/:id",
  requireRoles("OWNER", "MANAGER", "STOCK"),
  async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { id } = req.params;

    const {
      name,
      sku,
      barcode,
      category,
      brand,

      isActive,

      salePrice,
      cost,
      useSameOnlinePrice,
      onlinePrice,

      stock,
      minStock,
      allowBackorder,

      isVisibleOnline,
      description,
      imageUrl,
      isFeatured,
      allowPickup,
      allowDelivery,
    } = req.body;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        marketId: req.user.marketId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        message: "Produto não encontrado.",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        message: "Nome do produto é obrigatório.",
      });
    }

    const parsedSalePrice = parseMoney(salePrice);
    const parsedCost = parseMoney(cost || 0);
    const parsedStock = Number(stock || 0);
    const parsedMinStock = Number(minStock || 0);

    const parsedUseSameOnlinePrice =
      typeof useSameOnlinePrice === "boolean" ? useSameOnlinePrice : true;

    const parsedOnlinePrice = parsedUseSameOnlinePrice
      ? parsedSalePrice
      : parseMoney(onlinePrice || 0);

    if (parsedSalePrice === null) {
      return res.status(400).json({
        message: "Preço de venda inválido.",
      });
    }

    if (parsedCost === null) {
      return res.status(400).json({
        message: "Custo inválido.",
      });
    }

    if (parsedOnlinePrice === null) {
      return res.status(400).json({
        message: "Preço online inválido.",
      });
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        message: "Estoque inválido.",
      });
    }

    if (!Number.isInteger(parsedMinStock) || parsedMinStock < 0) {
      return res.status(400).json({
        message: "Estoque mínimo inválido.",
      });
    }

    const product = await prisma.product.update({
      where: {
        id,
      },
      data: {
        name: String(name).trim(),
        sku: sku ? String(sku).trim() : null,
        barcode: barcode ? String(barcode).trim() : null,
        category: category ? String(category).trim() : null,
        brand: brand ? String(brand).trim() : null,

        isActive: typeof isActive === "boolean" ? isActive : true,

        salePrice: parsedSalePrice,
        cost: parsedCost,
        useSameOnlinePrice: parsedUseSameOnlinePrice,
        onlinePrice: parsedOnlinePrice,

        stock: parsedStock,
        minStock: parsedMinStock,
        allowBackorder:
          typeof allowBackorder === "boolean" ? allowBackorder : false,

        isVisibleOnline:
          typeof isVisibleOnline === "boolean" ? isVisibleOnline : false,
        description: description ? String(description).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        isFeatured: typeof isFeatured === "boolean" ? isFeatured : false,
        allowPickup: typeof allowPickup === "boolean" ? allowPickup : true,
        allowDelivery:
          typeof allowDelivery === "boolean" ? allowDelivery : true,
      },
    });

    return res.json({
      product,
    });
  } catch (error) {
    console.error(error);

    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        message: "Já existe um produto com este SKU ou código de barras.",
      });
    }

    return res.status(500).json({
      message: "Erro ao editar produto.",
    });
  }
  }
);

productsRoutes.delete(
  "/:id",
  requireRoles("OWNER", "MANAGER", "STOCK"),
  async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Não autenticado.",
      });
    }

    const { id } = req.params;

    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        marketId: req.user.marketId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({
        message: "Produto não encontrado.",
      });
    }

    await prisma.product.delete({
      where: {
        id,
      },
    });

    return res.json({
      message: "Produto excluído com sucesso.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message:
        "Erro ao excluir produto. Se este produto já tiver vendas, tente desativá-lo em vez de excluir.",
    });
  }
  }
);

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
  );
}
