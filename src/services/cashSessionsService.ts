import { apiRequest } from "./api";
import type { CashMovement } from "./cashMovementsService";
import type { Sale } from "./salesService";

function token() {
  return localStorage.getItem("pdv_facil_token");
}

export type PaymentReconciliation = {
  method: string;
  sales: number;
  expected: number;
  confirmed: number | null;
  difference: number | null;
};

export type CashSessionSummary = {
  saleCount: number;
  itemCount: number;
  grossSales: number;
  discounts: number;
  cancelledSales: number;
  cancelledTotal: number;
  refundedSales: number;
  refundedTotal: number;
  netSales: number;
  averageTicket: number;
  supplies: number;
  withdrawals: number;
  cashSales: number;
  expectedCash: number;
  paymentMethods: PaymentReconciliation[];
};

export type CashSession = {
  id: string;
  operatorName?: string | null;
  openingAmount: number;
  closingAmount?: number | null;
  expectedCash?: number | null;
  difference?: number | null;
  closingCode?: string | null;
  closingStatus?: string | null;
  grossSales?: number | null;
  discounts?: number | null;
  netSales?: number | null;
  discrepancyReason?: string | null;
  discrepancyNote?: string | null;
  actionTaken?: string | null;
  finalNote?: string | null;
  countHistory?: number[] | null;
  paymentSummary?: PaymentReconciliation[] | null;
  revision?: number;
  corrections?: CashClosingCorrection[];
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  movements?: CashMovement[];
  sales?: Sale[];
  summary?: CashSessionSummary;
};

export type CashClosingCorrection = {
  id: string;
  authorizedManagerId?: string | null;
  authorizedManagerName: string;
  requestedByUserId: string;
  requestedByName: string;
  previousClosingAmount: number;
  correctedClosingAmount: number;
  previousDifference: number;
  correctedDifference: number;
  previousClosingStatus?: string | null;
  correctedClosingStatus: string;
  previousPaymentSummary: PaymentReconciliation[];
  correctedPaymentSummary: PaymentReconciliation[];
  reason: string;
  note?: string | null;
  createdAt: string;
};

export type CloseCashSessionData = {
  closingAmount: number;
  confirmedPayments: Record<string, number>;
  countHistory: number[];
  discrepancyReason?: string;
  discrepancyNote?: string;
  actionTaken?: string;
  finalNote?: string;
};

export function getCurrentCashSession() {
  return apiRequest<{ session: CashSession | null }>("/cash-sessions/current", {
    token: token(),
  });
}

export function getCashSessionPreview(id: string) {
  return apiRequest<{ session: CashSession }>(
    `/cash-sessions/${id}/preview`,
    { token: token() }
  );
}

export function getCashSessionSummary(id: string) {
  return apiRequest<{ session: CashSession }>(
    `/cash-sessions/${id}/summary`,
    { token: token() }
  );
}

export function listCashSessionHistory() {
  return apiRequest<{ sessions: CashSession[] }>("/cash-sessions/history", {
    token: token(),
  });
}

export function openCashSession(data: {
  openingAmount: number;
  operatorName?: string;
}) {
  return apiRequest<{ session: CashSession }>("/cash-sessions/open", {
    method: "POST",
    token: token(),
    body: data,
  });
}

export function closeCashSession(id: string, data: CloseCashSessionData) {
  return apiRequest<{ session: CashSession }>(`/cash-sessions/${id}/close`, {
    method: "POST",
    token: token(),
    body: data,
  });
}

export function authorizeCashClosingCorrection(
  id: string,
  data: { managerName: string; pin: string }
) {
  return apiRequest<{
    authorizationToken: string;
    manager: { id: string; name: string };
    expiresInSeconds: number;
  }>(`/cash-sessions/${id}/authorize-correction`, {
    method: "POST",
    token: token(),
    body: data,
  });
}

export function correctCashClosing(
  id: string,
  data: {
    authorizationToken: string;
    correctedPayments: Record<string, number>;
    reason: string;
    note?: string;
  }
) {
  return apiRequest<{ session: CashSession }>(
    `/cash-sessions/${id}/correct`,
    {
      method: "PATCH",
      token: token(),
      body: data,
    }
  );
}
