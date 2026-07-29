import { apiRequest } from "./api";
import type { CashMovement } from "./cashMovementsService";

function token() {
  return localStorage.getItem("pdv_facil_token");
}

export type CashSession = {
  id: string;
  operatorName?: string | null;
  openingAmount: number;
  closingAmount?: number | null;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  movements?: CashMovement[];
};

export function getCurrentCashSession() {
  return apiRequest<{ session: CashSession | null }>("/cash-sessions/current", {
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

export function closeCashSession(id: string, closingAmount: number) {
  return apiRequest<{ session: CashSession }>(`/cash-sessions/${id}/close`, {
    method: "POST",
    token: token(),
    body: { closingAmount },
  });
}
