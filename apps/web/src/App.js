import { jsx as _jsx } from "react/jsx-runtime";
import { useAuthController } from "./controllers/authController";
import { AuthGatewayView, ForcedPasswordChangeView } from "./views/AuthGatewayView";
import { CharacterDashboardView } from "./views/CharacterDashboardView";
import { SuperAdminDashboardView } from "./views/SuperAdminDashboardView";
export function App() {
    const auth = useAuthController();
    if (auth.isBootstrapping) {
        return (_jsx("main", { className: "page", children: _jsx("section", { className: "panel", children: _jsx("p", { children: "Cargando sesi\u00F3n..." }) }) }));
    }
    if (!auth.auth) {
        return (_jsx(AuthGatewayView, { mode: auth.authMode, isSubmitting: auth.isSubmitting, error: auth.error, onModeChange: auth.setAuthMode, onLogin: auth.login, onRegister: auth.register }));
    }
    if (auth.auth.user.mustChangePassword) {
        return (_jsx(ForcedPasswordChangeView, { email: auth.auth.user.email, isSubmitting: auth.isSubmitting, error: auth.error, onSubmit: (input) => auth.rotatePassword(input.currentPassword, input.newPassword) }));
    }
    if (auth.auth.user.role === "superadmin") {
        return (_jsx(SuperAdminDashboardView, { user: auth.auth.user, ensureAccessToken: auth.ensureAccessToken, onLogout: auth.logout }));
    }
    return (_jsx(CharacterDashboardView, { user: auth.auth.user, ensureAccessToken: auth.ensureAccessToken, onLogout: auth.logout }));
}
