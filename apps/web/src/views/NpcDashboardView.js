import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MONSTER_ATTRIBUTE_KEYS, MONSTER_ATTRIBUTE_LABELS, createDefaultMonsterSheet, createNpcSheetSeed, parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { UnifiedCharacterSheet } from "../components/UnifiedCharacterSheet";
import { NpcCreationWizard } from "../components/ActorCreationWizard";
import { useNpcController } from "../controllers/npcController";
import { updateNpc as persistNpcUpdate } from "../services/npcService";
const DEPTH_LABELS = {
    notes: "Solo notas",
    stat_block: "Bloque rapido",
    full_sheet: "Hoja completa"
};
const DEPTH_HELP = {
    notes: "PNJ puramente narrativo, pensado para contactos, testigos o secundarios sociales.",
    stat_block: "PNJ con bloque de stats ligero, siguiendo el formato de monstruos.",
    full_sheet: "PNJ tratado como un personaje completo, con hoja, calculos, inventario y constructor."
};
const NPC_NOTE_SECTIONS = [
    { key: "personality", label: "Personalidad", placeholder: "Temperamento, valores, sesgos..." },
    { key: "behavior", label: "Forma de actuar", placeholder: "Como negocia, amenaza, ayuda o se mueve..." },
    { key: "hooks", label: "Motivaciones y ganchos", placeholder: "Objetivos, secretos, relaciones, usos en partida..." }
];
function parseNpcNotesSections(notes) {
    const empty = { personality: "", behavior: "", hooks: "" };
    if (!notes.trim()) {
        return empty;
    }
    const personality = notes.match(/Personalidad:\s*([\s\S]*?)(?:\nForma de actuar:|\nMotivaciones y ganchos:|$)/i)?.[1]?.trim() ?? "";
    const behavior = notes.match(/Forma de actuar:\s*([\s\S]*?)(?:\nMotivaciones y ganchos:|$)/i)?.[1]?.trim() ?? "";
    const hooks = notes.match(/Motivaciones y ganchos:\s*([\s\S]*)$/i)?.[1]?.trim() ?? "";
    if (personality || behavior || hooks) {
        return { personality, behavior, hooks };
    }
    return { ...empty, personality: notes.trim() };
}
function buildNpcNotesSections(sections) {
    return NPC_NOTE_SECTIONS
        .map(({ key, label }) => {
        const value = sections[key].trim();
        return value ? `${label}: ${value}` : "";
    })
        .filter(Boolean)
        .join("\n\n");
}
function normalizeSearchValue(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function buildNpcCharacterRecord(npc) {
    const sheet = npc.sheet
        ? synchronizeCharacterSheet(npc.sheet)
        : createNpcSheetSeed({
            name: npc.name,
            race: npc.race,
            archetype: npc.archetype,
            occupation: npc.occupation,
            summary: npc.summary,
            notes: npc.notes
        });
    return {
        id: npc.id,
        name: npc.name,
        archetype: npc.archetype || "Guerrero",
        race: npc.race || "Humano",
        culture: "",
        profession: npc.occupation || "",
        level: 1,
        sheet,
        createdAt: npc.createdAt,
        updatedAt: npc.updatedAt
    };
}
function renderNpcStatBlock(npc) {
    const statBlock = npc.statBlock ?? createDefaultMonsterSheet();
    return (_jsxs("div", { className: "monster-statblock npc-statblock", children: [_jsxs("div", { className: "monster-statblock-header", children: [_jsxs("div", { children: [_jsx("h3", { children: npc.name }), _jsx("p", { children: npc.summary || "Sin resumen breve." })] }), _jsxs("div", { className: "monster-statblock-meta", children: [_jsx("span", { className: "compendium-chip", children: npc.faction || "Sin faccion" }), npc.labels.map((label) => (_jsx("span", { className: "compendium-chip", children: label }, `${npc.name}-${label}`)))] })] }), _jsxs("div", { className: "monster-stat-grid", children: [_jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Ataque:" }), "\u00A0", statBlock.attack] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Da\u00F1o:" }), "\u00A0", statBlock.fixedValues.damage ?? statBlock.damage, statBlock.fixedValues.damage != null ? _jsxs("small", { children: [" (", statBlock.damage, ")"] }) : null] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Defensa:" }), "\u00A0", statBlock.defense] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Armadura:" }), "\u00A0", statBlock.fixedValues.armor ?? statBlock.armor, statBlock.fixedValues.armor != null ? _jsxs("small", { children: [" (", statBlock.armor, ")"] }) : null] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Robustez:" }), "\u00A0", statBlock.toughness] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Umbral:" }), "\u00A0", statBlock.painThreshold] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Movimiento:" }), "\u00A0", statBlock.movement] })] }), _jsx("div", { className: "monster-attribute-table table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsx("th", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }, attribute))) }) }), _jsx("tbody", { children: _jsx("tr", { children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsx("td", { children: statBlock.attributes[attribute] }, attribute))) }) })] }) }), _jsxs("div", { className: "monster-detail-grid", children: [_jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Rasgos" }), _jsx("ul", { className: "tag-list", children: statBlock.traits.length > 0 ? statBlock.traits.map((trait) => _jsx("li", { children: trait }, trait)) : _jsx("li", { children: "Sin rasgos." }) })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Acciones" }), _jsx("ul", { className: "tag-list", children: statBlock.actions.length > 0 ? statBlock.actions.map((action) => _jsx("li", { children: action }, action)) : _jsx("li", { children: "Sin acciones." }) })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Tactica" }), _jsx("p", { children: statBlock.tactics || "Sin tactica definida." })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Debilidad" }), _jsx("p", { children: statBlock.weakness || "Sin debilidad definida." })] })] })] }));
}
function NpcEditorModal({ controller, onClose, onSaved }) {
    const draft = controller.draft;
    const noteSections = parseNpcNotesSections(draft.notes);
    async function handleSave() {
        const saved = await controller.saveDraft();
        if (saved) {
            onSaved(saved);
            onClose();
        }
    }
    return (_jsx("section", { className: "modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "panel modal-panel monster-modal-panel npc-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: controller.selectedNpcId ? "Editar PNJ" : "Crear PNJ" }), _jsx("p", { className: "section-help", children: "Elige primero el nivel del PNJ y el formulario se ajusta a ese formato." })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", disabled: controller.isSaving, onClick: () => void handleSave(), children: controller.isSaving ? "Guardando..." : "Guardar PNJ" }), _jsx("button", { type: "button", onClick: onClose, children: "Cerrar" })] })] }), controller.formError ? _jsx("p", { className: "error", children: controller.formError }) : null, _jsxs("div", { className: "monster-editor-layout", children: [_jsxs("section", { className: "monster-builder-card", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Nivel del PNJ" }), _jsxs("select", { value: draft.depth, onChange: (event) => controller.updateDepth(event.target.value), children: [_jsx("option", { value: "notes", children: "Solo notas" }), _jsx("option", { value: "stat_block", children: "Bloque de stats" }), _jsx("option", { value: "full_sheet", children: "Hoja completa" })] }), _jsx("small", { className: "meta-text", children: DEPTH_HELP[draft.depth] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: draft.name, onChange: (event) => controller.updateField("name", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Faccion" }), _jsx("input", { value: draft.faction, onChange: (event) => controller.updateField("faction", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Etiquetas" }), _jsx("input", { value: draft.labels.join(", "), placeholder: "mercader, ordo magica, informante", onChange: (event) => controller.updateLabels(event.target.value) })] }), draft.depth === "notes" ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Rol narrativo" }), _jsx("input", { value: draft.summary, placeholder: "Contacto, noble local, guia, testigo...", onChange: (event) => controller.updateField("summary", event.target.value) })] }), NPC_NOTE_SECTIONS.map((section) => (_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: section.label }), _jsx("textarea", { rows: 4, value: noteSections[section.key], placeholder: section.placeholder, onChange: (event) => controller.updateField("notes", buildNpcNotesSections({
                                                                ...noteSections,
                                                                [section.key]: event.target.value
                                                            })) })] }, section.key)))] })) : null, draft.depth !== "notes" ? (_jsxs(_Fragment, { children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: draft.race, onChange: (event) => controller.updateField("race", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("input", { value: draft.archetype, onChange: (event) => controller.updateField("archetype", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupacion" }), _jsx("input", { value: draft.occupation, onChange: (event) => controller.updateField("occupation", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Resumen" }), _jsx("input", { value: draft.summary, onChange: (event) => controller.updateField("summary", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Notas" }), _jsx("textarea", { rows: 6, value: draft.notes, onChange: (event) => controller.updateField("notes", event.target.value) })] })] })) : null] }), draft.depth === "stat_block" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "section-title", children: "Bloque de stats" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Ataque" }), _jsx("input", { value: draft.statBlock?.attack ?? "", onChange: (event) => controller.updateStatBlockField("attack", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { value: draft.statBlock?.damage ?? "", onChange: (event) => controller.updateStatBlockField("damage", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Defensa" }), _jsx("input", { value: draft.statBlock?.defense ?? "", onChange: (event) => controller.updateStatBlockField("defense", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura" }), _jsx("input", { value: draft.statBlock?.armor ?? "", onChange: (event) => controller.updateStatBlockField("armor", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez" }), _jsx("input", { value: draft.statBlock?.toughness ?? "", onChange: (event) => controller.updateStatBlockField("toughness", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Umbral" }), _jsx("input", { value: draft.statBlock?.painThreshold ?? "", onChange: (event) => controller.updateStatBlockField("painThreshold", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Movimiento" }), _jsx("input", { value: draft.statBlock?.movement ?? "", onChange: (event) => controller.updateStatBlockField("movement", event.target.value) })] })] }), _jsx("div", { className: "attributes-grid", children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsxs("label", { className: "attribute-box", children: [_jsx("span", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }), _jsx("input", { type: "number", min: 1, max: 20, value: draft.statBlock?.attributes[attribute] ?? 10, onChange: (event) => controller.updateStatBlockAttribute(attribute, Number(event.target.value || 0)) })] }, attribute))) }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Rasgos" }), _jsx("textarea", { rows: 3, value: (draft.statBlock?.traits ?? []).join("\n"), onChange: (event) => controller.updateStatBlockField("traits", event.target.value.split("\n").map((entry) => entry.trim()).filter(Boolean)) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Acciones" }), _jsx("textarea", { rows: 3, value: (draft.statBlock?.actions ?? []).join("\n"), onChange: (event) => controller.updateStatBlockField("actions", event.target.value.split("\n").map((entry) => entry.trim()).filter(Boolean)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tactica" }), _jsx("textarea", { rows: 3, value: draft.statBlock?.tactics ?? "", onChange: (event) => controller.updateStatBlockField("tactics", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Debilidad" }), _jsx("textarea", { rows: 3, value: draft.statBlock?.weakness ?? "", onChange: (event) => controller.updateStatBlockField("weakness", event.target.value) })] })] })] })) : null, draft.depth === "full_sheet" ? (_jsxs("article", { className: "campaign-sheet-card npc-full-sheet-guide", children: [_jsx("h3", { children: "Hoja completa" }), _jsx("p", { className: "meta-text", children: "Este PNJ se guardara como personaje completo." }), _jsx("p", { children: "Al guardar, se abrira directamente el constructor de personaje para terminar atributos, capacidades, acciones, inventario y contadores como si fuera un PJ." })] })) : null] }), _jsxs("section", { className: "monster-builder-card", children: [_jsx("h3", { children: "Vista previa" }), draft.depth === "notes" ? (_jsxs("article", { className: "campaign-sheet-card npc-notes-preview", children: [_jsxs("div", { className: "row-actions", children: [_jsx("strong", { children: draft.name || "PNJ sin nombre" }), _jsx("span", { className: "compendium-chip", children: DEPTH_LABELS[draft.depth] })] }), _jsx("p", { className: "meta-text", children: draft.faction || "Sin faccion" }), _jsx("p", { children: draft.summary || "Añade un resumen para definir el rol narrativo del PNJ." }), NPC_NOTE_SECTIONS.map((section) => (_jsxs("div", { children: [_jsx("strong", { children: section.label }), _jsx("p", { className: "section-help", children: noteSections[section.key] || `Sin ${section.label.toLowerCase()}.` })] }, section.key)))] })) : null, draft.depth === "stat_block" ? (renderNpcStatBlock({
                                    name: draft.name || "PNJ sin nombre",
                                    summary: draft.summary,
                                    statBlock: draft.statBlock ?? createDefaultMonsterSheet(),
                                    faction: draft.faction,
                                    labels: draft.labels
                                })) : null, draft.depth === "full_sheet" ? (_jsxs("article", { className: "campaign-sheet-card npc-notes-preview npc-full-sheet-preview", children: [_jsxs("div", { className: "row-actions", children: [_jsx("strong", { children: draft.name || "PNJ sin nombre" }), _jsx("span", { className: "compendium-chip", children: DEPTH_LABELS[draft.depth] })] }), _jsxs("p", { className: "meta-text", children: [draft.race || "Humano", " \u00B7 ", draft.archetype || "Guerrero", draft.occupation ? ` · ${draft.occupation}` : ""] }), _jsx("p", { children: draft.summary || "Se creara un PNJ con hoja completa y acceso al constructor." }), _jsx("p", { className: "section-help", children: draft.notes || "Al guardar podras continuar en la hoja completa del PNJ." })] })) : null, null] })] })] }) }));
}
export function NpcDashboardView({ ensureAccessToken }) {
    const controller = useNpcController(ensureAccessToken);
    const [search, setSearch] = useState("");
    const [depthFilter, setDepthFilter] = useState("all");
    const [factionFilter, setFactionFilter] = useState("all");
    const [pageMode, setPageMode] = useState("list");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const factions = useMemo(() => ["all", ...new Set(controller.npcs.map((npc) => npc.faction.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")))], [controller.npcs]);
    const visibleNpcs = useMemo(() => {
        const query = normalizeSearchValue(search);
        return controller.npcs.filter((npc) => {
            if (depthFilter !== "all" && npc.depth !== depthFilter) {
                return false;
            }
            if (factionFilter !== "all" && npc.faction !== factionFilter) {
                return false;
            }
            if (!query) {
                return true;
            }
            const haystack = normalizeSearchValue([
                npc.name,
                npc.race,
                npc.archetype,
                npc.occupation,
                npc.faction,
                npc.summary,
                npc.notes,
                ...npc.labels
            ].join(" "));
            return haystack.includes(query);
        });
    }, [controller.npcs, depthFilter, factionFilter, search]);
    const groupedNpcs = useMemo(() => {
        const groups = new Map();
        for (const npc of visibleNpcs) {
            const key = npc.faction.trim() || "Sin faccion";
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(npc);
        }
        return [...groups.entries()];
    }, [visibleNpcs]);
    const selectedNpc = controller.selectedNpc;
    const selectedNpcCharacter = selectedNpc && selectedNpc.depth === "full_sheet" ? buildNpcCharacterRecord(selectedNpc) : null;
    async function saveNpcSheet(nextSheet) {
        if (!selectedNpc) {
            return;
        }
        const token = await ensureAccessToken();
        const updated = await persistNpcUpdate(selectedNpc.id, {
            depth: "full_sheet",
            name: nextSheet.identidad.nombrePersonaje.trim() || selectedNpc.name,
            race: String(nextSheet.identidad.raza),
            archetype: String(nextSheet.identidad.arquetipo),
            occupation: nextSheet.identidad.profesion,
            faction: selectedNpc.faction,
            labels: selectedNpc.labels,
            summary: nextSheet.identidad.apariencia || selectedNpc.summary,
            notes: nextSheet.identidad.trasfondo || selectedNpc.notes,
            statBlock: selectedNpc.statBlock,
            sheet: synchronizeCharacterSheet(nextSheet)
        }, token);
        controller.selectNpc(updated.id);
        controller.loadDraftFromNpc(updated);
        await controller.refresh();
    }
    function openCreateModal() {
        controller.selectNpc(null);
        controller.resetDraft("notes");
        setIsEditorOpen(true);
    }
    function openEditModal(npc) {
        controller.selectNpc(npc.id);
        controller.loadDraftFromNpc(npc);
        setIsEditorOpen(true);
    }
    function handleEditorSaved(npc) {
        controller.selectNpc(npc.id);
        setPageMode(npc.depth === "full_sheet" ? "builder" : "detail");
    }
    if (pageMode === "builder" && selectedNpcCharacter) {
        return (_jsx(CharacterBuilderView, { character: selectedNpcCharacter, onBackToCharacters: () => setPageMode("sheet"), onOpenSheet: () => setPageMode("sheet"), onSave: saveNpcSheet, backLabel: "Volver a PNJ", sheetLabel: "Abrir hoja PNJ", saveLabel: "Guardar constructor PNJ" }));
    }
    if (pageMode === "sheet" && selectedNpcCharacter) {
        return (_jsx("section", { className: "campaign-sheet-shell", children: _jsx(UnifiedCharacterSheet, { title: selectedNpcCharacter.name, subtitle: `${selectedNpcCharacter.archetype || "Sin arquetipo"} · ${selectedNpcCharacter.race || "Sin raza"} · PNJ`, sheet: parseCharacterSheet(selectedNpcCharacter.sheet), editable: true, collapsibleHistory: true, onOpenBuilder: () => setPageMode("builder"), onSave: saveNpcSheet }) }));
    }
    if (pageMode === "detail" && selectedNpc) {
        return (_jsxs("div", { className: "monster-module npc-module", children: [_jsxs("section", { className: "panel monster-section npc-detail-panel", children: [_jsx("header", { className: "module-sticky-header module-sticky-header--single-row npc-module-header", children: _jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setPageMode("list"), children: "Volver al archivo" }), _jsx("h2", { children: selectedNpc.name }), _jsxs("p", { className: "section-help", children: [DEPTH_LABELS[selectedNpc.depth], " \u00B7 ", selectedNpc.faction || "Sin faccion"] })] }), _jsxs("div", { className: "toolbar", children: [selectedNpc.depth === "full_sheet" ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setPageMode("sheet"), children: "Abrir hoja" }), _jsx("button", { type: "button", onClick: () => setPageMode("builder"), children: "Abrir constructor" })] })) : null, _jsx("button", { type: "button", onClick: () => openEditModal(selectedNpc), children: "Editar" }), _jsx("button", { type: "button", className: "danger", onClick: () => void controller.removeNpc(selectedNpc.id), children: "Eliminar" })] })] }) }), _jsxs("div", { className: "compendium-tags", children: [_jsx("span", { className: "compendium-chip", children: DEPTH_LABELS[selectedNpc.depth] }), _jsx("span", { className: "compendium-chip", children: selectedNpc.faction || "Sin faccion" }), selectedNpc.labels.map((label) => _jsx("span", { className: "compendium-chip", children: label }, `${selectedNpc.id}-${label}`))] }), _jsxs("details", { className: "campaign-sheet-card npc-detail-notes narrative-collapsible-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: "Historia y notas" }), _jsx("small", { children: "Mostrar u ocultar" })] }), _jsxs("div", { className: "narrative-collapsible-content", children: [_jsx("p", { className: "meta-text", children: selectedNpc.summary || "Sin resumen breve." }), _jsx("p", { children: selectedNpc.notes || "Sin notas ampliadas." })] })] }), selectedNpc.depth !== "notes" ? renderNpcStatBlock(selectedNpc) : null] }), isEditorOpen ? (_jsx("section", { className: "modal-backdrop", children: _jsx(NpcCreationWizard, { controller: controller, onCancel: () => setIsEditorOpen(false), onSaved: (saved) => {
                            handleEditorSaved(saved);
                            setIsEditorOpen(false);
                        } }) })) : null] }));
    }
    return (_jsxs("div", { className: "monster-module npc-module", children: [_jsxs("header", { className: "panel lore-panel module-sticky-header module-sticky-header--single-row npc-module-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Archivo de PNJ" }), _jsx("p", { children: "PNJ narrativos, bloques r\u00E1pidos y fichas completas del Director de Juego." })] }), _jsx("div", { className: "toolbar", children: _jsx("button", { type: "button", onClick: () => openCreateModal(), children: "Nuevo PNJ" }) })] }), _jsxs("section", { className: "panel monster-section", children: [_jsxs("details", { className: "npc-guidance narrative-collapsible-card", children: [_jsxs("summary", { children: [_jsx("span", { children: "Ayuda sobre tipos de PNJ" }), _jsx("small", { children: "Mostrar u ocultar" })] }), _jsxs("div", { className: "monster-guidance-grid narrative-collapsible-content", children: [_jsx("div", { className: "info-box", children: "Solo notas: ideal para contactos, mercaderes, nobles y PNJ sociales." }), _jsx("div", { className: "info-box", children: "Bloque r\u00E1pido: a\u00F1ade estad\u00EDsticas y rasgos de mesa sin cargar una hoja completa." }), _jsx("div", { className: "info-box", children: "Hoja completa: usa la misma hoja y constructor que un PJ, con inventario y acciones." })] })] }), controller.loadError ? _jsx("p", { className: "error", children: controller.loadError }) : null, _jsxs("div", { className: "compendium-filters", children: [_jsxs("label", { className: "field compendium-search", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Nombre, faccion, etiqueta..." })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Profundidad" }), _jsxs("select", { value: depthFilter, onChange: (event) => setDepthFilter(event.target.value), children: [_jsx("option", { value: "all", children: "Todas" }), _jsx("option", { value: "notes", children: "Solo notas" }), _jsx("option", { value: "stat_block", children: "Bloque rapido" }), _jsx("option", { value: "full_sheet", children: "Hoja completa" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Faccion" }), _jsx("select", { value: factionFilter, onChange: (event) => setFactionFilter(event.target.value), children: factions.map((faction) => _jsx("option", { value: faction, children: faction === "all" ? "Todas" : faction }, faction)) })] })] }), _jsx("div", { className: "npc-faction-stack", children: groupedNpcs.length > 0 ? groupedNpcs.map(([faction, npcs]) => (_jsxs("section", { className: "campaign-sheet-card npc-faction-group", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: faction }), _jsxs("span", { className: "meta-text", children: [npcs.length, " PNJ"] })] }), _jsx("div", { className: "cards npc-record-grid", children: npcs.map((npc) => (_jsxs("article", { className: `card npc-record-card app-card-accent app-card-accent--npc-${npc.depth}`, children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: npc.name }), _jsxs("p", { className: "meta-text", children: [npc.race || "Sin raza", npc.occupation ? ` · ${npc.occupation}` : ""] })] }), _jsx("span", { className: "compendium-chip", children: DEPTH_LABELS[npc.depth] })] }), _jsx("p", { children: npc.summary || "Sin resumen breve." }), npc.labels.length > 0 ? (_jsx("div", { className: "compendium-tags", children: npc.labels.map((label) => _jsx("span", { className: "compendium-chip", children: label }, `${npc.id}-${label}`)) })) : null, _jsxs("div", { className: "card-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                            controller.selectNpc(npc.id);
                                                            setPageMode(npc.depth === "full_sheet" ? "sheet" : "detail");
                                                        }, children: npc.depth === "full_sheet" ? "Abrir hoja" : "Ver detalle" }), npc.depth === "full_sheet" ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                            controller.selectNpc(npc.id);
                                                            setPageMode("builder");
                                                        }, children: "Constructor" })) : null, _jsx("button", { type: "button", onClick: () => openEditModal(npc), children: "Editar" }), _jsx("button", { type: "button", className: "danger", onClick: () => void controller.removeNpc(npc.id), children: "Eliminar" })] })] }, npc.id))) })] }, faction))) : (_jsxs("div", { className: "entry-row", children: [_jsx("strong", { children: "No hay PNJ que coincidan." }), _jsx("p", { children: "Ajusta los filtros o crea un PNJ nuevo." })] })) })] }), isEditorOpen ? (_jsx("section", { className: "modal-backdrop", children: _jsx(NpcCreationWizard, { controller: controller, onCancel: () => setIsEditorOpen(false), onSaved: (saved) => {
                        controller.selectNpc(saved.id);
                        setPageMode(saved.depth === "full_sheet" ? "sheet" : "detail");
                        setIsEditorOpen(false);
                    } }) })) : null] }));
}
