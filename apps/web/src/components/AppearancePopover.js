import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { AppearanceSelector } from "./AppearanceSelector";
const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
export function AppearancePopover() {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    function closeAndRestoreFocus() {
        setIsOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeAndRestoreFocus();
                return;
            }
            if (event.key !== "Tab" || !panelRef.current)
                return;
            const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
            if (focusable.length === 0)
                return;
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
        const handlePointerDown = (event) => {
            const target = event.target;
            if (panelRef.current?.contains(target) || triggerRef.current?.contains(target))
                return;
            setIsOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("pointerdown", handlePointerDown);
        window.setTimeout(() => panelRef.current?.querySelector(FOCUSABLE_SELECTOR)?.focus(), 0);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [isOpen]);
    return (_jsxs("div", { className: "appearance-popover", children: [_jsxs("button", { ref: triggerRef, type: "button", className: "subtle-button appearance-popover-trigger", "aria-haspopup": "dialog", "aria-expanded": isOpen, onClick: () => setIsOpen((current) => !current), children: [_jsx(AppIcon, { name: "palette" }), _jsx("span", { children: "Apariencia" })] }), isOpen ? (_jsxs("div", { ref: panelRef, className: "appearance-popover-panel", role: "dialog", "aria-label": "Apariencia", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("strong", { children: "Apariencia" }), _jsx("span", { children: "Atm\u00F3sfera y luminosidad" })] }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Cerrar apariencia", onClick: closeAndRestoreFocus, children: _jsx(AppIcon, { name: "close" }) })] }), _jsx(AppearanceSelector, {})] })) : null] }));
}
