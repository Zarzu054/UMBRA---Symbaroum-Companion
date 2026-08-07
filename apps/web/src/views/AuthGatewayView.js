import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { ThemeSelector } from "../components/ThemeSelector";
function parseResetTokenFromHash() {
    const rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash.startsWith("reset-password")) {
        return "";
    }
    const [, search = ""] = rawHash.split("?");
    return new URLSearchParams(search).get("token") ?? "";
}
function clearResetHash() {
    if (window.location.hash.startsWith("#reset-password")) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
}
export function AuthGatewayView({ isSubmitting, error, onLogin, onRequestPasswordReset, onResetPassword }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotStatus, setForgotStatus] = useState(null);
    const [isForgotScreen, setIsForgotScreen] = useState(false);
    const [resetToken, setResetToken] = useState(() => parseResetTokenFromHash());
    const [resetPasswordValue, setResetPasswordValue] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetStatus, setResetStatus] = useState(null);
    const activeScreen = useMemo(() => {
        if (resetToken)
            return "reset";
        if (isForgotScreen)
            return "forgot";
        return "login";
    }, [isForgotScreen, resetToken]);
    useEffect(() => {
        function syncResetToken() {
            setResetToken(parseResetTokenFromHash());
            setResetStatus(null);
        }
        syncResetToken();
        window.addEventListener("hashchange", syncResetToken);
        return () => window.removeEventListener("hashchange", syncResetToken);
    }, []);
    function handleSubmit(event) {
        event.preventDefault();
        void onLogin({ email, password });
    }
    async function handleForgotSubmit(event) {
        event.preventDefault();
        setForgotStatus(null);
        await onRequestPasswordReset(forgotEmail);
        setForgotStatus("Si existe una cuenta con ese correo, se ha enviado un enlace de recuperacion.");
    }
    async function handleResetSubmit(event) {
        event.preventDefault();
        if (resetMismatchError || !resetToken) {
            return;
        }
        await onResetPassword(resetToken, resetPasswordValue);
        setResetStatus("Contrasena restablecida. Ya puedes iniciar sesion con la nueva clave.");
        setResetPasswordValue("");
        setResetConfirmPassword("");
        setResetToken("");
        setIsForgotScreen(false);
        clearResetHash();
    }
    const resetMismatchError = resetConfirmPassword && resetPasswordValue !== resetConfirmPassword
        ? "La confirmacion no coincide con la nueva contrasena"
        : null;
    return (_jsxs("main", { className: "page auth-page", children: [_jsx("div", { className: "auth-theme-control", children: _jsx(ThemeSelector, { compact: true }) }), _jsxs("section", { className: "panel auth-panel", children: [_jsx("h1", { children: "UMBRA" }), _jsx("p", { children: "Symbaroum Companion" }), activeScreen === "reset" ? (_jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleResetSubmit, autoComplete: "on", children: [_jsx("p", { className: "meta-text", children: "Define una nueva contrasena para tu cuenta." }), _jsx("input", { type: "password", name: "newPassword", autoComplete: "new-password", "aria-label": "Nueva contrasena", placeholder: "Nueva contrasena", value: resetPasswordValue, onChange: (event) => setResetPasswordValue(event.target.value) }), _jsx("input", { type: "password", name: "confirmNewPassword", autoComplete: "new-password", "aria-label": "Confirmar nueva contrasena", placeholder: "Confirmar nueva contrasena", value: resetConfirmPassword, onChange: (event) => setResetConfirmPassword(event.target.value) }), resetMismatchError ? _jsx("p", { className: "error auth-error", children: resetMismatchError }) : null, !resetMismatchError && error ? _jsx("p", { className: "error auth-error", children: error }) : null, !resetMismatchError && !error && resetStatus ? _jsx("p", { className: "meta-text", children: resetStatus }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting || Boolean(resetMismatchError), children: isSubmitting ? "Restableciendo..." : "Restablecer contrasena" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                    clearResetHash();
                                    setResetToken("");
                                    setResetStatus(null);
                                    setIsForgotScreen(false);
                                }, children: "Volver a entrar" })] })) : activeScreen === "forgot" ? (_jsxs("form", { className: "form-grid auth-form-grid auth-single-form", onSubmit: (event) => void handleForgotSubmit(event), autoComplete: "on", children: [_jsxs("div", { className: "auth-form-copy", children: [_jsx("h2", { children: "Recuperar contrasena" }), _jsx("p", { className: "meta-text", children: "Introduce el correo asociado a tu cuenta para recibir un enlace de recuperacion." })] }), _jsx("input", { type: "email", inputMode: "email", autoComplete: "email", "aria-label": "Correo de recuperacion", placeholder: "Correo de tu cuenta", value: forgotEmail, onChange: (event) => setForgotEmail(event.target.value) }), error ? _jsx("p", { className: "error auth-error", children: error }) : null, !error && forgotStatus ? _jsx("p", { className: "meta-text", children: forgotStatus }) : null, _jsx("button", { type: "submit", className: "auth-submit", disabled: isSubmitting, children: isSubmitting ? "Enviando..." : "Enviar enlace" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                    setForgotStatus(null);
                                    setIsForgotScreen(false);
                                }, children: "Volver a entrar" })] })) : activeScreen === "login" ? (_jsxs(_Fragment, { children: [_jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleSubmit, autoComplete: "on", children: [_jsx("input", { id: "auth-email", name: "email", type: "email", inputMode: "email", autoComplete: "username", "aria-label": "Correo", placeholder: "Correo", value: email, onChange: (event) => setEmail(event.target.value) }), _jsx("input", { id: "auth-password", name: "password", type: "password", autoComplete: "current-password", "aria-label": "Contrasena", placeholder: "Contrasena", value: password, onChange: (event) => setPassword(event.target.value) }), error ? _jsx("p", { className: "error auth-error", children: error }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting, children: isSubmitting ? "Procesando..." : "Entrar" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                    setForgotEmail(email);
                                    setForgotStatus(null);
                                    setIsForgotScreen(true);
                                }, children: "Recuperar contrasena" })] })) : null] })] }));
}
export function ForcedPasswordChangeView({ email, isSubmitting, error, onSubmit, onLogout }) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const mismatchError = confirmPassword && newPassword !== confirmPassword ? "La confirmacion no coincide con la nueva contrasena" : null;
    const lengthError = newPassword && newPassword.length < 8 ? "La nueva contrasena debe tener al menos 8 caracteres" : null;
    const reuseError = newPassword && currentPassword === newPassword ? "La nueva contrasena debe ser distinta de la temporal" : null;
    const validationError = lengthError || reuseError || mismatchError;
    function handleSubmit(event) {
        event.preventDefault();
        if (validationError) {
            return;
        }
        void onSubmit({ currentPassword, newPassword });
    }
    return (_jsxs("main", { className: "page auth-page", children: [_jsx("div", { className: "auth-theme-control", children: _jsx(ThemeSelector, { compact: true }) }), _jsxs("section", { className: "panel auth-panel", children: [_jsx("h1", { children: "UMBRA" }), _jsx("p", { children: "Debes cambiar la contrasena temporal antes de continuar." }), _jsx("p", { className: "meta-text", children: email }), _jsxs("div", { className: "auth-password-guidance", children: [_jsx("strong", { children: "Tu nueva contrasena debe:" }), _jsx("span", { children: "Tener al menos 8 caracteres." }), _jsx("span", { children: "Ser distinta de la contrasena temporal." })] }), _jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleSubmit, autoComplete: "on", children: [_jsx("input", { type: "password", name: "currentPassword", autoComplete: "current-password", "aria-label": "Contrasena actual", placeholder: "Contrasena temporal", value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value) }), _jsx("input", { type: "password", name: "newPassword", autoComplete: "new-password", "aria-label": "Nueva contrasena", placeholder: "Nueva contrasena", value: newPassword, onChange: (event) => setNewPassword(event.target.value) }), _jsx("input", { type: "password", name: "confirmPassword", autoComplete: "new-password", "aria-label": "Confirmar nueva contrasena", placeholder: "Confirmar nueva contrasena", value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value) }), validationError ? _jsx("p", { className: "error auth-error", children: validationError }) : null, !validationError && error ? _jsx("p", { className: "error auth-error", children: error }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting || Boolean(validationError), children: isSubmitting ? "Actualizando..." : "Guardar nueva contrasena" }), _jsx("button", { type: "button", className: "subtle-button", disabled: isSubmitting, onClick: () => void onLogout(), children: "Cerrar sesion" })] })] })] }));
}
