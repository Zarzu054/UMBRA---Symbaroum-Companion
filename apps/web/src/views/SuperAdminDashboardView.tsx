import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminAccountEvent,
  AdminAccountMutationResult,
  AdminDeactivationReason,
  AdminUserSummary,
  AuthUser,
  CreateManagedUserInput,
  DeactivateManagedUserInput
} from "@umbra/shared";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useSuperAdminController } from "../controllers/superadminController";
import { AppTopNavigation } from "../components/AppTopNavigation";

type Props = {
  user: AuthUser;
  ensureAccessToken: () => Promise<string>;
  onLogout: () => Promise<void>;
};

type AdminModal =
  | { kind: "create" }
  | { kind: "deactivate"; user: AdminUserSummary }
  | { kind: "reactivate"; user: AdminUserSummary }
  | { kind: "revoke"; user: AdminUserSummary }
  | null;

const STATUS_LABELS = {
  active: "Activa",
  pending: "Pendiente",
  deactivated: "Desactivada"
} as const;

const ROLE_LABELS = {
  player: "Jugador",
  gm: "Director de Juego"
} as const;

const REASON_OPTIONS: Array<{ value: AdminDeactivationReason; label: string }> = [
  { value: "access_no_longer_required", label: "El acceso ya no es necesario" },
  { value: "policy_violation", label: "Incumplimiento de las normas de uso" },
  { value: "security_concern", label: "Motivo de seguridad" },
  { value: "duplicate_or_error", label: "Cuenta duplicada o creada por error" },
  { value: "other", label: "Otro motivo" }
];

const EVENT_LABELS: Record<AdminAccountEvent["action"], string> = {
  created: "Cuenta creada",
  deactivated: "Cuenta desactivada",
  reactivated: "Cuenta reactivada",
  sessions_revoked: "Sesiones revocadas",
  credentials_resent: "Credenciales reenviadas"
};

