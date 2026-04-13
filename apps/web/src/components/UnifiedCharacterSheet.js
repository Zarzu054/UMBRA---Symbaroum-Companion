import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, WEAPON_QUALITY_OPTIONS, SYMBAROUM_ABILITIES, buildRollRequest, deriveCharacterActions, executeCharacterAction, findWeaponQualityOption, formatWeaponQualities, parseWeaponQualities, synchronizeCharacterSheet, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "@umbra/shared";
import { computeDerivedStats } from "../models/rulesEngine";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ARMOR_QUALITY_OPTIONS, ITEM_QUALITY_OPTIONS, createCustomInventoryItem, createInventoryItemFromTemplate, ITEM_CATALOG } from "../models/itemCatalog";
import { ALL_ENTRIES, findCompendiumEntryByTypeAndName, getCompendiumSourcePdfUrl, getCompendiumSummaryLink } from "../models/compendiumEntries";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import { dispatchRoll20Request, setRollDestination as persistRollDestination } from "../services/rollTransport";
const TAB_IDS = ["actions", "inventory", "abilities", "background", "notes"];
const ACTION_TAB_IDS = ["all", "favorites", "attacks", "powers", "actions", "free", "reactions", "other"];
const CAPABILITY_TAB_IDS = ["traits", "blessings", "burdens", "abilities", "powers", "rituals"];
const INVENTORY_TAB_IDS = ["money", "weapons", "armors", "items"];
const WEAPON_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todas" },
    { id: "one-handed", label: "Una mano" },
    { id: "short", label: "Cortas" },
    { id: "long", label: "Largas" },
    { id: "heavy", label: "Pesadas" },
    { id: "ranged", label: "A distancia" },
    { id: "thrown", label: "Arrojadizas" }
];
const ARMOR_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todas" },
    { id: "light", label: "Ligeras" },
    { id: "medium", label: "Medias" },
    { id: "heavy", label: "Pesadas" },
    { id: "shield", label: "Escudos" }
];
const ITEM_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todos" },
    { id: "consumable", label: "Consumibles" },
    { id: "travel", label: "Viaje" },
    { id: "ammunition", label: "Municion" },
    { id: "tool", label: "Herramientas" },
    { id: "material", label: "Materiales" },
    { id: "ritual", label: "Rituales" },
    { id: "valuable", label: "Valiosos" },
    { id: "artifact", label: "Artefactos" }
];
const SHEET_TAB_STORAGE_PREFIX = "umbra:character-sheet-tabs:";
const DEFAULT_SHEET_TAB_STATE = {
    activeTab: "actions",
    activeActionTab: "all",
    activeCapabilityTab: "abilities",
    activeInventoryTab: "weapons"
};
function matchesWeaponCatalogFilter(item, filterId) {
    if (item.category !== "weapon")
        return false;
    if (filterId === "all")
        return true;
    const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
    if (filterId === "ranged")
        return qualities.includes("a distancia") || item.slot === "ranged";
    if (filterId === "thrown")
        return qualities.includes("arrojadiza") || item.slot === "none";
    if (filterId === "heavy")
        return qualities.includes("pesada") || item.name.toLowerCase().includes("pesada");
    if (filterId === "long")
        return qualities.includes("larga");
    if (filterId === "short")
        return qualities.includes("corta") || item.slot === "offHand";
    if (filterId === "one-handed") {
        return item.slot === "mainHand"
            && !qualities.includes("corta")
            && !qualities.includes("larga")
            && !qualities.includes("pesada")
            && !qualities.includes("a distancia")
            && !qualities.includes("arrojadiza");
    }
    return true;
}
function matchesArmorCatalogFilter(item, filterId) {
    if (item.category !== "armor")
        return false;
    if (filterId === "all")
        return true;
    const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
    if (filterId === "shield")
        return qualities.includes("escudo") || item.name.toLowerCase().includes("escudo");
    if (filterId === "light")
        return qualities.includes("ligera");
    if (filterId === "medium")
        return qualities.includes("media");
    if (filterId === "heavy")
        return qualities.includes("pesada");
    return true;
}
function matchesItemCatalogFilter(item, filterId) {
    if (item.category === "weapon" || item.category === "armor")
        return false;
    if (filterId === "all")
        return true;
    const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
    if (filterId === "artifact")
        return item.category === "artifact" || qualities.includes("mistico");
    if (filterId === "consumable")
        return item.category === "consumable";
    if (filterId === "travel")
        return qualities.includes("viaje");
    if (filterId === "ammunition")
        return qualities.includes("municion");
    if (filterId === "tool")
        return qualities.includes("herramienta");
    if (filterId === "material")
        return qualities.includes("material");
    if (filterId === "ritual")
        return qualities.includes("ritual");
    if (filterId === "valuable")
        return item.category === "treasure" || qualities.includes("valioso");
    return true;
}
function getAmmoInfoForWeapon(weapon, inventoryItems) {
    if (weapon.category !== "weapon") {
        return null;
    }
    const normalizedName = normalizeCapabilityText(weapon.name);
    const qualities = parseWeaponQualities(weapon.qualities).map((entry) => normalizeCapabilityText(entry));
    const matchedAmmoNames = normalizedName.includes("ballesta") ? ["Virotes"] :
        normalizedName.includes("cerbatana") ? ["Dardos"] :
            normalizedName.includes("honda de lanza") ? ["Dardos", "Jabalina"] :
                normalizedName.includes("honda") ? ["Piedras de honda"] :
                    weapon.slot === "ranged" || qualities.includes("a distancia") ? ["Flechas"] :
                        [];
    if (matchedAmmoNames.length === 0) {
        return null;
    }
    const quantity = inventoryItems
        .filter((item) => matchedAmmoNames.some((ammoName) => normalizeCapabilityText(item.name) === normalizeCapabilityText(ammoName)))
        .reduce((sum, item) => sum + item.quantity, 0);
    return {
        label: matchedAmmoNames.join(" / "),
        quantity
    };
}
function parseMoneyCounters(rawValue) {
    const value = String(rawValue ?? "");
    const talerosMatch = value.match(/(\d+)\s*taler/i);
    const chelinesMatch = value.match(/(\d+)\s*chelin/i);
    const ortegsMatch = value.match(/(\d+)\s*orteg/i);
    const slashMatch = value.match(/^\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (slashMatch) {
        return {
            taleros: Number(slashMatch[1] ?? 0),
            chelines: Number(slashMatch[2] ?? 0),
            ortegs: Number(slashMatch[3] ?? 0)
        };
    }
    return {
        taleros: Number(talerosMatch?.[1] ?? 0),
        chelines: Number(chelinesMatch?.[1] ?? 0),
        ortegs: Number(ortegsMatch?.[1] ?? 0)
    };
}
function formatMoneyCounters(counters) {
    return `${Math.max(0, counters.taleros)} Taleros · ${Math.max(0, counters.chelines)} Chelines · ${Math.max(0, counters.ortegs)} Ortegs`;
}
function formatActionDisplayLabel(label) {
    return String(label ?? "")
        .replace(/^(Usar|Lanzar)\s+/i, "")
        .replace(/\s+\((Novato|Adepto|Maestro)\)\s*$/i, "")
        .trim();
}
function getActionRollLabel(action) {
    if (action.sourceType === "weapon") {
        return "Ataque";
    }
    if (action.sourceType === "power") {
        return "Hechizo";
    }
    const normalized = normalizeCapabilityText(`${action.label} ${action.effectSummary}`);
    if (/(defender|defensa|parar|desviar)/.test(normalized)) {
        return "Defensa";
    }
    return "Tirada";
}
function getActionDamageVariants(action) {
    if (action.damageModifiers && action.damageModifiers.length > 0) {
        return action.damageModifiers;
    }
    return [];
}
function getDamageRollBreakdown(action, selectedDamageModifierIds = []) {
    const selectedIds = new Set(selectedDamageModifierIds);
    const baseEntries = action.damageBreakdown && action.damageBreakdown.length > 0
        ? action.damageBreakdown
        : (action.damageFormula ? [{ label: action.sourceName, formula: action.damageFormula }] : []);
    const selectedModifiers = (action.damageModifiers ?? [])
        .filter((modifier) => selectedIds.has(modifier.id))
        .map((modifier) => ({
        label: modifier.label,
        formula: modifier.formula
    }));
    return [...baseEntries, ...selectedModifiers];
}
function getRollRequestBreakdown(request) {
    if (request.formulaBreakdown && request.formulaBreakdown.length > 0) {
        return request.formulaBreakdown;
    }
    if (request.phase === "damage" && request.formula) {
        return [{ label: request.sourceName || request.actionLabel, formula: request.formula }];
    }
    return [];
}
const BOON_CHECK_MODIFIER_DEFINITIONS = [
    { id: "boon:augur", names: ["Augur"], label: "Augur", bonus: 1, maxStacks: 3 },
    { id: "boon:pulgar-verde", names: ["Pulgar verde", "Sintonia con las plantas", "Sintonia con las plantas"], label: "Sintonia con las plantas", bonus: 1, maxStacks: 3 },
    { id: "boon:forjado-por-el-fuego", names: ["Forjado por el fuego"], label: "Forjado por el fuego", bonus: 1 },
    { id: "boon:imitador", names: ["Imitador"], label: "Imitador", bonus: 1, maxStacks: 3 },
    { id: "boon:manipulador", names: ["Manipulador"], label: "Manipulador", bonus: 1, maxStacks: 3 },
    { id: "boon:nacido-de-las-sombras", names: ["Nacido de las sombras"], label: "Nacido de las sombras", bonus: 1, maxStacks: 3 },
    { id: "boon:correveidile", names: ["Correveidile"], label: "Correveidile", bonus: 1, maxStacks: 3 }
];
function getBoonCheckModifiers(sheet) {
    const blessingCounts = new Map();
    sheet.bendiciones.forEach((entry) => {
        const normalized = normalizeCapabilityText(entry);
        blessingCounts.set(normalized, (blessingCounts.get(normalized) ?? 0) + 1);
    });
    return BOON_CHECK_MODIFIER_DEFINITIONS.flatMap((definition) => {
        const totalMatches = definition.names.reduce((sum, name) => sum + (blessingCounts.get(normalizeCapabilityText(name)) ?? 0), 0);
        if (totalMatches <= 0) {
            return [];
        }
        const appliedStacks = Math.min(totalMatches, definition.maxStacks ?? totalMatches);
        const totalBonus = appliedStacks * definition.bonus;
        return [{
                id: definition.id,
                label: `${definition.label} (+${totalBonus}, si aplica)`,
                bonus: totalBonus,
                source: "boon"
            }];
    });
}
function getAttackRollModifiers(action, sheet) {
    if (!action.rollAttribute) {
        return [];
    }
    const robustLevel = getSheetTraitLevel(sheet, "robusto");
    if (robustLevel <= 0 || getActionRollLabel(action) === "Defensa") {
        return [];
    }
    const bonus = robustLevel === 1 ? 2 : robustLevel === 2 ? 4 : 8;
    return [{
            id: `trait:robusto-attack:${robustLevel}`,
            label: `Robusto (+${bonus}, una vez por turno)`,
            bonus,
            source: "trait"
        }];
}
function getCheckRollModifiers(action, request, sheet) {
    const hasTargetRoll = Boolean((action && action.rollAttribute) || (request && typeof request.target === "number"));
    if (!hasTargetRoll) {
        return [];
    }
    const modifiers = [...getBoonCheckModifiers(sheet)];
    if (action) {
        modifiers.push(...getAttackRollModifiers(action, sheet));
    }
    return modifiers;
}
function getPendingAttackTarget(request, selectedAttackModifierIds, modifiers) {
    if (!request || typeof request.target !== "number") {
        return null;
    }
    const selectedBonus = modifiers
        .filter((modifier) => selectedAttackModifierIds.includes(modifier.id))
        .reduce((sum, modifier) => sum + modifier.bonus, 0);
    return request.target + selectedBonus;
}
function isIntegratedDamageBonusAction(action) {
    return action.sourceType !== "weapon" && !action.rollAttribute && String(action.damageFormula ?? "").trim().startsWith("+");
}
function hasActionRoll(action) {
    if (isIntegratedDamageBonusAction(action)) {
        return false;
    }
    return Boolean(action.rollAttribute || action.damageFormula);
}
function getActionSourceLabel(action) {
    switch (action.sourceType) {
        case "weapon":
            return action.sourceName || "Arma";
        case "power":
            return action.sourceName || "Poder mistico";
        case "ritual":
            return action.sourceName || "Ritual";
        case "ability":
        default:
            return action.sourceName || (action.fixedTarget ? "Accion especial" : "Habilidad");
    }
}
function isDefenseAlternativeAction(action) {
    return Boolean(action.rollAttribute) && getActionRollLabel(action) === "Defensa";
}
function isDefenseModifierOnlyAction(action) {
    return isDefenseAlternativeAction(action) && Boolean(action.fixedTarget);
}
function isOtherAction(action) {
    if (action.sourceType === "weapon" || action.sourceType === "power" || action.sourceType === "ritual") {
        return false;
    }
    return Boolean(action.fixedTarget);
}
function parseCapabilityTiers(text) {
    const source = String(text ?? "").trim();
    if (!source) {
        return { tiers: [], reference: null, remainder: null };
    }
    const tierRegex = /(Novato:|Adepto:|Maestro:)/g;
    const matches = [...source.matchAll(tierRegex)];
    if (matches.length === 0) {
        const referenceIndex = source.indexOf("Ref:");
        return {
            tiers: [],
            reference: referenceIndex >= 0 ? source.slice(referenceIndex).trim() : null,
            remainder: (referenceIndex >= 0 ? source.slice(0, referenceIndex) : source).trim() || null
        };
    }
    const tiers = [];
    let reference = null;
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const start = match.index ?? 0;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length;
        const rawLabel = (match[0] ?? "").replace(":", "").trim();
        const rawContent = source.slice(start + match[0].length, end).trim();
        const referenceIndex = rawContent.indexOf("Ref:");
        const content = (referenceIndex >= 0 ? rawContent.slice(0, referenceIndex) : rawContent).trim();
        if (referenceIndex >= 0 && !reference) {
            reference = rawContent.slice(referenceIndex).trim();
        }
        if (!content) {
            continue;
        }
        if (rawLabel === "Novato" || rawLabel === "Adepto" || rawLabel === "Maestro") {
            tiers.push({ label: rawLabel, content });
        }
    }
    return { tiers, reference, remainder: null };
}
function capabilityLevelRank(level) {
    switch (String(level ?? "").toLowerCase()) {
        case "maestro":
            return 3;
        case "adepto":
            return 2;
        case "novato":
        default:
            return 1;
    }
}
function normalizeCapabilityText(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function getSheetTraitLevel(sheet, traitName) {
    const target = normalizeCapabilityText(traitName);
    const traitSources = [
        ...(sheet.rasgos ?? []),
        ...String(sheet.noteSections?.traits ?? "")
            .split(/[,\n;]/)
            .map((entry) => entry.trim())
            .filter(Boolean)
    ];
    for (const rawTrait of traitSources) {
        const normalized = normalizeCapabilityText(rawTrait);
        if (!new RegExp(`\\b${target}\\b`).test(normalized)) {
            continue;
        }
        if (/\bmaestro\b/.test(normalized))
            return 3;
        if (/\badepto\b/.test(normalized))
            return 2;
        if (/\bnovato\b/.test(normalized))
            return 1;
        if (/\biii\b|\b3\b/.test(normalized))
            return 3;
        if (/\bii\b|\b2\b/.test(normalized))
            return 2;
        return 1;
    }
    return 0;
}
function isMeleeLikeAction(action) {
    const normalized = normalizeCapabilityText(`${action.label} ${action.sourceName} ${action.effectSummary}`);
    return !/(arco|ballesta|proyectil|disparo|a distancia|arrojadiza|jabalina|venablo)/.test(normalized);
}
function normalizeInventoryItemText(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function isContainerLikeInventoryItem(item) {
    const combinedText = normalizeInventoryItemText([item.name, item.description, item.qualities].filter(Boolean).join(" "));
    return /(mochila|bolsa|saco|bandolera|estuche|cofre|caja|barril|contenedor|alforja|morral)/.test(combinedText);
}
function isStackableInventoryItem(item) {
    if (isContainerLikeInventoryItem(item)) {
        return false;
    }
    if (item.stackable) {
        return true;
    }
    if (item.isCustom) {
        return false;
    }
    if (item.category === "weapon" || item.category === "armor" || item.category === "artifact") {
        return false;
    }
    return true;
}
function normalizeWeaponQualityKey(value) {
    return normalizeCapabilityText(value).replace(/[^a-z0-9]+/g, "-");
}
function getKnownWeaponQualities(item) {
    const knownIds = new Set(WEAPON_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}
function getCustomWeaponQualities(item) {
    const knownIds = new Set(WEAPON_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => !knownIds.has(normalizeWeaponQualityKey(quality)));
}
function getKnownArmorQualities(item) {
    const knownIds = new Set(ARMOR_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}
function getCustomArmorQualities(item) {
    const knownIds = new Set(ARMOR_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => !knownIds.has(normalizeWeaponQualityKey(quality)));
}
function getKnownItemQualities(item) {
    const knownIds = new Set(ITEM_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}
function getCustomItemQualities(item) {
    const knownIds = new Set(ITEM_QUALITY_OPTIONS.map((entry) => entry.id));
    return parseWeaponQualities(item.qualities)
        .filter((quality) => !knownIds.has(normalizeWeaponQualityKey(quality)));
}
function capitalizeActionLevel(level) {
    switch (String(level ?? "").toLowerCase()) {
        case "novato":
            return "Novato";
        case "adepto":
            return "Adepto";
        case "maestro":
            return "Maestro";
        default:
            return null;
    }
}
function formatCapabilitySource(entry) {
    if (entry.fuente && entry.pagina) {
        return `${entry.fuente} p. ${entry.pagina}`;
    }
    if (entry.fuente) {
        return entry.fuente;
    }
    if (entry.pagina) {
        return `p. ${entry.pagina}`;
    }
    return "Referencia de compendio";
}
function normalizeCapabilityTiers(tiers) {
    const order = ["Novato", "Adepto", "Maestro"];
    const unique = new Map();
    for (const tier of tiers) {
        if (!unique.has(tier.label) && tier.content.trim()) {
            unique.set(tier.label, { ...tier, content: tier.content.trim() });
        }
    }
    return order.map((label) => unique.get(label)).filter((tier) => Boolean(tier));
}
function shouldKeepCapabilityNote(note, tiers, reference) {
    const normalizedNote = normalizeCapabilityText(note);
    if (!normalizedNote) {
        return false;
    }
    if (reference && normalizedNote === normalizeCapabilityText(reference)) {
        return false;
    }
    if (tiers.length === 0) {
        return true;
    }
    if (/(novato:|adepto:|maestro:)/i.test(note)) {
        return false;
    }
    const combinedTierText = normalizeCapabilityText(tiers.map((tier) => `${tier.label} ${tier.content}`).join(" "));
    if (!combinedTierText) {
        return true;
    }
    return !combinedTierText.includes(normalizedNote);
}
export function UnifiedCharacterSheet({ title, subtitle, sheet, editable, busy = false, onSave, onBack, onOpenBuilder, onOpenCompendiumCapability }) {
    const { draft, editMode, isDirty, isSavingLocal, setDraft, setEditMode, updateField, save } = useUnifiedCharacterSheet({
        sheet,
        editable,
        onSave
    });
    const canEditNotes = editMode && editable;
    const canEditInventory = editable;
    const [selectedCatalogItemId, setSelectedCatalogItemId] = useState(ITEM_CATALOG[0]?.templateId ?? "");
    const [inventoryCatalogModalTab, setInventoryCatalogModalTab] = useState(null);
    const [selectedWeaponCatalogFilter, setSelectedWeaponCatalogFilter] = useState("all");
    const [selectedArmorCatalogFilter, setSelectedArmorCatalogFilter] = useState("all");
    const [selectedItemCatalogFilter, setSelectedItemCatalogFilter] = useState("all");
    const [history, setHistory] = useState([]);
    const rollDestination = "roll20";
    const [pendingRollConfirmation, setPendingRollConfirmation] = useState(null);
    const [showPendingRollBreakdown, setShowPendingRollBreakdown] = useState(false);
    const [actionDetailModal, setActionDetailModal] = useState(null);
    const [weaponEditorModal, setWeaponEditorModal] = useState(null);
    const [armorEditorModal, setArmorEditorModal] = useState(null);
    const [itemEditorModal, setItemEditorModal] = useState(null);
    const [activeWeaponQualityInfoId, setActiveWeaponQualityInfoId] = useState("");
    const normalizedSheet = useMemo(() => synchronizeCharacterSheet(draft), [draft]);
    const derived = useMemo(() => computeDerivedStats(normalizedSheet), [normalizedSheet]);
    const actions = useMemo(() => deriveCharacterActions(normalizedSheet), [normalizedSheet]);
    const defenseAlternativeActions = useMemo(() => actions.filter((action) => isDefenseModifierOnlyAction(action)), [actions]);
    const visibleActions = useMemo(() => actions.filter((action) => !isDefenseModifierOnlyAction(action)), [actions]);
    const favoriteActionIds = useMemo(() => new Set(normalizedSheet.actionFavorites ?? []), [normalizedSheet.actionFavorites]);
    const displayName = normalizedSheet.identidad.nombrePersonaje || title;
    const sheetTabStorageKey = useMemo(() => `${SHEET_TAB_STORAGE_PREFIX}${normalizeCapabilityText(displayName || "default").replace(/[^a-z0-9]+/g, "-")}`, [displayName]);
    const [sheetTabState, setSheetTabState] = useState(DEFAULT_SHEET_TAB_STATE);
    const [hasHydratedSheetTabs, setHasHydratedSheetTabs] = useState(false);
    const activeTab = sheetTabState.activeTab;
    const activeActionTab = sheetTabState.activeActionTab;
    const activeCapabilityTab = sheetTabState.activeCapabilityTab;
    const activeInventoryTab = sheetTabState.activeInventoryTab;
    const setActiveTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeTab: nextTab }));
    const setActiveActionTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeActionTab: nextTab }));
    const setActiveCapabilityTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeCapabilityTab: nextTab }));
    const setActiveInventoryTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeInventoryTab: nextTab }));
    const filteredActions = useMemo(() => {
        switch (activeActionTab) {
            case "all":
                return visibleActions;
            case "favorites":
                return visibleActions.filter((action) => favoriteActionIds.has(action.id));
            case "attacks":
                return visibleActions.filter((action) => action.sourceType === "weapon");
            case "powers":
                return visibleActions.filter((action) => action.sourceType === "power" || action.sourceType === "ritual");
            case "other":
                return visibleActions.filter((action) => isOtherAction(action));
            case "free":
                return visibleActions.filter((action) => action.cost === "free" && !isOtherAction(action));
            case "reactions":
                return visibleActions.filter((action) => action.cost === "reaction" && !isOtherAction(action));
            case "actions":
            default:
                return visibleActions.filter((action) => action.sourceType !== "weapon" &&
                    action.sourceType !== "power" &&
                    action.sourceType !== "ritual" &&
                    !isOtherAction(action) &&
                    action.cost !== "free" &&
                    action.cost !== "reaction");
        }
    }, [visibleActions, activeActionTab, favoriteActionIds]);
    const pendingAttackModifiers = useMemo(() => (pendingRollConfirmation
        ? getCheckRollModifiers(pendingRollConfirmation.action, pendingRollConfirmation.request, normalizedSheet)
        : []), [pendingRollConfirmation, normalizedSheet]);
    const experience = useMemo(() => getCharacterExperienceSummary(normalizedSheet), [normalizedSheet]);
    const displayedSpentExperience = Math.max(normalizedSheet.progreso.experienciaGastada, experience.computedSpent);
    const activeArmor = useMemo(() => normalizedSheet.inventoryItems.find((item) => item.category === "armor" && item.quantity > 0) ?? null, [normalizedSheet.inventoryItems]);
    const moneyCounters = useMemo(() => parseMoneyCounters(normalizedSheet.recursos.dinero), [normalizedSheet.recursos.dinero]);
    const inventorySections = useMemo(() => ({
        weapons: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "weapon"),
        armors: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "armor"),
        items: normalizedSheet.inventoryItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.category !== "weapon" && item.category !== "armor")
    }), [normalizedSheet.inventoryItems]);
    const modalCatalogItems = useMemo(() => {
        if (inventoryCatalogModalTab === "weapons") {
            return ITEM_CATALOG.filter((item) => item.category === "weapon");
        }
        if (inventoryCatalogModalTab === "armors") {
            return ITEM_CATALOG.filter((item) => item.category === "armor");
        }
        if (inventoryCatalogModalTab === "items") {
            return ITEM_CATALOG.filter((item) => item.category !== "weapon" && item.category !== "armor");
        }
        return [];
    }, [inventoryCatalogModalTab]);
    const filteredModalCatalogItems = useMemo(() => inventoryCatalogModalTab === "weapons"
        ? modalCatalogItems.filter((item) => matchesWeaponCatalogFilter(item, selectedWeaponCatalogFilter))
        : inventoryCatalogModalTab === "armors"
            ? modalCatalogItems.filter((item) => matchesArmorCatalogFilter(item, selectedArmorCatalogFilter))
            : inventoryCatalogModalTab === "items"
                ? modalCatalogItems.filter((item) => matchesItemCatalogFilter(item, selectedItemCatalogFilter))
                : modalCatalogItems, [inventoryCatalogModalTab, modalCatalogItems, selectedWeaponCatalogFilter, selectedArmorCatalogFilter, selectedItemCatalogFilter]);
    useEffect(() => {
        persistRollDestination("roll20");
    }, []);
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        let nextState = DEFAULT_SHEET_TAB_STATE;
        try {
            const rawTabs = window.localStorage.getItem(sheetTabStorageKey);
            if (rawTabs) {
                const persistedTabs = JSON.parse(rawTabs);
                nextState = {
                    activeTab: persistedTabs.activeTab && TAB_IDS.includes(persistedTabs.activeTab) ? persistedTabs.activeTab : DEFAULT_SHEET_TAB_STATE.activeTab,
                    activeActionTab: persistedTabs.activeActionTab && ACTION_TAB_IDS.includes(persistedTabs.activeActionTab) ? persistedTabs.activeActionTab : DEFAULT_SHEET_TAB_STATE.activeActionTab,
                    activeCapabilityTab: persistedTabs.activeCapabilityTab && CAPABILITY_TAB_IDS.includes(persistedTabs.activeCapabilityTab) ? persistedTabs.activeCapabilityTab : DEFAULT_SHEET_TAB_STATE.activeCapabilityTab,
                    activeInventoryTab: persistedTabs.activeInventoryTab && INVENTORY_TAB_IDS.includes(persistedTabs.activeInventoryTab) ? persistedTabs.activeInventoryTab : DEFAULT_SHEET_TAB_STATE.activeInventoryTab
                };
            }
        }
        catch {
            window.localStorage.removeItem(sheetTabStorageKey);
            nextState = DEFAULT_SHEET_TAB_STATE;
        }
        setSheetTabState(nextState);
        setHasHydratedSheetTabs(true);
    }, [sheetTabStorageKey]);
    useEffect(() => {
        if (typeof window === "undefined" || !hasHydratedSheetTabs) {
            return;
        }
        const persistedTabs = {
            activeTab,
            activeActionTab,
            activeCapabilityTab,
            activeInventoryTab
        };
        window.localStorage.setItem(sheetTabStorageKey, JSON.stringify(persistedTabs));
    }, [activeActionTab, activeCapabilityTab, activeInventoryTab, activeTab, hasHydratedSheetTabs, sheetTabStorageKey]);
    function pushHistory(titleText, rolls, detail) {
        setHistory((current) => [{ title: titleText, detail, rolls }, ...current].slice(0, 12));
    }
    function openActionDetail(action) {
        if (action.sourceType === "weapon") {
            const item = normalizedSheet.inventoryItems.find((entry) => entry.name === action.sourceName || entry.id === action.id.replace(/^weapon:/, ""));
            const detail = [item?.description, item?.qualities, item?.notes, action.effectSummary].filter(Boolean).join("\n\n").trim() || "Sin descripcion adicional.";
            setActionDetailModal({
                title: formatActionDisplayLabel(action.label),
                sourceLabel: getActionSourceLabel(action),
                detail
            });
            return;
        }
        const entries = action.sourceType === "power"
            ? normalizedSheet.poderesMisticos
            : action.sourceType === "ritual"
                ? normalizedSheet.rituales
                : normalizedSheet.habilidades;
        const entry = entries.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName));
        const canonicalEntry = (action.sourceType === "power"
            ? SYMBAROUM_MYSTIC_POWERS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName))
            : action.sourceType === "ritual"
                ? SYMBAROUM_RITUALS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName))
                : SYMBAROUM_ABILITIES.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName)));
        const rawDetail = canonicalEntry?.efectoResumen?.trim() ||
            `${entry?.efecto ?? ""}\n${entry?.notas ?? ""}`.trim() ||
            action.effectSummary;
        const parsed = parseCapabilityTiers(rawDetail);
        const currentTierLabel = entry?.nivel ? capitalizeActionLevel(entry.nivel) : null;
        const tierContent = currentTierLabel ? parsed.tiers.find((tier) => tier.label === currentTierLabel)?.content : null;
        const detail = [tierContent, parsed.remainder, parsed.reference].filter(Boolean).join("\n\n").trim() || "Sin descripcion adicional.";
        const capabilityType = action.sourceType === "power"
            ? "poder_mistico"
            : action.sourceType === "ritual"
                ? "ritual"
                : "habilidad";
        const compendiumEntry = ALL_ENTRIES.find((candidate) => candidate.tipo === capabilityType &&
            normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName));
        const summaryLink = compendiumEntry ? getCompendiumSummaryLink(compendiumEntry) : null;
        const references = [
            compendiumEntry?.fuente
                ? {
                    label: compendiumEntry.pagina ? `${compendiumEntry.fuente} p. ${compendiumEntry.pagina}` : compendiumEntry.fuente,
                    url: getCompendiumSourcePdfUrl(compendiumEntry.fuente, compendiumEntry.pagina, compendiumEntry.nombre) ?? ""
                }
                : null,
            summaryLink
                ? { label: `${summaryLink.documentLabel} - ${summaryLink.sectionLabel}`, url: summaryLink.url }
                : null
        ].filter((reference) => Boolean(reference?.url));
        setActionDetailModal({
            title: formatActionDisplayLabel(action.label),
            sourceLabel: getActionSourceLabel(action),
            detail,
            references,
            capabilityTipo: capabilityType,
            capabilityNombre: action.sourceName
        });
    }
    function openInventoryItemDetail(item) {
        const notes = [];
        if (item.attackAttribute || item.damageFormula || item.protectionFormula) {
            notes.push([
                item.attackAttribute ? `Ataque: ${ATTRIBUTE_LABELS[item.attackAttribute]}` : "",
                item.damageFormula ? `Danio: ${item.damageFormula}` : "",
                item.protectionFormula ? `Proteccion: ${item.protectionFormula}` : ""
            ].filter(Boolean).join(" · "));
        }
        if (item.weight || item.value) {
            notes.push([
                item.weight ? `Peso: ${item.weight}` : "",
                item.value ? `Valor: ${item.value}` : ""
            ].filter(Boolean).join(" · "));
        }
        if (item.qualities) {
            notes.push(`Cualidades: ${item.qualities}`);
        }
        if (item.notes) {
            notes.push(...item.notes.split(/\n+/).map((entry) => entry.trim()).filter(Boolean));
        }
        setActionDetailModal({
            title: item.name || "Objeto sin nombre",
            sourceLabel: item.isCustom ? "Arma personalizada" : item.category === "weapon" ? "Arma del catalogo" : item.category === "armor" ? "Armadura" : "Objeto",
            detail: item.description.trim() || "Sin descripcion adicional.",
            notes,
            removeInventoryIndex: canEditInventory ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined
        });
    }
    function openInventoryWeaponDetail(item) {
        const qualityDefinitions = parseWeaponQualities(item.qualities).map((quality) => {
            const definition = findWeaponQualityOption(quality);
            return definition
                ? {
                    id: definition.id,
                    label: definition.label,
                    summary: definition.summary,
                    details: definition.details ?? definition.summary
                }
                : {
                    id: quality.toLowerCase(),
                    label: quality,
                    summary: quality,
                    details: quality
                };
        });
        const qualityPrefixes = new Set(qualityDefinitions.map((entry) => `${entry.label}:`.toLowerCase()));
        const notes = (item.notes || "")
            .split(/\n+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .filter((entry) => {
            const normalizedEntry = entry.toLowerCase();
            for (const prefix of qualityPrefixes) {
                if (normalizedEntry.startsWith(prefix)) {
                    return false;
                }
            }
            return true;
        });
        const ammoInfo = getAmmoInfoForWeapon(item, normalizedSheet.inventoryItems);
        if (ammoInfo) {
            notes.unshift(`Municion disponible: ${ammoInfo.quantity} ${ammoInfo.label}`);
        }
        setActiveWeaponQualityInfoId("");
        setActionDetailModal({
            title: item.name || "Objeto sin nombre",
            sourceLabel: item.isCustom ? "Arma personalizada" : "Arma del catalogo",
            detail: item.description.trim() || "Sin descripcion adicional.",
            notes,
            removeInventoryIndex: canEditInventory ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canEditInventory && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            inventoryMeta: {
                kind: "weapon",
                damage: item.damageFormula || undefined,
                protection: item.protectionFormula || undefined,
                primaryLabel: "Danio base",
                value: item.value || undefined,
                notes,
                qualities: qualityDefinitions
            }
        });
    }
    function openInventoryArmorDetail(item) {
        const qualityDefinitions = parseWeaponQualities(item.qualities).map((quality) => {
            const definition = ARMOR_QUALITY_OPTIONS.find((entry) => entry.id === normalizeWeaponQualityKey(quality));
            return definition
                ? {
                    id: definition.id,
                    label: definition.label,
                    summary: definition.summary,
                    details: definition.details ?? definition.summary
                }
                : {
                    id: quality.toLowerCase(),
                    label: quality,
                    summary: quality,
                    details: quality
                };
        });
        const qualityPrefixes = new Set(qualityDefinitions.map((entry) => `${entry.label}:`.toLowerCase()));
        const notes = (item.notes || "")
            .split(/\n+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .filter((entry) => {
            const normalizedEntry = entry.toLowerCase();
            for (const prefix of qualityPrefixes) {
                if (normalizedEntry.startsWith(prefix)) {
                    return false;
                }
            }
            return true;
        });
        if (item.modifiers.length > 0) {
            notes.push(`Modificadores: ${item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")}`);
        }
        setActiveWeaponQualityInfoId("");
        setActionDetailModal({
            title: item.name || "Objeto sin nombre",
            sourceLabel: item.isCustom ? "Armadura personalizada" : "Armadura del catalogo",
            detail: item.description.trim() || "Sin descripcion adicional.",
            notes,
            removeInventoryIndex: canEditInventory ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canEditInventory && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            inventoryMeta: {
                kind: "armor",
                protection: item.protectionFormula || undefined,
                primaryLabel: "Proteccion base",
                value: item.value || undefined,
                notes,
                qualities: qualityDefinitions
            }
        });
    }
    function openManagedInventoryItemDetail(item) {
        const qualityDefinitions = parseWeaponQualities(item.qualities).map((quality) => {
            const definition = ITEM_QUALITY_OPTIONS.find((entry) => entry.id === normalizeWeaponQualityKey(quality));
            return definition
                ? {
                    id: definition.id,
                    label: definition.label,
                    summary: definition.summary,
                    details: definition.details ?? definition.summary
                }
                : {
                    id: quality.toLowerCase(),
                    label: quality,
                    summary: quality,
                    details: quality
                };
        });
        const qualityPrefixes = new Set(qualityDefinitions.map((entry) => `${entry.label}:`.toLowerCase()));
        const notes = (item.notes || "")
            .split(/\n+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .filter((entry) => {
            const normalizedEntry = entry.toLowerCase();
            for (const prefix of qualityPrefixes) {
                if (normalizedEntry.startsWith(prefix)) {
                    return false;
                }
            }
            return true;
        });
        if (item.modifiers.length > 0) {
            notes.push(`Modificadores: ${item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")}`);
        }
        setActiveWeaponQualityInfoId("");
        setActionDetailModal({
            title: item.name || "Objeto sin nombre",
            sourceLabel: item.isCustom ? "Objeto personalizado" : "Objeto del catalogo",
            detail: item.description.trim() || "Sin descripcion adicional.",
            notes,
            removeInventoryIndex: canEditInventory ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canEditInventory && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            inventoryMeta: {
                kind: "item",
                damage: `x${item.quantity}`,
                primaryLabel: "Cantidad",
                value: item.value || undefined,
                notes,
                qualities: qualityDefinitions
            }
        });
    }
    function openCapabilityDetail(tipo, entry) {
        const compendiumEntry = ALL_ENTRIES.find((candidate) => candidate.tipo === tipo &&
            normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(entry.nombre));
        const canonicalEntry = tipo === "poder_mistico"
            ? SYMBAROUM_MYSTIC_POWERS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(entry.nombre))
            : tipo === "ritual"
                ? SYMBAROUM_RITUALS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(entry.nombre))
                : SYMBAROUM_ABILITIES.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(entry.nombre));
        const parsed = parseCapabilityTiers(canonicalEntry?.efectoResumen?.trim() || entry.efecto || entry.notas);
        const normalizedTiers = normalizeCapabilityTiers(parsed.tiers);
        const noteBlocks = [
            shouldKeepCapabilityNote(parsed.remainder ?? "", normalizedTiers, parsed.reference) ? parsed.remainder : null,
            shouldKeepCapabilityNote(entry.notas, normalizedTiers, parsed.reference) ? entry.notas : null
        ].filter((value) => Boolean(value?.trim()));
        const detail = normalizedTiers.length === 0
            ? [parsed.remainder, parsed.reference, entry.notas].filter(Boolean).join("\n\n").trim() || "Sin descripcion adicional."
            : "";
        const sourceLabel = compendiumEntry
            ? formatCapabilitySource({ ...entry, fuente: compendiumEntry.fuente, pagina: compendiumEntry.pagina ?? entry.pagina })
            : formatCapabilitySource(entry);
        const summaryLink = compendiumEntry ? getCompendiumSummaryLink(compendiumEntry) : null;
        const references = [
            compendiumEntry?.fuente
                ? {
                    label: compendiumEntry.pagina ? `${compendiumEntry.fuente} p. ${compendiumEntry.pagina}` : compendiumEntry.fuente,
                    url: getCompendiumSourcePdfUrl(compendiumEntry.fuente, compendiumEntry.pagina, compendiumEntry.nombre) ?? ""
                }
                : entry.fuente
                    ? {
                        label: formatCapabilitySource(entry),
                        url: getCompendiumSourcePdfUrl(entry.fuente, entry.pagina, entry.nombre) ?? ""
                    }
                    : null,
            summaryLink
                ? { label: `${summaryLink.documentLabel} - ${summaryLink.sectionLabel}`, url: summaryLink.url }
                : null
        ].filter((reference) => Boolean(reference?.url));
        setActionDetailModal({
            title: entry.nombre || "Capacidad",
            sourceLabel,
            detail,
            tiers: normalizedTiers,
            notes: noteBlocks,
            references,
            capabilityTipo: tipo,
            capabilityNombre: entry.nombre
        });
    }
    function openSimpleCompendiumDetail(tipo, categoryLabel, entryName) {
        const compendiumEntry = findCompendiumEntryByTypeAndName(tipo, entryName);
        if (!compendiumEntry) {
            setActionDetailModal({
                title: entryName,
                sourceLabel: categoryLabel,
                detail: tipo === "bendicion"
                    ? "Bendicion registrada en la ficha. Cada bendicion cuenta como 5 PX gastados."
                    : "Carga registrada en la ficha. Cada carga aporta 5 PX adicionales al total de experiencia disponible.",
                notes: [
                    tipo === "bendicion"
                        ? "No existe una entrada detallada en el compendio para este nombre exacto."
                        : "No existe una entrada detallada en el compendio para este nombre exacto."
                ]
            });
            return;
        }
        const summaryLink = getCompendiumSummaryLink(compendiumEntry);
        const references = [
            getCompendiumSourcePdfUrl(compendiumEntry.fuente, compendiumEntry.pagina, compendiumEntry.nombre),
            summaryLink?.url
        ]
            .filter((url) => Boolean(url))
            .map((url) => ({
            url,
            label: url === summaryLink?.url ? summaryLink.documentLabel : `${compendiumEntry.fuente}${compendiumEntry.pagina ? ` p. ${compendiumEntry.pagina}` : ""}`
        }));
        setActionDetailModal({
            title: compendiumEntry.nombre,
            sourceLabel: `${categoryLabel}${compendiumEntry.fuente ? ` · ${compendiumEntry.fuente}${compendiumEntry.pagina ? ` p. ${compendiumEntry.pagina}` : ""}` : ""}`,
            detail: compendiumEntry.detalle,
            references
        });
    }
    function queueRoll20Request(requestOrAction, phaseOrTitle, requestTitle, selectedAttackModifierIds = [], selectedDamageModifierIds = []) {
        if ("destination" in requestOrAction) {
            setPendingRollConfirmation({
                request: requestOrAction,
                title: String(phaseOrTitle),
                visibility: "public",
                selectedAttackModifierIds: [],
                selectedDamageModifierIds: [],
                defenseAlternativeIds: [],
                selectedDefenseAlternativeId: ""
            });
            setShowPendingRollBreakdown(false);
            return;
        }
        setPendingRollConfirmation({
            action: requestOrAction,
            phase: phaseOrTitle,
            title: requestTitle ?? "",
            visibility: "public",
            selectedAttackModifierIds,
            selectedDamageModifierIds,
            defenseAlternativeIds: [],
            selectedDefenseAlternativeId: ""
        });
        setShowPendingRollBreakdown(false);
    }
    function buildPendingConfirmationRequest(pending) {
        const selectedDefenseAction = pending.selectedDefenseAlternativeId
            ? defenseAlternativeActions.find((action) => action.id === pending.selectedDefenseAlternativeId)
            : null;
        if (selectedDefenseAction) {
            return buildRollRequest(normalizedSheet, displayName, selectedDefenseAction.id, "attack", rollDestination);
        }
        if (pending.request) {
            return { ...pending.request };
        }
        if (pending.action && pending.phase) {
            return buildRollRequest(normalizedSheet, displayName, pending.action.id, pending.phase, rollDestination, "", pending.selectedDamageModifierIds);
        }
        return null;
    }
    function runAction(action, phase, damageVariantId) {
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, phase, `${action.label} - ${phase === "damage" ? "Danio" : "Tirada"}`);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, phase, damageVariantId ? [damageVariantId] : []);
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runDamageVariantAction(action, damageVariantId, damageLabel) {
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "damage", `${action.label} - ${damageLabel}`, [], [damageVariantId]);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, "damage", [damageVariantId]);
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runAttackAction(action) {
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "attack", `${action.label} · Tirada`);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, "attack");
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runDamageAction(action) {
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "damage", `${action.label} · Danio`);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, "damage");
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runAttributeRoll(attribute) {
        const label = `Prueba de ${ATTRIBUTE_LABELS[attribute]}`;
        if (rollDestination !== "umbra") {
            queueRoll20Request({
                kind: "check",
                phase: "attack",
                characterName: displayName,
                actionId: `attribute:${attribute}`,
                actionLabel: label,
                sourceName: ATTRIBUTE_LABELS[attribute],
                sourceType: "ability",
                formula: "1d20",
                target: normalizedSheet.atributos[attribute],
                rollAttribute: attribute,
                destination: rollDestination
            }, label);
            return;
        }
        const total = Math.floor(Math.random() * 20) + 1;
        pushHistory(label, [{
                kind: "attribute_check",
                label,
                dice: [total],
                formula: "1d20",
                total,
                target: normalizedSheet.atributos[attribute],
                success: total <= normalizedSheet.atributos[attribute]
            }]);
    }
    function runDefenseRoll() {
        const label = "Defensa";
        if (rollDestination !== "umbra") {
            setPendingRollConfirmation({
                request: {
                    kind: "check",
                    phase: "attack",
                    characterName: displayName,
                    actionId: "derived:defense",
                    actionLabel: label,
                    sourceName: label,
                    sourceType: "ability",
                    formula: "1d20",
                    target: derived.defensaTotal,
                    destination: rollDestination
                },
                title: label,
                visibility: "public",
                selectedAttackModifierIds: [],
                selectedDamageModifierIds: [],
                defenseAlternativeIds: defenseAlternativeActions.map((action) => action.id),
                selectedDefenseAlternativeId: ""
            });
            return;
        }
        const total = Math.floor(Math.random() * 20) + 1;
        pushHistory(label, [{
                kind: "attribute_check",
                label,
                dice: [total],
                formula: "1d20",
                total,
                target: derived.defensaTotal,
                success: total <= derived.defensaTotal
            }]);
    }
    function runArmorRoll() {
        const formula = activeArmor?.protectionFormula || derived.armaduraActiva;
        if (!formula)
            return;
        const label = activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Armadura");
        if (rollDestination !== "umbra") {
            const formulaBreakdown = activeArmor?.protectionFormula
                ? [{
                        label: activeArmor?.name || "Armadura",
                        formula
                    }]
                : (derived.armaduraNaturalBreakdown.length > 0
                    ? derived.armaduraNaturalBreakdown
                    : [{
                            label: activeArmor?.name || (derived.armaduraNatural ? "Armadura natural" : "Armadura"),
                            formula
                        }]);
            queueRoll20Request({
                kind: "damage",
                phase: "damage",
                characterName: displayName,
                actionId: `armor:${activeArmor?.id ?? "legacy"}`,
                actionLabel: label,
                sourceName: label,
                sourceType: "ability",
                formula,
                formulaBreakdown,
                destination: rollDestination
            }, `${label} · Proteccion`);
            return;
        }
        const match = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!match)
            return;
        const diceCount = Number(match[1]);
        const diceSides = Number(match[2]);
        const modifier = Number(match[3] ?? "0");
        let total = modifier;
        const dice = [];
        for (let index = 0; index < diceCount; index += 1) {
            const die = Math.floor(Math.random() * diceSides) + 1;
            dice.push(die);
            total += die;
        }
        pushHistory(`${label} · Proteccion`, [{
                kind: "damage",
                label: "Proteccion",
                dice,
                formula,
                total
            }]);
    }
    async function handleConfirmRoll20Send(visibility) {
        if (!pendingRollConfirmation)
            return;
        try {
            const request = buildPendingConfirmationRequest(pendingRollConfirmation);
            if (!request) {
                throw new Error("No se pudo preparar la tirada");
            }
            if (typeof request.target === "number") {
                const selectedAttackModifiers = getCheckRollModifiers(pendingRollConfirmation.action, request, normalizedSheet)
                    .filter((modifier) => pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id));
                const totalAttackBonus = selectedAttackModifiers.reduce((sum, modifier) => sum + modifier.bonus, 0);
                if (totalAttackBonus !== 0) {
                    request.target += totalAttackBonus;
                    const modifierNote = `Modificadores de tirada: ${selectedAttackModifiers.map((modifier) => modifier.label).join(", ")}`;
                    request.note = request.note ? `${request.note} | ${modifierNote}` : modifierNote;
                }
            }
            await dispatchRoll20Request(request, visibility);
        }
        catch (error) {
            void error;
        }
        finally {
            setPendingRollConfirmation(null);
            setShowPendingRollBreakdown(false);
        }
    }
    function updateRatedEntry(section, index, field, value) {
        setDraft({
            ...draft,
            [section]: draft[section].map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry))
        });
    }
    function addRatedEntry(section) {
        setDraft({
            ...draft,
            [section]: [...draft[section], { nombre: "", tipo: "", efecto: "", nivel: "novato", fuente: "", pagina: undefined, notas: "", acciones: [] }]
        });
    }
    function removeRatedEntry(section, index) {
        setDraft({ ...draft, [section]: draft[section].filter((_, entryIndex) => entryIndex !== index) });
    }
    function updateSimpleSheetList(section, rawValue) {
        setDraft({
            ...draft,
            [section]: rawValue
                .split("\n")
                .map((entry) => entry.trim())
                .filter(Boolean)
        });
    }
    function addSimpleSheetEntry(section) {
        setDraft({
            ...draft,
            [section]: [...draft[section], ""]
        });
    }
    function removeSimpleSheetEntry(section, index) {
        setDraft({
            ...draft,
            [section]: draft[section].filter((_, entryIndex) => entryIndex !== index)
        });
    }
    function updateInventoryItem(index, field, value) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
        });
    }
    function addInventoryItem() {
        setDraft({
            ...draft,
            inventoryItems: [...draft.inventoryItems, createCustomInventoryItem()]
        });
    }
    function addCustomWeapon() {
        setWeaponEditorModal({
            mode: "create",
            item: createCustomInventoryItem("weapon")
        });
        setActiveInventoryTab("weapons");
    }
    function addCustomArmor() {
        setArmorEditorModal({
            mode: "create",
            item: createCustomInventoryItem("armor")
        });
        setActiveInventoryTab("armors");
    }
    function addCustomItemModal() {
        setItemEditorModal({
            mode: "create",
            item: createCustomInventoryItem()
        });
        setActiveInventoryTab("items");
    }
    function updateWeaponEditorItem(field, value) {
        setWeaponEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
    }
    function toggleWeaponEditorQuality(qualityLabel) {
        setWeaponEditorModal((current) => {
            if (!current || current.item.category !== "weapon") {
                return current;
            }
            const currentQualities = parseWeaponQualities(current.item.qualities);
            const normalizedTarget = normalizeWeaponQualityKey(qualityLabel);
            const nextQualities = currentQualities.some((quality) => normalizeWeaponQualityKey(quality) === normalizedTarget)
                ? currentQualities.filter((quality) => normalizeWeaponQualityKey(quality) !== normalizedTarget)
                : [...currentQualities, qualityLabel];
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities(nextQualities)
                }
            };
        });
    }
    function updateWeaponEditorCustomQualities(rawValue) {
        setWeaponEditorModal((current) => {
            if (!current || current.item.category !== "weapon") {
                return current;
            }
            const knownQualities = getKnownWeaponQualities(current.item);
            const customQualities = parseWeaponQualities(rawValue);
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities([...knownQualities, ...customQualities])
                }
            };
        });
    }
    function saveWeaponEditorModal() {
        if (!weaponEditorModal)
            return;
        const nextItem = {
            ...weaponEditorModal.item,
            name: weaponEditorModal.item.name.trim() || "Arma personalizada",
            description: weaponEditorModal.item.description.trim(),
            value: weaponEditorModal.item.value.trim(),
            damageFormula: weaponEditorModal.item.damageFormula.trim(),
            notes: weaponEditorModal.item.notes.trim(),
            qualities: formatWeaponQualities(parseWeaponQualities(weaponEditorModal.item.qualities))
        };
        setDraft({
            ...draft,
            inventoryItems: typeof weaponEditorModal.index === "number"
                ? draft.inventoryItems.map((item, index) => (index === weaponEditorModal.index ? nextItem : item))
                : [...draft.inventoryItems, nextItem]
        });
        setWeaponEditorModal(null);
    }
    function updateArmorEditorItem(field, value) {
        setArmorEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
    }
    function toggleArmorEditorQuality(qualityLabel) {
        setArmorEditorModal((current) => {
            if (!current || current.item.category !== "armor") {
                return current;
            }
            const currentQualities = parseWeaponQualities(current.item.qualities);
            const normalizedTarget = normalizeWeaponQualityKey(qualityLabel);
            const nextQualities = currentQualities.some((quality) => normalizeWeaponQualityKey(quality) === normalizedTarget)
                ? currentQualities.filter((quality) => normalizeWeaponQualityKey(quality) !== normalizedTarget)
                : [...currentQualities, qualityLabel];
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities(nextQualities)
                }
            };
        });
    }
    function updateArmorEditorCustomQualities(rawValue) {
        setArmorEditorModal((current) => {
            if (!current || current.item.category !== "armor") {
                return current;
            }
            const knownQualities = getKnownArmorQualities(current.item);
            const customQualities = parseWeaponQualities(rawValue);
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities([...knownQualities, ...customQualities])
                }
            };
        });
    }
    function saveArmorEditorModal() {
        if (!armorEditorModal)
            return;
        const nextItem = {
            ...armorEditorModal.item,
            name: armorEditorModal.item.name.trim() || "Armadura personalizada",
            description: armorEditorModal.item.description.trim(),
            value: armorEditorModal.item.value.trim(),
            protectionFormula: armorEditorModal.item.protectionFormula.trim(),
            notes: armorEditorModal.item.notes.trim(),
            qualities: formatWeaponQualities(parseWeaponQualities(armorEditorModal.item.qualities)),
            slot: armorEditorModal.item.slot === "none" ? "armor" : armorEditorModal.item.slot
        };
        setDraft({
            ...draft,
            inventoryItems: typeof armorEditorModal.index === "number"
                ? draft.inventoryItems.map((item, index) => (index === armorEditorModal.index ? nextItem : item))
                : [...draft.inventoryItems, nextItem]
        });
        setArmorEditorModal(null);
    }
    function updateItemEditorItem(field, value) {
        setItemEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
    }
    function toggleItemEditorQuality(qualityLabel) {
        setItemEditorModal((current) => {
            if (!current) {
                return current;
            }
            const currentQualities = parseWeaponQualities(current.item.qualities);
            const normalizedTarget = normalizeWeaponQualityKey(qualityLabel);
            const nextQualities = currentQualities.some((quality) => normalizeWeaponQualityKey(quality) === normalizedTarget)
                ? currentQualities.filter((quality) => normalizeWeaponQualityKey(quality) !== normalizedTarget)
                : [...currentQualities, qualityLabel];
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities(nextQualities)
                }
            };
        });
    }
    function updateItemEditorCustomQualities(rawValue) {
        setItemEditorModal((current) => {
            if (!current) {
                return current;
            }
            const knownQualities = getKnownItemQualities(current.item);
            const customQualities = parseWeaponQualities(rawValue);
            return {
                ...current,
                item: {
                    ...current.item,
                    qualities: formatWeaponQualities([...knownQualities, ...customQualities])
                }
            };
        });
    }
    function saveItemEditorModal() {
        if (!itemEditorModal)
            return;
        const nextItem = {
            ...itemEditorModal.item,
            name: itemEditorModal.item.name.trim() || "Objeto personalizado",
            description: itemEditorModal.item.description.trim(),
            value: itemEditorModal.item.value.trim(),
            notes: itemEditorModal.item.notes.trim(),
            qualities: formatWeaponQualities(parseWeaponQualities(itemEditorModal.item.qualities))
        };
        setDraft({
            ...draft,
            inventoryItems: typeof itemEditorModal.index === "number"
                ? draft.inventoryItems.map((item, index) => (index === itemEditorModal.index ? nextItem : item))
                : [...draft.inventoryItems, nextItem]
        });
        setItemEditorModal(null);
    }
    function removeInventoryItem(index) {
        const removedId = draft.inventoryItems[index]?.id;
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.filter((_, itemIndex) => itemIndex !== index),
            equipmentSlots: {
                mainHand: draft.equipmentSlots.mainHand === removedId ? "" : draft.equipmentSlots.mainHand,
                offHand: draft.equipmentSlots.offHand === removedId ? "" : draft.equipmentSlots.offHand,
                ranged: draft.equipmentSlots.ranged === removedId ? "" : draft.equipmentSlots.ranged,
                armor: draft.equipmentSlots.armor === removedId ? "" : draft.equipmentSlots.armor,
                artifact: draft.equipmentSlots.artifact === removedId ? "" : draft.equipmentSlots.artifact,
                worn: draft.equipmentSlots.worn === removedId ? "" : draft.equipmentSlots.worn
            }
        });
    }
    function addCatalogInventoryItem() {
        const template = ITEM_CATALOG.find((entry) => entry.templateId === selectedCatalogItemId);
        if (!template)
            return;
        setDraft({
            ...draft,
            inventoryItems: [...draft.inventoryItems, createInventoryItemFromTemplate(template)]
        });
    }
    function openInventoryCatalogModal(tab) {
        const filteredItems = ITEM_CATALOG.filter((item) => {
            if (tab === "weapons")
                return item.category === "weapon";
            if (tab === "armors")
                return item.category === "armor";
            return item.category !== "weapon" && item.category !== "armor";
        });
        setSelectedWeaponCatalogFilter("all");
        setSelectedArmorCatalogFilter("all");
        setSelectedItemCatalogFilter("all");
        setSelectedCatalogItemId(filteredItems[0]?.templateId ?? "");
        setInventoryCatalogModalTab(tab);
    }
    function addSelectedCatalogItemFromModal() {
        addCatalogInventoryItem();
        setInventoryCatalogModalTab(null);
    }
    useEffect(() => {
        if (!filteredModalCatalogItems.some((item) => item.templateId === selectedCatalogItemId)) {
            setSelectedCatalogItemId(filteredModalCatalogItems[0]?.templateId ?? "");
        }
    }, [filteredModalCatalogItems, selectedCatalogItemId]);
    function changeInventoryQuantity(index, delta) {
        const item = draft.inventoryItems[index];
        if (!item)
            return;
        const nextQuantity = Math.max(0, item.quantity + delta);
        if (nextQuantity <= 0) {
            removeInventoryItem(index);
            return;
        }
        updateInventoryItem(index, "quantity", nextQuantity);
    }
    function changeMoneyCounter(currency, delta) {
        const nextCounters = {
            ...moneyCounters,
            [currency]: Math.max(0, moneyCounters[currency] + delta)
        };
        updateField("recursos.dinero", formatMoneyCounters(nextCounters));
    }
    function toggleFavoriteAction(actionId) {
        const currentFavorites = new Set(normalizedSheet.actionFavorites ?? []);
        if (currentFavorites.has(actionId)) {
            currentFavorites.delete(actionId);
        }
        else {
            currentFavorites.add(actionId);
        }
        setDraft({
            ...draft,
            actionFavorites: [...currentFavorites]
        });
    }
    function renderInventoryItemEditor(item, index) {
        const stackable = isStackableInventoryItem(item);
        const isInventoryCombatItem = item.category === "weapon" || item.category === "armor";
        const isManagedInventoryItem = !isInventoryCombatItem;
        const ammoInfo = item.category === "weapon" ? getAmmoInfoForWeapon(item, normalizedSheet.inventoryItems) : null;
        return (_jsxs("article", { className: `campaign-structured-card${(isInventoryCombatItem || isManagedInventoryItem) ? " is-clickable-card" : ""}`, onClick: item.category === "weapon" ? () => openInventoryWeaponDetail(item) : item.category === "armor" ? () => openInventoryArmorDetail(item) : () => openManagedInventoryItemDetail(item), onKeyDown: (isInventoryCombatItem || isManagedInventoryItem) ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (item.category === "weapon") {
                        openInventoryWeaponDetail(item);
                    }
                    else if (item.category === "armor") {
                        openInventoryArmorDetail(item);
                    }
                    else {
                        openManagedInventoryItemDetail(item);
                    }
                }
            } : undefined, role: (isInventoryCombatItem || isManagedInventoryItem) ? "button" : undefined, tabIndex: (isInventoryCombatItem || isManagedInventoryItem) ? 0 : undefined, children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: item.name || "Objeto sin nombre" }), (isInventoryCombatItem || item.qualities) ? (_jsxs("div", { className: "unified-sheet-weapon-list-summary", children: [_jsx("p", { className: "meta-text", children: item.qualities || (item.category === "artifact" ? "Mistico" : item.category === "consumable" ? "Consumible" : item.category === "treasure" ? "Valioso" : "Equipo") }), ammoInfo ? _jsxs("p", { className: "meta-text", children: [ammoInfo.label, ": ", ammoInfo.quantity] }) : null] })) : (_jsxs("p", { className: "meta-text", children: [item.category === "armor" ? "Armadura" : "Objeto", item.equipped ? " · equipado" : "", item.slot !== "none" ? ` · ${slotLabel(item.slot)}` : ""] }))] }), _jsxs("div", { className: `unified-sheet-quantity-controls${(isInventoryCombatItem || isManagedInventoryItem) ? " is-weapon-summary" : ""}`, children: [item.category === "weapon" && item.damageFormula ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.damageFormula }) : null, item.category === "armor" && item.protectionFormula ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.protectionFormula }) : null, isManagedInventoryItem && !stackable && item.value ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.value }) : null, stackable ? _jsxs("span", { className: "info-chip", children: ["x", item.quantity] }) : null, canEditInventory && stackable ? (_jsxs("div", { className: "unified-sheet-stack-controls", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: (event) => {
                                                event.stopPropagation();
                                                changeInventoryQuantity(index, 1);
                                            }, children: "+" }), _jsx("button", { type: "button", className: "subtle-button", onClick: (event) => {
                                                event.stopPropagation();
                                                changeInventoryQuantity(index, -1);
                                            }, children: "-" })] })) : null] })] }), _jsxs("div", { className: "unified-sheet-item-readonly-grid", children: [(item.attackAttribute || item.damageFormula || item.protectionFormula) && !isInventoryCombatItem && !isManagedInventoryItem ? (_jsxs("div", { className: "info-box", children: [item.attackAttribute ? _jsxs("span", { children: ["Ataque: ", ATTRIBUTE_LABELS[item.attackAttribute]] }) : null, item.damageFormula ? _jsxs("span", { children: ["Danio: ", item.damageFormula] }) : null, item.protectionFormula ? _jsxs("span", { children: ["Proteccion: ", item.protectionFormula] }) : null] })) : null, (item.weight || item.value) && !isInventoryCombatItem && !isManagedInventoryItem ? (_jsxs("div", { className: "info-box", children: [item.weight ? _jsxs("span", { children: ["Peso: ", item.weight] }) : null, item.value ? _jsxs("span", { children: ["Valor: ", item.value] }) : null] })) : null, item.qualities && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Cualidades: ", item.qualities] }) }) : null, item.modifiers.length > 0 ? (_jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Modificadores: ", item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")] }) })) : null] }), item.description && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("p", { className: "unified-sheet-rich-text", children: item.description }) : null, item.notes && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("p", { className: "unified-sheet-capability-notes", children: item.notes }) : null] }, item.id));
    }
    function updateInventoryAction(index, actionIndex, field, value) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? {
                    ...item,
                    grantedActions: item.grantedActions.map((action, currentActionIndex) => (currentActionIndex === actionIndex ? { ...action, [field]: value } : action))
                }
                : item))
        });
    }
    function addInventoryAction(index) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? {
                    ...item,
                    grantedActions: [
                        ...item.grantedActions,
                        { id: `item-action-${Date.now()}`, label: "Nueva accion", cost: "combat", effectSummary: "" }
                    ]
                }
                : item))
        });
    }
    function removeInventoryAction(index, actionIndex) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? { ...item, grantedActions: item.grantedActions.filter((_, currentActionIndex) => currentActionIndex !== actionIndex) }
                : item))
        });
    }
    function updateInventoryModifier(index, modifierIndex, field, value) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? {
                    ...item,
                    modifiers: item.modifiers.map((modifier, currentModifierIndex) => (currentModifierIndex === modifierIndex ? { ...modifier, [field]: value } : modifier))
                }
                : item))
        });
    }
    function addInventoryModifier(index) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? {
                    ...item,
                    modifiers: [
                        ...item.modifiers,
                        { id: `item-modifier-${Date.now()}`, label: "Nuevo modificador", modifierType: "custom", value: "", notes: "" }
                    ]
                }
                : item))
        });
    }
    function removeInventoryModifier(index, modifierIndex) {
        setDraft({
            ...draft,
            inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index
                ? { ...item, modifiers: item.modifiers.filter((_, currentModifierIndex) => currentModifierIndex !== modifierIndex) }
                : item))
        });
    }
    function updateCondition(index, field, value) {
        setDraft({ ...draft, conditions: draft.conditions.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) });
    }
    function addCondition() {
        setDraft({ ...draft, conditions: [...draft.conditions, { id: `condition-${Date.now()}`, name: "", category: "custom", active: true, severity: "minor", summary: "", notes: "" }] });
    }
    function removeCondition(index) {
        setDraft({ ...draft, conditions: draft.conditions.filter((_, itemIndex) => itemIndex !== index) });
    }
    function adjustNumber(path, delta, min = 0) {
        const parts = path.split(".");
        let cursor = normalizedSheet;
        for (let index = 0; index < parts.length - 1; index += 1) {
            cursor = cursor[parts[index]];
        }
        const key = parts[parts.length - 1];
        const current = typeof cursor[key] === "number" ? Number(cursor[key]) : 0;
        const nextValue = Math.max(min, current + delta);
        if (path === "combate.robustezActual") {
            updateField(path, Math.min(derived.robustezMaximaTotal, nextValue));
            return;
        }
        updateField(path, nextValue);
    }
    function renderTabStage(className = "unified-sheet-stage campaign-sheet-card") {
        return (_jsxs("section", { className: className, children: [_jsx("nav", { className: "unified-sheet-tabs", children: [
                        ["actions", "Acciones"],
                        ["inventory", "Inventario"],
                        ["abilities", "Capacidades"],
                        ["background", "Trasfondo"],
                        ["notes", "Notas"]
                    ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeTab === tab ? "is-active" : "", onClick: () => setActiveTab(tab), children: label }, tab))) }), _jsxs("div", { className: "unified-sheet-tab-content", children: [activeTab === "actions" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Acciones disponibles" }) }), _jsx("nav", { className: "unified-sheet-subtabs unified-sheet-action-subtabs", "aria-label": "Filtros de acciones", children: [
                                            ["all", "Todas"],
                                            ["favorites", "Favoritas"],
                                            ["attacks", "Ataques"],
                                            ["powers", "Poderes y rituales"],
                                            ["actions", "Acciones"],
                                            ["free", "Acciones gratuitas"],
                                            ["reactions", "Reacciones"],
                                            ["other", "Otras"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeActionTab === tab ? "is-active" : "", onClick: () => setActiveActionTab(tab), children: label }, tab))) }), _jsxs("div", { className: "campaign-sheet-actions", children: [filteredActions.map((action) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row", children: [_jsxs("div", { className: "campaign-action-main", children: [_jsxs("div", { className: "campaign-action-title-row", children: [_jsx("button", { type: "button", className: `campaign-action-favorite-toggle${favoriteActionIds.has(action.id) ? " is-active" : ""}`, onClick: () => toggleFavoriteAction(action.id), "aria-label": favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", title: favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", children: "\u2605" }), _jsx("button", { type: "button", className: "campaign-action-name-button", onClick: () => openActionDetail(action), children: formatActionDisplayLabel(action.label) })] }), _jsx("span", { className: "campaign-action-source-note", children: getActionSourceLabel(action) })] }), _jsx("div", { className: "campaign-action-slot", children: action.rollAttribute ? (_jsx("button", { type: "button", onClick: () => runAttackAction(action), children: getActionRollLabel(action) })) : (_jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" })) }), _jsx("div", { className: "campaign-action-slot is-damage", children: action.damageFormula && !isIntegratedDamageBonusAction(action) ? _jsx("button", { type: "button", onClick: () => runDamageAction(action), children: "Danio" }) : _jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" }) })] }, action.id))), filteredActions.length === 0 ? _jsx("p", { className: "section-help", children: "Sin acciones registradas en esta categoria." }) : null] })] }) })) : null, activeTab === "inventory" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Inventario y equipo" }) }), _jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Secciones del inventario", children: [
                                            ["money", "Dinero"],
                                            ["weapons", "Armas"],
                                            ["armors", "Armaduras"],
                                            ["items", "Objetos"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeInventoryTab === tab ? "is-active" : "", onClick: () => setActiveInventoryTab(tab), children: label }, tab))) }), activeInventoryTab === "money" ? (_jsx("div", { className: "unified-sheet-money-grid", children: [
                                            ["taleros", "Taleros"],
                                            ["chelines", "Chelines"],
                                            ["ortegs", "Ortegs"]
                                        ].map(([key, label]) => (_jsxs("article", { className: "campaign-structured-card unified-sheet-money-card", children: [_jsx("strong", { children: label }), _jsx("div", { className: `unified-sheet-money-coin is-${key}`, "aria-hidden": "true", children: _jsx("span", { children: key === "taleros" ? "T" : key === "chelines" ? "C" : "O" }) }), _jsxs("span", { children: ["x", moneyCounters[key]] }), canEditInventory ? (_jsxs("div", { className: "unified-sheet-stack-controls unified-sheet-money-controls", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => changeMoneyCounter(key, -1), children: "-" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => changeMoneyCounter(key, 1), children: "+" })] })) : null] }, key))) })) : null, activeInventoryTab === "weapons" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armas" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: addCustomWeapon, children: "Arma personalizada" }), _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("weapons"), children: "Agregar arma" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.weapons.length > 0
                                                    ? inventorySections.weapons.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armas registradas." }) })] })) : null, activeInventoryTab === "armors" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armaduras" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: addCustomArmor, children: "Armadura personalizada" }), _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("armors"), children: "Agregar armadura" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.armors.length > 0
                                                    ? inventorySections.armors.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armaduras registradas." }) })] })) : null, activeInventoryTab === "items" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Objetos" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: addCustomItemModal, children: "Objeto personalizado" }), _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("items"), children: "Agregar objeto" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.items.length > 0
                                                    ? inventorySections.items.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin otros objetos registrados." }) })] })) : null] }) })) : null, activeTab === "abilities" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Tipos de capacidades", children: [
                                            ["traits", "Rasgos"],
                                            ["blessings", "Bendiciones"],
                                            ["burdens", "Cargas"],
                                            ["abilities", "Habilidades"],
                                            ["powers", "Poderes"],
                                            ["rituals", "Rituales"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeCapabilityTab === tab ? "is-active" : "", onClick: () => setActiveCapabilityTab(tab), children: label }, tab))) }), activeCapabilityTab === "traits" ? (_jsx(SimpleStringList, { title: "Rasgos", entries: normalizedSheet.rasgos, emptyText: "Sin rasgos registrados." })) : null, activeCapabilityTab === "blessings" ? (_jsx(SimpleStringList, { title: "Bendiciones", entries: normalizedSheet.bendiciones, emptyText: "Sin bendiciones registradas.", onOpenDetail: (entry) => openSimpleCompendiumDetail("bendicion", "Bendicion", entry) })) : null, activeCapabilityTab === "burdens" ? (_jsx(SimpleStringList, { title: "Cargas", entries: normalizedSheet.cargas, emptyText: "Sin cargas registradas.", onOpenDetail: (entry) => openSimpleCompendiumDetail("carga", "Carga", entry) })) : null, activeCapabilityTab === "abilities" ? (_jsx(CapabilityTextList, { title: "Habilidades", entries: normalizedSheet.habilidades, onOpenDetail: (entry) => openCapabilityDetail("habilidad", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined })) : null, activeCapabilityTab === "powers" ? (_jsx(CapabilityTextList, { title: "Poderes misticos", entries: normalizedSheet.poderesMisticos, onOpenDetail: (entry) => openCapabilityDetail("poder_mistico", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined })) : null, activeCapabilityTab === "rituals" ? (_jsx(CapabilityTextList, { title: "Rituales", entries: normalizedSheet.rituales, onOpenDetail: (entry) => openCapabilityDetail("ritual", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined })) : null] }) })) : null, activeTab === "background" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Sombra", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.sombra, onChange: (event) => updateField("identidad.sombra", event.target.value) }) }), _jsx(Field, { label: "Cita", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.cita, onChange: (event) => updateField("identidad.cita", event.target.value) }) }), _jsx(Field, { label: "Edad", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.edad, onChange: (event) => updateField("identidad.edad", event.target.value) }) }), _jsx(Field, { label: "Altura", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.altura, onChange: (event) => updateField("identidad.altura", event.target.value) }) }), _jsx(Field, { label: "Peso", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.peso, onChange: (event) => updateField("identidad.peso", event.target.value) }) })] }), _jsx(Field, { label: "Apariencia", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.identidad.apariencia, onChange: (event) => updateField("identidad.apariencia", event.target.value) }) }), _jsx(Field, { label: "Objetivo personal", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.identidad.objetivoPersonal, onChange: (event) => updateField("identidad.objetivoPersonal", event.target.value) }) }), _jsx(Field, { label: "Historia", children: _jsx("textarea", { disabled: true, rows: 8, value: normalizedSheet.noteSections.background, onChange: (event) => updateField("noteSections.background", event.target.value) }) })] }) })) : null, activeTab === "notes" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Notas y contexto" }), _jsx(Field, { label: "Notas generales", children: _jsx("textarea", { disabled: !canEditNotes, rows: 6, value: normalizedSheet.noteSections.general, onChange: (event) => updateField("noteSections.general", event.target.value) }) }), _jsx(Field, { label: "Notas de campana", children: _jsx("textarea", { disabled: !canEditNotes, rows: 4, value: normalizedSheet.noteSections.campaign, onChange: (event) => updateField("noteSections.campaign", event.target.value) }) }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Grupo", children: _jsx("input", { disabled: true, value: normalizedSheet.grupo.nombre, onChange: (event) => updateField("grupo.nombre", event.target.value) }) }), _jsx(Field, { label: "Objetivo del grupo", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.grupo.objetivo, onChange: (event) => updateField("grupo.objetivo", event.target.value) }) })] })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contactos" }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.contactosHoja.map((contacto, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: true, value: contacto.nombre, onChange: (event) => updateField(`contactosHoja.${index}.nombre`, event.target.value) }) }), _jsx(Field, { label: "Raza", children: _jsx("input", { disabled: true, value: contacto.raza, onChange: (event) => updateField(`contactosHoja.${index}.raza`, event.target.value) }) }), _jsx(Field, { label: "Ocupacion", children: _jsx("input", { disabled: true, value: contacto.ocupacion, onChange: (event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value) }) }), _jsx(Field, { label: "Jugador", children: _jsx("input", { disabled: true, value: contacto.jugador, onChange: (event) => updateField(`contactosHoja.${index}.jugador`, event.target.value) }) })] }) }, `contacto-${index}`))) })] })] })) : null] })] }));
    }
    return (_jsxs("div", { className: `unified-sheet is-tab-${activeTab}`, children: [_jsxs("section", { className: "unified-sheet-persistent campaign-sheet-card", children: [_jsxs("div", { className: "unified-sheet-header-band", children: [_jsxs("div", { className: "unified-sheet-hero-main", children: [_jsxs("div", { className: "unified-sheet-portrait", children: [_jsx("div", { className: "unified-sheet-portrait-ring" }), _jsx("div", { className: "unified-sheet-portrait-content", children: _jsx("span", { children: String(normalizedSheet.identidad.arquetipo).slice(0, 1) }) })] }), _jsxs("div", { className: "unified-sheet-identity", children: [_jsx("h2", { className: "unified-sheet-title", children: displayName }), subtitle ? _jsx("span", { className: "unified-sheet-inline-subtitle", children: subtitle }) : null] }), onOpenBuilder ? (_jsxs("button", { type: "button", className: "unified-sheet-builder-launch", onClick: onOpenBuilder, children: [_jsx("span", { "aria-hidden": "true", children: "\u2692" }), _jsx("span", { children: "Constructor" })] })) : null, _jsxs("div", { className: "unified-sheet-xp-card", children: [_jsxs("div", { className: "unified-sheet-xp-row", children: [_jsx("span", { children: "PX total" }), _jsxs("div", { className: "unified-sheet-xp-controls", children: [_jsx("button", { type: "button", className: "vital-action subtle", onClick: () => adjustNumber("progreso.experienciaTotal", -1), children: "-" }), _jsx("strong", { children: normalizedSheet.progreso.experienciaTotal }), _jsx("button", { type: "button", className: "vital-action gain", onClick: () => adjustNumber("progreso.experienciaTotal", 1), children: "+" })] })] }), _jsxs("div", { className: "unified-sheet-xp-row is-static", children: [_jsx("span", { children: "PX gastada" }), _jsx("strong", { children: displayedSpentExperience })] })] })] }), _jsxs("section", { className: "unified-sheet-header-stats", children: [_jsxs("div", { className: "unified-sheet-vital-card is-health", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Robustez" }), _jsxs("strong", { children: [derived.robustezActualTotal, " / ", derived.robustezMaximaTotal] })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action loss", onClick: () => adjustNumber("combate.robustezActual", -1), children: "-1 Danio" }), _jsx("button", { type: "button", className: "vital-action gain", onClick: () => adjustNumber("combate.robustezActual", 1), children: "+1 Vida" })] })] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion temporal" }), _jsx("strong", { children: normalizedSheet.corrupcion.temporal })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action recovery", onClick: () => adjustNumber("corrupcion.temporal", -1), children: "-1 Temp" }), _jsx("button", { type: "button", className: "vital-action corruption", onClick: () => adjustNumber("corrupcion.temporal", 1), children: "+1 Temp" })] })] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption-deep", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion permanente" }), _jsx("strong", { children: normalizedSheet.corrupcion.permanente })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action recovery", onClick: () => adjustNumber("corrupcion.permanente", -1), children: "-1 Perm" }), _jsx("button", { type: "button", className: "vital-action corruption-deep", onClick: () => adjustNumber("corrupcion.permanente", 1), children: "+1 Perm" })] })] })] })] }), _jsxs("div", { className: "unified-sheet-body-grid", children: [renderTabStage("unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card"), _jsxs("section", { className: "unified-sheet-static-column", children: [_jsx("div", { className: "unified-sheet-attribute-rail", children: ATTRIBUTE_KEYS.map((key) => (_jsxs("div", { className: "unified-sheet-attribute-chip", children: [_jsx("span", { children: ATTRIBUTE_LABELS[key] }), _jsx("strong", { children: normalizedSheet.atributos[key] }), _jsx("button", { type: "button", className: "vital-action subtle", onClick: () => runAttributeRoll(key), children: "Tirar" })] }, key))) }), _jsxs("div", { className: "unified-sheet-static-summary", children: [_jsxs("div", { className: "unified-sheet-quick-row is-primary", children: [_jsxs("article", { className: "unified-sheet-quick-card is-defense-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Defensa" }), _jsx("strong", { children: derived.defensaTotal })] }), _jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle is-defense-roll", onClick: runDefenseRoll, children: "Tirar Defensa" }) })] }), _jsxs("article", { className: "unified-sheet-quick-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armadura" }), _jsx("strong", { children: activeArmor?.protectionFormula || derived.armaduraActiva || "-" })] }), _jsx("strong", { children: activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Sin armadura") }), _jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle", onClick: runArmorRoll, disabled: !(activeArmor?.protectionFormula || derived.armaduraActiva), children: "Tirar Armadura" }) })] })] }), _jsxs("div", { className: "unified-sheet-quick-row is-derived", children: [_jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Iniciativa" }), _jsx("strong", { children: derived.iniciativaTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de corrupcion" }), _jsx("strong", { children: derived.umbralCorrupcionTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de dolor" }), _jsx("strong", { children: derived.umbralDolorTotal })] })] }), _jsx("div", { className: "unified-sheet-quick-row is-conditions", children: _jsxs("article", { className: "unified-sheet-quick-card is-wide", children: [_jsx("h3", { children: "Condiciones" }), _jsx("div", { className: "unified-sheet-quick-tags", children: normalizedSheet.conditions.length > 0 ? normalizedSheet.conditions.slice(0, 4).map((condition) => (_jsx("span", { className: `unified-sheet-tag is-${condition.category}`, children: condition.name || "Condicion" }, condition.id))) : _jsx("span", { className: "unified-sheet-tag", children: "Sin condiciones" }) })] }) })] })] })] })] }), activeTab === "actions" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Acciones disponibles" }) }), _jsx("nav", { className: "unified-sheet-subtabs unified-sheet-action-subtabs", "aria-label": "Filtros de acciones", children: [
                                ["all", "Todas"],
                                ["favorites", "Favoritas"],
                                ["attacks", "Ataques"],
                                ["powers", "Poderes y rituales"],
                                ["actions", "Acciones"],
                                ["free", "Acciones gratuitas"],
                                ["reactions", "Reacciones"],
                                ["other", "Otras"]
                            ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeActionTab === tab ? "is-active" : "", onClick: () => setActiveActionTab(tab), children: label }, tab))) }), _jsxs("div", { className: "campaign-sheet-actions", children: [filteredActions.map((action) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row", children: [_jsxs("div", { className: "campaign-action-title-row", children: [_jsx("button", { type: "button", className: `campaign-action-favorite-toggle${favoriteActionIds.has(action.id) ? " is-active" : ""}`, onClick: () => toggleFavoriteAction(action.id), "aria-label": favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", title: favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", children: "\u2605" }), _jsx("strong", { children: formatActionDisplayLabel(action.label) })] }), _jsx("div", { className: "campaign-action-slot", children: action.rollAttribute ? (_jsx("button", { type: "button", onClick: () => runAttackAction(action), children: getActionRollLabel(action) })) : (_jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" })) }), _jsx("div", { className: "campaign-action-slot is-damage", children: action.damageFormula && !isIntegratedDamageBonusAction(action) ? _jsx("button", { type: "button", onClick: () => runDamageAction(action), children: "Danio" }) : _jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" }) }), _jsx("div", { className: "campaign-action-slot", children: _jsx("button", { type: "button", className: "subtle-button", onClick: () => openActionDetail(action), children: "Detalle" }) })] }, action.id))), filteredActions.length === 0 ? _jsx("p", { className: "section-help", children: "Sin acciones registradas en esta categoria." }) : null] })] }) })) : null, activeTab === "inventory" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Inventario y equipo" }), editMode ? (_jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: addCustomWeapon, children: "Arma personalizada" }), _jsx("button", { type: "button", onClick: addInventoryItem, children: "Agregar objeto" })] })) : null] }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Dinero", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.recursos.dinero, onChange: (event) => updateField("recursos.dinero", event.target.value) }) }), _jsx(Field, { label: "Otros recursos", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.recursos.otros, onChange: (event) => updateField("recursos.otros", event.target.value) }) })] }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.inventoryItems.map((item, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editMode, value: item.name, onChange: (event) => updateInventoryItem(index, "name", event.target.value) }) }), _jsx(Field, { label: "Categoria", children: _jsxs("select", { disabled: !editMode, value: item.category, onChange: (event) => updateInventoryItem(index, "category", event.target.value), children: [_jsx("option", { value: "weapon", children: "Arma" }), _jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "gear", children: "Equipo" }), _jsx("option", { value: "consumable", children: "Consumible" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "treasure", children: "Tesoro" }), _jsx("option", { value: "other", children: "Otro" })] }) }), _jsx(Field, { label: "Cantidad", children: isStackableInventoryItem(item) ? (_jsxs("div", { className: "unified-sheet-inline-quantity-editor", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: !editMode, onClick: () => changeInventoryQuantity(index, -1), children: "-" }), _jsx("input", { disabled: !editMode, type: "number", min: 0, value: item.quantity, onChange: (event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0)) }), _jsx("button", { type: "button", className: "subtle-button", disabled: !editMode, onClick: () => changeInventoryQuantity(index, 1), children: "+" })] })) : (_jsx("input", { disabled: !editMode, type: "number", min: 0, value: item.quantity, onChange: (event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0)) })) }), _jsx(Field, { label: "Equipada", children: _jsxs("select", { disabled: !editMode, value: item.equipped ? "si" : "no", onChange: (event) => updateInventoryItem(index, "equipped", event.target.value === "si"), children: [_jsx("option", { value: "si", children: "Si" }), _jsx("option", { value: "no", children: "No" })] }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { disabled: !editMode, value: item.slot, onChange: (event) => updateInventoryItem(index, "slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "mainHand", children: "Mano principal" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "ranged", children: "A distancia" }), _jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "worn", children: "Vestido" })] }) }), _jsx(Field, { label: "Danio / proteccion", children: _jsx("input", { disabled: !editMode, value: item.category === "armor" ? item.protectionFormula : item.damageFormula, onChange: (event) => updateInventoryItem(index, item.category === "armor" ? "protectionFormula" : "damageFormula", event.target.value) }) }), item.category === "weapon" ? (_jsx(Field, { label: "Cualidades", children: _jsx("input", { disabled: !editMode, value: item.qualities, onChange: (event) => updateInventoryItem(index, "qualities", event.target.value) }) })) : null] }), _jsx("textarea", { disabled: !editMode, rows: 2, value: item.description, onChange: (event) => updateInventoryItem(index, "description", event.target.value) }), editMode ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => removeInventoryItem(index), children: "Quitar" }) : null] }, item.id))) })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Ranuras equipadas" }), _jsx("div", { className: "form-grid", children: ["mainHand", "offHand", "ranged", "armor", "artifact", "worn"].map((slot) => (_jsx(Field, { label: slotLabel(slot), children: _jsxs("select", { disabled: !editMode, value: normalizedSheet.equipmentSlots[slot], onChange: (event) => updateField(`equipmentSlots.${slot}`, event.target.value), children: [_jsx("option", { value: "", children: "Sin asignar" }), normalizedSheet.inventoryItems.map((item) => (_jsx("option", { value: item.id, children: item.name || item.id }, `${slot}-${item.id}`)))] }) }, slot))) })] })] })) : null, activeTab === "abilities" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Tipos de capacidades", children: [
                                    ["traits", "Rasgos"],
                                    ["blessings", "Bendiciones"],
                                    ["burdens", "Cargas"],
                                    ["abilities", "Habilidades"],
                                    ["powers", "Poderes"],
                                    ["rituals", "Rituales"]
                                ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeCapabilityTab === tab ? "is-active" : "", onClick: () => setActiveCapabilityTab(tab), children: label }, tab))) }), activeCapabilityTab === "traits" ? (_jsx(SimpleStringListEditor, { title: "Rasgos", entries: normalizedSheet.rasgos, editable: editMode, rows: 6, helpText: "Rasgos de personaje como Contactos se guardan aqui y se exportan/importan como tipo Rasgo.", onChange: (value) => updateSimpleSheetList("rasgos", value), onAdd: () => addSimpleSheetEntry("rasgos"), onRemove: (index) => removeSimpleSheetEntry("rasgos", index) })) : null, activeCapabilityTab === "blessings" ? (_jsx(SimpleStringListEditor, { title: "Bendiciones", entries: normalizedSheet.bendiciones, editable: editMode, rows: 6, helpText: "Cada bendicion cuenta como 5 PX gastados.", onChange: (value) => updateSimpleSheetList("bendiciones", value), onAdd: () => addSimpleSheetEntry("bendiciones"), onRemove: (index) => removeSimpleSheetEntry("bendiciones", index) })) : null, activeCapabilityTab === "burdens" ? (_jsx(SimpleStringListEditor, { title: "Cargas", entries: normalizedSheet.cargas, editable: editMode, rows: 6, helpText: "Cada carga aporta 5 PX extra disponibles.", onChange: (value) => updateSimpleSheetList("cargas", value), onAdd: () => addSimpleSheetEntry("cargas"), onRemove: (index) => removeSimpleSheetEntry("cargas", index) })) : null] }), activeCapabilityTab === "abilities" ? (_jsx(CapabilityEditor, { title: "Habilidades", entries: normalizedSheet.habilidades, editable: editMode, onAdd: () => addRatedEntry("habilidades"), onRemove: (index) => removeRatedEntry("habilidades", index), onUpdate: (index, field, value) => updateRatedEntry("habilidades", index, field, value), onOpenDetail: (entry) => openCapabilityDetail("habilidad", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined })) : null, activeCapabilityTab === "powers" ? (_jsx(CapabilityEditor, { title: "Poderes misticos", entries: normalizedSheet.poderesMisticos, editable: editMode, onAdd: () => addRatedEntry("poderesMisticos"), onRemove: (index) => removeRatedEntry("poderesMisticos", index), onUpdate: (index, field, value) => updateRatedEntry("poderesMisticos", index, field, value), onOpenDetail: (entry) => openCapabilityDetail("poder_mistico", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined })) : null, activeCapabilityTab === "rituals" ? (_jsx(CapabilityEditor, { title: "Rituales", entries: normalizedSheet.rituales, editable: editMode, onAdd: () => addRatedEntry("rituales"), onRemove: (index) => removeRatedEntry("rituales", index), onUpdate: (index, field, value) => updateRatedEntry("rituales", index, field, value), onOpenDetail: (entry) => openCapabilityDetail("ritual", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined })) : null] })) : null, activeTab === "background" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Sombra", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.sombra, onChange: (event) => updateField("identidad.sombra", event.target.value) }) }), _jsx(Field, { label: "Cita", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.cita, onChange: (event) => updateField("identidad.cita", event.target.value) }) }), _jsx(Field, { label: "Edad", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.edad, onChange: (event) => updateField("identidad.edad", event.target.value) }) }), _jsx(Field, { label: "Altura", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.altura, onChange: (event) => updateField("identidad.altura", event.target.value) }) }), _jsx(Field, { label: "Peso", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.peso, onChange: (event) => updateField("identidad.peso", event.target.value) }) })] }), _jsx(Field, { label: "Apariencia", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.identidad.apariencia, onChange: (event) => updateField("identidad.apariencia", event.target.value) }) }), _jsx(Field, { label: "Objetivo personal", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.identidad.objetivoPersonal, onChange: (event) => updateField("identidad.objetivoPersonal", event.target.value) }) }), _jsx(Field, { label: "Historia", children: _jsx("textarea", { disabled: !editMode, rows: 8, value: normalizedSheet.noteSections.background, onChange: (event) => updateField("noteSections.background", event.target.value) }) })] }) })) : null, activeTab === "notes" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Notas y contexto" }), _jsx(Field, { label: "Notas generales", children: _jsx("textarea", { disabled: !editMode, rows: 6, value: normalizedSheet.noteSections.general, onChange: (event) => updateField("noteSections.general", event.target.value) }) }), _jsx(Field, { label: "Notas de campana", children: _jsx("textarea", { disabled: !editMode, rows: 4, value: normalizedSheet.noteSections.campaign, onChange: (event) => updateField("noteSections.campaign", event.target.value) }) }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Grupo", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.grupo.nombre, onChange: (event) => updateField("grupo.nombre", event.target.value) }) }), _jsx(Field, { label: "Objetivo del grupo", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.grupo.objetivo, onChange: (event) => updateField("grupo.objetivo", event.target.value) }) })] })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contactos" }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.contactosHoja.map((contacto, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editMode, value: contacto.nombre, onChange: (event) => updateField(`contactosHoja.${index}.nombre`, event.target.value) }) }), _jsx(Field, { label: "Raza", children: _jsx("input", { disabled: !editMode, value: contacto.raza, onChange: (event) => updateField(`contactosHoja.${index}.raza`, event.target.value) }) }), _jsx(Field, { label: "Ocupacion", children: _jsx("input", { disabled: !editMode, value: contacto.ocupacion, onChange: (event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value) }) }), _jsx(Field, { label: "Jugador", children: _jsx("input", { disabled: !editMode, value: contacto.jugador, onChange: (event) => updateField(`contactosHoja.${index}.jugador`, event.target.value) }) })] }) }, `contacto-${index}`))) })] })] })) : null, pendingRollConfirmation ? (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", children: [_jsx("h3", { children: "Enviar tirada" }), _jsx("p", { className: "section-help", children: pendingRollConfirmation.title }), pendingAttackModifiers.length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de tirada" }), pendingAttackModifiers.map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
                                                ...current,
                                                selectedAttackModifierIds: event.target.checked
                                                    ? [...current.selectedAttackModifierIds, modifier.id]
                                                    : current.selectedAttackModifierIds.filter((entry) => entry !== modifier.id)
                                            } : current) }), _jsx("span", { children: modifier.label })] }, `${pendingRollConfirmation.action?.id}-${modifier.id}`))), _jsxs("p", { className: "section-help", children: ["Objetivo final: ", getPendingAttackTarget(buildPendingConfirmationRequest(pendingRollConfirmation), pendingRollConfirmation.selectedAttackModifierIds, pendingAttackModifiers) ?? "-"] })] })) : null, pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage" && getActionDamageVariants(pendingRollConfirmation.action).length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de dano" }), getActionDamageVariants(pendingRollConfirmation.action).map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedDamageModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
                                                ...current,
                                                selectedDamageModifierIds: event.target.checked
                                                    ? [...current.selectedDamageModifierIds, modifier.id]
                                                    : current.selectedDamageModifierIds.filter((entry) => entry !== modifier.id)
                                            } : current) }), _jsxs("span", { children: [modifier.label, " (", modifier.formula, ")"] })] }, `${pendingRollConfirmation.action?.id}-${modifier.id}`)))] })) : null, (() => {
                            const formulaBreakdown = pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage"
                                ? getDamageRollBreakdown(pendingRollConfirmation.action, pendingRollConfirmation.selectedDamageModifierIds)
                                : (pendingRollConfirmation.request?.phase === "damage" ? getRollRequestBreakdown(pendingRollConfirmation.request) : []);
                            const finalFormula = pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage"
                                ? buildRollRequest(normalizedSheet, displayName, pendingRollConfirmation.action.id, "damage", rollDestination, "", pendingRollConfirmation.selectedDamageModifierIds).formula
                                : (pendingRollConfirmation.request?.phase === "damage" ? pendingRollConfirmation.request.formula : "");
                            if (!finalFormula) {
                                return null;
                            }
                            return (_jsxs("div", { className: "character-roll-confirm-formula-block", children: [_jsxs("div", { className: "character-roll-confirm-formula-row", children: [_jsxs("p", { className: "section-help", children: ["Formula final: ", finalFormula] }), formulaBreakdown.length > 0 ? (_jsx("button", { type: "button", className: "character-roll-info-button", onClick: () => setShowPendingRollBreakdown((current) => !current), "aria-expanded": showPendingRollBreakdown, "aria-label": "Mostrar origen de los dados", children: "i" })) : null] }), showPendingRollBreakdown && formulaBreakdown.length > 0 ? (_jsx("div", { className: "character-roll-breakdown-list", children: formulaBreakdown.map((entry, index) => (_jsxs("div", { className: "character-roll-breakdown-item", children: [_jsx("strong", { children: entry.label }), entry.formula ? _jsx("span", { children: entry.formula }) : null, entry.detail ? _jsx("span", { children: entry.detail }) : null] }, `${entry.label}-${entry.formula ?? entry.detail ?? index}`))) })) : null] }));
                        })(), (pendingRollConfirmation.defenseAlternativeIds?.length ?? 0) > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Defensa" }), _jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "radio", name: "defense-alternative", checked: !pendingRollConfirmation.selectedDefenseAlternativeId, onChange: () => setPendingRollConfirmation((current) => current ? { ...current, selectedDefenseAlternativeId: "" } : current) }), _jsxs("span", { children: ["Defensa base (", derived.defensaTotal, ")"] })] }), pendingRollConfirmation.defenseAlternativeIds?.map((actionId) => {
                                    const action = defenseAlternativeActions.find((entry) => entry.id === actionId);
                                    if (!action)
                                        return null;
                                    const label = formatActionDisplayLabel(action.label);
                                    return (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "radio", name: "defense-alternative", checked: pendingRollConfirmation.selectedDefenseAlternativeId === action.id, onChange: () => setPendingRollConfirmation((current) => current ? { ...current, selectedDefenseAlternativeId: action.id } : current) }), _jsx("span", { children: label })] }, action.id));
                                })] })) : null, _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsxs("div", { className: "character-roll-confirm-primary", children: [_jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("public"), children: "Publico" }), _jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("gm"), children: "Solo DJ" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPendingRollConfirmation(null), children: "Cancelar" })] })] }) })) : null, actionDetailModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setActionDetailModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: actionDetailModal.title }), _jsx("p", { className: "section-help", children: actionDetailModal.sourceLabel }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [actionDetailModal.inventoryMeta ? (_jsxs("div", { className: "unified-sheet-weapon-detail-layout", children: [_jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [actionDetailModal.inventoryMeta.damage || actionDetailModal.inventoryMeta.protection ? (_jsx("strong", { children: actionDetailModal.inventoryMeta.damage || actionDetailModal.inventoryMeta.protection })) : null, _jsx("span", { children: actionDetailModal.inventoryMeta.primaryLabel || "Valor base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: actionDetailModal.inventoryMeta.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: actionDetailModal.inventoryMeta.value })] })) : null })] }), _jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { className: "unified-sheet-rich-text", children: actionDetailModal.detail }) }), actionDetailModal.inventoryMeta.qualities && actionDetailModal.inventoryMeta.qualities.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-weapon-quality-list", children: actionDetailModal.inventoryMeta.qualities.map((quality) => (_jsxs("div", { className: "unified-sheet-weapon-quality-row", children: [_jsx("span", { children: quality.label }), _jsx("button", { type: "button", className: `unified-sheet-weapon-quality-info${activeWeaponQualityInfoId === quality.id ? " is-active" : ""}`, "aria-label": `Ver detalle de ${quality.label}`, onClick: () => setActiveWeaponQualityInfoId((current) => current === quality.id ? "" : quality.id), children: "i" })] }, `${actionDetailModal.title}-${quality.id}`))) }), activeWeaponQualityInfoId ? ((() => {
                                                    const selectedQuality = actionDetailModal.inventoryMeta?.qualities?.find((quality) => quality.id === activeWeaponQualityInfoId);
                                                    return selectedQuality ? (_jsxs("div", { className: "unified-sheet-weapon-quality-panel", children: [_jsx("strong", { children: selectedQuality.label }), _jsx("p", { children: selectedQuality.details })] })) : null;
                                                })()) : null] })) : null, actionDetailModal.inventoryMeta.notes && actionDetailModal.inventoryMeta.notes.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-notes", children: [_jsx("h4", { children: "Notas" }), actionDetailModal.inventoryMeta.notes.map((note, index) => (_jsx("p", { className: "unified-sheet-capability-notes", children: note }, `${actionDetailModal.title}-inventory-note-${index}`)))] })) : null] })) : actionDetailModal.tiers && actionDetailModal.tiers.length > 0 ? (_jsx("div", { className: "unified-sheet-capability-tier-list", children: actionDetailModal.tiers.map((tier) => (_jsxs("section", { className: "unified-sheet-capability-tier", children: [_jsx("h4", { children: tier.label }), _jsx("p", { className: "unified-sheet-rich-text", children: tier.content })] }, `${actionDetailModal.title}-${tier.label}`))) })) : (_jsx("p", { className: "unified-sheet-rich-text", children: actionDetailModal.detail })), !actionDetailModal.inventoryMeta && actionDetailModal.notes?.map((note, index) => (_jsx("p", { className: "unified-sheet-capability-notes", children: note }, `${actionDetailModal.title}-note-${index}`))), actionDetailModal.references && actionDetailModal.references.length > 0 ? (_jsx("div", { className: "unified-sheet-capability-meta", children: actionDetailModal.references.map((reference) => (_jsx("a", { href: reference.url, target: "_blank", rel: "noreferrer", children: reference.label }, reference.url))) })) : null] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [typeof actionDetailModal.editInventoryIndex === "number" ? (_jsx("button", { type: "button", className: "accent-button", onClick: () => {
                                        const item = normalizedSheet.inventoryItems[actionDetailModal.editInventoryIndex];
                                        if (!item)
                                            return;
                                        if (item.category === "weapon") {
                                            setWeaponEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex
                                            });
                                        }
                                        else if (item.category === "armor") {
                                            setArmorEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex
                                            });
                                        }
                                        else {
                                            setItemEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex
                                            });
                                        }
                                        setActionDetailModal(null);
                                    }, children: "Editar" })) : null, typeof actionDetailModal.removeInventoryIndex === "number" ? (_jsx("button", { type: "button", className: "destructive-button", onClick: () => {
                                        removeInventoryItem(actionDetailModal.removeInventoryIndex);
                                        setActionDetailModal(null);
                                    }, children: "Quitar" })) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => setActionDetailModal(null), children: "Cerrar" })] })] }) })) : null, weaponEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setWeaponEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: weaponEditorModal.mode === "create" ? "Arma personalizada" : "Editar arma personalizada" }), _jsx("p", { className: "section-help", children: "Configura el arma y guardala para que aparezca en el inventario como cualquier otra arma." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: weaponEditorModal.item.name, onChange: (event) => updateWeaponEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Danio", children: _jsx("input", { value: weaponEditorModal.item.damageFormula, onChange: (event) => updateWeaponEditorItem("damageFormula", event.target.value) }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: weaponEditorModal.item.slot, onChange: (event) => updateWeaponEditorItem("slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "mainHand", children: "Mano principal" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "ranged", children: "A distancia" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 0, value: weaponEditorModal.item.quantity, onChange: (event) => updateWeaponEditorItem("quantity", Number(event.target.value || 0)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { value: weaponEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateWeaponEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: weaponEditorModal.item.value, onChange: (event) => updateWeaponEditorItem("value", event.target.value) }) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: WEAPON_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownWeaponQualities(weaponEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleWeaponEditorQuality(quality.label), children: quality.label }, `${weaponEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomWeaponQualities(weaponEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateWeaponEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: weaponEditorModal.item.description, placeholder: "Descripcion del arma", onChange: (event) => updateWeaponEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: weaponEditorModal.item.notes, placeholder: "Notas de uso, mantenimiento o procedencia", onChange: (event) => updateWeaponEditorItem("notes", event.target.value) }) })] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setWeaponEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveWeaponEditorModal, children: "Guardar" })] })] }) })) : null, armorEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setArmorEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: armorEditorModal.mode === "create" ? "Armadura personalizada" : "Editar armadura personalizada" }), _jsx("p", { className: "section-help", children: "Configura la armadura y guardala para que aparezca en el inventario como cualquier otra armadura." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: armorEditorModal.item.name, onChange: (event) => updateArmorEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Proteccion", children: _jsx("input", { value: armorEditorModal.item.protectionFormula, onChange: (event) => updateArmorEditorItem("protectionFormula", event.target.value) }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: armorEditorModal.item.slot, onChange: (event) => updateArmorEditorItem("slot", event.target.value), children: [_jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "worn", children: "Llevada" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 0, value: armorEditorModal.item.quantity, onChange: (event) => updateArmorEditorItem("quantity", Number(event.target.value || 0)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { value: armorEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateArmorEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: armorEditorModal.item.value, onChange: (event) => updateArmorEditorItem("value", event.target.value) }) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: ARMOR_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownArmorQualities(armorEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleArmorEditorQuality(quality.label), children: quality.label }, `${armorEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomArmorQualities(armorEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateArmorEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: armorEditorModal.item.description, placeholder: "Descripcion de la armadura", onChange: (event) => updateArmorEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: armorEditorModal.item.notes, placeholder: "Notas de uso, mantenimiento o procedencia", onChange: (event) => updateArmorEditorItem("notes", event.target.value) }) })] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setArmorEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveArmorEditorModal, children: "Guardar" })] })] }) })) : null, itemEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setItemEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: itemEditorModal.mode === "create" ? "Objeto personalizado" : "Editar objeto personalizado" }), _jsx("p", { className: "section-help", children: "Configura el objeto para que aparezca en el inventario con el mismo flujo de detalle que el catalogo." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: itemEditorModal.item.name, onChange: (event) => updateItemEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Categoria", children: _jsxs("select", { value: itemEditorModal.item.category, onChange: (event) => updateItemEditorItem("category", event.target.value), children: [_jsx("option", { value: "gear", children: "Equipo" }), _jsx("option", { value: "consumable", children: "Consumible" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "treasure", children: "Tesoro" }), _jsx("option", { value: "other", children: "Otro" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 0, value: itemEditorModal.item.quantity, onChange: (event) => updateItemEditorItem("quantity", Number(event.target.value || 0)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { value: itemEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateItemEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: itemEditorModal.item.slot, onChange: (event) => updateItemEditorItem("slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "worn", children: "Vestido" }), _jsx("option", { value: "artifact", children: "Artefacto" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: itemEditorModal.item.value, onChange: (event) => updateItemEditorItem("value", event.target.value) }) })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: ITEM_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownItemQualities(itemEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleItemEditorQuality(quality.label), children: quality.label }, `${itemEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomItemQualities(itemEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateItemEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: itemEditorModal.item.description, placeholder: "Descripcion del objeto", onChange: (event) => updateItemEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: itemEditorModal.item.notes, placeholder: "Notas de uso, procedencia o comercio", onChange: (event) => updateItemEditorItem("notes", event.target.value) }) })] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setItemEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveItemEditorModal, children: "Guardar" })] })] }) })) : null, inventoryCatalogModalTab ? (_jsx("div", { className: "modal-backdrop", onClick: () => setInventoryCatalogModalTab(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-item-catalog-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: inventoryCatalogModalTab === "weapons"
                                ? "Agregar arma"
                                : inventoryCatalogModalTab === "armors"
                                    ? "Agregar armadura"
                                    : "Agregar objeto" }), _jsx("p", { className: "section-help", children: "Selecciona un objeto existente del catalogo para anadirlo al inventario." }), _jsxs("div", { className: "unified-sheet-item-catalog-fields", children: [inventoryCatalogModalTab === "weapons" ? (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: selectedWeaponCatalogFilter, onChange: (event) => setSelectedWeaponCatalogFilter(event.target.value), children: WEAPON_CATALOG_FILTER_OPTIONS.map((option) => (_jsx("option", { value: option.id, children: option.label }, option.id))) })] })) : inventoryCatalogModalTab === "armors" ? (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: selectedArmorCatalogFilter, onChange: (event) => setSelectedArmorCatalogFilter(event.target.value), children: ARMOR_CATALOG_FILTER_OPTIONS.map((option) => (_jsx("option", { value: option.id, children: option.label }, option.id))) })] })) : inventoryCatalogModalTab === "items" ? (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: selectedItemCatalogFilter, onChange: (event) => setSelectedItemCatalogFilter(event.target.value), children: ITEM_CATALOG_FILTER_OPTIONS.map((option) => (_jsx("option", { value: option.id, children: option.label }, option.id))) })] })) : null, _jsxs("label", { className: "field", children: [_jsx("span", { children: inventoryCatalogModalTab === "weapons" ? "Arma" : inventoryCatalogModalTab === "armors" ? "Armadura" : inventoryCatalogModalTab === "items" ? "Objeto" : "Catalogo" }), _jsx("select", { value: selectedCatalogItemId, onChange: (event) => setSelectedCatalogItemId(event.target.value), children: filteredModalCatalogItems.map((item) => (_jsx("option", { value: item.templateId, children: item.name }, item.templateId))) })] })] }), filteredModalCatalogItems.length > 0 ? (_jsx("div", { className: "unified-sheet-item-catalog-preview", children: (() => {
                                const selectedItem = filteredModalCatalogItems.find((item) => item.templateId === selectedCatalogItemId) ?? filteredModalCatalogItems[0];
                                if (!selectedItem)
                                    return null;
                                const selectedItemQualities = parseWeaponQualities(selectedItem.qualities);
                                return (selectedItem.category === "weapon" ? (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: "Arma del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [selectedItem.damageFormula ? _jsx("strong", { children: selectedItem.damageFormula }) : _jsx("strong", { children: "-" }), _jsx("span", { children: "Danio base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, selectedItemQualities.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: selectedItemQualities.map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] })) : selectedItem.category === "armor" ? (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: "Armadura del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [selectedItem.protectionFormula ? _jsx("strong", { children: selectedItem.protectionFormula }) : _jsx("strong", { children: "-" }), _jsx("span", { children: "Proteccion base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, parseWeaponQualities(selectedItem.qualities).length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: parseWeaponQualities(selectedItem.qualities).map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] })) : (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: selectedItem.category === "artifact" ? "Artefacto del catalogo" : "Objeto del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [_jsxs("strong", { children: ["x", selectedItem.defaultQuantity ?? 1] }), _jsx("span", { children: "Cantidad base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, selectedItemQualities.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: selectedItemQualities.map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] })));
                            })() })) : (_jsx("p", { className: "section-help", children: "No hay elementos disponibles en esta categoria." })), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setInventoryCatalogModalTab(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: filteredModalCatalogItems.length === 0 || !selectedCatalogItemId, onClick: addSelectedCatalogItemFromModal, children: "Agregar" })] })] }) })) : null] }));
}
function Field({ label, children }) {
    return _jsxs("label", { className: "field", children: [_jsx("span", { children: label }), children] });
}
function slotLabel(slot) {
    switch (slot) {
        case "mainHand": return "Mano principal";
        case "offHand": return "Mano secundaria";
        case "ranged": return "A distancia";
        case "armor": return "Armadura";
        case "artifact": return "Artefacto";
        case "worn": return "Vestido";
    }
}
function CapabilityTextList({ title, entries, onOpenDetail }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsxs("article", { className: `unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}`, onClick: onOpenDetail ? () => onOpenDetail(entry) : undefined, onKeyDown: onOpenDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDetail(entry);
                }
            } : undefined, role: onOpenDetail ? "button" : undefined, tabIndex: onOpenDetail ? 0 : undefined, children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: entry.nombre || title }) }), _jsxs("div", { className: "unified-sheet-capability-meta", children: [entry.tipo ? _jsx("span", { children: entry.tipo }) : null, entry.nivel ? _jsx("span", { children: entry.nivel }) : null, entry.fuente ? _jsxs("span", { children: [entry.fuente, entry.pagina ? ` p. ${entry.pagina}` : ""] }) : entry.pagina ? _jsxs("span", { children: ["p. ", entry.pagina] }) : null] })] }, `${title}-${index}-${entry.nombre}`)))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: "Sin entradas." })) }));
}
function SimpleStringList({ title, entries, emptyText, onOpenDetail }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsxs("article", { className: `unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}`, onClick: onOpenDetail ? () => onOpenDetail(entry) : undefined, onKeyDown: onOpenDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDetail(entry);
                }
            } : undefined, tabIndex: onOpenDetail ? 0 : undefined, role: onOpenDetail ? "button" : undefined, children: [_jsx("h3", { children: entry }), _jsx("div", { className: "unified-sheet-capability-meta", children: _jsx("span", { children: title }) })] }, `${title}-${index}-${entry}`)))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: emptyText })) }));
}
function SimpleStringListEditor({ title, entries, editable, rows, helpText, onChange, onAdd, onRemove }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar linea" }) : null] }), helpText ? _jsx("p", { className: "section-help", children: helpText }) : null, _jsx(Field, { label: title, children: _jsx("textarea", { disabled: !editable, rows: rows, value: entries.join("\n"), onChange: (event) => onChange(event.target.value) }) }), _jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "row-actions", children: [_jsx("strong", { children: entry || `${title} ${index + 1}` }), editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] }) }, `${title}-editor-${index}-${entry}`)))) : (_jsx("p", { className: "section-help", children: "Sin entradas." })) })] }));
}
function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenDetail, onOpenCompendium }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar" }) : null] }), _jsxs("div", { className: "unified-sheet-list", children: [entries.map((entry, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editable, value: entry.nombre, onChange: (event) => onUpdate(index, "nombre", event.target.value) }) }), _jsx(Field, { label: "Tipo", children: _jsx("input", { disabled: !editable, value: entry.tipo, onChange: (event) => onUpdate(index, "tipo", event.target.value) }) }), _jsx(Field, { label: "Nivel", children: _jsxs("select", { disabled: !editable, value: entry.nivel, onChange: (event) => onUpdate(index, "nivel", event.target.value), children: [_jsx("option", { value: "novato", children: "Novato" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] }) }), _jsx(Field, { label: "Fuente", children: _jsx("input", { disabled: !editable, value: entry.fuente, onChange: (event) => onUpdate(index, "fuente", event.target.value) }) }), _jsx(Field, { label: "Pagina", children: _jsx("input", { disabled: !editable, type: "number", min: 0, value: entry.pagina ?? "", onChange: (event) => onUpdate(index, "pagina", Number(event.target.value || 0)) }) })] }), _jsx("textarea", { disabled: !editable, rows: 3, value: entry.efecto, onChange: (event) => onUpdate(index, "efecto", event.target.value) }), _jsx("textarea", { disabled: !editable, rows: 2, value: entry.notas, onChange: (event) => onUpdate(index, "notas", event.target.value) }), _jsxs("div", { className: "card-actions", children: [onOpenDetail ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenDetail(entry), children: "Ver detalle" }) : null, onOpenCompendium ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenCompendium(entry.nombre), children: "Ver en compendio" }) : null, editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] })] }, `${title}-${index}-${entry.nombre}`))), entries.length === 0 ? _jsx("p", { className: "section-help", children: "Sin entradas." }) : null] })] }));
}
