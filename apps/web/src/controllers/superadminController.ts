import { useEffect, useMemo, useState } from "react";
import type { SupportUser } from "@umbra/shared";
import { fetchSupportUsers, revokeUserSessions } from "../services/authService";

export function useSuperAdminController(ensureAccessToken: () => Promise<string>) {
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const token = await ensureAccessToken();
      const result = await fetchSupportUsers(token);
      setUsers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }

  async function revokeSessions(userId: string): Promise<void> {
    setError(null);

    try {
      const token = await ensureAccessToken();
      await revokeUserSessions(token, userId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke sessions");
    }
  }

  return useMemo(
    () => ({ users, isLoading, error, refresh, revokeSessions }),
    [users, isLoading, error]
  );
}