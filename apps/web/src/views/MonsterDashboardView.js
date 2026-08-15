import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDerivedMonsterSheetStats, MONSTER_ATTRIBUTE_KEYS, MONSTER_ATTRIBUTE_LABELS, MONSTER_CATEGORIES, MONSTER_THREATS } from "@umbra/shared";
import { useMonsterController } from "../controllers/monsterController";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MonsterCreationWizard } from "../components/ActorCreationWizard";
import { MonsterReferenceSheet } from "../components/MonsterReferenceSheet";
import { useConfirmationDialog } from "../components/ConfirmationDialogProvider";
export const MONSTER_CATALOG_SPLIT_STORAGE_KEY = "umbra:monster-catalog-split";
export function clampMonsterCatalogSplit(value) {
    return Math.min(75, Math.max(25, Math.round(value)));
}
function readMonsterCatalogSplit() {
    if (typeof window === "undefined")
        return 50;
    try {
        const stored = Number(window.localStorage.getItem(MONSTER_CATALOG_SPLIT_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? clampMonsterCatalogSplit(stored) : 50;
    }
    catch {
        return 50;
    }
}
function normalizeSearchValue(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function renderMonsterTable(monster) {
    const derivedSheet = getDerivedMonsterSheetStats(monster.sheet);
    return (_jsxs("div", { className: "monster-statblock", children: [_jsxs("div", { className: "monster-statblock-header", children: [_jsxs("div", { children: [_jsx("h3", { children: monster.name }), _jsx("p", { children: monster.summary })] }), _jsxs("div", { className: "monster-statblock-meta", children: [_jsx("span", { className: "compendium-chip", children: monster.category }), _jsx("span", { className: "compendium-chip", children: monster.threat }), _jsx("span", { className: "compendium-chip", children: monster.source })] })] }), _jsxs("div", { className: "monster-stat-grid", children: [_jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Ataque:" }), "\u00A0", monster.sheet.attack] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Da\u00F1o:" }), "\u00A0", monster.sheet.fixedValues.damage ?? monster.sheet.damage, _jsxs("small", { children: [" (", monster.sheet.damage, ")"] })] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Defensa:" }), "\u00A0", derivedSheet.defense] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Armadura:" }), "\u00A0", monster.sheet.fixedValues.armor ?? derivedSheet.armor, _jsxs("small", { children: [" (", monster.sheet.armor, ")"] })] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Robustez:" }), "\u00A0", derivedSheet.toughness] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Umbral:" }), "\u00A0", derivedSheet.painThreshold] }), _jsxs("div", { className: "info-box", children: [_jsx("strong", { children: "Movimiento:" }), "\u00A0", monster.sheet.movement] })] }), _jsx("div", { className: "monster-attribute-table table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsx("th", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }, attribute))) }) }), _jsx("tbody", { children: _jsx("tr", { children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsx("td", { children: monster.sheet.attributes[attribute] }, attribute))) }) })] }) }), _jsxs("div", { className: "monster-detail-grid", children: [(monster.sheet.equipment?.length ?? 0) > 0 ? (_jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Equipo" }), _jsx("ul", { className: "tag-list", children: monster.sheet.equipment?.map((item, index) => (_jsxs("li", { children: [item.name, item.fixedValue != null ? ` · ${item.fixedValue} (${item.damageFormula || item.protectionFormula})` : ""] }, `${item.catalogId}-${index}`))) })] })) : null, _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Capacidades y rasgos" }), _jsx("ul", { className: "tag-list", children: monster.sheet.traits.map((trait) => (_jsx("li", { children: trait }, trait))) })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Acciones" }), _jsx("ul", { className: "tag-list", children: monster.sheet.actions.map((action) => (_jsx("li", { children: action }, action))) })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "T\u00E1ctica" }), _jsx("p", { children: monster.sheet.tactics || "Sin táctica definida." })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Debilidad" }), _jsx("p", { children: monster.sheet.weakness || "Sin debilidad definida." })] }), _jsxs("article", { className: "entry-row", children: [_jsx("strong", { children: "Bot\u00EDn / restos" }), _jsx("p", { children: monster.sheet.loot || "Sin botín definido." })] })] })] }));
}
function MonsterEditorModal({ controller, onClose }) {
    useBodyScrollLock(true);
    return (_jsx("div", { className: "modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "panel modal-panel monster-modal-panel", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: controller.selectedCustomId ? "Editar monstruo" : "Crear monstruo" }), _jsx("p", { className: "section-help", children: "Formulario completo con vista previa integrada del bloque de estad\u00EDsticas." })] }), _jsxs("div", { className: "toolbar", children: [_jsxs("span", { className: "compendium-chip", children: ["Total atributos: ", controller.draftAttributeTotal] }), _jsx("button", { type: "button", disabled: controller.isSaving, onClick: () => void controller.saveDraft(), children: controller.isSaving ? "Guardando..." : "Guardar monstruo" }), _jsx("button", { type: "button", onClick: onClose, children: "Cerrar" })] })] }), controller.formError ? _jsx("p", { className: "error", children: controller.formError }) : null, _jsxs("div", { className: "monster-editor-layout", children: [_jsxs("section", { className: "monster-builder-card", children: [_jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre" }), _jsx("input", { value: controller.draft.name, disabled: controller.isSaving, onChange: (event) => controller.updateField("name", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categor\u00EDa" }), _jsx("select", { value: controller.draft.category, disabled: controller.isSaving, onChange: (event) => controller.updateField("category", event.target.value), children: MONSTER_CATEGORIES.map((category) => (_jsx("option", { value: category, children: category }, category))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Peligrosidad" }), _jsx("select", { value: controller.draft.threat, disabled: controller.isSaving, onChange: (event) => controller.updateField("threat", event.target.value), children: MONSTER_THREATS.map((threat) => (_jsx("option", { value: threat, children: threat }, threat))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Resumen t\u00E1ctico" }), _jsx("input", { value: controller.draft.summary, disabled: controller.isSaving, onChange: (event) => controller.updateField("summary", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ataque" }), _jsx("input", { value: controller.draft.sheet.attack, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("attack", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("input", { value: controller.draft.sheet.damage, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("damage", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Defensa" }), _jsx("input", { value: controller.draft.sheet.defense, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("defense", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura" }), _jsx("input", { value: controller.draft.sheet.armor, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("armor", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Robustez" }), _jsx("input", { value: controller.draft.sheet.toughness, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("toughness", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Umbral de dolor" }), _jsx("input", { value: controller.draft.sheet.painThreshold, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("painThreshold", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Movimiento" }), _jsx("input", { value: controller.draft.sheet.movement, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("movement", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Bot\u00EDn / restos" }), _jsx("input", { value: controller.draft.sheet.loot, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("loot", event.target.value) })] })] }), _jsx("div", { className: "section-title", children: "Atributos" }), _jsx("div", { className: "attributes-grid", children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsxs("label", { className: "attribute-box", children: [_jsx("span", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }), _jsx("input", { type: "number", min: 1, max: 20, value: controller.draft.sheet.attributes[attribute], disabled: controller.isSaving, onChange: (event) => controller.updateAttribute(attribute, Number(event.target.value)) })] }, attribute))) }), _jsx("div", { className: "section-title", children: "Rasgos y conducta" }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Rasgos de monstruo" }), _jsx("textarea", { rows: 4, placeholder: "Un rasgo por l\u00EDnea", value: controller.draft.sheet.traits.join("\n"), disabled: controller.isSaving, onChange: (event) => controller.updateListField("traits", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Acciones" }), _jsx("textarea", { rows: 4, placeholder: "Una acci\u00F3n por l\u00EDnea", value: controller.draft.sheet.actions.join("\n"), disabled: controller.isSaving, onChange: (event) => controller.updateListField("actions", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "T\u00E1ctica" }), _jsx("textarea", { rows: 4, value: controller.draft.sheet.tactics, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("tactics", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Debilidad" }), _jsx("textarea", { rows: 4, value: controller.draft.sheet.weakness, disabled: controller.isSaving, onChange: (event) => controller.updateSheetField("weakness", event.target.value) })] })] })] }), _jsxs("section", { className: "monster-builder-card", children: [_jsx("h3", { children: "Vista previa" }), renderMonsterTable({
                                    ...controller.draft,
                                    name: controller.draft.name || "Monstruo sin nombre",
                                    summary: controller.draft.summary || "Añade un resumen táctico para completar la ficha."
                                })] })] })] }) }));
}
function MonsterSheetModal({ monster, onClose }) {
    useBodyScrollLock(true);
    return (_jsx("div", { className: "modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "panel modal-panel monster-sheet-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("div", { className: "monster-sheet-modal-header", children: _jsxs("div", { className: "row-actions", children: [_jsx("h2", { children: "Hoja r\u00E1pida" }), _jsx("button", { type: "button", onClick: onClose, children: "Cerrar" })] }) }), _jsx("div", { className: "monster-sheet-modal-body", children: renderMonsterTable(monster) })] }) }));
}
function LegacyMonsterDashboardView({ user, ensureAccessToken }) {
    const controller = useMonsterController(user, ensureAccessToken);
    const [activeTab, setActiveTab] = useState("codex");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isCodexSheetOpen, setIsCodexSheetOpen] = useState(false);
    const [detailMonsterId, setDetailMonsterId] = useState(null);
    const [sheetPreviewMonsterId, setSheetPreviewMonsterId] = useState(null);
    const [codexSearch, setCodexSearch] = useState("");
    const filteredCodexMonsters = useMemo(() => {
        const query = normalizeSearchValue(codexSearch);
        if (!query)
            return controller.codexMonsters;
        return controller.codexMonsters.filter((monster) => {
            const haystack = normalizeSearchValue([
                monster.name,
                monster.category,
                monster.threat,
                monster.source,
                monster.summary,
                monster.sheet.traits.join(" "),
                monster.sheet.actions.join(" ")
            ].join(" "));
            return haystack.includes(query);
        });
    }, [codexSearch, controller.codexMonsters]);
    const visibleCodexMonster = useMemo(() => filteredCodexMonsters.find((monster) => monster.id === controller.selectedCodexId) ?? filteredCodexMonsters[0] ?? null, [filteredCodexMonsters, controller.selectedCodexId]);
    const detailMonster = useMemo(() => controller.customMonsters.find((monster) => monster.id === detailMonsterId) ?? null, [controller.customMonsters, detailMonsterId]);
    const sheetPreviewMonster = useMemo(() => controller.customMonsters.find((monster) => monster.id === sheetPreviewMonsterId) ?? null, [controller.customMonsters, sheetPreviewMonsterId]);
    function openCreateModal() {
        controller.resetDraft();
        setIsEditorOpen(true);
    }
    function openEditModal(monsterId) {
        controller.selectCustomMonster(monsterId);
        setIsEditorOpen(true);
    }
    function openDetail(monsterId) {
        setDetailMonsterId(monsterId);
    }
    function closeDetail() {
        setDetailMonsterId(null);
    }
    function openCodexDetail(monsterId) {
        controller.setSelectedCodexId(monsterId);
        setIsCodexSheetOpen(true);
    }
    return (_jsxs("div", { className: "monster-module", children: [_jsxs("section", { className: "panel lore-panel", children: [_jsx("h2", { children: "Archivo del Director de Juego" }), _jsx("p", { children: "Acceso r\u00E1pido a monstruos listos para mesa y un banco propio de criaturas dise\u00F1adas con la l\u00F3gica del C\u00F3dice de monstruos." }), _jsxs("div", { className: "monster-guidance-grid", children: [_jsx("div", { className: "info-box", children: "Plantilla sugerida de atributos: 80 puntos repartidos con un rol t\u00E1ctico claro." }), _jsx("div", { className: "info-box", children: "Prioriza rasgos pasivos, una debilidad clara y pocas acciones realmente decisivas." }), _jsx("div", { className: "info-box", children: "El m\u00F3dulo separa el c\u00F3dice base de tus monstruos persistidos en base de datos." })] })] }), _jsx("section", { className: "panel monster-section", children: _jsxs("div", { className: "toolbar campaign-section-nav", "aria-label": "Secciones del m\u00F3dulo de monstruos", children: [_jsx("button", { type: "button", className: activeTab === "codex" ? "is-active" : "", onClick: () => setActiveTab("codex"), children: "Monstruos del c\u00F3dice" }), _jsx("button", { type: "button", className: activeTab === "custom" ? "is-active" : "", onClick: () => setActiveTab("custom"), children: "Mis monstruos" })] }) }), _jsxs("div", { className: "monster-module-layout", children: [activeTab === "codex" ? (_jsxs("section", { className: "panel monster-section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: "Monstruos del c\u00F3dice" }), _jsx("p", { className: "section-help", children: "Selecci\u00F3n inicial lista para consulta inmediata en partida." })] }), _jsxs("div", { className: "toolbar", children: [controller.isLoading ? _jsx("span", { className: "meta-text", children: "Cargando..." }) : null, _jsxs("span", { className: "meta-text", children: [filteredCodexMonsters.length, " resultados"] })] })] }), _jsx("div", { className: "compendium-filters", children: _jsxs("label", { className: "field compendium-search", children: [_jsx("span", { children: "Buscar en el c\u00F3dice" }), _jsx("input", { type: "search", value: codexSearch, onChange: (event) => setCodexSearch(event.target.value), placeholder: "Nombre, rasgo, categor\u00EDa, acci\u00F3n..." })] }) }), _jsx("div", { className: "monster-browser-layout", children: _jsx("div", { className: "monster-browser-list", children: filteredCodexMonsters.length > 0 ? (filteredCodexMonsters.map((monster) => (_jsxs("button", { className: `compendium-list-item${visibleCodexMonster?.id === monster.id ? " is-active" : ""}`, onClick: () => openCodexDetail(monster.id), children: [_jsx("strong", { children: monster.name }), _jsxs("span", { children: [monster.category, " \u00B7 ", monster.threat] }), _jsx("span", { className: "compendium-list-summary", children: monster.summary })] }, monster.id)))) : (_jsxs("div", { className: "entry-row", children: [_jsx("strong", { children: "No hay coincidencias." }), _jsx("p", { children: "Ajusta la b\u00FAsqueda para localizar otro monstruo del c\u00F3dice." })] })) }) })] })) : null, activeTab === "custom" ? (detailMonster ? (_jsxs("section", { className: "panel monster-section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: detailMonster.name }), _jsxs("p", { className: "section-help", children: [detailMonster.category, " \u00B7 ", detailMonster.threat] })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: closeDetail, children: "Volver al listado" }), _jsx("button", { type: "button", onClick: () => openEditModal(detailMonster.id), children: "Editar" }), _jsx("button", { type: "button", onClick: () => setSheetPreviewMonsterId(detailMonster.id), children: "Hoja r\u00E1pida" })] })] }), renderMonsterTable(detailMonster)] })) : (_jsxs("section", { className: "panel monster-section", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h2", { children: "Mis monstruos" }), _jsx("p", { className: "section-help", children: "Listado compacto con acceso a detalle, edici\u00F3n y hoja r\u00E1pida." })] }), _jsx("div", { className: "toolbar", children: _jsx("button", { type: "button", onClick: openCreateModal, children: "Nuevo monstruo" }) })] }), controller.loadError ? _jsx("p", { className: "error", children: controller.loadError }) : null, _jsx("div", { className: "monster-record-list", children: controller.customMonsters.length > 0 ? (controller.customMonsters.map((monster) => (_jsxs("article", { className: "monster-record-item", children: [_jsxs("div", { className: "monster-record-main", children: [_jsx("strong", { children: monster.name }), _jsxs("span", { children: [monster.category, " \u00B7 ", monster.threat] }), _jsx("span", { className: "compendium-list-summary", children: monster.summary })] }), _jsxs("div", { className: "monster-record-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setSheetPreviewMonsterId(monster.id), children: "Hoja r\u00E1pida" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => openDetail(monster.id), children: "Ver detalle" }), _jsx("button", { type: "button", onClick: () => openEditModal(monster.id), children: "Editar" }), _jsx("button", { type: "button", className: "danger", disabled: controller.isSaving, onClick: async () => {
                                                        controller.selectCustomMonster(monster.id);
                                                        await controller.deleteSelected();
                                                    }, children: "Eliminar" })] })] }, monster.id)))) : (_jsxs("div", { className: "entry-row", children: [_jsx("strong", { children: "No hay monstruos propios a\u00FAn." }), _jsx("p", { children: "Crea el primero para empezar tu colecci\u00F3n de bloques personalizados." })] })) })] }))) : null] }), isEditorOpen ? (_jsx("div", { className: "modal-backdrop", children: _jsx(MonsterCreationWizard, { controller: controller, onCancel: () => setIsEditorOpen(false) }) })) : null, sheetPreviewMonster ? (_jsx(MonsterSheetModal, { monster: sheetPreviewMonster, onClose: () => setSheetPreviewMonsterId(null) })) : null, isCodexSheetOpen && visibleCodexMonster ? (_jsx(MonsterSheetModal, { monster: visibleCodexMonster, onClose: () => setIsCodexSheetOpen(false) })) : null] }));
}
export function sortMonsterCatalog(monsters, mode) {
    const sorted = [...monsters];
    if (mode === "appearance") {
        return sorted.sort((a, b) => (a.appearanceOrder ?? a.sheet.appearanceOrder ?? Number.MAX_SAFE_INTEGER) - (b.appearanceOrder ?? b.sheet.appearanceOrder ?? Number.MAX_SAFE_INTEGER));
    }
    return sorted.sort((a, b) => {
        const familyA = a.sheet.family || a.family || a.name;
        const familyB = b.sheet.family || b.family || b.name;
        return familyA.localeCompare(familyB, "es", { sensitivity: "base" }) || a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
}
function monsterSearchText(monster) {
    return normalizeSearchValue([
        monster.name,
        monster.family,
        monster.variant,
        monster.category,
        monster.threat,
        monster.source,
        monster.summary,
        monster.sheet.family,
        monster.sheet.variant,
        monster.sheet.race,
        monster.sheet.description,
        monster.sheet.conduct,
        monster.sheet.shadow,
        monster.sheet.traits.join(" "),
        monster.sheet.actions.join(" "),
        monster.sheet.capabilities.map((entry) => `${entry.name} ${entry.legacyData ?? ""}`).join(" "),
        monster.sheet.weapons.map((weapon) => `${weapon.name} ${weapon.details} ${weapon.qualities}`).join(" "),
        monster.sheet.tactics,
        monster.sheet.loot
    ].filter(Boolean).join(" "));
}
function useNarrowMonsterLayout() {
    const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches === true);
    useEffect(() => {
        if (typeof window.matchMedia !== "function")
            return;
        const media = window.matchMedia("(max-width: 1023px)");
        const update = () => setNarrow(media.matches);
        update();
        media.addEventListener?.("change", update);
        return () => media.removeEventListener?.("change", update);
    }, []);
    return narrow;
}
export function MonsterDashboardView({ user, ensureAccessToken }) {
    const confirm = useConfirmationDialog();
    const controller = useMonsterController(user, ensureAccessToken);
    const [activeTab, setActiveTab] = useState("codex");
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [customDetailId, setCustomDetailId] = useState(null);
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [familyFilter, setFamilyFilter] = useState("");
    const [threatFilter, setThreatFilter] = useState("");
    const [sortMode, setSortMode] = useState("alphabetical");
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const lastTriggerRef = useRef(null);
    const filtersTriggerRef = useRef(null);
    const filtersSearchRef = useRef(null);
    const workspaceRef = useRef(null);
    const splitPercentRef = useRef(readMonsterCatalogSplit());
    const [splitPercent, setSplitPercent] = useState(splitPercentRef.current);
    const [isResizing, setIsResizing] = useState(false);
    const isNarrow = useNarrowMonsterLayout();
    const selectedId = activeTab === "codex" ? controller.selectedCodexId : customDetailId;
    useBodyScrollLock(isFiltersOpen || (isNarrow && Boolean(selectedId)));
    const sourceMonsters = activeTab === "codex" ? controller.codexMonsters : controller.customMonsters;
    const sources = useMemo(() => Array.from(new Set(sourceMonsters.map((monster) => monster.source))).sort((a, b) => a.localeCompare(b, "es")), [sourceMonsters]);
    const families = useMemo(() => Array.from(new Set(sourceMonsters.map((monster) => monster.sheet.family || monster.family || monster.name))).sort((a, b) => a.localeCompare(b, "es")), [sourceMonsters]);
    const filteredMonsters = useMemo(() => {
        const query = normalizeSearchValue(search);
        const filtered = sourceMonsters.filter((monster) => {
            if (query && !monsterSearchText(monster).includes(query))
                return false;
            if (sourceFilter && monster.source !== sourceFilter)
                return false;
            if (categoryFilter && monster.category !== categoryFilter)
                return false;
            if (familyFilter && (monster.sheet.family || monster.family || monster.name) !== familyFilter)
                return false;
            if (threatFilter && monster.threat !== threatFilter)
                return false;
            return true;
        });
        return sortMonsterCatalog(filtered, sortMode);
    }, [sourceMonsters, search, sourceFilter, categoryFilter, familyFilter, threatFilter, sortMode]);
    const selectedMonster = useMemo(() => {
        if (!selectedId)
            return null;
        return sourceMonsters.find((monster) => monster.id === selectedId) ?? null;
    }, [selectedId, sourceMonsters]);
    useEffect(() => {
        if (!selectedId || filteredMonsters.some((monster) => monster.id === selectedId))
            return;
        if (activeTab === "codex")
            controller.setSelectedCodexId("");
        else
            setCustomDetailId(null);
    }, [activeTab, filteredMonsters, selectedId]);
    useEffect(() => {
        if (!isFiltersOpen)
            return;
        filtersSearchRef.current?.focus();
        const closeOnEscape = (event) => {
            if (event.key !== "Escape")
                return;
            setIsFiltersOpen(false);
            window.setTimeout(() => filtersTriggerRef.current?.focus(), 0);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [isFiltersOpen]);
    useEffect(() => {
        if (!isResizing)
            return;
        const handlePointerMove = (event) => {
            event.preventDefault();
            resizeCatalogFromClientX(event.clientX);
        };
        const finishResize = () => {
            setIsResizing(false);
            persistCatalogSplit(splitPercentRef.current);
        };
        document.body.classList.add("is-resizing-monster-catalog");
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", finishResize, { once: true });
        window.addEventListener("pointercancel", finishResize, { once: true });
        return () => {
            document.body.classList.remove("is-resizing-monster-catalog");
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", finishResize);
            window.removeEventListener("pointercancel", finishResize);
        };
    }, [isResizing]);
    function persistCatalogSplit(value) {
        try {
            window.localStorage.setItem(MONSTER_CATALOG_SPLIT_STORAGE_KEY, String(value));
        }
        catch {
            // The selected proportion remains active for this session when storage is unavailable.
        }
    }
    function applyCatalogSplit(value, persist = false) {
        const next = clampMonsterCatalogSplit(value);
        splitPercentRef.current = next;
        setSplitPercent(next);
        if (persist)
            persistCatalogSplit(next);
    }
    function resizeCatalogFromClientX(clientX) {
        const bounds = workspaceRef.current?.getBoundingClientRect();
        if (!bounds || bounds.width <= 0)
            return;
        applyCatalogSplit(((clientX - bounds.left) / bounds.width) * 100);
    }
    function startCatalogResize(event) {
        if (isNarrow)
            return;
        event.preventDefault();
        resizeCatalogFromClientX(event.clientX);
        setIsResizing(true);
    }
    function handleCatalogSplitterKeyDown(event) {
        let next = splitPercentRef.current;
        if (event.key === "ArrowLeft")
            next -= 5;
        else if (event.key === "ArrowRight")
            next += 5;
        else if (event.key === "Home")
            next = 25;
        else if (event.key === "End")
            next = 75;
        else
            return;
        event.preventDefault();
        applyCatalogSplit(next, true);
    }
    function closeSheet() {
        if (activeTab === "codex")
            controller.setSelectedCodexId("");
        else
            setCustomDetailId(null);
        window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
    }
    function selectMonster(monsterId, trigger) {
        lastTriggerRef.current = trigger;
        if (activeTab === "codex")
            controller.setSelectedCodexId(monsterId);
        else
            setCustomDetailId(monsterId);
    }
    function changeTab(tab) {
        if (tab === activeTab)
            return;
        closeSheet();
        setActiveTab(tab);
        setSourceFilter("");
        setCategoryFilter("");
        setFamilyFilter("");
        setThreatFilter("");
    }
    function openCreate() {
        controller.resetDraft();
        setIsEditorOpen(true);
    }
    function openEdit(monsterId) {
        controller.selectCustomMonster(monsterId);
        setIsEditorOpen(true);
    }
    function duplicateOfficial(monsterId) {
        if (controller.duplicateCodexMonster(monsterId))
            setIsEditorOpen(true);
    }
    function closeFilters() {
        setIsFiltersOpen(false);
        window.setTimeout(() => filtersTriggerRef.current?.focus(), 0);
    }
    function clearFilters() {
        setSearch("");
        setSourceFilter("");
        setCategoryFilter("");
        setFamilyFilter("");
        setThreatFilter("");
        setSortMode("alphabetical");
    }
    async function removeCustom(monster) {
        if (!await confirm({
            title: "Eliminar monstruo",
            message: `¿Eliminar definitivamente a ${monster.name}? Esta acción no se puede deshacer.`,
            confirmLabel: "Eliminar definitivamente",
            tone: "danger"
        }))
            return;
        await controller.deleteSelected(monster.id);
        setCustomDetailId(null);
    }
    return (_jsxs("div", { className: "monster-module monster-catalog-module", children: [_jsxs("section", { ref: workspaceRef, className: `panel monster-catalog-workspace${isResizing ? " is-resizing" : ""}`, style: { gridTemplateColumns: `${splitPercent}fr 10px ${100 - splitPercent}fr` }, children: [_jsxs("aside", { className: "monster-catalog-list-pane", "aria-label": "Listado de monstruos", children: [_jsxs("nav", { className: "monster-catalog-tabs", "aria-label": "Secciones del m\u00F3dulo de monstruos", children: [_jsx("button", { type: "button", className: activeTab === "codex" ? "is-active" : "", "aria-pressed": activeTab === "codex", onClick: () => changeTab("codex"), children: "Cat\u00E1logo oficial" }), _jsx("button", { type: "button", className: activeTab === "custom" ? "is-active" : "", "aria-pressed": activeTab === "custom", onClick: () => changeTab("custom"), children: "Mis monstruos" })] }), _jsxs("div", { className: "monster-catalog-list-header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Archivo del Director de Juego" }), _jsx("h1", { children: "Monstruos y adversarios" }), _jsxs("span", { children: [filteredMonsters.length, " resultados", controller.isLoading ? " · Cargando..." : ""] })] }), _jsxs("div", { className: "monster-catalog-list-actions", children: [_jsxs("button", { ref: filtersTriggerRef, type: "button", className: "subtle-button", onClick: () => setIsFiltersOpen(true), children: ["Buscar y filtrar", search || sourceFilter || categoryFilter || familyFilter || threatFilter || sortMode !== "alphabetical" ? " · Activo" : ""] }), activeTab === "custom" ? _jsx("button", { type: "button", onClick: openCreate, children: "Nuevo monstruo" }) : null] })] }), controller.loadError ? _jsx("p", { className: "error", children: controller.loadError }) : null, _jsx("div", { className: "monster-catalog-results", children: filteredMonsters.length ? filteredMonsters.map((monster, index) => {
                                    const family = monster.sheet.family || monster.family || monster.name;
                                    const previousFamily = index > 0 ? filteredMonsters[index - 1]?.sheet.family || filteredMonsters[index - 1]?.family || filteredMonsters[index - 1]?.name : null;
                                    return (_jsxs("div", { className: "monster-catalog-result-group", children: [family !== previousFamily ? _jsx("h3", { children: family }) : null, _jsxs("button", { type: "button", className: `monster-catalog-result${selectedMonster?.id === monster.id ? " is-active" : ""}`, "aria-current": selectedMonster?.id === monster.id ? "true" : undefined, onClick: (event) => selectMonster(monster.id, event.currentTarget), children: [_jsxs("span", { children: [_jsx("strong", { children: monster.name }), _jsxs("small", { children: [monster.source, monster.references?.[0]?.page ? ` · p.${monster.references[0].page}` : ""] })] }), _jsxs("span", { className: "monster-catalog-result-meta", children: [_jsx("em", { children: monster.category }), _jsx("b", { children: monster.threat })] })] })] }, monster.id));
                                }) : _jsxs("div", { className: "monster-catalog-empty", children: [_jsx("strong", { children: "No hay coincidencias." }), _jsx("p", { children: "Ajusta la b\u00FAsqueda o limpia alg\u00FAn filtro." })] }) })] }), _jsx("div", { className: "monster-catalog-splitter", role: "separator", "aria-label": "Ajustar ancho del cat\u00E1logo y la ficha", "aria-orientation": "vertical", "aria-valuemin": 25, "aria-valuemax": 75, "aria-valuenow": splitPercent, "aria-valuetext": `Catálogo ${splitPercent}%, ficha ${100 - splitPercent}%`, tabIndex: 0, title: "Arrastra para ajustar el ancho. Tambi\u00E9n puedes usar las flechas.", onPointerDown: startCatalogResize, onKeyDown: handleCatalogSplitterKeyDown, children: _jsx("span", { "aria-hidden": "true" }) }), _jsx("div", { className: `monster-catalog-detail-pane${selectedMonster ? " is-open" : ""}`, children: selectedMonster ? (_jsx(MonsterReferenceSheet, { monster: selectedMonster, backgroundPreferenceScope: `${user.id}:monster-sheets`, official: activeTab === "codex", busy: controller.isSaving, onClose: closeSheet, onDuplicate: activeTab === "codex" ? () => duplicateOfficial(selectedMonster.id) : undefined, onEdit: activeTab === "custom" ? () => openEdit(selectedMonster.id) : undefined, onDelete: activeTab === "custom" ? () => void removeCustom(selectedMonster) : undefined })) : _jsxs("div", { className: "monster-catalog-detail-empty", children: [_jsx("span", { "aria-hidden": "true", children: "\u2726" }), _jsx("h2", { children: "Selecciona un monstruo" }), _jsx("p", { children: "Su ficha aparecer\u00E1 aqu\u00ED sin abandonar el listado." })] }) })] }), isFiltersOpen ? (_jsx("div", { className: "modal-backdrop monster-filter-modal-backdrop", onMouseDown: (event) => { if (event.target === event.currentTarget)
                    closeFilters(); }, children: _jsxs("section", { className: "monster-filter-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "monster-filter-title", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Cat\u00E1logo de monstruos" }), _jsx("h2", { id: "monster-filter-title", children: "Buscar y ordenar" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: closeFilters, children: "Cerrar" })] }), _jsxs("div", { className: "monster-catalog-filters", children: [_jsxs("label", { className: "field monster-catalog-search", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { ref: filtersSearchRef, type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Nombre, rasgo, arma, t\u00E1ctica..." })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Orden" }), _jsxs("select", { value: sortMode, onChange: (event) => setSortMode(event.target.value), children: [_jsx("option", { value: "alphabetical", children: "Alfab\u00E9tico" }), _jsx("option", { value: "appearance", children: "Orden de los libros" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Manual" }), _jsxs("select", { value: sourceFilter, onChange: (event) => setSourceFilter(event.target.value), children: [_jsx("option", { value: "", children: "Todos" }), sources.map((source) => _jsx("option", { children: source }, source))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Categor\u00EDa" }), _jsxs("select", { value: categoryFilter, onChange: (event) => setCategoryFilter(event.target.value), children: [_jsx("option", { value: "", children: "Todas" }), MONSTER_CATEGORIES.map((category) => _jsx("option", { children: category }, category))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Familia" }), _jsxs("select", { value: familyFilter, onChange: (event) => setFamilyFilter(event.target.value), children: [_jsx("option", { value: "", children: "Todas" }), families.map((family) => _jsx("option", { children: family }, family))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Desaf\u00EDo" }), _jsxs("select", { value: threatFilter, onChange: (event) => setThreatFilter(event.target.value), children: [_jsx("option", { value: "", children: "Todos" }), MONSTER_THREATS.map((threat) => _jsx("option", { children: threat }, threat))] })] })] }), _jsxs("footer", { children: [_jsx("button", { type: "button", className: "subtle-button", onClick: clearFilters, children: "Limpiar" }), _jsxs("button", { type: "button", onClick: closeFilters, children: ["Ver ", filteredMonsters.length, " resultados"] })] })] }) })) : null, isEditorOpen ? _jsx("div", { className: "modal-backdrop", children: _jsx(MonsterCreationWizard, { controller: controller, onCancel: () => setIsEditorOpen(false) }) }) : null] }));
}
