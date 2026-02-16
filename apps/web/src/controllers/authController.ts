import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoginInput, RegisterInput } from "@umbra/shared";
import type { AuthState } from "../models/authModel";
import { clearAuthState, loadAuthState, saveAuthState } from "../services/authStorage";
import { getCurrentUser, loginUser, logoutUser, refreshSession, registerUser } from "../services/authService";

type AuthMode = "login" | "register";

export function useAuthController() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  const setAndPersist = useCallback((state: AuthState | null) => {
    setAuth(state);
    if (state) saveAuthState(state);
    else clearAuthState();
  }, []);

  async function bootstrap(): Promise<void> {
    const stored = loadAuthState();
    if (!stored) {
      setIsBootstrapping(false);
      return;
    }

    try {
      const user = await getCurrentUser(stored.accessToken);
      const next = { ...stored, user };
      setAndPersist(next);
    } catch {
      try {
        const refreshed = await refreshSession({ refreshToken: stored.refreshToken });
        setAndPersist(refreshed);
      } catch {
        setAndPersist(null);
      }
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function register(input: RegisterInput): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await registerUser(input);
      setAndPersist(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function login(input: LoginInput): Promise<void> {
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await loginUser(input);
      setAndPersist(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function ensureAccessToken(): Promise<string> {
    if (!auth) throw new Error("Not authenticated");

    const expiresInSeconds = getTokenRemainingSeconds(auth.accessToken);
    if (expiresInSeconds > 30) return auth.accessToken;

    const refreshed = await refreshSession({ refreshToken: auth.refreshToken });
    setAndPersist(refreshed);
    return refreshed.accessToken;
  }

  async function logout(): Promise<void> {
    if (auth?.refreshToken) {
      try {
        await logoutUser({ refreshToken: auth.refreshToken });
      } catch {
        // no-op, local logout still needs to happen
      }
    }

    setAndPersist(null);
    setAuthMode("login");
  }

  return useMemo(
    () => ({
      auth,
      authMode,
      isBootstrapping,
      isSubmitting,
      error,
      setAuthMode,
      register,
      login,
      logout,
      ensureAccessToken
    }),
    [auth, authMode, isBootstrapping, isSubmitting, error]
  );
}

function getTokenRemainingSeconds(token: string): number {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return 0;

    const json = atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return 0;

    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return 0;
  }
}