import { apiRequest } from "./api";

export type CashMovementType = "SUPPLY" | "WITHDRAWAL";

export type CashMovement = {
  id: string;
  marketId: string;
  userId: string;
  type: CashMovementType;
  amount: number;
  note?: string | null;
  cashSessionId?: string | null;
  createdAt: string;
};

export type CreateCashMovementData = {
  type: CashMovementType;
  amount: number;
  note?: string;
  cashSessionId: string;
};

type CashMovementsResponse = {
  movements: CashMovement[];
};

type CashMovementResponse = {
  movement: CashMovement;
};

function getToken() {
  return localStorage.getItem("pdv_facil_token");
}

export function listCashMovementsRequest() {
  return apiRequest<CashMovementsResponse>("/cash-movements", {
    method: "GET",
    token: getToken(),
  });
}

export function createCashMovementRequest(data: CreateCashMovementData) {
  return apiRequest<CashMovementResponse>("/cash-movements", {
    method: "POST",
    token: getToken(),
    body: data,
  });
}
