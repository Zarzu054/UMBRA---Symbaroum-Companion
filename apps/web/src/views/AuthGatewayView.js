import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
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
export function AuthGatewayView({ mode, isSubmitting, error, onModeChange, onLogin, onRegister, onRequestPasswordReset, onResetPassword }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("player");
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotStatus, setForgotStatus] = useState(null);
    const [resetToken, setResetToken] = useState(() => parseResetTokenFromHash());
    const [resetPasswordValue, setResetPasswordValue] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetStatus, setResetStatus] = useState(null);
    const allowPublicRegistration = import.meta.env.VITE_ALLOW_PUBLIC_REGISTRATION !== "false";
    const activeScreen = useMemo(() => {
        if (resetToken)
            return "reset";
        if (mode === "register")
            return "register";
        return "login";
    }, [mode, resetToken]);
    useEffect(() => {
        function syncResetToken() {
            setResetToken(parseResetTokenFromHash());
            setResetStatus(null);
        }
        syncResetToken();
        window.addEventListener("hashchange", syncResetToken);
        return () => window.removeEventListener("hashchange", syncResetToken);
    }, []);
    async function submit() {
        if (activeScreen === "login") {
            await onLogin({ email, password });
            return;
        }
        await onRegister({ email, password, role });
    }
    function handleSubmit(event) {
        event.preventDefault();
        void submit();
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
        clearResetHash();
        onModeChange("login");
    }
    const resetMismatchError = resetConfirmPassword && resetPasswordValue !== resetConfirmPassword
        ? "La confirmacion no coincide con la nueva contrasena"
        : null;
    return (_jsx("main", { className: "page auth-page", children: _jsxs("section", { className: "panel auth-panel", children: [_jsx("h1", { children: "UMBRA" }), _jsx("p", { children: "Companion de Symbaroum" }), allowPublicRegistration && activeScreen !== "reset" ? (_jsxs("div", { className: "auth-switch", children: [_jsx("button", { className: mode === "login" ? "active" : "", onClick: () => onModeChange("login"), children: "Entrar" }), _jsx("button", { className: mode === "register" ? "active" : "", onClick: () => onModeChange("register"), children: "Registro" })] })) : null, activeScreen === "reset" ? (_jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleResetSubmit, autoComplete: "on", children: [_jsx("p", { className: "meta-text", children: "Define una nueva contrasena para tu cuenta." }), _jsx("input", { type: "password", name: "newPassword", autoComplete: "new-password", "aria-label": "Nueva contrasena", placeholder: "Nueva contrasena", value: resetPasswordValue, onChange: (event) => setResetPasswordValue(event.target.value) }), _jsx("input", { type: "password", name: "confirmNewPassword", autoComplete: "new-password", "aria-label": "Confirmar nueva contrasena", placeholder: "Confirmar nueva contrasena", value: resetConfirmPassword, onChange: (event) => setResetConfirmPassword(event.target.value) }), resetMismatchError ? _jsx("p", { className: "error auth-error", children: resetMismatchError }) : null, !resetMismatchError && error ? _jsx("p", { className: "error auth-error", children: error }) : null, !resetMismatchError && !error && resetStatus ? _jsx("p", { className: "meta-text", children: resetStatus }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting || Boolean(resetMismatchError), children: isSubmitting ? "Restableciendo..." : "Restablecer contrasena" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                clearResetHash();
                                setResetToken("");
                                setResetStatus(null);
                                onModeChange("login");
                            }, children: "Volver a entrar" })] })) : activeScreen === "login" || activeScreen === "register" ? (_jsxs(_Fragment, { children: [_jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleSubmit, autoComplete: "on", children: [_jsx("input", { id: "auth-email", name: "email", type: "email", inputMode: "email", autoComplete: activeScreen === "login" ? "username" : "email", "aria-label": "Correo", placeholder: "Correo", value: email, onChange: (event) => setEmail(event.target.value) }), _jsx("input", { id: "auth-password", name: "password", type: "password", autoComplete: activeScreen === "login" ? "current-password" : "new-password", "aria-label": "Contrasena", placeholder: "Contrasena", value: password, onChange: (event) => setPassword(event.target.value) }), activeScreen === "register" && allowPublicRegistration ? (_jsxs("select", { id: "auth-role", name: "role", autoComplete: "off", value: role, onChange: (event) => setRole(event.target.value), children: [_jsx("option", { value: "player", children: "Jugador" }), _jsx("option", { value: "gm", children: "Director de Juego" })] })) : null, error ? _jsx("p", { className: "error auth-error", children: error }) : null, !allowPublicRegistration ? _jsx("p", { className: "meta-text", children: "El acceso se gestiona solo con cuentas creadas por el administrador." }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting, children: isSubmitting ? "Procesando..." : activeScreen === "login" ? "Entrar" : "Crear cuenta" })] }), activeScreen === "login" ? (_jsxs("div", { className: "auth-recovery-block", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setForgotStatus((current) => current === null ? "" : null), children: "Recuperar contrasena" }), forgotStatus !== null ? (_jsxs("form", { className: "form-grid auth-form-grid auth-recovery-form", onSubmit: (event) => void handleForgotSubmit(event), children: [_jsx("input", { type: "email", inputMode: "email", autoComplete: "email", "aria-label": "Correo de recuperacion", placeholder: "Correo de tu cuenta", value: forgotEmail, onChange: (event) => setForgotEmail(event.target.value) }), error ? _jsx("p", { className: "error auth-error", children: error }) : null, !error && forgotStatus ? _jsx("p", { className: "meta-text", children: forgotStatus }) : null, _jsx("button", { type: "submit", className: "auth-submit", disabled: isSubmitting, children: isSubmitting ? "Enviando..." : "Enviar enlace" })] })) : null] })) : null] })) : null] }) }));
}
export function ForcedPasswordChangeView({ email, isSubmitting, error, onSubmit }) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const mismatchError = confirmPassword && newPassword !== confirmPassword ? "La confirmacion no coincide con la nueva contrasena" : null;
    function handleSubmit(event) {
        event.preventDefault();
        if (mismatchError) {
            return;
        }
        void onSubmit({ currentPassword, newPassword });
    }
    return (_jsx("main", { className: "page auth-page", children: _jsxs("section", { className: "panel auth-panel", children: [_jsx("h1", { children: "UMBRA" }), _jsx("p", { children: "Debes cambiar la contrasena temporal antes de continuar." }), _jsx("p", { className: "meta-text", children: email }), _jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleSubmit, autoComplete: "on", children: [_jsx("input", { type: "password", name: "currentPassword", autoComplete: "current-password", "aria-label": "Contrasena actual", placeholder: "Contrasena temporal", value: currentPassword, onChange: (event) => setCurrentPassword(event.target.value) }), _jsx("input", { type: "password", name: "newPassword", autoComplete: "new-password", "aria-label": "Nueva contrasena", placeholder: "Nueva contrasena", value: newPassword, onChange: (event) => setNewPassword(event.target.value) }), _jsx("input", { type: "password", name: "confirmPassword", autoComplete: "new-password", "aria-label": "Confirmar nueva contrasena", placeholder: "Confirmar nueva contrasena", value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value) }), mismatchError ? _jsx("p", { className: "error auth-error", children: mismatchError }) : null, !mismatchError && error ? _jsx("p", { className: "error auth-error", children: error }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting || Boolean(mismatchError), children: isSubmitting ? "Actualizando..." : "Guardar nueva contrasena" })] })] }) }));
}
