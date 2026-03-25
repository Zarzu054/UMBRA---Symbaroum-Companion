import { useEffect, useMemo, useState } from "react";
import { fetchSupportUsers, revokeUserSessions } from "../services/authService";
export function useSuperAdminController(ensureAccessToken) {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        void refresh();
    }, []);
    async function refresh() {
        setIsLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            const result = await fetchSupportUsers(token);
            setUsers(result);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios");
        }
        finally {
            setIsLoading(false);
        }
    }
    async function revokeSessions(userId) {
        setError(null);
        try {
            const token = await ensureAccessToken();
            await revokeUserSessions(token, userId);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron revocar las sesiones");
        }
    }
    return useMemo(() => ({ users, isLoading, error, refresh, revokeSessions }), [users, isLoading, error]);
}
