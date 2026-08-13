import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CharacterChangeEvent } from "@umbra/shared";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { presentCharacterChanges, type PresentedCharacterChange } from "../models/characterChangePresentation";
import { fetchCharacterChangeLog, markCharacterChangeLogRead } from "../services/characterService";

type Props = {
  characterId: string;
  characterName: string;
  ensureAccessToken: () => Promise<string>;
  onClose: () => void;
  onRead: () => void | Promise<void>;
};

type ChangeSession = {
  key: string;
  actorId: string;
  actorEmail: string;
  actorRole: CharacterChangeEvent["actorRole"];
  startedAt: string;
  endedAt: string;
  unread: boolean;
  events: CharacterChangeEvent[];
};

const SESSION_WINDOW_MS = 5 * 60 * 1000;

function groupEvents(events: CharacterChangeEvent[]): ChangeSession[] {
  const groups: ChangeSession[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const lastDate = last ? new Date(last.startedAt).getTime() : 0;
    const eventDate = new Date(event.createdAt).getTime();
    if (last && last.actorId === event.actorId && Math.abs(lastDate - eventDate) <= SESSION_WINDOW_MS) {
      last.events.push(event);
      last.startedAt = event.createdAt;
      last.unread ||= event.isUnread;
    } else {
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

function roleLabel(role: CharacterChangeEvent["actorRole"]): string {
  if (role === "gm") return "DJ";
  if (role === "superadmin") return "Superadmin";
  return "Jugador";
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    sheet: "Hoja",
    builder: "Constructor",
    experience: "Experiencia",
    artifact: "Artefacto",
    profession: "Profesión",
    campaign_link: "Campaña"
  };
  return labels[source] ?? "Ficha";
}

function ChangeRow({ change }: { change: PresentedCharacterChange }) {
  return (
    <li className={`character-change-row is-${change.operation}`}>
      <div className="character-change-summary">
        <span className="character-change-section">{change.section}</span>
        <strong>{change.title}</strong>
        {change.description ? <span className="character-change-description">{change.description}</span> : null}
      </div>
      {change.before !== undefined || change.after !== undefined ? (
        <div className="character-change-values">
          {change.before !== undefined ? <span>{change.before}</span> : null}
          {change.before !== undefined && change.after !== undefined ? <span aria-hidden="true">→</span> : null}
          {change.after !== undefined ? <span>{change.after}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export function CharacterChangeLogModal({ characterId, characterName, ensureAccessToken, onClose, onRead }: Props) {
  const [events, setEvents] = useState<CharacterChangeEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock(true);

  async function load(cursor?: string): Promise<void> {
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => { void load(); }, [characterId]);
  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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

  return createPortal(
    <section className="modal-backdrop character-change-log-backdrop" onClick={onClose}>
      <div className="modal-panel character-change-log-modal" role="dialog" aria-modal="true" aria-labelledby="character-change-log-title" onClick={(event) => event.stopPropagation()}>
        <header className="row-actions character-change-log-header">
          <div><h2 id="character-change-log-title">Historial de {characterName}</h2><p className="section-help">Cambios realizados por el jugador y el director de juego.</p></div>
          <button ref={closeButtonRef} type="button" onClick={onClose}>Cerrar</button>
        </header>
        <div className="character-change-log-body">
          {loading ? <p className="section-help">Cargando historial...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && sessions.length === 0 ? <p className="section-help">Todavía no hay cambios registrados.</p> : null}
          {sessions.map((session) => (
            <article key={session.key} className={`character-change-session${session.unread ? " is-unread" : ""}`}>
              <header>
                <div><strong>{session.actorEmail}</strong><span>{roleLabel(session.actorRole)}</span></div>
                <time>{new Date(session.startedAt).toLocaleString()} {session.startedAt !== session.endedAt ? `– ${new Date(session.endedAt).toLocaleTimeString()}` : ""}</time>
              </header>
              {session.unread ? <span className="character-change-unread-label">Nuevo</span> : null}
              {session.events.map((event) => (
                <section key={event.id} className="character-change-event">
                  <div className="character-change-event-title">
                    <div>
                      <strong>{event.summary}</strong>
                      <span className="compendium-chip">{sourceLabel(event.source)}</span>
                      {event.campaignName ? <span className="compendium-chip">{event.campaignName}</span> : null}
                    </div>
                    <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
                  </div>
                  <ul>{event.presentedChanges.map((change) => <ChangeRow key={`${event.id}-${change.key}`} change={change} />)}</ul>
                </section>
              ))}
            </article>
          ))}
          {nextCursor ? <button type="button" className="subtle-button character-change-load-more" disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? "Cargando..." : "Cargar cambios anteriores"}</button> : null}
        </div>
      </div>
    </section>,
    document.body
  );
}
