import { apiRequest } from "./api";
const token = () => localStorage.getItem("pdv_facil_token");

export type FiscalSettings = {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  taxRegime: string | null;
  stateCode: string | null;
  cityName: string | null;
  cityIbgeCode: string | null;
  postalCode: string | null;
  street: string | null;
  streetNumber: string | null;
  district: string | null;
  complementaryAddress: string | null;
  fiscalProvider: string;
  environment: "HOMOLOGATION";
  issuanceEnabled: boolean;
  receiptWidth: 58 | 80;
};
export type FiscalSettingsInput = Pick<FiscalSettings, "legalName" | "tradeName" | "cnpj" | "stateRegistration" | "taxRegime" | "stateCode" | "cityName" | "cityIbgeCode" | "postalCode" | "street" | "streetNumber" | "district" | "complementaryAddress" | "receiptWidth">;
export type ReceiptPreview = {
  documentType: "NON_FISCAL_PREVIEW";
  fiscalEmissionEnabled: boolean;
  warning: string;
  seller: { name: string; legalName: string | null; cnpj: string | null; address: string | null };
  receiptWidth: number;
  sale: {
    id: string; createdAt: string; paymentMethod: string; customerName: string | null;
    subtotal: number; discount: number; total: number; status: string;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number; ncm: string | null }>;
  };
  readiness: { companyMissing: string[]; productsMissing: Array<{ productName: string; missing: string[] }> };
};
export const fiscalService = {
  settings: () => apiRequest<{
    settings: FiscalSettings;
    integration: { provider: string; status: string; apiCallsEnabled: false; mode: string; message: string };
  }>("/fiscal/settings", { token: token() }),
  saveSettings: (data: FiscalSettingsInput) => apiRequest<{ settings: FiscalSettings; message: string }>("/fiscal/settings", {
    method: "PUT", token: token(), body: data
  }),
  preview: (saleId: string) => apiRequest<ReceiptPreview>(`/fiscal/sales/${encodeURIComponent(saleId)}/preview`, { token: token() })
};
