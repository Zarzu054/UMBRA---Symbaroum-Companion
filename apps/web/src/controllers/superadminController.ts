import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminAccountEvent,
  AdminAccountMutationResult,
  AdminUserList,
  AdminUserListQuery,
  CreateManagedUserInput,
  DeactivateManagedUserInput
} from "@umbra/shared";
import {
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUserEvents,
  fetchAdminUsers,
  reactivateAdminUser,
  retryAdminEventEmail,
  revokeUserSessions
} from "../services/authService";

const EMPTY_LIST: AdminUserList = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  counts: { active: 0, pending: 0, deactivated: 0, notificationAttention: 0 }
};

export function useSuperAdminController(ensureAccessToken: () => Promise<string>) {
  const [data, setData] = useState<AdminUserList>(EMPTY_LIST);
  const [filters, setFilters] = useState<AdminUserListQuery>({
    query: "",
    role: "all",
    status: "all",
    page: 1,
    pageSize: 25
  });
  const [isLoading, setIsLoading] = useState(true);
  const [operationUserId, setOperationUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminAccountEvent[]>([]);
  const [eventsUserId, setEventsUserId] = useState<string | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (query = filters): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      setData(await fetchAdminUsers(token, query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas");
    } finally {
      setIsLoading(false);
    }
  }, [ensureAccessToken, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(filters), filters.query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [filters, refresh]);

  const runUserMutation = useCallback(async (
    userId: string,
    action: (token: string) => Promise<AdminAccountMutationResult>
  ): Promise<AdminAccountMutationResult> => {
    setOperationUserId(userId);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const result = await action(token);
      await refresh(filters);
      if (eventsUserId === userId) {
        setEvents(await fetchAdminUserEvents(token, userId));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar la operacion";
      setError(message);
      throw err;
    } finally {
      setOperationUserId(null);
    }
  }, [ensureAccessToken, eventsUserId, filters, refresh]);

  async function createUser(input: CreateManagedUserInput): Promise<AdminAccountMutationResult> {
    setOperationUserId("create");
    setError(null);
    try {
      const token = await ensureAccessToken();
      const result = await createAdminUser(token, input);
      await refresh({ ...filters, page: 1 });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
      throw err;
    } finally {
      setOperationUserId(null);
    }
  }

  function deactivateUser(userId: string, input: DeactivateManagedUserInput) {
    return runUserMutation(userId, (token) => deactivateAdminUser(token, userId, input));
  }

  function reactivateUser(userId: string) {
    return runUserMutation(userId, (token) => reactivateAdminUser(token, userId));
  }

  function revokeSessions(userId: string) {
    return runUserMutation(userId, (token) => revokeUserSessions(token, userId));
  }

  function retryEmail(userId: string, eventId: string) {
    return runUserMutation(userId, (token) => retryAdminEventEmail(token, userId, eventId));
  }

  async function loadEvents(userId: string): Promise<void> {
    setEventsUserId(userId);
    setEvents([]);
    setIsLoadingEvents(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      setEvents(await fetchAdminUserEvents(token, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
    } finally {
      setIsLoadingEvents(false);
    }
  }

  function closeEvents(): void {
    setEventsUserId(null);
    setEvents([]);
  }

  function updateFilters(patch: Partial<AdminUserListQuery>): void {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 1
    }));
  }

  return useMemo(
    () => ({
      data,
      filters,
      isLoading,
      isSaving: operationUserId !== null,
      operationUserId,
      events,
      eventsUserId,
      isLoadingEvents,
      error,
      refresh,
      updateFilters,
      createUser,
      deactivateUser,
      reactivateUser,
      revokeSessions,
      retryEmail,
      loadEvents,
      closeEvents
    }),
    [
      data,
      filters,
      isLoading,
      operationUserId,
      events,
      eventsUserId,
      isLoadingEvents,
      error,
      refresh,
      runUserMutation
    ]
  );
}
