import { apiRequest } from "./api";

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  market: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
};

export type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  market: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
  };
};

export function loginRequest(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: {
      email,
      password,
    },
  });
}

export function registerRequest(
  marketName: string,
  email: string,
  password: string
) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: {
      marketName,
      email,
      password,
    },
  });
}

export function meRequest(token: string) {
  return apiRequest<MeResponse>("/auth/me", {
    method: "GET",
    token,
  });
}