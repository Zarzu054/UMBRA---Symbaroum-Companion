import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, SYMBAROUM_ABILITIES, buildRollRequest, deriveCharacterActions, executeCharacterAction, synchronizeCharacterSheet, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "@umbra/shared";
import { computeDerivedStats } from "../models/rulesEngine";
import { createCustomInventoryItem, createInventoryItemFromTemplate, ITEM_CATALOG } from "../models/itemCatalog";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import { dispatchRoll20Request, setRollDestination as persistRollDestination } from "../services/rollTransport";
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
function getPendingAttackTarget(sheet, characterName, action, destination, selectedAttackModifierIds) {
    const request = buildRollRequest(sheet, characterName, action.id, "attack", destination);
    if (typeof request.target !== "number") {
        return null;
    }
    const selectedBonus = getAttackRollModifiers(action, sheet)
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
export function UnifiedCharacterSheet({ title, subtitle, sheet, editable, busy = false, onSave, onBack, onOpenCompendiumCapability }) {
    const { draft, editMode, isDirty, isSavingLocal, setDraft, setEditMode, updateField, save } = useUnifiedCharacterSheet({
        sheet,
        editable,
        onSave
    });
    const canEditNotes = editMode && editable;
    const canEditInventory = editable;
    const [activeTab, setActiveTab] = useState("actions");
    const [activeActionTab, setActiveActionTab] = useState("all");
    const [activeCapabilityTab, setActiveCapabilityTab] = useState("abilities");
    const [activeInventoryTab, setActiveInventoryTab] = useState("weapons");
    const [selectedCatalogItemId, setSelectedCatalogItemId] = useState(ITEM_CATALOG[0]?.templateId ?? "");
    const [inventoryCatalogModalTab, setInventoryCatalogModalTab] = useState(null);
    const [history, setHistory] = useState([]);
    const rollDestination = "roll20";
    const [pendingRollConfirmation, setPendingRollConfirmation] = useState(null);
    const [showPendingRollBreakdown, setShowPendingRollBreakdown] = useState(false);
    const [actionDetailModal, setActionDetailModal] = useState(null);
    const normalizedSheet = useMemo(() => synchronizeCharacterSheet(draft), [draft]);
    const derived = useMemo(() => computeDerivedStats(normalizedSheet), [normalizedSheet]);
    const actions = useMemo(() => deriveCharacterActions(normalizedSheet), [normalizedSheet]);
    const defenseAlternativeActions = useMemo(() => actions.filter((action) => isDefenseModifierOnlyAction(action)), [actions]);
    const visibleActions = useMemo(() => actions.filter((action) => !isDefenseModifierOnlyAction(action)), [actions]);
    const filteredActions = useMemo(() => {
        switch (activeActionTab) {
            case "all":
                return visibleActions;
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
    }, [visibleActions, activeActionTab]);
    const pendingAttackModifiers = useMemo(() => (pendingRollConfirmation?.action && pendingRollConfirmation.phase === "attack"
        ? getAttackRollModifiers(pendingRollConfirmation.action, normalizedSheet)
        : []), [pendingRollConfirmation, normalizedSheet]);
    const displayName = normalizedSheet.identidad.nombrePersonaje || title;
    const equippedItems = useMemo(() => normalizedSheet.inventoryItems.filter((item) => item.equipped), [normalizedSheet.inventoryItems]);
    const equippedArmor = useMemo(() => equippedItems.find((item) => item.category === "armor") ?? null, [equippedItems]);
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
    useEffect(() => {
        persistRollDestination("roll20");
    }, []);
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
        setActionDetailModal({
            title: formatActionDisplayLabel(action.label),
            sourceLabel: getActionSourceLabel(action),
            detail
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
        const formula = equippedArmor?.protectionFormula || derived.armaduraActiva;
        if (!formula)
            return;
        const label = equippedArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Armadura");
        if (rollDestination !== "umbra") {
            const formulaBreakdown = equippedArmor?.protectionFormula
                ? [{
                        label: equippedArmor?.name || "Armadura",
                        formula
                    }]
                : (derived.armaduraNaturalBreakdown.length > 0
                    ? derived.armaduraNaturalBreakdown
                    : [{
                            label: equippedArmor?.name || (derived.armaduraNatural ? "Armadura natural" : "Armadura"),
                            formula
                        }]);
            queueRoll20Request({
                kind: "damage",
                phase: "damage",
                characterName: displayName,
                actionId: `armor:${equippedArmor?.id ?? "legacy"}`,
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
            const selectedDefenseAction = pendingRollConfirmation.selectedDefenseAlternativeId
                ? defenseAlternativeActions.find((action) => action.id === pendingRollConfirmation.selectedDefenseAlternativeId)
                : null;
            const request = selectedDefenseAction
                ? buildRollRequest(normalizedSheet, displayName, selectedDefenseAction.id, "attack", rollDestination)
                : pendingRollConfirmation.request ?? (pendingRollConfirmation.action && pendingRollConfirmation.phase
                    ? buildRollRequest(normalizedSheet, displayName, pendingRollConfirmation.action.id, pendingRollConfirmation.phase, rollDestination, "", pendingRollConfirmation.selectedDamageModifierIds)
                    : null);
            if (!request) {
                throw new Error("No se pudo preparar la tirada");
            }
            if (pendingRollConfirmation.action && pendingRollConfirmation.phase === "attack" && typeof request.target === "number") {
                const selectedAttackModifiers = getAttackRollModifiers(pendingRollConfirmation.action, normalizedSheet)
                    .filter((modifier) => pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id));
                const totalAttackBonus = selectedAttackModifiers.reduce((sum, modifier) => sum + modifier.bonus, 0);
                if (totalAttackBonus !== 0) {
                    request.target += totalAttackBonus;
                    const modifierNote = `Modificadores de ataque: ${selectedAttackModifiers.map((modifier) => modifier.label).join(", ")}`;
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
        setSelectedCatalogItemId(filteredItems[0]?.templateId ?? "");
        setInventoryCatalogModalTab(tab);
    }
    function addSelectedCatalogItemFromModal() {
        addCatalogInventoryItem();
        setInventoryCatalogModalTab(null);
    }
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
    function renderInventoryItemEditor(item, index) {
        const stackable = isStackableInventoryItem(item);
        return (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: item.name || "Objeto sin nombre" }), _jsxs("p", { className: "meta-text", children: [item.category === "weapon" ? "Arma" : item.category === "armor" ? "Armadura" : "Objeto", item.equipped ? " · equipado" : "", item.slot !== "none" ? ` · ${slotLabel(item.slot)}` : ""] })] }), _jsxs("div", { className: "unified-sheet-quantity-controls", children: [stackable ? _jsxs("span", { className: "info-chip", children: ["x", item.quantity] }) : null, canEditInventory && stackable ? (_jsxs("div", { className: "unified-sheet-stack-controls", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => changeInventoryQuantity(index, 1), children: "+" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => changeInventoryQuantity(index, -1), children: "-" })] })) : null, canEditInventory ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => removeInventoryItem(index), children: "Quitar" }) : null] })] }), _jsxs("div", { className: "unified-sheet-item-readonly-grid", children: [item.attackAttribute || item.damageFormula || item.protectionFormula ? (_jsxs("div", { className: "info-box", children: [item.attackAttribute ? _jsxs("span", { children: ["Ataque: ", ATTRIBUTE_LABELS[item.attackAttribute]] }) : null, item.damageFormula ? _jsxs("span", { children: ["Danio: ", item.damageFormula] }) : null, item.protectionFormula ? _jsxs("span", { children: ["Proteccion: ", item.protectionFormula] }) : null] })) : null, item.weight || item.value ? (_jsxs("div", { className: "info-box", children: [item.weight ? _jsxs("span", { children: ["Peso: ", item.weight] }) : null, item.value ? _jsxs("span", { children: ["Valor: ", item.value] }) : null] })) : null, item.qualities ? _jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Cualidades: ", item.qualities] }) }) : null, item.modifiers.length > 0 ? (_jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Modificadores: ", item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")] }) })) : null] }), item.description ? _jsx("p", { className: "unified-sheet-rich-text", children: item.description }) : null, item.notes ? _jsx("p", { className: "unified-sheet-capability-notes", children: item.notes }) : null] }, item.id));
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
                                            ["attacks", "Ataques"],
                                            ["powers", "Poderes y rituales"],
                                            ["actions", "Acciones"],
                                            ["free", "Acciones gratuitas"],
                                            ["reactions", "Reacciones"],
                                            ["other", "Otras"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeActionTab === tab ? "is-active" : "", onClick: () => setActiveActionTab(tab), children: label }, tab))) }), _jsxs("div", { className: "campaign-sheet-actions", children: [filteredActions.map((action) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row", children: [_jsxs("div", { className: "campaign-action-main", children: [_jsx("button", { type: "button", className: "campaign-action-name-button", onClick: () => openActionDetail(action), children: formatActionDisplayLabel(action.label) }), _jsx("span", { className: "campaign-action-source-note", children: getActionSourceLabel(action) })] }), _jsx("div", { className: "campaign-action-slot", children: action.rollAttribute ? (_jsx("button", { type: "button", onClick: () => runAttackAction(action), children: getActionRollLabel(action) })) : (_jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" })) }), _jsx("div", { className: "campaign-action-slot is-damage", children: action.damageFormula && !isIntegratedDamageBonusAction(action) ? _jsx("button", { type: "button", onClick: () => runDamageAction(action), children: "Danio" }) : _jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" }) })] }, action.id))), filteredActions.length === 0 ? _jsx("p", { className: "section-help", children: "Sin acciones registradas en esta categoria." }) : null] })] }) })) : null, activeTab === "inventory" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Inventario y equipo" }) }), _jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Secciones del inventario", children: [
                                            ["money", "Dinero"],
                                            ["weapons", "Armas"],
                                            ["armors", "Armaduras"],
                                            ["items", "Objetos"],
                                            ["slots", "Ranuras equipadas"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeInventoryTab === tab ? "is-active" : "", onClick: () => setActiveInventoryTab(tab), children: label }, tab))) }), activeInventoryTab === "money" ? (_jsx("div", { className: "unified-sheet-money-grid", children: [
                                            ["taleros", "Taleros"],
                                            ["chelines", "Chelines"],
                                            ["ortegs", "Ortegs"]
                                        ].map(([key, label]) => (_jsxs("article", { className: "campaign-structured-card unified-sheet-money-card", children: [_jsx("strong", { children: label }), _jsxs("span", { children: ["x", moneyCounters[key]] }), canEditInventory ? (_jsxs("div", { className: "unified-sheet-stack-controls", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => changeMoneyCounter(key, 1), children: "+" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => changeMoneyCounter(key, -1), children: "-" })] })) : null] }, key))) })) : null, activeInventoryTab === "weapons" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armas" }), canEditInventory ? _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("weapons"), children: "Agregar arma" }) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.weapons.length > 0
                                                    ? inventorySections.weapons.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armas registradas." }) })] })) : null, activeInventoryTab === "armors" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armaduras" }), canEditInventory ? _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("armors"), children: "Agregar armadura" }) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.armors.length > 0
                                                    ? inventorySections.armors.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armaduras registradas." }) })] })) : null, activeInventoryTab === "items" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Objetos" }), canEditInventory ? _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("items"), children: "Agregar objeto" }) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.items.length > 0
                                                    ? inventorySections.items.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin otros objetos registrados." }) })] })) : null, activeInventoryTab === "slots" ? (_jsx("div", { className: "form-grid", children: ["mainHand", "offHand", "ranged", "armor", "artifact", "worn"].map((slot) => (_jsx(Field, { label: slotLabel(slot), children: _jsxs("select", { disabled: !canEditInventory, value: normalizedSheet.equipmentSlots[slot], onChange: (event) => updateField(`equipmentSlots.${slot}`, event.target.value), children: [_jsx("option", { value: "", children: "Sin asignar" }), normalizedSheet.inventoryItems.map((item) => (_jsx("option", { value: item.id, children: item.name || item.id }, `${slot}-${item.id}`)))] }) }, slot))) })) : null] }) })) : null, activeTab === "abilities" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Tipos de capacidades", children: [
                                            ["traits", "Rasgos"],
                                            ["blessings", "Bendiciones"],
                                            ["burdens", "Cargas"],
                                            ["abilities", "Habilidades"],
                                            ["powers", "Poderes"],
                                            ["rituals", "Rituales"]
                                        ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeCapabilityTab === tab ? "is-active" : "", onClick: () => setActiveCapabilityTab(tab), children: label }, tab))) }), activeCapabilityTab === "traits" ? (_jsx(SimpleStringList, { title: "Rasgos", entries: normalizedSheet.rasgos, emptyText: "Sin rasgos registrados." })) : null, activeCapabilityTab === "blessings" ? (_jsx(SimpleStringList, { title: "Bendiciones", entries: normalizedSheet.bendiciones, emptyText: "Sin bendiciones registradas." })) : null, activeCapabilityTab === "burdens" ? (_jsx(SimpleStringList, { title: "Cargas", entries: normalizedSheet.cargas, emptyText: "Sin cargas registradas." })) : null, activeCapabilityTab === "abilities" ? (_jsx(CapabilityTextList, { title: "Habilidades", entries: normalizedSheet.habilidades, onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined })) : null, activeCapabilityTab === "powers" ? (_jsx(CapabilityTextList, { title: "Poderes misticos", entries: normalizedSheet.poderesMisticos, onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined })) : null, activeCapabilityTab === "rituals" ? (_jsx(CapabilityTextList, { title: "Rituales", entries: normalizedSheet.rituales, onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined })) : null] }) })) : null, activeTab === "background" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Sombra", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.sombra, onChange: (event) => updateField("identidad.sombra", event.target.value) }) }), _jsx(Field, { label: "Cita", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.cita, onChange: (event) => updateField("identidad.cita", event.target.value) }) }), _jsx(Field, { label: "Edad", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.edad, onChange: (event) => updateField("identidad.edad", event.target.value) }) }), _jsx(Field, { label: "Altura", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.altura, onChange: (event) => updateField("identidad.altura", event.target.value) }) }), _jsx(Field, { label: "Peso", children: _jsx("input", { disabled: true, value: normalizedSheet.identidad.peso, onChange: (event) => updateField("identidad.peso", event.target.value) }) })] }), _jsx(Field, { label: "Apariencia", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.identidad.apariencia, onChange: (event) => updateField("identidad.apariencia", event.target.value) }) }), _jsx(Field, { label: "Objetivo personal", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.identidad.objetivoPersonal, onChange: (event) => updateField("identidad.objetivoPersonal", event.target.value) }) }), _jsx(Field, { label: "Historia", children: _jsx("textarea", { disabled: true, rows: 8, value: normalizedSheet.noteSections.background, onChange: (event) => updateField("noteSections.background", event.target.value) }) })] }) })) : null, activeTab === "notes" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Notas y contexto" }), _jsx(Field, { label: "Notas generales", children: _jsx("textarea", { disabled: !canEditNotes, rows: 6, value: normalizedSheet.noteSections.general, onChange: (event) => updateField("noteSections.general", event.target.value) }) }), _jsx(Field, { label: "Notas de campana", children: _jsx("textarea", { disabled: !canEditNotes, rows: 4, value: normalizedSheet.noteSections.campaign, onChange: (event) => updateField("noteSections.campaign", event.target.value) }) }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Grupo", children: _jsx("input", { disabled: true, value: normalizedSheet.grupo.nombre, onChange: (event) => updateField("grupo.nombre", event.target.value) }) }), _jsx(Field, { label: "Objetivo del grupo", children: _jsx("textarea", { disabled: true, rows: 2, value: normalizedSheet.grupo.objetivo, onChange: (event) => updateField("grupo.objetivo", event.target.value) }) })] })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contactos" }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.contactosHoja.map((contacto, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: true, value: contacto.nombre, onChange: (event) => updateField(`contactosHoja.${index}.nombre`, event.target.value) }) }), _jsx(Field, { label: "Raza", children: _jsx("input", { disabled: true, value: contacto.raza, onChange: (event) => updateField(`contactosHoja.${index}.raza`, event.target.value) }) }), _jsx(Field, { label: "Ocupacion", children: _jsx("input", { disabled: true, value: contacto.ocupacion, onChange: (event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value) }) }), _jsx(Field, { label: "Jugador", children: _jsx("input", { disabled: true, value: contacto.jugador, onChange: (event) => updateField(`contactosHoja.${index}.jugador`, event.target.value) }) })] }) }, `contacto-${index}`))) })] })] })) : null] })] }));
    }
    return (_jsxs("div", { className: `unified-sheet is-tab-${activeTab}`, children: [_jsxs("section", { className: "unified-sheet-persistent campaign-sheet-card", children: [_jsxs("div", { className: "unified-sheet-header-band", children: [_jsxs("div", { className: "unified-sheet-hero-main", children: [_jsxs("div", { className: "unified-sheet-portrait", children: [_jsx("div", { className: "unified-sheet-portrait-ring" }), _jsx("div", { className: "unified-sheet-portrait-content", children: _jsx("span", { children: String(normalizedSheet.identidad.arquetipo).slice(0, 1) }) })] }), _jsxs("div", { className: "unified-sheet-identity", children: [_jsx("h2", { className: "unified-sheet-title", children: displayName }), subtitle ? _jsx("span", { className: "unified-sheet-inline-subtitle", children: subtitle }) : null] })] }), _jsxs("section", { className: "unified-sheet-header-stats", children: [_jsxs("div", { className: "unified-sheet-vital-card is-health", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Robustez" }), _jsxs("strong", { children: [derived.robustezActualTotal, " / ", derived.robustezMaximaTotal] })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action gain", onClick: () => adjustNumber("combate.robustezActual", 1), children: "+1 Vida" }), _jsx("button", { type: "button", className: "vital-action loss", onClick: () => adjustNumber("combate.robustezActual", -1), children: "-1 Danio" })] })] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion temporal" }), _jsx("strong", { children: normalizedSheet.corrupcion.temporal })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action corruption", onClick: () => adjustNumber("corrupcion.temporal", 1), children: "+1 Temp" }), _jsx("button", { type: "button", className: "vital-action subtle", onClick: () => adjustNumber("corrupcion.temporal", -1), children: "-1 Temp" })] })] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption-deep", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion permanente" }), _jsx("strong", { children: normalizedSheet.corrupcion.permanente })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), _jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action corruption-deep", onClick: () => adjustNumber("corrupcion.permanente", 1), children: "+1 Perm" }), _jsx("button", { type: "button", className: "vital-action subtle-dark", onClick: () => adjustNumber("corrupcion.permanente", -1), children: "-1 Perm" })] })] })] })] }), _jsxs("div", { className: "unified-sheet-body-grid", children: [renderTabStage("unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card"), _jsxs("section", { className: "unified-sheet-static-column", children: [_jsx("div", { className: "unified-sheet-attribute-rail", children: ATTRIBUTE_KEYS.map((key) => (_jsxs("div", { className: "unified-sheet-attribute-chip", children: [_jsx("span", { children: ATTRIBUTE_LABELS[key] }), _jsx("strong", { children: normalizedSheet.atributos[key] }), _jsx("button", { type: "button", className: "vital-action subtle", onClick: () => runAttributeRoll(key), children: "Tirar" })] }, key))) }), _jsxs("div", { className: "unified-sheet-static-summary", children: [_jsxs("div", { className: "unified-sheet-quick-row is-primary", children: [_jsxs("article", { className: "unified-sheet-quick-card is-defense-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Defensa" }), _jsx("strong", { children: derived.defensaTotal })] }), _jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle is-defense-roll", onClick: runDefenseRoll, children: "Tirar Defensa" }) })] }), _jsxs("article", { className: "unified-sheet-quick-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armadura" }), _jsx("strong", { children: equippedArmor?.protectionFormula || derived.armaduraActiva || "-" })] }), _jsx("strong", { children: equippedArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Sin armadura") }), _jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle", onClick: runArmorRoll, disabled: !(equippedArmor?.protectionFormula || derived.armaduraActiva), children: "Tirar Armadura" }) })] })] }), _jsxs("div", { className: "unified-sheet-quick-row is-derived", children: [_jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Iniciativa" }), _jsx("strong", { children: derived.iniciativaTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de corrupcion" }), _jsx("strong", { children: derived.umbralCorrupcionTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de dolor" }), _jsx("strong", { children: derived.umbralDolorTotal })] })] }), _jsx("div", { className: "unified-sheet-quick-row is-conditions", children: _jsxs("article", { className: "unified-sheet-quick-card is-wide", children: [_jsx("h3", { children: "Condiciones" }), _jsx("div", { className: "unified-sheet-quick-tags", children: normalizedSheet.conditions.length > 0 ? normalizedSheet.conditions.slice(0, 4).map((condition) => (_jsx("span", { className: `unified-sheet-tag is-${condition.category}`, children: condition.name || "Condicion" }, condition.id))) : _jsx("span", { className: "unified-sheet-tag", children: "Sin condiciones" }) })] }) })] })] })] })] }), activeTab === "actions" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Acciones disponibles" }) }), _jsx("nav", { className: "unified-sheet-subtabs unified-sheet-action-subtabs", "aria-label": "Filtros de acciones", children: [
                                ["all", "Todas"],
                                ["attacks", "Ataques"],
                                ["powers", "Poderes y rituales"],
                                ["actions", "Acciones"],
                                ["free", "Acciones gratuitas"],
                                ["reactions", "Reacciones"],
                                ["other", "Otras"]
                            ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeActionTab === tab ? "is-active" : "", onClick: () => setActiveActionTab(tab), children: label }, tab))) }), _jsxs("div", { className: "campaign-sheet-actions", children: [filteredActions.map((action) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row", children: [_jsx("strong", { children: formatActionDisplayLabel(action.label) }), _jsx("div", { className: "campaign-action-slot", children: action.rollAttribute ? (_jsx("button", { type: "button", onClick: () => runAttackAction(action), children: getActionRollLabel(action) })) : (_jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" })) }), _jsx("div", { className: "campaign-action-slot is-damage", children: action.damageFormula && !isIntegratedDamageBonusAction(action) ? _jsx("button", { type: "button", onClick: () => runDamageAction(action), children: "Danio" }) : _jsx("span", { "aria-hidden": "true", className: "campaign-action-slot-placeholder" }) })] }, action.id))), filteredActions.length === 0 ? _jsx("p", { className: "section-help", children: "Sin acciones registradas en esta categoria." }) : null] })] }) })) : null, activeTab === "inventory" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Inventario y equipo" }), editMode ? _jsx("button", { type: "button", onClick: addInventoryItem, children: "Agregar objeto" }) : null] }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Dinero", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.recursos.dinero, onChange: (event) => updateField("recursos.dinero", event.target.value) }) }), _jsx(Field, { label: "Otros recursos", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.recursos.otros, onChange: (event) => updateField("recursos.otros", event.target.value) }) })] }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.inventoryItems.map((item, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editMode, value: item.name, onChange: (event) => updateInventoryItem(index, "name", event.target.value) }) }), _jsx(Field, { label: "Categoria", children: _jsxs("select", { disabled: !editMode, value: item.category, onChange: (event) => updateInventoryItem(index, "category", event.target.value), children: [_jsx("option", { value: "weapon", children: "Arma" }), _jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "gear", children: "Equipo" }), _jsx("option", { value: "consumable", children: "Consumible" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "treasure", children: "Tesoro" }), _jsx("option", { value: "other", children: "Otro" })] }) }), _jsx(Field, { label: "Cantidad", children: isStackableInventoryItem(item) ? (_jsxs("div", { className: "unified-sheet-inline-quantity-editor", children: [_jsx("button", { type: "button", className: "subtle-button", disabled: !editMode, onClick: () => changeInventoryQuantity(index, -1), children: "-" }), _jsx("input", { disabled: !editMode, type: "number", min: 0, value: item.quantity, onChange: (event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0)) }), _jsx("button", { type: "button", className: "subtle-button", disabled: !editMode, onClick: () => changeInventoryQuantity(index, 1), children: "+" })] })) : (_jsx("input", { disabled: !editMode, type: "number", min: 0, value: item.quantity, onChange: (event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0)) })) }), _jsx(Field, { label: "Equipada", children: _jsxs("select", { disabled: !editMode, value: item.equipped ? "si" : "no", onChange: (event) => updateInventoryItem(index, "equipped", event.target.value === "si"), children: [_jsx("option", { value: "si", children: "Si" }), _jsx("option", { value: "no", children: "No" })] }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { disabled: !editMode, value: item.slot, onChange: (event) => updateInventoryItem(index, "slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "mainHand", children: "Mano principal" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "ranged", children: "A distancia" }), _jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "worn", children: "Vestido" })] }) }), _jsx(Field, { label: "Danio / proteccion", children: _jsx("input", { disabled: !editMode, value: item.category === "armor" ? item.protectionFormula : item.damageFormula, onChange: (event) => updateInventoryItem(index, item.category === "armor" ? "protectionFormula" : "damageFormula", event.target.value) }) })] }), _jsx("textarea", { disabled: !editMode, rows: 2, value: item.description, onChange: (event) => updateInventoryItem(index, "description", event.target.value) }), editMode ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => removeInventoryItem(index), children: "Quitar" }) : null] }, item.id))) })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Ranuras equipadas" }), _jsx("div", { className: "form-grid", children: ["mainHand", "offHand", "ranged", "armor", "artifact", "worn"].map((slot) => (_jsx(Field, { label: slotLabel(slot), children: _jsxs("select", { disabled: !editMode, value: normalizedSheet.equipmentSlots[slot], onChange: (event) => updateField(`equipmentSlots.${slot}`, event.target.value), children: [_jsx("option", { value: "", children: "Sin asignar" }), normalizedSheet.inventoryItems.map((item) => (_jsx("option", { value: item.id, children: item.name || item.id }, `${slot}-${item.id}`)))] }) }, slot))) })] })] })) : null, activeTab === "abilities" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("nav", { className: "unified-sheet-subtabs", "aria-label": "Tipos de capacidades", children: [
                                    ["traits", "Rasgos"],
                                    ["blessings", "Bendiciones"],
                                    ["burdens", "Cargas"],
                                    ["abilities", "Habilidades"],
                                    ["powers", "Poderes"],
                                    ["rituals", "Rituales"]
                                ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeCapabilityTab === tab ? "is-active" : "", onClick: () => setActiveCapabilityTab(tab), children: label }, tab))) }), activeCapabilityTab === "traits" ? (_jsx(SimpleStringListEditor, { title: "Rasgos", entries: normalizedSheet.rasgos, editable: editMode, rows: 6, helpText: "Rasgos de personaje como Contactos se guardan aqui y se exportan/importan como tipo Rasgo.", onChange: (value) => updateSimpleSheetList("rasgos", value), onAdd: () => addSimpleSheetEntry("rasgos"), onRemove: (index) => removeSimpleSheetEntry("rasgos", index) })) : null, activeCapabilityTab === "blessings" ? (_jsx(SimpleStringListEditor, { title: "Bendiciones", entries: normalizedSheet.bendiciones, editable: editMode, rows: 6, helpText: "Cada bendicion cuenta como 5 PX gastados.", onChange: (value) => updateSimpleSheetList("bendiciones", value), onAdd: () => addSimpleSheetEntry("bendiciones"), onRemove: (index) => removeSimpleSheetEntry("bendiciones", index) })) : null, activeCapabilityTab === "burdens" ? (_jsx(SimpleStringListEditor, { title: "Cargas", entries: normalizedSheet.cargas, editable: editMode, rows: 6, helpText: "Cada carga aporta 5 PX extra disponibles.", onChange: (value) => updateSimpleSheetList("cargas", value), onAdd: () => addSimpleSheetEntry("cargas"), onRemove: (index) => removeSimpleSheetEntry("cargas", index) })) : null] }), activeCapabilityTab === "abilities" ? (_jsx(CapabilityEditor, { title: "Habilidades", entries: normalizedSheet.habilidades, editable: editMode, onAdd: () => addRatedEntry("habilidades"), onRemove: (index) => removeRatedEntry("habilidades", index), onUpdate: (index, field, value) => updateRatedEntry("habilidades", index, field, value), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined })) : null, activeCapabilityTab === "powers" ? (_jsx(CapabilityEditor, { title: "Poderes misticos", entries: normalizedSheet.poderesMisticos, editable: editMode, onAdd: () => addRatedEntry("poderesMisticos"), onRemove: (index) => removeRatedEntry("poderesMisticos", index), onUpdate: (index, field, value) => updateRatedEntry("poderesMisticos", index, field, value), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined })) : null, activeCapabilityTab === "rituals" ? (_jsx(CapabilityEditor, { title: "Rituales", entries: normalizedSheet.rituales, editable: editMode, onAdd: () => addRatedEntry("rituales"), onRemove: (index) => removeRatedEntry("rituales", index), onUpdate: (index, field, value) => updateRatedEntry("rituales", index, field, value), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined })) : null] })) : null, activeTab === "background" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Trasfondo" }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Sombra", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.sombra, onChange: (event) => updateField("identidad.sombra", event.target.value) }) }), _jsx(Field, { label: "Cita", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.cita, onChange: (event) => updateField("identidad.cita", event.target.value) }) }), _jsx(Field, { label: "Edad", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.edad, onChange: (event) => updateField("identidad.edad", event.target.value) }) }), _jsx(Field, { label: "Altura", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.altura, onChange: (event) => updateField("identidad.altura", event.target.value) }) }), _jsx(Field, { label: "Peso", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.identidad.peso, onChange: (event) => updateField("identidad.peso", event.target.value) }) })] }), _jsx(Field, { label: "Apariencia", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.identidad.apariencia, onChange: (event) => updateField("identidad.apariencia", event.target.value) }) }), _jsx(Field, { label: "Objetivo personal", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.identidad.objetivoPersonal, onChange: (event) => updateField("identidad.objetivoPersonal", event.target.value) }) }), _jsx(Field, { label: "Historia", children: _jsx("textarea", { disabled: !editMode, rows: 8, value: normalizedSheet.noteSections.background, onChange: (event) => updateField("noteSections.background", event.target.value) }) })] }) })) : null, activeTab === "notes" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Notas y contexto" }), _jsx(Field, { label: "Notas generales", children: _jsx("textarea", { disabled: !editMode, rows: 6, value: normalizedSheet.noteSections.general, onChange: (event) => updateField("noteSections.general", event.target.value) }) }), _jsx(Field, { label: "Notas de campana", children: _jsx("textarea", { disabled: !editMode, rows: 4, value: normalizedSheet.noteSections.campaign, onChange: (event) => updateField("noteSections.campaign", event.target.value) }) }), _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Grupo", children: _jsx("input", { disabled: !editMode, value: normalizedSheet.grupo.nombre, onChange: (event) => updateField("grupo.nombre", event.target.value) }) }), _jsx(Field, { label: "Objetivo del grupo", children: _jsx("textarea", { disabled: !editMode, rows: 2, value: normalizedSheet.grupo.objetivo, onChange: (event) => updateField("grupo.objetivo", event.target.value) }) })] })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contactos" }), _jsx("div", { className: "unified-sheet-list", children: normalizedSheet.contactosHoja.map((contacto, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editMode, value: contacto.nombre, onChange: (event) => updateField(`contactosHoja.${index}.nombre`, event.target.value) }) }), _jsx(Field, { label: "Raza", children: _jsx("input", { disabled: !editMode, value: contacto.raza, onChange: (event) => updateField(`contactosHoja.${index}.raza`, event.target.value) }) }), _jsx(Field, { label: "Ocupacion", children: _jsx("input", { disabled: !editMode, value: contacto.ocupacion, onChange: (event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value) }) }), _jsx(Field, { label: "Jugador", children: _jsx("input", { disabled: !editMode, value: contacto.jugador, onChange: (event) => updateField(`contactosHoja.${index}.jugador`, event.target.value) }) })] }) }, `contacto-${index}`))) })] })] })) : null, pendingRollConfirmation ? (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", children: [_jsx("h3", { children: "Enviar tirada" }), _jsx("p", { className: "section-help", children: pendingRollConfirmation.title }), pendingAttackModifiers.length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de ataque" }), pendingAttackModifiers.map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
                                                ...current,
                                                selectedAttackModifierIds: event.target.checked
                                                    ? [...current.selectedAttackModifierIds, modifier.id]
                                                    : current.selectedAttackModifierIds.filter((entry) => entry !== modifier.id)
                                            } : current) }), _jsx("span", { children: modifier.label })] }, `${pendingRollConfirmation.action?.id}-${modifier.id}`))), _jsxs("p", { className: "section-help", children: ["Objetivo final: ", getPendingAttackTarget(normalizedSheet, displayName, pendingRollConfirmation.action, rollDestination, pendingRollConfirmation.selectedAttackModifierIds) ?? "-"] })] })) : null, pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage" && getActionDamageVariants(pendingRollConfirmation.action).length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de dano" }), getActionDamageVariants(pendingRollConfirmation.action).map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedDamageModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
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
                                })] })) : null, _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsxs("div", { className: "character-roll-confirm-primary", children: [_jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("public"), children: "Publico" }), _jsx("button", { type: "button", onClick: () => void handleConfirmRoll20Send("gm"), children: "Solo DJ" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPendingRollConfirmation(null), children: "Cancelar" })] })] }) })) : null, actionDetailModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setActionDetailModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: actionDetailModal.title }), _jsx("p", { className: "section-help", children: actionDetailModal.sourceLabel }), _jsx("p", { className: "unified-sheet-rich-text", children: actionDetailModal.detail }), _jsx("div", { className: "row-actions character-roll-confirm-actions", children: _jsx("button", { type: "button", className: "subtle-button", onClick: () => setActionDetailModal(null), children: "Cerrar" }) })] }) })) : null, inventoryCatalogModalTab ? (_jsx("div", { className: "modal-backdrop", onClick: () => setInventoryCatalogModalTab(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-item-catalog-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: inventoryCatalogModalTab === "weapons"
                                ? "Agregar arma"
                                : inventoryCatalogModalTab === "armors"
                                    ? "Agregar armadura"
                                    : "Agregar objeto" }), _jsx("p", { className: "section-help", children: "Selecciona un objeto existente del catalogo para anadirlo al inventario." }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Catalogo" }), _jsx("select", { value: selectedCatalogItemId, onChange: (event) => setSelectedCatalogItemId(event.target.value), children: modalCatalogItems.map((item) => (_jsx("option", { value: item.templateId, children: item.name }, item.templateId))) })] }), modalCatalogItems.length > 0 ? (_jsx("div", { className: "unified-sheet-item-catalog-preview", children: (() => {
                                const selectedItem = modalCatalogItems.find((item) => item.templateId === selectedCatalogItemId) ?? modalCatalogItems[0];
                                if (!selectedItem)
                                    return null;
                                return (_jsxs(_Fragment, { children: [_jsx("strong", { children: selectedItem.name }), selectedItem.description ? _jsx("p", { children: selectedItem.description }) : null, _jsxs("div", { className: "unified-sheet-capability-meta", children: [_jsx("span", { children: selectedItem.category === "weapon" ? "Arma" : selectedItem.category === "armor" ? "Armadura" : "Objeto" }), selectedItem.damageFormula ? _jsxs("span", { children: ["Danio ", selectedItem.damageFormula] }) : null, selectedItem.protectionFormula ? _jsxs("span", { children: ["Proteccion ", selectedItem.protectionFormula] }) : null, selectedItem.qualities ? _jsx("span", { children: selectedItem.qualities }) : null] })] }));
                            })() })) : (_jsx("p", { className: "section-help", children: "No hay elementos disponibles en esta categoria." })), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setInventoryCatalogModalTab(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: modalCatalogItems.length === 0 || !selectedCatalogItemId, onClick: addSelectedCatalogItemFromModal, children: "Agregar" })] })] }) })) : null] }));
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
function CapabilityTextList({ title, entries, onOpenCompendium }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => ((() => {
            const parsed = parseCapabilityTiers(entry.efecto);
            const parsedNotes = parseCapabilityTiers(entry.notas);
            const visibleTierCount = capabilityLevelRank(entry.nivel);
            const visibleTiers = parsed.tiers.filter((tier) => capabilityLevelRank(tier.label) <= visibleTierCount);
            const normalizedBody = normalizeCapabilityText([
                ...visibleTiers.map((tier) => `${tier.label}: ${tier.content}`),
                parsed.remainder ?? "",
                parsed.reference ?? ""
            ].join(" "));
            const normalizedNotes = normalizeCapabilityText(entry.notas);
            const shouldShowNotes = normalizedNotes.length > 0 &&
                parsedNotes.tiers.length === 0 &&
                !normalizedBody.includes(normalizedNotes);
            return (_jsxs("article", { className: "unified-sheet-capability-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: entry.nombre || title }), onOpenCompendium && entry.nombre ? (_jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenCompendium(entry.nombre), children: "Ver en compendio" })) : null] }), _jsxs("div", { className: "unified-sheet-capability-meta", children: [entry.tipo ? _jsx("span", { children: entry.tipo }) : null, entry.nivel ? _jsx("span", { children: entry.nivel }) : null, entry.fuente ? _jsxs("span", { children: [entry.fuente, entry.pagina ? ` p. ${entry.pagina}` : ""] }) : entry.pagina ? _jsxs("span", { children: ["p. ", entry.pagina] }) : null] }), visibleTiers.length > 0 ? (_jsx("div", { className: "unified-sheet-capability-tier-list", children: visibleTiers.map((tier) => (_jsxs("section", { className: "unified-sheet-capability-tier", children: [_jsx("h4", { children: tier.label }), _jsx("p", { className: "unified-sheet-rich-text", children: tier.content })] }, `${entry.nombre}-${tier.label}`))) })) : null, !visibleTiers.length && parsed.remainder ? _jsx("p", { className: "unified-sheet-rich-text", children: parsed.remainder }) : null, parsed.reference ? _jsx("p", { className: "unified-sheet-capability-notes", children: parsed.reference }) : null, shouldShowNotes ? _jsx("p", { className: "unified-sheet-capability-notes", children: entry.notas }) : null] }, `${title}-${index}-${entry.nombre}`));
        })()))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: "Sin entradas." })) }));
}
function SimpleStringList({ title, entries, emptyText }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsxs("article", { className: "unified-sheet-capability-card", children: [_jsx("h3", { children: entry }), _jsx("div", { className: "unified-sheet-capability-meta", children: _jsx("span", { children: title }) })] }, `${title}-${index}-${entry}`)))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: emptyText })) }));
}
function SimpleStringListEditor({ title, entries, editable, rows, helpText, onChange, onAdd, onRemove }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar linea" }) : null] }), helpText ? _jsx("p", { className: "section-help", children: helpText }) : null, _jsx(Field, { label: title, children: _jsx("textarea", { disabled: !editable, rows: rows, value: entries.join("\n"), onChange: (event) => onChange(event.target.value) }) }), _jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "row-actions", children: [_jsx("strong", { children: entry || `${title} ${index + 1}` }), editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] }) }, `${title}-editor-${index}-${entry}`)))) : (_jsx("p", { className: "section-help", children: "Sin entradas." })) })] }));
}
function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenCompendium }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar" }) : null] }), _jsxs("div", { className: "unified-sheet-list", children: [entries.map((entry, index) => (_jsxs("article", { className: "campaign-structured-card", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editable, value: entry.nombre, onChange: (event) => onUpdate(index, "nombre", event.target.value) }) }), _jsx(Field, { label: "Tipo", children: _jsx("input", { disabled: !editable, value: entry.tipo, onChange: (event) => onUpdate(index, "tipo", event.target.value) }) }), _jsx(Field, { label: "Nivel", children: _jsxs("select", { disabled: !editable, value: entry.nivel, onChange: (event) => onUpdate(index, "nivel", event.target.value), children: [_jsx("option", { value: "novato", children: "Novato" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] }) }), _jsx(Field, { label: "Fuente", children: _jsx("input", { disabled: !editable, value: entry.fuente, onChange: (event) => onUpdate(index, "fuente", event.target.value) }) }), _jsx(Field, { label: "Pagina", children: _jsx("input", { disabled: !editable, type: "number", min: 0, value: entry.pagina ?? "", onChange: (event) => onUpdate(index, "pagina", Number(event.target.value || 0)) }) })] }), _jsx("textarea", { disabled: !editable, rows: 3, value: entry.efecto, onChange: (event) => onUpdate(index, "efecto", event.target.value) }), _jsx("textarea", { disabled: !editable, rows: 2, value: entry.notas, onChange: (event) => onUpdate(index, "notas", event.target.value) }), _jsxs("div", { className: "card-actions", children: [onOpenCompendium ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenCompendium(entry.nombre), children: "Ver en compendio" }) : null, editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] })] }, `${title}-${index}-${entry.nombre}`))), entries.length === 0 ? _jsx("p", { className: "section-help", children: "Sin entradas." }) : null] })] }));
}
