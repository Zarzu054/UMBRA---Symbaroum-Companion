import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { presentCharacterChanges } from "../models/characterChangePresentation";
import { fetchCharacterChangeLog, markCharacterChangeLogRead } from "../services/characterService";
const SESSION_WINDOW_MS = 5 * 60 * 1000;
function groupEvents(events) {
    const groups = [];
    for (const event of events) {
        const last = groups.at(-1);
        const lastDate = last ? new Date(last.startedAt).getTime() : 0;
        const eventDate = new Date(event.createdAt).getTime();
        if (last && last.actorId === event.actorId && Math.abs(lastDate - eventDate) <= SESSION_WINDOW_MS) {
            last.events.push(event);
            last.startedAt = event.createdAt;
            last.unread ||= event.isUnread;
        }
        else {
            groups.push({
                key: event.id,
                actorId: event.actorId,
                actorEmail: event.actorEmail,
                actorRole: event.actorRole,
                startedAt: event.createdAt,
                endedAt: event.createdAt,
                unread: event.isUnread,
                events: [event]
            });
        }
    }
    return groups;
}
function roleLabel(role) {
    if (role === "gm")
        return "DJ";
    if (role === "superadmin")
        return "Superadmin";
    return "Jugador";
}
function sourceLabel(source) {
    const labels = {
        sheet: "Hoja",
        builder: "Constructor",
        experience: "Experiencia",
        artifact: "Artefacto",
        profession: "Profesión",
        campaign_link: "Campaña"
    };
    return labels[source] ?? "Ficha";
}
function ChangeRow({ change }) {
    return (_jsxs("li", { className: `character-change-row is-${change.operation}`, children: [_jsxs("div", { className: "character-change-summary", children: [_jsx("span", { className: "character-change-section", children: change.section }), _jsx("strong", { children: change.title }), change.description ? _jsx("span", { className: "character-change-description", children: change.description }) : null] }), change.before !== undefined || change.after !== undefined ? (_jsxs("div", { className: "character-change-values", children: [change.before !== undefined ? _jsx("span", { children: change.before }) : null, change.before !== undefined && change.after !== undefined ? _jsx("span", { "aria-hidden": "true", children: "\u2192" }) : null, change.after !== undefined ? _jsx("span", { children: change.after }) : null] })) : null] }));
}
export function CharacterChangeLogModal({ characterId, characterName, ensureAccessToken, onClose, onRead }) {
    const [events, setEvents] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const closeButtonRef = useRef(null);
    const openerRef = useRef(null);
    useBodyScrollLock(true);
    async function load(cursor) {
        cursor ? setLoadingMore(true) : setLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            const page = await fetchCharacterChangeLog(characterId, token, cursor);
            setEvents((current) => cursor
                ? [...current, ...page.events.filter((event) => !current.some((entry) => entry.id === event.id))]
                : page.events);
            setNextCursor(page.nextCursor);
            if (!cursor) {
                await markCharacterChangeLogRead(characterId, token);
                await onRead();
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial");
        }
        finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }
    useEffect(() => { void load(); }, [characterId]);
    useEffect(() => {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeButtonRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            openerRef.current?.focus();
        };
    }, [onClose]);
    const sessions = useMemo(() => groupEvents(events)
        .map((session) => ({
        ...session,
        events: session.events
            .map((event) => ({ ...event, presentedChanges: presentCharacterChanges(event.changes) }))
            .filter((event) => event.presentedChanges.length > 0)
    }))
        .filter((session) => session.events.length > 0), [events]);
    return createPortal(_jsx("section", { className: "modal-backdrop character-change-log-backdrop", onClick: onClose, children: _jsxs("div", { className: "modal-panel character-change-log-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "character-change-log-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "row-actions character-change-log-header", children: [_jsxs("div", { children: [_jsxs("h2", { id: "character-change-log-title", children: ["Historial de ", characterName] }), _jsx("p", { className: "section-help", children: "Cambios realizados por el jugador y el director de juego." })] }), _jsx("button", { ref: closeButtonRef, type: "button", onClick: onClose, children: "Cerrar" })] }), _jsxs("div", { className: "character-change-log-body", children: [loading ? _jsx("p", { className: "section-help", children: "Cargando historial..." }) : null, error ? _jsx("p", { className: "error-text", children: error }) : null, !loading && !error && sessions.length === 0 ? _jsx("p", { className: "section-help", children: "Todav\u00EDa no hay cambios registrados." }) : null, sessions.map((session) => (_jsxs("article", { className: `character-change-session${session.unread ? " is-unread" : ""}`, children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("strong", { children: session.actorEmail }), _jsx("span", { children: roleLabel(session.actorRole) })] }), _jsxs("time", { children: [new Date(session.startedAt).toLocaleString(), " ", session.startedAt !== session.endedAt ? `– ${new Date(session.endedAt).toLocaleTimeString()}` : ""] })] }), session.unread ? _jsx("span", { className: "character-change-unread-label", children: "Nuevo" }) : null, session.events.map((event) => (_jsxs("section", { className: "character-change-event", children: [_jsxs("div", { className: "character-change-event-title", children: [_jsxs("div", { children: [_jsx("strong", { children: event.summary }), _jsx("span", { className: "compendium-chip", children: sourceLabel(event.source) }), event.campaignName ? _jsx("span", { className: "compendium-chip", children: event.campaignName }) : null] }), _jsx("time", { children: new Date(event.createdAt).toLocaleTimeString() })] }), _jsx("ul", { children: event.presentedChanges.map((change) => _jsx(ChangeRow, { change: change }, `${event.id}-${change.key}`)) })] }, event.id)))] }, session.key))), nextCursor ? _jsx("button", { type: "button", className: "subtle-button character-change-load-more", disabled: loadingMore, onClick: () => void load(nextCursor), children: loadingMore ? "Cargando..." : "Cargar cambios anteriores" }) : null] })] }) }), document.body);
}
