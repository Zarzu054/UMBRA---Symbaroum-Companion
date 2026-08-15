import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { archiveCampaignItem, assignCampaignItemOwner, createCampaignItem, restoreCampaignItem, updateCampaignItem } from "../services/campaignItemService";
function emptyDefinition(kind) {
    return {
        name: kind === "weapon" ? "Nueva arma" : kind === "armor" ? "Nueva armadura" : "Nuevo objeto",
        category: kind === "weapon" ? "weapon" : kind === "armor" ? "armor" : "gear",
        stackable: false,
        description: "",
        weight: "",
        value: "",
        defaultQuantity: 1,
        defaultSlot: kind === "weapon" ? "mainHand" : kind === "armor" ? "armor" : "none",
        attackAttribute: kind === "weapon" ? "diestro" : undefined,
        damageFormula: "",
        protectionFormula: kind === "armor" ? "1d4" : "",
        qualities: kind === "armor" ? "Ligera" : "",
        notes: "",
        grantedActions: [],
        modifiers: []
    };
}
function ownerValue(item) {
    return item.ownerType && item.ownerId ? `${item.ownerType}:${item.ownerId}` : "";
}
function parseOwner(value) {
    if (!value)
        return {};
    const [ownerType, ownerId] = value.split(":");
    return { ownerType, ownerId };
}
export function CampaignItemManager({ campaign, kind, ensureAccessToken, onRefresh }) {
    const [editor, setEditor] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const items = useMemo(() => (campaign.campaignItems ?? [])
        .filter((item) => item.kind === kind && (showArchived || !item.archivedAt))
        .filter((item) => !query.trim() || `${item.definition.name} ${item.definition.description} ${item.definition.qualities}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))), [campaign.campaignItems, kind, query, showArchived]);
    async function mutate(action) {
        setBusy(true);
        setError(null);
        try {
            await action(await ensureAccessToken());
            await onRefresh();
            return true;
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo actualizar el objeto de campaña.");
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    async function saveEditor() {
        if (!editor)
            return;
        const owner = parseOwner(editor.ownerValue);
        const saved = await mutate((token) => editor.itemId
            ? updateCampaignItem(editor.itemId, { definition: editor.definition, isUnique: editor.isUnique, ...owner }, token)
            : createCampaignItem(campaign.id, { definition: editor.definition, isUnique: editor.isUnique, ...owner }, token));
        if (saved)
            setEditor(null);
    }
    async function changeOwner(item, value) {
        const owner = parseOwner(value);
        await mutate((token) => assignCampaignItemOwner(item.id, {
            ownerType: owner.ownerType ?? null,
            ownerId: owner.ownerId ?? null
        }, token));
    }
    const label = kind === "weapon" ? "arma" : kind === "armor" ? "armadura" : "objeto";
    return (_jsxs("div", { className: "campaign-item-manager", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { className: "inline-row campaign-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { type: "search", value: query, onChange: (event) => setQuery(event.target.value), placeholder: `Buscar ${label}...` })] }), _jsxs("label", { className: "campaign-item-archive-toggle", children: [_jsx("input", { type: "checkbox", checked: showArchived, onChange: (event) => setShowArchived(event.target.checked) }), " Mostrar archivados"] })] }), _jsxs("button", { type: "button", disabled: busy, onClick: () => setEditor({ definition: emptyDefinition(kind), isUnique: false, ownerValue: "" }), children: ["Crear ", label] })] }), error ? _jsx("p", { className: "error-text", children: error }) : null, _jsxs("div", { className: "cards campaign-item-template-grid", children: [items.map((item) => (_jsxs("article", { className: `card campaign-item-template-card${item.archivedAt ? " is-archived" : ""}`, children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("strong", { children: item.definition.name }), _jsx("span", { children: item.definition.category === "artifact" ? "Artefacto menor" : kind === "weapon" ? "Arma" : kind === "armor" ? "Armadura" : "Objeto" })] }), _jsxs("div", { className: "toolbar", children: [item.isUnique ? _jsx("span", { className: "campaign-item-unique-badge", children: "Pieza \u00FAnica" }) : _jsx("span", { className: "compendium-chip", children: "Reutilizable" }), item.archivedAt ? _jsx("span", { className: "compendium-chip", children: "Archivado" }) : null] })] }), item.definition.description ? _jsx("p", { children: item.definition.description }) : null, item.definition.qualities ? _jsxs("span", { children: ["Cualidades: ", item.definition.qualities] }) : null, item.isUnique ? (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Poseedor" }), _jsxs("select", { value: ownerValue(item), disabled: busy || Boolean(item.archivedAt), onChange: (event) => void changeOwner(item, event.target.value), children: [_jsx("option", { value: "", children: "Sin poseedor" }), campaign.characters.map((character) => _jsxs("option", { value: `character:${character.id}`, children: ["PJ \u00B7 ", character.name] }, character.id)), campaign.npcs.map((npc) => _jsxs("option", { value: `npc:${npc.id}`, children: ["PNJ \u00B7 ", npc.name] }, npc.id))] })] })) : null, _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", disabled: busy, onClick: () => setEditor({ itemId: item.id, definition: { ...item.definition }, isUnique: item.isUnique, ownerValue: ownerValue(item) }), children: "Editar" }), item.archivedAt
                                        ? _jsx("button", { type: "button", disabled: busy, onClick: () => void mutate((token) => restoreCampaignItem(item.id, token)), children: "Restaurar" })
                                        : _jsx("button", { type: "button", className: "danger", disabled: busy, onClick: () => void mutate((token) => archiveCampaignItem(item.id, token)), children: "Archivar" })] })] }, item.id))), items.length === 0 ? _jsxs("p", { className: "section-help", children: ["No hay ", label, "s de campa\u00F1a en esta secci\u00F3n."] }) : null] }), editor ? (_jsx("div", { className: "modal-backdrop", onClick: () => !busy && setEditor(null), children: _jsxs("section", { className: "panel modal-panel campaign-item-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: editor.itemId ? `Editar ${label}` : `Crear ${label}` }), _jsx("p", { className: "section-help", children: "La definici\u00F3n se compartir\u00E1 con todos los inventarios de la campa\u00F1a." })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setEditor(null), children: "Cerrar" })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: editor.definition.name, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, name: event.target.value } }) })] }), kind === "item" ? _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categor\u00EDa" }), _jsxs("select", { value: editor.definition.category, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, category: event.target.value } }), children: [_jsx("option", { value: "gear", children: "Equipo" }), _jsx("option", { value: "consumable", children: "Consumible" }), _jsx("option", { value: "artifact", children: "Artefacto menor" }), _jsx("option", { value: "treasure", children: "Tesoro" }), _jsx("option", { value: "other", children: "Otro" })] })] }) : null, kind === "weapon" ? _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { value: editor.definition.damageFormula, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, damageFormula: event.target.value } }) })] }) : null, kind === "armor" ? _jsxs("label", { className: "field", children: [_jsx("span", { children: "Protecci\u00F3n" }), _jsx("input", { value: editor.definition.protectionFormula, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, protectionFormula: event.target.value } }) })] }) : null, _jsxs("label", { className: "field", children: [_jsx("span", { children: "Valor" }), _jsx("input", { value: editor.definition.value, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, value: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Peso" }), _jsx("input", { value: editor.definition.weight, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, weight: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cantidad predeterminada" }), _jsx("input", { type: "number", min: 1, disabled: editor.isUnique, value: editor.isUnique ? 1 : editor.definition.defaultQuantity, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, defaultQuantity: Math.max(1, Number(event.target.value || 1)) } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apilable" }), _jsxs("select", { disabled: editor.isUnique, value: editor.isUnique ? "no" : editor.definition.stackable ? "si" : "no", onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, stackable: event.target.value === "si" } }), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "S\u00ED" })] })] })] }), _jsxs("label", { className: "campaign-item-unique-toggle", children: [_jsx("input", { type: "checkbox", checked: editor.isUnique, onChange: (event) => setEditor({ ...editor, isUnique: event.target.checked, definition: event.target.checked ? { ...editor.definition, stackable: false, defaultQuantity: 1 } : editor.definition }) }), _jsxs("span", { children: [_jsx("strong", { children: "Poseedor \u00FAnico" }), _jsx("small", { children: "Solo puede existir en el inventario de un PJ o PNJ de la campa\u00F1a." })] })] }), editor.isUnique ? _jsxs("label", { className: "field", children: [_jsx("span", { children: "Poseedor inicial" }), _jsxs("select", { value: editor.ownerValue, onChange: (event) => setEditor({ ...editor, ownerValue: event.target.value }), children: [_jsx("option", { value: "", children: "Sin poseedor" }), campaign.characters.map((character) => _jsxs("option", { value: `character:${character.id}`, children: ["PJ \u00B7 ", character.name] }, character.id)), campaign.npcs.map((npc) => _jsxs("option", { value: `npc:${npc.id}`, children: ["PNJ \u00B7 ", npc.name] }, npc.id))] })] }) : null, _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("input", { value: editor.definition.qualities, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, qualities: event.target.value } }), placeholder: "Separadas por comas" })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Descripci\u00F3n" }), _jsx("textarea", { rows: 3, value: editor.definition.description, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, description: event.target.value } }) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Notas" }), _jsx("textarea", { rows: 3, value: editor.definition.notes, onChange: (event) => setEditor({ ...editor, definition: { ...editor.definition, notes: event.target.value } }) })] }), error ? _jsx("p", { className: "error-text", children: error }) : null, _jsxs("div", { className: "row-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setEditor(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: busy || editor.definition.name.trim().length < 2, onClick: () => void saveEditor(), children: "Guardar" })] })] }) })) : null] }));
}
