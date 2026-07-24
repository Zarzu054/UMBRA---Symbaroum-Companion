import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminUser, deactivateAdminUser, fetchAdminUserEvents, fetchAdminUsers, reactivateAdminUser, retryAdminEventEmail, revokeUserSessions } from "../services/authService";
const EMPTY_LIST = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    counts: { active: 0, pending: 0, deactivated: 0, notificationAttention: 0 }
};
export function useSuperAdminController(ensureAccessToken) {
    const [data, setData] = useState(EMPTY_LIST);
    const [filters, setFilters] = useState({
        query: "",
        role: "all",
        status: "all",
        page: 1,
        pageSize: 25
    });
    const [isLoading, setIsLoading] = useState(true);
    const [operationUserId, setOperationUserId] = useState(null);
    const [events, setEvents] = useState([]);
    const [eventsUserId, setEventsUserId] = useState(null);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);
    const [error, setError] = useState(null);
    const refresh = useCallback(async (query = filters) => {
        setIsLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            setData(await fetchAdminUsers(token, query));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas");
        }
        finally {
            setIsLoading(false);
        }
    }, [ensureAccessToken, filters]);
    useEffect(() => {
        const timer = window.setTimeout(() => void refresh(filters), filters.query ? 300 : 0);
        return () => window.clearTimeout(timer);
    }, [filters, refresh]);
    const runUserMutation = useCallback(async (userId, action) => {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "No se pudo completar la operacion";
            setError(message);
            throw err;
        }
        finally {
            setOperationUserId(null);
        }
    }, [ensureAccessToken, eventsUserId, filters, refresh]);
    async function createUser(input) {
        setOperationUserId("create");
        setError(null);
        try {
            const token = await ensureAccessToken();
            const result = await createAdminUser(token, input);
            await refresh({ ...filters, page: 1 });
            return result;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
            throw err;
        }
        finally {
            setOperationUserId(null);
        }
    }
    function deactivateUser(userId, input) {
        return runUserMutation(userId, (token) => deactivateAdminUser(token, userId, input));
    }
    function reactivateUser(userId) {
        return runUserMutation(userId, (token) => reactivateAdminUser(token, userId));
    }
    function revokeSessions(userId) {
        return runUserMutation(userId, (token) => revokeUserSessions(token, userId));
    }
    function retryEmail(userId, eventId) {
        return runUserMutation(userId, (token) => retryAdminEventEmail(token, userId, eventId));
    }
    async function loadEvents(userId) {
        setEventsUserId(userId);
        setEvents([]);
        setIsLoadingEvents(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            setEvents(await fetchAdminUserEvents(token, userId));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
        }
        finally {
            setIsLoadingEvents(false);
        }
    }
    function closeEvents() {
        setEventsUserId(null);
        setEvents([]);
    }
    function updateFilters(patch) {
        setFilters((current) => ({
            ...current,
            ...patch,
            page: patch.page ?? 1
        }));
    }
    return useMemo(() => ({
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
    }), [
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
    ]);
}
