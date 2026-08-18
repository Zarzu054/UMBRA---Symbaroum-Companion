import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { AppearancePopover } from "./AppearancePopover";
import { AppearanceSelector } from "./AppearanceSelector";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useMediaQuery } from "../hooks/useMediaQuery";
const MOBILE_QUERY = "(max-width: 900px)";
export function AppTopNavigation({ items, currentTitle, userEmail, roleLabel, onLogout }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    useBodyScrollLock(isOpen && isMobile);
    useEffect(() => {
        setIsOpen(false);
        setIsCustomizationOpen(false);
    }, [isMobile]);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (event) => {
            if (document.querySelector(".character-sheet-background-dialog"))
                return;
            if (event.key === "Escape") {
                setIsOpen(false);
                setIsCustomizationOpen(false);
                window.setTimeout(() => triggerRef.current?.focus(), 0);
                return;
            }
            if (event.key !== "Tab" || !menuRef.current)
                return;
            const focusable = Array.from(menuRef.current.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
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
            if (target instanceof Element && target.closest(".character-sheet-background-backdrop"))
                return;
            if (menuRef.current?.contains(target) || triggerRef.current?.contains(target))
                return;
            setIsOpen(false);
            setIsCustomizationOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("pointerdown", handlePointerDown);
        window.setTimeout(() => menuRef.current?.querySelector("button:not([disabled])")?.focus(), 0);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [isOpen]);
    const selectItem = (item) => {
        item.onSelect();
        setIsOpen(false);
        setIsCustomizationOpen(false);
    };
    return (_jsxs("header", { className: "app-top-navigation", children: [_jsxs("div", { className: "app-top-navigation-inner", children: [_jsx("button", { type: "button", className: "app-brand", onClick: () => items[0] && selectItem(items[0]), "aria-label": "Ir al inicio de UMBRA", children: "UMBRA" }), _jsx("span", { className: "app-current-title", children: currentTitle }), !isMobile ? (_jsx("nav", { className: "app-primary-navigation", "aria-label": "Navegaci\u00F3n principal", children: items.map((item) => (_jsx("button", { type: "button", className: item.active ? "is-active" : "", "aria-current": item.active ? "page" : undefined, onClick: () => selectItem(item), children: item.label }, item.id))) })) : null, isMobile ? _jsx(AppearancePopover, { compact: true }) : null, _jsxs("button", { ref: triggerRef, type: "button", className: "app-navigation-menu-trigger", "aria-label": "Abrir navegaci\u00F3n", "aria-haspopup": "dialog", "aria-expanded": isOpen, onClick: () => setIsOpen((current) => {
                            if (current)
                                setIsCustomizationOpen(false);
                            return !current;
                        }), children: [_jsx(AppIcon, { name: isMobile ? "menu" : "user" }), _jsx("span", { children: isMobile ? "Menú" : userEmail })] })] }), isOpen ? (_jsxs("div", { ref: menuRef, className: "app-navigation-menu", role: "dialog", "aria-label": "Navegaci\u00F3n y preferencias", children: [_jsxs("div", { className: "app-navigation-menu-heading", children: [_jsxs("div", { children: [_jsx("strong", { children: userEmail }), _jsx("span", { children: roleLabel })] }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Cerrar navegaci\u00F3n", onClick: () => { setIsOpen(false); setIsCustomizationOpen(false); }, children: _jsx(AppIcon, { name: "close" }) })] }), isMobile ? (_jsx("nav", { className: "app-navigation-menu-modules", "aria-label": "M\u00F3dulos", children: items.map((item) => (_jsx("button", { type: "button", className: item.active ? "is-active" : "", "aria-current": item.active ? "page" : undefined, onClick: () => selectItem(item), children: item.label }, item.id))) })) : null, !isMobile ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "subtle-button app-navigation-customization-trigger", "aria-expanded": isCustomizationOpen, "aria-controls": "session-customization-controls", onClick: () => setIsCustomizationOpen((current) => !current), children: [_jsx(AppIcon, { name: "palette" }), _jsx("span", { children: "Personalizaci\u00F3n" })] }), isCustomizationOpen ? (_jsx("div", { id: "session-customization-controls", className: "app-navigation-menu-section", children: _jsx(AppearanceSelector, {}) })) : null] })) : null, _jsx("button", { type: "button", className: "app-logout-button", onClick: () => void onLogout(), children: "Cerrar sesi\u00F3n" })] })) : null] }));
}
