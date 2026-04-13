import type {
  AuthSession,
  ChangePasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  SupportUser
} from "@umbra/shared";
import { fromSession, type AuthState } from "../models/authModel";

const JSON_HEADERS = { "Content-Type": "application/json" };

type ApiResponse<T> = { data: T };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
  } catch {
    return `Fallo de solicitud (${response.status})`;
  }
}

async function postJson<TBody, TData>(url: string, body: TBody, token?: string): Promise<TData> {
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return undefined as TData;
  }

  const payload = (await response.json()) as ApiResponse<TData>;
  return payload.data;
}

export async function registerUser(input: RegisterInput): Promise<AuthState> {
  const session = await postJson<RegisterInput, AuthSession>("/auth/register", input);
  return fromSession(session);
}

export async function loginUser(input: LoginInput): Promise<AuthState> {
  const session = await postJson<LoginInput, AuthSession>("/auth/login", input);
  return fromSession(session);
}

export async function refreshSession(input: RefreshInput): Promise<AuthState> {
  const session = await postJson<RefreshInput, AuthSession>("/auth/refresh", input);
  return fromSession(session);
}

export async function logoutUser(input: RefreshInput): Promise<void> {
  await postJson<RefreshInput, void>("/auth/logout", input);
}

export async function changePassword(input: ChangePasswordInput, accessToken: string): Promise<AuthState> {
  const session = await postJson<ChangePasswordInput, AuthSession>("/auth/change-password", input, accessToken);
  return fromSession(session);
}

export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
  await postJson<RequestPasswordResetInput, void>("/auth/request-password-reset", input);
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await postJson<ResetPasswordInput, void>("/auth/reset-password", input);
}

export async function getCurrentUser(accessToken: string) {
  const response = await fetch("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as ApiResponse<AuthSession["user"]>;
  return payload.data;
}

export async function fetchSupportUsers(accessToken: string): Promise<SupportUser[]> {
  const response = await fetch("/admin/users", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as ApiResponse<SupportUser[]>;
  return payload.data;
}

export async function revokeUserSessions(accessToken: string, userId: string): Promise<void> {
  await postJson<object, void>(`/admin/users/${userId}/revoke-sessions`, {}, accessToken);
}
