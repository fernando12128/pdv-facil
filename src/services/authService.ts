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

export type AccountFlowResponse = {
  message: string;
  email?: string;
  developmentToken?: string;
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
  return apiRequest<AccountFlowResponse>("/auth/register", {
    method: "POST",
    body: {
      marketName,
      email,
      password,
    },
  });
}

export function verifyEmailRequest(email: string, token: string) {
  return apiRequest<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: { email, token },
  });
}

export function resendVerificationRequest(email: string) {
  return apiRequest<AccountFlowResponse>("/auth/verification/resend", {
    method: "POST",
    body: { email },
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<AccountFlowResponse>("/auth/password-reset/request", {
    method: "POST",
    body: { email },
  });
}

export function confirmPasswordReset(token: string, password: string) {
  return apiRequest<{ message: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: { token, password },
  });
}

export function meRequest(token: string) {
  return apiRequest<MeResponse>("/auth/me", {
    method: "GET",
    token,
  });
}
