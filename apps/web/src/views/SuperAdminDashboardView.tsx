import type { AuthUser } from "@umbra/shared";
import { useSuperAdminController } from "../controllers/superadminController";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

export function SuperAdminDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useSuperAdminController(ensureAccessToken);

  return (
    <main className="page">
      <header className="top-bar">
        <div>
          <h1>Panel de Superadministracion</h1>
          <p>{user.email}</p>
        </div>
        <button onClick={() => void onLogout()}>Salir</button>
      </header>

      <section className="panel">
        <div className="row-actions">
          <h2>Usuarios</h2>
          <button onClick={() => void controller.refresh()}>Actualizar</button>
        </div>

        {controller.isLoading ? <p>Cargando usuarios...</p> : null}
        {controller.error ? <p className="error">{controller.error}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creado</th>
                <th>Sesiones activas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {controller.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>{u.activeRefreshTokens}</td>
                  <td>
                    <button onClick={() => void controller.revokeSessions(u.id)}>Revocar sesiones</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
