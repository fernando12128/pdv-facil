import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/authMiddleware";

export const fiscalRoutes = Router();
fiscalRoutes.use(authMiddleware);

const allowedRoles = ["OWNER", "MANAGER"];
const fields = [
  "legalName", "tradeName", "cnpj", "stateRegistration", "taxRegime", "stateCode",
  "cityName", "cityIbgeCode", "postalCode", "street", "streetNumber", "district",
  "complementaryAddress"
] as const;
const digits = (value: string) => value.replace(/\D/g, "");
function validCnpj(cnpj: string) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}
function canManage(req: AuthenticatedRequest) {
  return !!req.user && allowedRoles.includes(req.user.role);
}

fiscalRoutes.get("/settings", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  const settings = await prisma.fiscalSettings.findUnique({ where: { marketId } });
  return res.json({
    settings: settings || {
      legalName: "", tradeName: "", cnpj: "", stateRegistration: "", taxRegime: "",
      stateCode: "", cityName: "", cityIbgeCode: "", postalCode: "", street: "",
      streetNumber: "", district: "", complementaryAddress: "",
      fiscalProvider: "FOCUS_NFE", environment: "HOMOLOGATION", issuanceEnabled: false, receiptWidth: 80
    },
    integration: {
      provider: "FOCUS_NFE", status: "NOT_CONFIGURED",
      apiCallsEnabled: false, mode: "PREPARATION_ONLY",
      message: "Emissão NFC-e/NF-e indisponível nesta etapa. Nenhuma nota é transmitida."
    }
  });
});

fiscalRoutes.put("/settings", async (req: AuthenticatedRequest, res) => {
  if (!canManage(req)) return res.status(403).json({ message: "Sem permissão para alterar configurações fiscais." });
  const input = req.body || {};
  if (typeof input !== "object" || Array.isArray(input))
    return res.status(400).json({ message: "Dados inválidos." });
  const clean: Record<string, string | null> = {};
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined && value !== null && typeof value !== "string")
      return res.status(400).json({ message: `Campo ${field} deve ser texto.` });
    const str = typeof value === "string" ? value.trim() : "";
    if (str.length > 180) return res.status(400).json({ message: `Campo ${field} é muito longo.` });
    clean[field] = str || null;
  }
  if (clean.cnpj) {
    clean.cnpj = digits(clean.cnpj);
    if (!validCnpj(clean.cnpj)) return res.status(400).json({ message: "CNPJ inválido (dígitos verificadores)." });
  }
  if (clean.cityIbgeCode && !/^\d{7}$/.test(clean.cityIbgeCode))
    return res.status(400).json({ message: "Código IBGE deve conter 7 dígitos." });
  if (clean.postalCode) {
    clean.postalCode = digits(clean.postalCode);
    if (!/^\d{8}$/.test(clean.postalCode)) return res.status(400).json({ message: "CEP deve conter 8 dígitos." });
  }
  if (clean.stateCode) {
    clean.stateCode = clean.stateCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(clean.stateCode)) return res.status(400).json({ message: "UF inválida." });
  }
  if (clean.taxRegime && !["SIMPLES_NACIONAL", "SIMPLES_EXCESSO", "REGIME_NORMAL"].includes(clean.taxRegime))
    return res.status(400).json({ message: "Regime tributário inválido." });
  const width = input.receiptWidth ?? 80;
  if (![58, 80].includes(width)) return res.status(400).json({ message: "Largura do cupom deve ser 58 ou 80 mm." });
  // Homologação e integração desligada são propositalmente fixas até a implantação segura do conector.
  const marketId = req.user!.marketId;
  const settings = await prisma.fiscalSettings.upsert({
    where: { marketId },
    create: {
      marketId, ...(clean as any),
      receiptWidth: width, environment: "HOMOLOGATION", issuanceEnabled: false,
      fiscalProvider: "FOCUS_NFE"
    },
    update: { ...(clean as any), receiptWidth: width, environment: "HOMOLOGATION", issuanceEnabled: false }
  });
  return res.json({ settings, message: "Dados fiscais preparados. Nenhuma emissão está habilitada." });
});

// Prévia não fiscal de uma venda já concluída. A configuração ainda não habilita transmissão à SEFAZ.
fiscalRoutes.get("/sales/:saleId/preview", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  const sale = await prisma.productSale.findFirst({
    where: { id: req.params.saleId, marketId },
    include: { items: true }
  });
  if (!sale) return res.status(404).json({ message: "Venda não encontrada." });
  const [market, settings, products] = await Promise.all([
    prisma.market.findUnique({ where: { id: marketId }, select: { name: true, address: true } }),
    prisma.fiscalSettings.findUnique({ where: { marketId } }),
    prisma.product.findMany({
      where: { marketId, id: { in: sale.items.map(item => item.productId) } },
      select: { id: true, ncm: true, cfop: true, cest: true, fiscalUnit: true, taxSituation: true, originCode: true }
    })
  ]);
  const lookup = new Map(products.map(product => [product.id, product]));
  const missing = sale.items.flatMap(item => {
    const product = lookup.get(item.productId);
    const fields = [];
    if (!product?.ncm) fields.push("NCM");
    if (!product?.cfop) fields.push("CFOP");
    if (!product?.taxSituation) fields.push("CST/CSOSN");
    return fields.length ? [{ productName: item.productName, missing: fields }] : [];
  });
  const sellerMissing = [
    !settings?.cnpj && "CNPJ",
    !settings?.legalName && "Razão social",
    !settings?.stateCode && "UF",
    !settings?.cityIbgeCode && "Município IBGE",
    !settings?.taxRegime && "Regime tributário"
  ].filter(Boolean);
  return res.json({
    documentType: "NON_FISCAL_PREVIEW",
    fiscalEmissionEnabled: false,
    warning: "PRÉVIA NÃO FISCAL. Não é NFC-e, NF-e, DANFE ou documento autorizado pela SEFAZ.",
    seller: {
      name: settings?.tradeName || market?.name || "Estabelecimento",
      legalName: settings?.legalName || null, cnpj: settings?.cnpj || null,
      address: [settings?.street, settings?.streetNumber, settings?.district, settings?.cityName, settings?.stateCode]
        .filter(Boolean).join(", ") || market?.address || null
    },
    sale: {
      id: sale.id, createdAt: sale.createdAt, paymentMethod: sale.paymentMethod,
      customerName: sale.customerName, subtotal: sale.subtotal, discount: sale.discount,
      total: sale.total, status: sale.status,
      items: sale.items.map(item => ({
        name: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total,
        ncm: lookup.get(item.productId)?.ncm || null
      }))
    },
    readiness: { companyMissing: sellerMissing, productsMissing: missing },
    receiptWidth: settings?.receiptWidth || 80
  });
});
