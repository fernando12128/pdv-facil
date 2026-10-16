import { Router } from "express";
import { prisma } from "../lib/prisma";

export const publicRoutes = Router();

publicRoutes.get("/products", async (req, res) => {
  try {
    const marketId =
      typeof req.query.marketId === "string" ? req.query.marketId.trim() : "";
    if (!marketId) {
      return res.status(400).json({
        message: "Informe a empresa para consultar o catálogo público.",
      });
    }

    const marketExists = await prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true },
    });
    if (!marketExists) {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }

    const products = await prisma.product.findMany({
      where: {
        marketId,
        isActive: true,
        isVisibleOnline: true,
      },
      orderBy: [
        {
          isFeatured: "desc",
        },
        {
          name: "asc",
        },
      ],
    });

    const publicProducts = products.map((product) => {
      const effectivePrice = product.useSameOnlinePrice
        ? product.salePrice
        : product.onlinePrice;

      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category || "Produtos",
        categorySlug: createSlug(product.category || "Produtos"),

        description: product.description || "",

        image: product.imageUrl || "/images/produtos/sedas-premium.png",

        priceValue: effectivePrice,
        price: effectivePrice.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),

        isAvailable: product.allowBackorder ? true : product.stock > 0,

        badge: getProductBadge({
          isFeatured: product.isFeatured,
          stock: product.stock,
          minStock: product.minStock,
        }),

        allowPickup: product.allowPickup,
        allowDelivery: product.allowDelivery,
      };
    });

    return res.json({
      products: publicProducts,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erro ao listar produtos públicos.",
    });
  }
});

function getProductBadge(product: {
  isFeatured: boolean;
  stock: number;
  minStock: number;
}) {
  if (product.isFeatured) {
    return "DESTAQUE";
  }

  if (product.stock > 0 && product.stock <= product.minStock) {
    return "ÚLTIMAS UNIDADES";
  }

  return "";
}

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