export function SuperAdminDashboardView({ user, ensureAccessToken, onLogout }: Props) {
  const controller = useSuperAdminController(ensureAccessToken);
  const [modal, setModal] = useState<AdminModal>(null);
  const [detailUser, setDetailUser] = useState<AdminUserSummary | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "warning"; message: string } | null>(null);
  const [createForm, setCreateForm] = useState<CreateManagedUserInput>({ email: "", role: "player" });
  const [deactivateForm, setDeactivateForm] = useState<DeactivateManagedUserInput>({
    reason: "access_no_longer_required",
    explanation: ""
  });
  useBodyScrollLock(Boolean(modal || detailUser));

  const totalPages = Math.max(1, Math.ceil(controller.data.total / controller.data.pageSize));
  const activeDetailUser = useMemo(
    () => controller.data.items.find((entry) => entry.id === detailUser?.id) ?? detailUser,
    [controller.data.items, detailUser]
  );

  useEffect(() => {
    if (!modal && !detailUser) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !controller.isSaving) {
        setModal(null);
        if (detailUser) {
          setDetailUser(null);
          controller.closeEvents();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, detailUser, controller.isSaving]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showMutationResult(result: AdminAccountMutationResult, successMessage: string): void {
    if (result.event.notificationStatus === "failed") {
      setToast({
        tone: "warning",
        message: `${successMessage} El correo no pudo enviarse; queda pendiente para reintentar.`
      });
      return;
    }
    setToast({ tone: "success", message: successMessage });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const result = await controller.createUser(createForm);
      setModal(null);
      setCreateForm({ email: "", role: "player" });
      showMutationResult(result, "Cuenta creada correctamente.");
    } catch {
      // The controller exposes the friendly error in the modal.
    }
  }

  async function handleDeactivate(event: React.FormEvent<HTMLFormElement>, target: AdminUserSummary): Promise<void> {
    event.preventDefault();
    try {
      const result = await controller.deactivateUser(target.id, deactivateForm);
      setModal(null);
      setDeactivateForm({ reason: "access_no_longer_required", explanation: "" });
      showMutationResult(result, "La cuenta ha sido desactivada y sus sesiones se han cerrado.");
    } catch {
      // The controller exposes the friendly error in the modal.
    }
  }

  async function handleReactivate(target: AdminUserSummary): Promise<void> {
    try {
      const result = await controller.reactivateUser(target.id);
      setModal(null);
      showMutationResult(result, "La cuenta ha sido reactivada con nuevas credenciales temporales.");
    } catch {
      // The controller exposes the friendly error in the modal.
    }
  }

  async function handleRevoke(target: AdminUserSummary): Promise<void> {
    try {
      await controller.revokeSessions(target.id);
      setModal(null);
      setToast({ tone: "success", message: "Todas las sesiones activas han sido revocadas." });
    } catch {
      // The controller exposes the friendly error in the modal.
    }
  }

  async function openDetail(target: AdminUserSummary): Promise<void> {
    setDetailUser(target);
    await controller.loadEvents(target.id);
  }

  async function handleRetry(event: AdminAccountEvent): Promise<void> {
    if (!activeDetailUser) return;
    try {
      const result = await controller.retryEmail(activeDetailUser.id, event.id);
      showMutationResult(result, "El correo se ha reenviado correctamente.");
    } catch {
      // The controller exposes the friendly error in the drawer.
    }
  }

  function renderActions(target: AdminUserSummary) {
    const isBusy = controller.operationUserId === target.id;
    return (
      <div className="admin-account-actions">
        <button type="button" className="subtle-button" disabled={isBusy} onClick={() => void openDetail(target)}>
          Historial
        </button>
        {target.status === "deactivated" ? (
          <button type="button" disabled={isBusy} onClick={() => setModal({ kind: "reactivate", user: target })}>
            Reactivar
          </button>
        ) : (
          <>
            {target.activeRefreshTokens > 0 ? (
              <button type="button" className="subtle-button" disabled={isBusy} onClick={() => setModal({ kind: "revoke", user: target })}>
                Revocar sesiones
              </button>
            ) : null}
            <button type="button" className="danger" disabled={isBusy} onClick={() => setModal({ kind: "deactivate", user: target })}>
              Desactivar
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <main className="page admin-page">
      <AppTopNavigation
        items={[]}
        currentTitle="Administración"
        userEmail={user.email}
        roleLabel="Superadministrador"
        onLogout={onLogout}
      />
      <header className="admin-hero">
        <div>
          <span className="admin-eyebrow">UMBRA · Administración</span>
          <h1>Gestión de cuentas</h1>
          <p>Administra el acceso de jugadores y directores sin entrar en los módulos de juego.</p>
        </div>
        <div className="admin-session">
          <span>{user.email}</span>
          <button type="button" className="subtle-button" onClick={() => void onLogout()}>Cerrar sesión</button>
        </div>
      </header>

      <section className="admin-summary-grid" aria-label="Resumen de cuentas">
        <SummaryCard label="Activas" value={controller.data.counts.active} tone="active" onClick={() => controller.updateFilters({ status: "active" })} />
        <SummaryCard label="Pendientes" value={controller.data.counts.pending} tone="pending" onClick={() => controller.updateFilters({ status: "pending" })} />
        <SummaryCard label="Desactivadas" value={controller.data.counts.deactivated} tone="deactivated" onClick={() => controller.updateFilters({ status: "deactivated" })} />
        <SummaryCard label="Correos pendientes" value={controller.data.counts.notificationAttention} tone="attention" />
      </section>

      <section className="panel admin-directory">
        <div className="admin-directory-heading">
          <div>
            <h2>Cuentas de usuario</h2>
            <p className="section-help">{controller.data.total} cuenta(s) coinciden con los filtros actuales.</p>
          </div>
          <div className="admin-heading-actions">
            <button type="button" className="subtle-button" disabled={controller.isLoading} onClick={() => void controller.refresh()}>
              Actualizar
            </button>
            <button type="button" onClick={() => setModal({ kind: "create" })}>Crear cuenta</button>
          </div>
        </div>

        <div className="admin-filters">
          <label className="field admin-search">
            <span>Buscar por correo</span>
            <input
              type="search"
              placeholder="usuario@correo.com"
              value={controller.filters.query}
              onChange={(event) => controller.updateFilters({ query: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Rol</span>
            <select
              value={controller.filters.role}
              onChange={(event) => controller.updateFilters({ role: event.target.value as "all" | "player" | "gm" })}
            >
              <option value="all">Todos</option>
              <option value="player">Jugadores</option>
              <option value="gm">Directores de Juego</option>
            </select>
          </label>
          <label className="field">
            <span>Estado</span>
            <select
              value={controller.filters.status}
              onChange={(event) => controller.updateFilters({ status: event.target.value as "all" | "active" | "pending" | "deactivated" })}
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="pending">Pendientes</option>
              <option value="deactivated">Desactivadas</option>
            </select>
          </label>
        </div>

        {controller.error && !modal && !detailUser ? <p className="error admin-global-error">{controller.error}</p> : null}

        {controller.isLoading ? (
          <div className="admin-loading" aria-live="polite">
            <span className="admin-spinner" />
            <p>Cargando cuentas...</p>
          </div>
        ) : controller.data.items.length === 0 ? (
          <div className="admin-empty">
            <strong>No hay cuentas que mostrar</strong>
            <p>Prueba a cambiar los filtros o crea una nueva cuenta.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Alta</th>
                    <th>Sesiones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {controller.data.items.map((target) => (
                    <tr key={target.id}>
                      <td>
                        <strong>{target.email}</strong>
                        {target.notificationAttention ? <span className="admin-mail-warning">Correo pendiente</span> : null}
                      </td>
                      <td>{ROLE_LABELS[target.role]}</td>
                      <td><StatusBadge status={target.status} /></td>
                      <td>{formatDate(target.createdAt)}</td>
                      <td>{target.activeRefreshTokens}</td>
                      <td>{renderActions(target)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-mobile-list">
              {controller.data.items.map((target) => (
                <article className="admin-account-card" key={target.id}>
                  <div className="admin-account-card-head">
                    <div>
                      <strong>{target.email}</strong>
                      <span>{ROLE_LABELS[target.role]} · Alta {formatDate(target.createdAt)}</span>
                    </div>
                    <StatusBadge status={target.status} />
                  </div>
                  <div className="admin-account-card-meta">
                    <span>{target.activeRefreshTokens} sesión(es) activa(s)</span>
                    {target.notificationAttention ? <span className="admin-mail-warning">Correo pendiente</span> : null}
                  </div>
                  {renderActions(target)}
                </article>
              ))}
            </div>
          </>
        )}

        <nav className="admin-pagination" aria-label="Paginación de cuentas">
          <button
            type="button"
            className="subtle-button"
            disabled={controller.filters.page <= 1 || controller.isLoading}
            onClick={() => controller.updateFilters({ page: controller.filters.page - 1 })}
          >
            Anterior
          </button>
          <span>Página {controller.filters.page} de {totalPages}</span>
          <button
            type="button"
            className="subtle-button"
            disabled={controller.filters.page >= totalPages || controller.isLoading}
            onClick={() => controller.updateFilters({ page: controller.filters.page + 1 })}
          >
            Siguiente
          </button>
        </nav>
      </section>

      {toast ? (
        <div className={`admin-toast is-${toast.tone}`} role="status">
          <span>{toast.message}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}

      {modal?.kind === "create" ? (
        <AdminDialog title="Crear una cuenta" onClose={() => setModal(null)} busy={controller.isSaving}>
          <form className="admin-dialog-form" onSubmit={(event) => void handleCreate(event)}>
            <p className="section-help">UMBRA generará una contraseña temporal y la enviará por correo. La persona deberá cambiarla al iniciar sesión.</p>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                autoFocus
                required
                type="email"
                autoComplete="off"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Rol</span>
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as "player" | "gm" }))}
              >
                <option value="player">Jugador</option>
                <option value="gm">Director de Juego</option>
              </select>
            </label>
            {controller.error ? <p className="error">{controller.error}</p> : null}
            <div className="admin-dialog-actions">
              <button type="button" className="subtle-button" disabled={controller.isSaving} onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" disabled={controller.isSaving || !createForm.email.trim()}>
                {controller.isSaving ? "Creando..." : "Crear y enviar acceso"}
              </button>
            </div>
          </form>
        </AdminDialog>
      ) : null}

      {modal?.kind === "deactivate" ? (
        <AdminDialog title="Desactivar cuenta" onClose={() => setModal(null)} busy={controller.isSaving}>
          <form className="admin-dialog-form" onSubmit={(event) => void handleDeactivate(event, modal.user)}>
            <div className="admin-danger-note">
              <strong>{modal.user.email}</strong>
              <p>El acceso finalizará de inmediato y se cerrarán todas sus sesiones. Sus personajes y campañas se conservarán.</p>
            </div>
            <label className="field">
              <span>Motivo</span>
              <select
                value={deactivateForm.reason}
                onChange={(event) => setDeactivateForm((current) => ({ ...current, reason: event.target.value as AdminDeactivationReason }))}
              >
                {REASON_OPTIONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Explicación para la persona</span>
              <textarea
                autoFocus
                required
                minLength={10}
                maxLength={500}
                rows={5}
                value={deactivateForm.explanation}
                onChange={(event) => setDeactivateForm((current) => ({ ...current, explanation: event.target.value }))}
              />
              <small>{deactivateForm.explanation.length}/500 · mínimo 10 caracteres</small>
            </label>
            {controller.error ? <p className="error">{controller.error}</p> : null}
            <div className="admin-dialog-actions">
              <button type="button" className="subtle-button" disabled={controller.isSaving} onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="danger" disabled={controller.isSaving || deactivateForm.explanation.trim().length < 10}>
                {controller.isSaving ? "Desactivando..." : "Desactivar y notificar"}
              </button>
            </div>
          </form>
        </AdminDialog>
      ) : null}

      {modal?.kind === "reactivate" ? (
        <AdminDialog title="Reactivar cuenta" onClose={() => setModal(null)} busy={controller.isSaving}>
          <div className="admin-dialog-form">
            <p>Se generará una nueva contraseña temporal para <strong>{modal.user.email}</strong>. Las credenciales anteriores dejarán de funcionar.</p>
            <p className="section-help">La cuenta permanecerá pendiente si el correo no puede enviarse.</p>
            {controller.error ? <p className="error">{controller.error}</p> : null}
            <div className="admin-dialog-actions">
              <button type="button" className="subtle-button" disabled={controller.isSaving} onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" disabled={controller.isSaving} onClick={() => void handleReactivate(modal.user)}>
                {controller.isSaving ? "Reactivando..." : "Reactivar y enviar acceso"}
              </button>
            </div>
          </div>
        </AdminDialog>
      ) : null}

      {modal?.kind === "revoke" ? (
        <AdminDialog title="Revocar sesiones" onClose={() => setModal(null)} busy={controller.isSaving}>
          <div className="admin-dialog-form">
            <p>Se cerrarán las {modal.user.activeRefreshTokens} sesión(es) activa(s) de <strong>{modal.user.email}</strong>.</p>
            {controller.error ? <p className="error">{controller.error}</p> : null}
            <div className="admin-dialog-actions">
              <button type="button" className="subtle-button" disabled={controller.isSaving} onClick={() => setModal(null)}>Cancelar</button>
              <button type="button" disabled={controller.isSaving} onClick={() => void handleRevoke(modal.user)}>
                {controller.isSaving ? "Revocando..." : "Revocar sesiones"}
              </button>
            </div>
          </div>
        </AdminDialog>
      ) : null}

      {activeDetailUser ? (
        <section className="admin-drawer-backdrop" onClick={() => { setDetailUser(null); controller.closeEvents(); }}>
          <aside
            className="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-drawer-header">
              <div>
                <span className="admin-eyebrow">Historial de cuenta</span>
                <h2 id="admin-history-title">{activeDetailUser.email}</h2>
                <div className="admin-drawer-badges">
                  <StatusBadge status={activeDetailUser.status} />
                  <span>{ROLE_LABELS[activeDetailUser.role]}</span>
                </div>
              </div>
              <button type="button" className="subtle-button" onClick={() => { setDetailUser(null); controller.closeEvents(); }}>Cerrar</button>
            </header>
            {controller.error ? <p className="error">{controller.error}</p> : null}
            {controller.isLoadingEvents ? (
              <div className="admin-loading"><span className="admin-spinner" /><p>Cargando historial...</p></div>
            ) : controller.events.length === 0 ? (
              <div className="admin-empty"><strong>Sin actividad registrada</strong></div>
            ) : (
              <ol className="admin-timeline">
                {controller.events.map((event) => {
                  const canRetry =
                    event.notificationStatus === "failed" ||
                    event.notificationStatus === "pending" ||
                    (event.notificationStatus === "sent" &&
                      activeDetailUser.mustChangePassword &&
                      event.action !== "deactivated" &&
                      event.action !== "sessions_revoked");
                  return (
                    <li key={event.id}>
                      <span className={`admin-timeline-marker is-${event.notificationStatus}`} />
                      <div className="admin-timeline-card">
                        <div className="admin-timeline-title">
                          <strong>{EVENT_LABELS[event.action]}</strong>
                          <time>{formatDateTime(event.createdAt)}</time>
                        </div>
                        <p>Realizado por {event.actorEmail}</p>
                        {event.reason ? <p><strong>Motivo:</strong> {REASON_OPTIONS.find((entry) => entry.value === event.reason)?.label}</p> : null}
                        {event.explanation ? <p>{event.explanation}</p> : null}
                        {event.notificationStatus !== "not_required" ? (
                          <div className="admin-event-mail">
                            <span className={`admin-mail-state is-${event.notificationStatus}`}>
                              Correo {event.notificationStatus === "sent" ? "enviado" : event.notificationStatus === "failed" ? "fallido" : "pendiente"}
                            </span>
                            <span>{event.notificationAttempts} intento(s)</span>
                            {canRetry ? (
                              <button
                                type="button"
                                className="subtle-button"
                                disabled={controller.operationUserId === activeDetailUser.id}
                                onClick={() => void handleRetry(event)}
                              >
                                {event.notificationStatus === "sent" ? "Reenviar credenciales" : "Reintentar correo"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </aside>
        </section>
      ) : null}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  onClick
}: {
  label: string;
  value: number;
  tone: string;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <div className={`admin-summary-card is-${tone}`}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    );
  }
  return (
    <button type="button" className={`admin-summary-card is-${tone}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function StatusBadge({ status }: { status: AdminUserSummary["status"] }) {
  return <span className={`admin-status-badge is-${status}`}>{STATUS_LABELS[status]}</span>;
}

function AdminDialog({
  title,
  busy,
  onClose,
  children
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
        )
      );
    if (!dialog.contains(document.activeElement)) {
      getFocusable()[0]?.focus();
    }

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <section className="modal-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div
        ref={dialogRef}
        className="panel modal-panel admin-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-dialog-header">
          <h2 id="admin-dialog-title">{title}</h2>
          <button type="button" className="subtle-button" disabled={busy} aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
