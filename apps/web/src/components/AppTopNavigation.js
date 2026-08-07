import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { ThemeSelector } from "./ThemeSelector";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
const MOBILE_QUERY = "(max-width: 900px)";
function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia?.(MOBILE_QUERY).matches === true;
}
export function AppTopNavigation({ items, currentTitle, userEmail, roleLabel, onLogout }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(isMobileViewport);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    useBodyScrollLock(isOpen && isMobile);
    useEffect(() => {
        if (typeof window.matchMedia !== "function")
            return;
        const media = window.matchMedia(MOBILE_QUERY);
        const sync = (matches) => {
            setIsMobile(matches);
            setIsOpen(false);
        };
        sync(media.matches);
        const handleChange = (event) => sync(event.matches);
        media.addEventListener?.("change", handleChange);
        return () => media.removeEventListener?.("change", handleChange);
    }, []);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsOpen(false);
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
            if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target))
                return;
            setIsOpen(false);
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
    };
    return (_jsxs("header", { className: "app-top-navigation", children: [_jsxs("div", { className: "app-top-navigation-inner", children: [_jsx("button", { type: "button", className: "app-brand", onClick: () => items[0] && selectItem(items[0]), "aria-label": "Ir al inicio de UMBRA", children: "UMBRA" }), _jsx("span", { className: "app-current-title", children: currentTitle }), !isMobile ? (_jsx("nav", { className: "app-primary-navigation", "aria-label": "Navegaci\u00F3n principal", children: items.map((item) => (_jsx("button", { type: "button", className: item.active ? "is-active" : "", "aria-current": item.active ? "page" : undefined, onClick: () => selectItem(item), children: item.label }, item.id))) })) : null, _jsxs("button", { ref: triggerRef, type: "button", className: "app-navigation-menu-trigger", "aria-label": "Abrir navegaci\u00F3n", "aria-haspopup": "dialog", "aria-expanded": isOpen, onClick: () => setIsOpen((current) => !current), children: [_jsx(AppIcon, { name: isMobile ? "menu" : "user" }), _jsx("span", { children: isMobile ? "Menú" : userEmail })] })] }), isOpen ? (_jsxs("div", { ref: menuRef, className: "app-navigation-menu", role: "dialog", "aria-label": "Navegaci\u00F3n y preferencias", children: [_jsxs("div", { className: "app-navigation-menu-heading", children: [_jsxs("div", { children: [_jsx("strong", { children: userEmail }), _jsx("span", { children: roleLabel })] }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Cerrar navegaci\u00F3n", onClick: () => setIsOpen(false), children: _jsx(AppIcon, { name: "close" }) })] }), isMobile ? (_jsx("nav", { className: "app-navigation-menu-modules", "aria-label": "M\u00F3dulos", children: items.map((item) => (_jsx("button", { type: "button", className: item.active ? "is-active" : "", "aria-current": item.active ? "page" : undefined, onClick: () => selectItem(item), children: item.label }, item.id))) })) : null, _jsxs("div", { className: "app-navigation-menu-section", children: [_jsx("span", { className: "app-navigation-menu-label", children: "Apariencia" }), _jsx(ThemeSelector, {})] }), _jsx("button", { type: "button", className: "app-logout-button", onClick: () => void onLogout(), children: "Cerrar sesi\u00F3n" })] })) : null] }));
}
