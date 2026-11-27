import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middlewares/authMiddleware";

export const productsRoutes = Router();

function validateFiscalProduct(input: any) {
  const fields = ["ncm", "cest", "cfop", "fiscalUnit", "originCode", "taxSituation"] as const;
  for (const field of fields) {
    if (input[field] != null && typeof input[field] !== "string") return "Campos fiscais devem ser texto.";
  }
  const normalized = {
    ncm: input.ncm?.trim() || null,
    cest: input.cest?.trim() || null,
    cfop: input.cfop?.trim() || null,
    fiscalUnit: input.fiscalUnit?.trim().toUpperCase() || "UN",
    originCode: input.originCode?.trim() || "0",
    taxSituation: input.taxSituation?.trim() || null
  };
  if (normalized.ncm && !/^\d{8}$/.test(normalized.ncm)) return "NCM precisa de 8 dígitos.";
  if (normalized.cest && !/^\d{7}$/.test(normalized.cest)) return "CEST precisa de 7 dígitos.";
  if (normalized.cfop && !/^\d{4}$/.test(normalized.cfop)) return "CFOP precisa de 4 dígitos.";
  if (!/^[A-Z]{1,6}$/.test(normalized.fiscalUnit)) return "Unidade fiscal inválida.";
  if (!/^[0-8]$/.test(normalized.originCode)) return "Origem do produto inválida.";
  if (normalized.taxSituation && !/^\d{2,3}$/.test(normalized.taxSituation)) return "CST/CSOSN inválido.";
  return normalized;
}


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

productsRoutes.post("/", async (req: AuthenticatedRequest, res) => {
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

    const fiscalData = validateFiscalProduct(req.body || {});
    if (typeof fiscalData === "string") return res.status(400).json({ message: fiscalData });

    const parsedSalePrice = Number(salePrice);
    const parsedCost = Number(cost || 0);
    const parsedStock = Number(stock || 0);
    const parsedMinStock = Number(minStock || 0);

    const parsedUseSameOnlinePrice =
      typeof useSameOnlinePrice === "boolean" ? useSameOnlinePrice : true;

    const parsedOnlinePrice = parsedUseSameOnlinePrice
      ? parsedSalePrice
      : Number(onlinePrice || 0);

    if (!isMoneyValue(parsedSalePrice) || parsedSalePrice < 0) {
      return res.status(400).json({
        message: "Preço de venda inválido.",
      });
    }

    if (!isMoneyValue(parsedCost) || parsedCost < 0) {
      return res.status(400).json({
        message: "Custo inválido.",
      });
    }

    if (!isMoneyValue(parsedOnlinePrice) || parsedOnlinePrice < 0) {
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
        ...fiscalData,

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

    return res.status(500).json({
      message: "Erro ao cadastrar produto.",
    });
  }
});

productsRoutes.put("/:id", async (req: AuthenticatedRequest, res) => {
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

    const fiscalData = validateFiscalProduct(req.body || {});
    if (typeof fiscalData === "string") return res.status(400).json({ message: fiscalData });

    const parsedSalePrice = Number(salePrice);
    const parsedCost = Number(cost || 0);
    const parsedStock = Number(stock || 0);
    const parsedMinStock = Number(minStock || 0);

    const parsedUseSameOnlinePrice =
      typeof useSameOnlinePrice === "boolean" ? useSameOnlinePrice : true;

    const parsedOnlinePrice = parsedUseSameOnlinePrice
      ? parsedSalePrice
      : Number(onlinePrice || 0);

    if (!isMoneyValue(parsedSalePrice) || parsedSalePrice < 0) {
      return res.status(400).json({
        message: "Preço de venda inválido.",
      });
    }

    if (!isMoneyValue(parsedCost) || parsedCost < 0) {
      return res.status(400).json({
        message: "Custo inválido.",
      });
    }

    if (!isMoneyValue(parsedOnlinePrice) || parsedOnlinePrice < 0) {
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
        ...fiscalData,

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

    return res.status(500).json({
      message: "Erro ao editar produto.",
    });
  }
});

productsRoutes.delete("/:id", async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Não autenticado." });
  if (!["OWNER", "MANAGER"].includes(req.user.role)) {
    return res.status(403).json({ message: "Apenas administradores podem excluir produtos." });
  }

  const marketId = req.user.marketId;
  const id = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, marketId } });
      if (!product) return { status: 404, message: "Produto não encontrado." };

      // Exclusão física só é segura para produtos sem estoque e sem histórico.
      if (product.stock !== 0) {
        return { status: 409, message: "Este produto possui estoque. Ajuste-o pelo fluxo de inventário ou desative o produto para preservar o histórico." };
      }

      const [sales, orders, purchases] = await Promise.all([
        tx.saleItem.count({ where: { productId: id, sale: { marketId } } }),
        tx.onlineOrderItem.count({ where: { productId: id, order: { marketId } } }),
        tx.purchaseItem.count({ where: { productId: id, purchase: { marketId } } })
      ]);
      if (sales || orders || purchases) {
        return { status: 409, message: "Este produto já possui vendas, pedidos ou compras registradas. Para manter o histórico, utilize Desativar." };
      }

      await tx.product.delete({ where: { id } });
      return { status: 200, message: "Produto excluído com sucesso." };
    });
    return res.status(result.status).json({ message: result.message });
  } catch (error) {
    // A FK continua protegendo o histórico contra uma referência concorrente.
    if (error && typeof error === "object" && "code" in error && (error.code === "P2003" || error.code === "P2014")) {
      return res.status(409).json({ message: "Produto vinculado a movimentações. Desative-o para preservar o histórico." });
    }
    console.error(error);
    return res.status(500).json({ message: "Erro ao excluir produto." });
  }
});

function isMoneyValue(value: number) {
  return Number.isFinite(value) && Math.round(value * 100) === value * 100;
}
