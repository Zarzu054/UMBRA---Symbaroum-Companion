import { useCallback, useEffect, useMemo, useState } from "react";
import { clearAuthState, loadAuthState, saveAuthState } from "../services/authStorage";
import { changePassword, getCurrentUser, loginUser, logoutUser, refreshSession, requestPasswordReset, resetPassword } from "../services/authService";
export function useAuthController() {
    const [auth, setAuth] = useState(null);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        void bootstrap();
    }, []);
    const setAndPersist = useCallback((state) => {
        setAuth(state);
        if (state)
            saveAuthState(state);
        else
            clearAuthState();
    }, []);
    async function bootstrap() {
        const stored = loadAuthState();
        if (!stored) {
            setIsBootstrapping(false);
            return;
        }
        try {
            const user = await getCurrentUser(stored.accessToken);
            const next = { ...stored, user };
            setAndPersist(next);
        }
        catch {
            try {
                const refreshed = await refreshSession({ refreshToken: stored.refreshToken });
                setAndPersist(refreshed);
            }
            catch {
                setAndPersist(null);
            }
        }
        finally {
            setIsBootstrapping(false);
        }
    }
    async function login(input) {
        setIsSubmitting(true);
        setError(null);
        try {
            const session = await loginUser(input);
            setAndPersist(session);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Inicio de sesion fallido");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function rotatePassword(currentPassword, newPassword) {
        if (!auth) {
            setError("No autenticado");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const session = await changePassword({ currentPassword, newPassword }, auth.accessToken);
            setAndPersist(session);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo actualizar la contrasena");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function sendPasswordReset(email) {
        setIsSubmitting(true);
        setError(null);
        try {
            await requestPasswordReset({ email });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo enviar el correo de recuperacion");
            throw err;
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function confirmPasswordReset(token, newPassword) {
        setIsSubmitting(true);
        setError(null);
        try {
            await resetPassword({ token, newPassword });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo restablecer la contrasena");
            throw err;
        }
        finally {
            setIsSubmitting(false);
        }
    }
    async function ensureAccessToken() {
        if (!auth)
            throw new Error("No autenticado");
        const expiresInSeconds = getTokenRemainingSeconds(auth.accessToken);
        if (expiresInSeconds > 30)
            return auth.accessToken;
        const refreshed = await refreshSession({ refreshToken: auth.refreshToken });
        setAndPersist(refreshed);
        return refreshed.accessToken;
    }
    async function logout() {
        if (auth?.refreshToken) {
            try {
                await logoutUser({ refreshToken: auth.refreshToken });
            }
            catch {
                // no-op, local logout still needs to happen
            }
        }
        setAndPersist(null);
    }
    return useMemo(() => ({
        auth,
        isBootstrapping,
        isSubmitting,
        error,
        login,
        rotatePassword,
        sendPasswordReset,
        confirmPasswordReset,
        logout,
        ensureAccessToken
    }), [auth, isBootstrapping, isSubmitting, error]);
}
function getTokenRemainingSeconds(token) {
    try {
        const payloadSegment = token.split(".")[1];
        if (!payloadSegment)
            return 0;
        const json = atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(json);
        if (!payload.exp)
            return 0;
        return payload.exp - Math.floor(Date.now() / 1000);
    }
    catch {
        return 0;
    }
}
