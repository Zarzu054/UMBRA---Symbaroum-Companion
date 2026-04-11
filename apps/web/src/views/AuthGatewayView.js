import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function AuthGatewayView({ mode, isSubmitting, error, onModeChange, onLogin, onRegister }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("player");
    const allowPublicRegistration = import.meta.env.VITE_ALLOW_PUBLIC_REGISTRATION !== "false";
    async function submit() {
        if (mode === "login") {
            await onLogin({ email, password });
            return;
        }
        await onRegister({ email, password, role });
    }
    function handleSubmit(event) {
        event.preventDefault();
        void submit();
    }
    return (_jsx("main", { className: "page auth-page", children: _jsxs("section", { className: "panel auth-panel", children: [_jsx("h1", { children: "UMBRA" }), _jsx("p", { children: "Companion de Symbaroum" }), allowPublicRegistration ? (_jsxs("div", { className: "auth-switch", children: [_jsx("button", { className: mode === "login" ? "active" : "", onClick: () => onModeChange("login"), children: "Entrar" }), _jsx("button", { className: mode === "register" ? "active" : "", onClick: () => onModeChange("register"), children: "Registro" })] })) : null, _jsxs("form", { className: "form-grid auth-form-grid", onSubmit: handleSubmit, autoComplete: "on", children: [_jsx("input", { id: "auth-email", name: "email", type: "email", inputMode: "email", autoComplete: mode === "login" ? "username" : "email", "aria-label": "Correo", placeholder: "Correo", value: email, onChange: (event) => setEmail(event.target.value) }), _jsx("input", { id: "auth-password", name: "password", type: "password", autoComplete: mode === "login" ? "current-password" : "new-password", "aria-label": "Contrasena", placeholder: "Contrasena", value: password, onChange: (event) => setPassword(event.target.value) }), mode === "register" && allowPublicRegistration ? (_jsxs("select", { id: "auth-role", name: "role", autoComplete: "off", value: role, onChange: (event) => setRole(event.target.value), children: [_jsx("option", { value: "player", children: "Jugador" }), _jsx("option", { value: "gm", children: "Director de Juego" })] })) : null, error ? _jsx("p", { className: "error auth-error", children: error }) : null, !allowPublicRegistration ? _jsx("p", { className: "meta-text", children: "El acceso se gestiona solo con cuentas creadas por el administrador." }) : null, _jsx("button", { className: "auth-submit", type: "submit", disabled: isSubmitting, children: isSubmitting ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta" })] })] }) }));
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
