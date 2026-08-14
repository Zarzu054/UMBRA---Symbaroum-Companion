import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
const ConfirmationDialogContext = createContext(null);
export function ConfirmationDialogProvider({ children }) {
    const [pending, setPending] = useState(null);
    const pendingRef = useRef(null);
    const openerRef = useRef(null);
    const confirmButtonRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();
    useBodyScrollLock(Boolean(pending));
    const requestConfirmation = useCallback((options) => new Promise((resolve) => {
        pendingRef.current?.resolve(false);
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const next = { ...options, resolve };
        pendingRef.current = next;
        setPending(next);
    }), []);
    const settle = useCallback((confirmed) => {
        const current = pendingRef.current;
        if (!current)
            return;
        pendingRef.current = null;
        setPending(null);
        current.resolve(confirmed);
        window.setTimeout(() => openerRef.current?.focus(), 0);
    }, []);
    useEffect(() => {
        if (!pending)
            return;
        confirmButtonRef.current?.focus();
        const handleKeyDown = (event) => {
            if (event.key !== "Escape")
                return;
            event.preventDefault();
            settle(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [pending, settle]);
    useEffect(() => () => pendingRef.current?.resolve(false), []);
    return (_jsxs(ConfirmationDialogContext.Provider, { value: requestConfirmation, children: [children, pending ? (_jsx("div", { className: "modal-backdrop confirmation-dialog-backdrop", onClick: () => settle(false), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal confirmation-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": titleId, "aria-describedby": descriptionId, onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { id: titleId, children: pending.title }), _jsx("p", { id: descriptionId, className: "section-help", children: pending.message }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { ref: confirmButtonRef, type: "button", className: pending.tone === "danger" ? "destructive-button" : undefined, onClick: () => settle(true), children: pending.confirmLabel ?? "Confirmar" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => settle(false), children: pending.cancelLabel ?? "Cancelar" })] })] }) })) : null] }));
}
export function useConfirmationDialog() {
    const requestConfirmation = useContext(ConfirmationDialogContext);
    return requestConfirmation ?? (() => Promise.resolve(false));
}
