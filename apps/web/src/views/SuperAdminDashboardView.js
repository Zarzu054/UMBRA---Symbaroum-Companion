import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useSuperAdminController } from "../controllers/superadminController";
const STATUS_LABELS = {
    active: "Activa",
    pending: "Pendiente",
    deactivated: "Desactivada"
};
const ROLE_LABELS = {
    player: "Jugador",
    gm: "Director de Juego"
};
const REASON_OPTIONS = [
    { value: "access_no_longer_required", label: "El acceso ya no es necesario" },
    { value: "policy_violation", label: "Incumplimiento de las normas de uso" },
    { value: "security_concern", label: "Motivo de seguridad" },
    { value: "duplicate_or_error", label: "Cuenta duplicada o creada por error" },
    { value: "other", label: "Otro motivo" }
];
const EVENT_LABELS = {
    created: "Cuenta creada",
    deactivated: "Cuenta desactivada",
    reactivated: "Cuenta reactivada",
    sessions_revoked: "Sesiones revocadas",
    credentials_resent: "Credenciales reenviadas"
};
export function SuperAdminDashboardView({ user, ensureAccessToken, onLogout }) {
    const controller = useSuperAdminController(ensureAccessToken);
    const [modal, setModal] = useState(null);
    const [detailUser, setDetailUser] = useState(null);
    const [toast, setToast] = useState(null);
    const [createForm, setCreateForm] = useState({ email: "", role: "player" });
    const [deactivateForm, setDeactivateForm] = useState({
        reason: "access_no_longer_required",
        explanation: ""
    });
    useBodyScrollLock(Boolean(modal || detailUser));
    const totalPages = Math.max(1, Math.ceil(controller.data.total / controller.data.pageSize));
    const activeDetailUser = useMemo(() => controller.data.items.find((entry) => entry.id === detailUser?.id) ?? detailUser, [controller.data.items, detailUser]);
    useEffect(() => {
        if (!modal && !detailUser)
            return;
        const handleKeyDown = (event) => {
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
        if (!toast)
            return;
        const timer = window.setTimeout(() => setToast(null), 5000);
        return () => window.clearTimeout(timer);
    }, [toast]);
    function showMutationResult(result, successMessage) {
        if (result.event.notificationStatus === "failed") {
            setToast({
                tone: "warning",
                message: `${successMessage} El correo no pudo enviarse; queda pendiente para reintentar.`
            });
            return;
        }
        setToast({ tone: "success", message: successMessage });
    }
    async function handleCreate(event) {
        event.preventDefault();
        try {
            const result = await controller.createUser(createForm);
            setModal(null);
            setCreateForm({ email: "", role: "player" });
            showMutationResult(result, "Cuenta creada correctamente.");
        }
        catch {
            // The controller exposes the friendly error in the modal.
        }
    }
    async function handleDeactivate(event, target) {
        event.preventDefault();
        try {
            const result = await controller.deactivateUser(target.id, deactivateForm);
            setModal(null);
            setDeactivateForm({ reason: "access_no_longer_required", explanation: "" });
            showMutationResult(result, "La cuenta ha sido desactivada y sus sesiones se han cerrado.");
        }
        catch {
            // The controller exposes the friendly error in the modal.
        }
    }
    async function handleReactivate(target) {
        try {
            const result = await controller.reactivateUser(target.id);
            setModal(null);
            showMutationResult(result, "La cuenta ha sido reactivada con nuevas credenciales temporales.");
        }
        catch {
            // The controller exposes the friendly error in the modal.
        }
    }
    async function handleRevoke(target) {
        try {
            await controller.revokeSessions(target.id);
            setModal(null);
            setToast({ tone: "success", message: "Todas las sesiones activas han sido revocadas." });
        }
        catch {
            // The controller exposes the friendly error in the modal.
        }
    }
    async function openDetail(target) {
        setDetailUser(target);
        await controller.loadEvents(target.id);
    }
    async function handleRetry(event) {
        if (!activeDetailUser)
            return;
        try {
            const result = await controller.retryEmail(activeDetailUser.id, event.id);
            showMutationResult(result, "El correo se ha reenviado correctamente.");
        }
        catch {
            // The controller exposes the friendly error in the drawer.
        }
    }
    function renderActions(target) {
        const isBusy = controller.operationUserId === target.id;
        return (_jsxs("div", { className: "admin-account-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: isBusy, onClick: () => void openDetail(target), children: "Historial" }), target.status === "deactivated" ? (_jsx("button", { type: "button", disabled: isBusy, onClick: () => setModal({ kind: "reactivate", user: target }), children: "Reactivar" })) : (_jsxs(_Fragment, { children: [target.activeRefreshTokens > 0 ? (_jsx("button", { type: "button", className: "subtle-button", disabled: isBusy, onClick: () => setModal({ kind: "revoke", user: target }), children: "Revocar sesiones" })) : null, _jsx("button", { type: "button", className: "danger", disabled: isBusy, onClick: () => setModal({ kind: "deactivate", user: target }), children: "Desactivar" })] }))] }));
    }
    return (_jsxs("main", { className: "page admin-page", children: [_jsxs("header", { className: "admin-hero", children: [_jsxs("div", { children: [_jsx("span", { className: "admin-eyebrow", children: "UMBRA \u00B7 Administraci\u00F3n" }), _jsx("h1", { children: "Gesti\u00F3n de cuentas" }), _jsx("p", { children: "Administra el acceso de jugadores y directores sin entrar en los m\u00F3dulos de juego." })] }), _jsxs("div", { className: "admin-session", children: [_jsx("span", { children: user.email }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => void onLogout(), children: "Cerrar sesi\u00F3n" })] })] }), _jsxs("section", { className: "admin-summary-grid", "aria-label": "Resumen de cuentas", children: [_jsx(SummaryCard, { label: "Activas", value: controller.data.counts.active, tone: "active", onClick: () => controller.updateFilters({ status: "active" }) }), _jsx(SummaryCard, { label: "Pendientes", value: controller.data.counts.pending, tone: "pending", onClick: () => controller.updateFilters({ status: "pending" }) }), _jsx(SummaryCard, { label: "Desactivadas", value: controller.data.counts.deactivated, tone: "deactivated", onClick: () => controller.updateFilters({ status: "deactivated" }) }), _jsx(SummaryCard, { label: "Correos pendientes", value: controller.data.counts.notificationAttention, tone: "attention" })] }), _jsxs("section", { className: "panel admin-directory", children: [_jsxs("div", { className: "admin-directory-heading", children: [_jsxs("div", { children: [_jsx("h2", { children: "Cuentas de usuario" }), _jsxs("p", { className: "section-help", children: [controller.data.total, " cuenta(s) coinciden con los filtros actuales."] })] }), _jsxs("div", { className: "admin-heading-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.isLoading, onClick: () => void controller.refresh(), children: "Actualizar" }), _jsx("button", { type: "button", onClick: () => setModal({ kind: "create" }), children: "Crear cuenta" })] })] }), _jsxs("div", { className: "admin-filters", children: [_jsxs("label", { className: "field admin-search", children: [_jsx("span", { children: "Buscar por correo" }), _jsx("input", { type: "search", placeholder: "usuario@correo.com", value: controller.filters.query, onChange: (event) => controller.updateFilters({ query: event.target.value }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Rol" }), _jsxs("select", { value: controller.filters.role, onChange: (event) => controller.updateFilters({ role: event.target.value }), children: [_jsx("option", { value: "all", children: "Todos" }), _jsx("option", { value: "player", children: "Jugadores" }), _jsx("option", { value: "gm", children: "Directores de Juego" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Estado" }), _jsxs("select", { value: controller.filters.status, onChange: (event) => controller.updateFilters({ status: event.target.value }), children: [_jsx("option", { value: "all", children: "Todos" }), _jsx("option", { value: "active", children: "Activas" }), _jsx("option", { value: "pending", children: "Pendientes" }), _jsx("option", { value: "deactivated", children: "Desactivadas" })] })] })] }), controller.error && !modal && !detailUser ? _jsx("p", { className: "error admin-global-error", children: controller.error }) : null, controller.isLoading ? (_jsxs("div", { className: "admin-loading", "aria-live": "polite", children: [_jsx("span", { className: "admin-spinner" }), _jsx("p", { children: "Cargando cuentas..." })] })) : controller.data.items.length === 0 ? (_jsxs("div", { className: "admin-empty", children: [_jsx("strong", { children: "No hay cuentas que mostrar" }), _jsx("p", { children: "Prueba a cambiar los filtros o crea una nueva cuenta." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "table-wrap admin-table-wrap", children: _jsxs("table", { className: "admin-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Cuenta" }), _jsx("th", { children: "Rol" }), _jsx("th", { children: "Estado" }), _jsx("th", { children: "Alta" }), _jsx("th", { children: "Sesiones" }), _jsx("th", { children: "Acciones" })] }) }), _jsx("tbody", { children: controller.data.items.map((target) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("strong", { children: target.email }), target.notificationAttention ? _jsx("span", { className: "admin-mail-warning", children: "Correo pendiente" }) : null] }), _jsx("td", { children: ROLE_LABELS[target.role] }), _jsx("td", { children: _jsx(StatusBadge, { status: target.status }) }), _jsx("td", { children: formatDate(target.createdAt) }), _jsx("td", { children: target.activeRefreshTokens }), _jsx("td", { children: renderActions(target) })] }, target.id))) })] }) }), _jsx("div", { className: "admin-mobile-list", children: controller.data.items.map((target) => (_jsxs("article", { className: "admin-account-card", children: [_jsxs("div", { className: "admin-account-card-head", children: [_jsxs("div", { children: [_jsx("strong", { children: target.email }), _jsxs("span", { children: [ROLE_LABELS[target.role], " \u00B7 Alta ", formatDate(target.createdAt)] })] }), _jsx(StatusBadge, { status: target.status })] }), _jsxs("div", { className: "admin-account-card-meta", children: [_jsxs("span", { children: [target.activeRefreshTokens, " sesi\u00F3n(es) activa(s)"] }), target.notificationAttention ? _jsx("span", { className: "admin-mail-warning", children: "Correo pendiente" }) : null] }), renderActions(target)] }, target.id))) })] })), _jsxs("nav", { className: "admin-pagination", "aria-label": "Paginaci\u00F3n de cuentas", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.filters.page <= 1 || controller.isLoading, onClick: () => controller.updateFilters({ page: controller.filters.page - 1 }), children: "Anterior" }), _jsxs("span", { children: ["P\u00E1gina ", controller.filters.page, " de ", totalPages] }), _jsx("button", { type: "button", className: "subtle-button", disabled: controller.filters.page >= totalPages || controller.isLoading, onClick: () => controller.updateFilters({ page: controller.filters.page + 1 }), children: "Siguiente" })] })] }), toast ? (_jsxs("div", { className: `admin-toast is-${toast.tone}`, role: "status", children: [_jsx("span", { children: toast.message }), _jsx("button", { type: "button", "aria-label": "Cerrar aviso", onClick: () => setToast(null), children: "\u00D7" })] })) : null, modal?.kind === "create" ? (_jsx(AdminDialog, { title: "Crear una cuenta", onClose: () => setModal(null), busy: controller.isSaving, children: _jsxs("form", { className: "admin-dialog-form", onSubmit: (event) => void handleCreate(event), children: [_jsx("p", { className: "section-help", children: "UMBRA generar\u00E1 una contrase\u00F1a temporal y la enviar\u00E1 por correo. La persona deber\u00E1 cambiarla al iniciar sesi\u00F3n." }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Correo electr\u00F3nico" }), _jsx("input", { autoFocus: true, required: true, type: "email", autoComplete: "off", value: createForm.email, onChange: (event) => setCreateForm((current) => ({ ...current, email: event.target.value })) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Rol" }), _jsxs("select", { value: createForm.role, onChange: (event) => setCreateForm((current) => ({ ...current, role: event.target.value })), children: [_jsx("option", { value: "player", children: "Jugador" }), _jsx("option", { value: "gm", children: "Director de Juego" })] })] }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, _jsxs("div", { className: "admin-dialog-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.isSaving, onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { type: "submit", disabled: controller.isSaving || !createForm.email.trim(), children: controller.isSaving ? "Creando..." : "Crear y enviar acceso" })] })] }) })) : null, modal?.kind === "deactivate" ? (_jsx(AdminDialog, { title: "Desactivar cuenta", onClose: () => setModal(null), busy: controller.isSaving, children: _jsxs("form", { className: "admin-dialog-form", onSubmit: (event) => void handleDeactivate(event, modal.user), children: [_jsxs("div", { className: "admin-danger-note", children: [_jsx("strong", { children: modal.user.email }), _jsx("p", { children: "El acceso finalizar\u00E1 de inmediato y se cerrar\u00E1n todas sus sesiones. Sus personajes y campa\u00F1as se conservar\u00E1n." })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Motivo" }), _jsx("select", { value: deactivateForm.reason, onChange: (event) => setDeactivateForm((current) => ({ ...current, reason: event.target.value })), children: REASON_OPTIONS.map((reason) => _jsx("option", { value: reason.value, children: reason.label }, reason.value)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Explicaci\u00F3n para la persona" }), _jsx("textarea", { autoFocus: true, required: true, minLength: 10, maxLength: 500, rows: 5, value: deactivateForm.explanation, onChange: (event) => setDeactivateForm((current) => ({ ...current, explanation: event.target.value })) }), _jsxs("small", { children: [deactivateForm.explanation.length, "/500 \u00B7 m\u00EDnimo 10 caracteres"] })] }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, _jsxs("div", { className: "admin-dialog-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.isSaving, onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { type: "submit", className: "danger", disabled: controller.isSaving || deactivateForm.explanation.trim().length < 10, children: controller.isSaving ? "Desactivando..." : "Desactivar y notificar" })] })] }) })) : null, modal?.kind === "reactivate" ? (_jsx(AdminDialog, { title: "Reactivar cuenta", onClose: () => setModal(null), busy: controller.isSaving, children: _jsxs("div", { className: "admin-dialog-form", children: [_jsxs("p", { children: ["Se generar\u00E1 una nueva contrase\u00F1a temporal para ", _jsx("strong", { children: modal.user.email }), ". Las credenciales anteriores dejar\u00E1n de funcionar."] }), _jsx("p", { className: "section-help", children: "La cuenta permanecer\u00E1 pendiente si el correo no puede enviarse." }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, _jsxs("div", { className: "admin-dialog-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.isSaving, onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: controller.isSaving, onClick: () => void handleReactivate(modal.user), children: controller.isSaving ? "Reactivando..." : "Reactivar y enviar acceso" })] })] }) })) : null, modal?.kind === "revoke" ? (_jsx(AdminDialog, { title: "Revocar sesiones", onClose: () => setModal(null), busy: controller.isSaving, children: _jsxs("div", { className: "admin-dialog-form", children: [_jsxs("p", { children: ["Se cerrar\u00E1n las ", modal.user.activeRefreshTokens, " sesi\u00F3n(es) activa(s) de ", _jsx("strong", { children: modal.user.email }), "."] }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, _jsxs("div", { className: "admin-dialog-actions", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: controller.isSaving, onClick: () => setModal(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: controller.isSaving, onClick: () => void handleRevoke(modal.user), children: controller.isSaving ? "Revocando..." : "Revocar sesiones" })] })] }) })) : null, activeDetailUser ? (_jsx("section", { className: "admin-drawer-backdrop", onClick: () => { setDetailUser(null); controller.closeEvents(); }, children: _jsxs("aside", { className: "admin-drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "admin-history-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "admin-drawer-header", children: [_jsxs("div", { children: [_jsx("span", { className: "admin-eyebrow", children: "Historial de cuenta" }), _jsx("h2", { id: "admin-history-title", children: activeDetailUser.email }), _jsxs("div", { className: "admin-drawer-badges", children: [_jsx(StatusBadge, { status: activeDetailUser.status }), _jsx("span", { children: ROLE_LABELS[activeDetailUser.role] })] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => { setDetailUser(null); controller.closeEvents(); }, children: "Cerrar" })] }), controller.error ? _jsx("p", { className: "error", children: controller.error }) : null, controller.isLoadingEvents ? (_jsxs("div", { className: "admin-loading", children: [_jsx("span", { className: "admin-spinner" }), _jsx("p", { children: "Cargando historial..." })] })) : controller.events.length === 0 ? (_jsx("div", { className: "admin-empty", children: _jsx("strong", { children: "Sin actividad registrada" }) })) : (_jsx("ol", { className: "admin-timeline", children: controller.events.map((event) => {
                                const canRetry = event.notificationStatus === "failed" ||
                                    event.notificationStatus === "pending" ||
                                    (event.notificationStatus === "sent" &&
                                        activeDetailUser.mustChangePassword &&
                                        event.action !== "deactivated" &&
                                        event.action !== "sessions_revoked");
                                return (_jsxs("li", { children: [_jsx("span", { className: `admin-timeline-marker is-${event.notificationStatus}` }), _jsxs("div", { className: "admin-timeline-card", children: [_jsxs("div", { className: "admin-timeline-title", children: [_jsx("strong", { children: EVENT_LABELS[event.action] }), _jsx("time", { children: formatDateTime(event.createdAt) })] }), _jsxs("p", { children: ["Realizado por ", event.actorEmail] }), event.reason ? _jsxs("p", { children: [_jsx("strong", { children: "Motivo:" }), " ", REASON_OPTIONS.find((entry) => entry.value === event.reason)?.label] }) : null, event.explanation ? _jsx("p", { children: event.explanation }) : null, event.notificationStatus !== "not_required" ? (_jsxs("div", { className: "admin-event-mail", children: [_jsxs("span", { className: `admin-mail-state is-${event.notificationStatus}`, children: ["Correo ", event.notificationStatus === "sent" ? "enviado" : event.notificationStatus === "failed" ? "fallido" : "pendiente"] }), _jsxs("span", { children: [event.notificationAttempts, " intento(s)"] }), canRetry ? (_jsx("button", { type: "button", className: "subtle-button", disabled: controller.operationUserId === activeDetailUser.id, onClick: () => void handleRetry(event), children: event.notificationStatus === "sent" ? "Reenviar credenciales" : "Reintentar correo" })) : null] })) : null] })] }, event.id));
                            }) }))] }) })) : null] }));
}
function SummaryCard({ label, value, tone, onClick }) {
    if (!onClick) {
        return (_jsxs("div", { className: `admin-summary-card is-${tone}`, children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
    }
    return (_jsxs("button", { type: "button", className: `admin-summary-card is-${tone}`, onClick: onClick, children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function StatusBadge({ status }) {
    return _jsx("span", { className: `admin-status-badge is-${status}`, children: STATUS_LABELS[status] });
}
function AdminDialog({ title, busy, onClose, children }) {
    const dialogRef = useRef(null);
    const previousFocusRef = useRef(typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog)
            return;
        const getFocusable = () => Array.from(dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
        if (!dialog.contains(document.activeElement)) {
            getFocusable()[0]?.focus();
        }
        const trapFocus = (event) => {
            if (event.key !== "Tab")
                return;
            const focusable = getFocusable();
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
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
    return (_jsx("section", { className: "modal-backdrop", onClick: () => { if (!busy)
            onClose(); }, children: _jsxs("div", { ref: dialogRef, className: "panel modal-panel admin-dialog", role: "dialog", tabIndex: -1, "aria-modal": "true", "aria-labelledby": "admin-dialog-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "admin-dialog-header", children: [_jsx("h2", { id: "admin-dialog-title", children: title }), _jsx("button", { type: "button", className: "subtle-button", disabled: busy, "aria-label": "Cerrar", onClick: onClose, children: "\u00D7" })] }), children] }) }));
}
function formatDate(value) {
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function formatDateTime(value) {
    return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}
