import { useAuthController } from "./controllers/authController";
import { AuthGatewayView } from "./views/AuthGatewayView";
import { CharacterDashboardView } from "./views/CharacterDashboardView";
import { SuperAdminDashboardView } from "./views/SuperAdminDashboardView";

export function App() {
  const auth = useAuthController();

  if (auth.isBootstrapping) {
    return (
      <main className="page">
        <section className="panel">
          <p>Cargando sesión...</p>
        </section>
      </main>
    );
  }

  if (!auth.auth) {
    return (
      <AuthGatewayView
        mode={auth.authMode}
        isSubmitting={auth.isSubmitting}
        error={auth.error}
        onModeChange={auth.setAuthMode}
        onLogin={auth.login}
        onRegister={auth.register}
      />
    );
  }

  if (auth.auth.user.role === "superadmin") {
    return (
      <SuperAdminDashboardView
        user={auth.auth.user}
        ensureAccessToken={auth.ensureAccessToken}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <CharacterDashboardView
      user={auth.auth.user}
      ensureAccessToken={auth.ensureAccessToken}
      onLogout={auth.logout}
    />
  );
}
