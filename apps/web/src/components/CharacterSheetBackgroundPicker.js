import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { CHARACTER_SHEET_BACKGROUNDS, applyCharacterSheetBackground, findCharacterSheetBackground, useCharacterSheetBackground } from "../models/characterSheetBackground";
import { AppIcon } from "./AppIcon";
const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";
export function CharacterSheetBackgroundPicker({ preferenceScope, triggerVariant = "sheet" }) {
    const [selectedId, setSelectedId] = useCharacterSheetBackground(preferenceScope);
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const dialogRef = useRef(null);
    const selectedBackground = findCharacterSheetBackground(selectedId);
    const selectedName = selectedBackground?.name ?? "Sin ilustración";
    useBodyScrollLock(isOpen);
    useEffect(() => {
        applyCharacterSheetBackground(selectedId);
    }, [selectedId]);
    function closePicker() {
        setIsOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closePicker();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current)
                return;
            const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR));
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
        window.addEventListener("keydown", handleKeyDown);
        window.setTimeout(() => dialogRef.current?.querySelector(".is-selected")?.focus(), 0);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);
    function selectBackground(id) {
        setSelectedId(id);
    }
    return (_jsxs(_Fragment, { children: [_jsx("button", { ref: triggerRef, type: "button", className: triggerVariant === "appearance" ? "appearance-background-dialog-trigger" : "unified-sheet-background-trigger", "aria-label": triggerVariant === "appearance" ? `Elegir fondo de pantalla. Actual: ${selectedName}` : undefined, "aria-haspopup": "dialog", "aria-expanded": isOpen, onClick: () => setIsOpen(true), children: triggerVariant === "appearance" ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "appearance-background-trigger-preview", "aria-hidden": "true", children: selectedBackground ? _jsx("img", { src: selectedBackground.thumbnailUrl, alt: "" }) : _jsx("span", { className: "appearance-background-none" }) }), _jsxs("span", { className: "appearance-background-trigger-copy", children: [_jsx("strong", { children: "Elegir fondo" }), _jsxs("small", { children: ["Actual: ", selectedName] })] }), _jsx(AppIcon, { name: "palette", size: 18 })] })) : (_jsxs(_Fragment, { children: [_jsx(AppIcon, { name: "palette", size: 16 }), _jsx("span", { children: "Fondo" })] })) }), isOpen ? createPortal(_jsx("div", { className: "modal-backdrop character-sheet-background-backdrop", onClick: closePicker, children: _jsxs("div", { ref: dialogRef, className: "modal-panel character-sheet-background-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "character-sheet-background-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "character-sheet-background-dialog-header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Ambientaci\u00F3n de la ficha" }), _jsx("h2", { id: "character-sheet-background-title", children: "Elige una ilustraci\u00F3n" }), _jsx("p", { children: "La selecci\u00F3n se guarda para tu usuario en este dispositivo y se aplica inmediatamente." })] }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Cerrar selector de fondo", onClick: closePicker, children: _jsx(AppIcon, { name: "close" }) })] }), _jsxs("div", { className: "character-sheet-background-grid", role: "group", "aria-label": "Fondos disponibles", children: [_jsxs("button", { type: "button", className: `character-sheet-background-option is-none${selectedId === "none" ? " is-selected" : ""}`, "aria-pressed": selectedId === "none", onClick: () => selectBackground("none"), children: [_jsx("span", { className: "character-sheet-background-none-preview", "aria-hidden": "true" }), _jsxs("span", { className: "character-sheet-background-option-copy", children: [_jsx("strong", { children: "Sin ilustraci\u00F3n" }), _jsx("small", { children: "Usar el fondo de la atm\u00F3sfera" })] })] }), CHARACTER_SHEET_BACKGROUNDS.map((background) => (_jsxs("button", { type: "button", className: `character-sheet-background-option${selectedId === background.id ? " is-selected" : ""}`, "aria-pressed": selectedId === background.id, onClick: () => selectBackground(background.id), children: [_jsx("img", { src: background.thumbnailUrl, alt: "", loading: "lazy" }), _jsxs("span", { className: "character-sheet-background-option-copy", children: [_jsx("strong", { children: background.name }), _jsxs("small", { children: [background.source, " \u00B7 p.", background.page] })] })] }, background.id)))] }), _jsxs("footer", { className: "character-sheet-background-dialog-footer", children: [_jsx("span", { children: selectedName }), _jsx("button", { type: "button", onClick: closePicker, children: "Aplicar y cerrar" })] })] }) }), document.body) : null] }));
}
