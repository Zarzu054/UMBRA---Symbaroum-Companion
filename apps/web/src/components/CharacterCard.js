import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CharacterCard({ item, selected, onOpenSheet, onOpenBuilder, onExportPdf, onDuplicate, onDelete }) {
    const initials = item.title
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "PJ";
    return (_jsxs("article", { className: `card character-record-card ${selected ? "card-selected" : ""}`, children: [_jsxs("div", { className: "character-record-card-head", children: [_jsx("div", { className: "character-record-card-portrait", "aria-hidden": "true", children: _jsx("span", { children: initials }) }), _jsxs("div", { className: "character-record-card-copy", children: [_jsx("h3", { children: item.title }), _jsx("p", { children: item.subtitle })] })] }), _jsxs("small", { className: "character-record-card-updated", children: ["Actualizada ", item.createdLabel] }), _jsxs("div", { className: "card-actions", children: [_jsx("button", { onClick: onOpenSheet, children: selected ? "Hoja abierta" : "Abrir hoja" }), _jsx("button", { onClick: onOpenBuilder, children: "\u2692 Constructor" }), _jsx("button", { onClick: onExportPdf, children: "Exportar PDF" }), _jsx("button", { onClick: onDuplicate, children: "Duplicar" }), _jsx("button", { className: "danger", onClick: onDelete, children: "Eliminar" })] })] }));
}
