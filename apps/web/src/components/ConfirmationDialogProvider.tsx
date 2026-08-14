import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

export type ConfirmationDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PendingConfirmation = ConfirmationDialogOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmationRequest = (options: ConfirmationDialogOptions) => Promise<boolean>;

const ConfirmationDialogContext = createContext<ConfirmationRequest | null>(null);

export function ConfirmationDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useBodyScrollLock(Boolean(pending));

  const requestConfirmation = useCallback<ConfirmationRequest>((options) => new Promise<boolean>((resolve) => {
    pendingRef.current?.resolve(false);
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const next = { ...options, resolve };
    pendingRef.current = next;
    setPending(next);
  }), []);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      settle(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pending, settle]);

  useEffect(() => () => pendingRef.current?.resolve(false), []);

  return (
    <ConfirmationDialogContext.Provider value={requestConfirmation}>
      {children}
      {pending ? (
        <div className="modal-backdrop confirmation-dialog-backdrop" onClick={() => settle(false)}>
          <div
            className="panel modal-panel character-roll-confirm-modal confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={titleId}>{pending.title}</h3>
            <p id={descriptionId} className="section-help">{pending.message}</p>
            <div className="row-actions character-roll-confirm-actions">
              <button
                ref={confirmButtonRef}
                type="button"
                className={pending.tone === "danger" ? "destructive-button" : undefined}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirmar"}
              </button>
              <button type="button" className="subtle-button" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancelar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmationDialogContext.Provider>
  );
}

export function useConfirmationDialog(): ConfirmationRequest {
  const requestConfirmation = useContext(ConfirmationDialogContext);
  return requestConfirmation ?? (() => Promise.resolve(false));
}
