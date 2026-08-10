export const paymentMethods = ["CASH", "PIX", "CREDIT", "DEBIT"] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

const aliases: Record<string, PaymentMethod> = {
  CASH: "CASH",
  DINHEIRO: "CASH",
  PIX: "PIX",
  CREDIT: "CREDIT",
  CREDITO: "CREDIT",
  "CRÉDITO": "CREDIT",
  DEBIT: "DEBIT",
  DEBITO: "DEBIT",
  "DÉBITO": "DEBIT",
};

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  const normalized = String(value || "").trim().toLocaleUpperCase("pt-BR");
  return aliases[normalized] || null;
}
export function isCashPayment(value: unknown) {
  return normalizePaymentMethod(value) === "CASH";
}
