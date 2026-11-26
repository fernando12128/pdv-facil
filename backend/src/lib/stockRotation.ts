import { prisma } from "./prisma";

export type SlowStockItem = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  cost: number;
  lastSaleAt: string | null;
  daysWithoutSales: number;
  neverSold: boolean;
  capitalCents: number;
  status: "NEW" | "NORMAL" | "14_DAYS" | "30_DAYS" | "60_DAYS";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const roundCents = (value: number) => Math.round(value * 100);

/**
 * Giro por produto, considerando vendas de balcão concluídas e pedidos online entregues.
 * Produtos novos só passam a ser contados depois de 14 dias de cadastro.
 * Estoque zerado/inativo é excluído dos alertas.
 */
export async function getStockRotation(marketId: string, now = new Date()) {
  const products = await prisma.product.findMany({
    where: { marketId, isActive: true, stock: { gt: 0 } },
    select: {
      id: true, name: true, sku: true, stock: true, cost: true, createdAt: true,
      saleItems: {
        where: { sale: { marketId, status: "COMPLETED" } },
        orderBy: { sale: { createdAt: "desc" } },
        take: 1,
        select: { sale: { select: { createdAt: true } } }
      },
      onlineOrderItems: {
        where: { order: { marketId, status: "DELIVERED" } },
        orderBy: { order: { createdAt: "desc" } },
        take: 1,
        select: { order: { select: { createdAt: true } } }
      }
    },
    orderBy: { name: "asc" }
  });

  const items: SlowStockItem[] = products.map(product => {
    const lastCounter = product.saleItems[0]?.sale.createdAt.getTime() ?? 0;
    const lastOnline = product.onlineOrderItems[0]?.order.createdAt.getTime() ?? 0;
    const lastSale = Math.max(lastCounter, lastOnline);
    const neverSold = lastSale === 0;
    const referenceTime = Math.max(lastSale, product.createdAt.getTime());
    const daysWithoutSales = Math.max(0, Math.floor((now.getTime() - referenceTime) / DAY_MS));
    const status: SlowStockItem["status"] = daysWithoutSales >= 60 ? "60_DAYS"
      : daysWithoutSales >= 30 ? "30_DAYS"
      : daysWithoutSales >= 14 ? "14_DAYS"
      : neverSold ? "NEW" : "NORMAL";

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      cost: product.cost,
      lastSaleAt: lastSale ? new Date(lastSale).toISOString() : null,
      daysWithoutSales,
      neverSold,
      capitalCents: roundCents(product.cost * product.stock),
      status
    };
  });
  const overdue = items.filter(item => item.daysWithoutSales >= 14);
  return {
    items,
    summary: {
      slowCount: overdue.length,
      slowCapitalCents: overdue.reduce((sum, item) => sum + item.capitalCents, 0),
      neverSoldCount: items.filter(item => item.neverSold).length,
      days30Count: items.filter(item => item.daysWithoutSales >= 30).length,
      days60Count: items.filter(item => item.daysWithoutSales >= 60).length
    }
  };
}
