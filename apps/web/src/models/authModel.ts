import type { AuthSession, AuthUser } from "@umbra/shared";

export type AuthState = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export function fromSession(session: AuthSession): AuthState {
  return {
    user: session.user,
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken
  };
}