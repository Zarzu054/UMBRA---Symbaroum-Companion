import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, WEAPON_QUALITY_OPTIONS, SYMBAROUM_ABILITIES, buildRollRequest, averageDiceFormula, deriveCharacterActions, executeCharacterAction, findWeaponQualityOption, formatSkillLevelLabel, formatWeaponQualities, parseWeaponQualities, synchronizeCharacterSheet, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, evaluateProfession, getBenefitProfessionIds, normalizeProfessionCapabilities } from "@umbra/shared";
import { computeDerivedStats } from "../models/rulesEngine";
import { getCharacterActionRollPresentation } from "../models/actionPresentation";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ARMOR_QUALITY_OPTIONS, ITEM_QUALITY_OPTIONS, createCustomInventoryItem, createInventoryItemFromTemplate, ITEM_CATALOG } from "../models/itemCatalog";
import { ALL_ENTRIES, findCompendiumEntryByTypeAndName, getCompendiumSourcePdfUrl, getCompendiumSummaryLink } from "../models/compendiumEntries";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { SourceReferenceLink } from "./SourceReferenceLink";
import { dispatchRoll20Request, setRollDestination as persistRollDestination } from "../services/rollTransport";
const TAB_IDS = ["actions", "inventory", "abilities", "background", "notes"];
const MECHANICAL_TAB_IDS = ["actions", "inventory", "abilities"];
const NARRATIVE_TAB_IDS = ["background", "notes"];
const ACTION_TAB_IDS = ["all", "favorites", "attacks", "combat", "movement", "free", "reactions", "powers", "artifacts", "feats", "maneuvers", "special", "other"];
const CAPABILITY_TAB_IDS = ["traits", "blessings", "burdens", "abilities", "powers", "rituals"];
const INVENTORY_TAB_IDS = ["money", "weapons", "armors", "artifacts", "items"];
const CHARACTER_CONDITION_DEFINITIONS = [
    { id: "condition-burning", name: "Ardiendo", category: "injury", tone: "danger" },
    { id: "condition-stunned", name: "Aturdido", category: "state", tone: "warning" },
    { id: "condition-blinded", name: "Cegado", category: "state", tone: "warning" },
    { id: "condition-prone", name: "Derribado", category: "state", tone: "info" },
    { id: "condition-poisoned", name: "Envenenado", category: "injury", tone: "poison" },
    { id: "condition-immobilized", name: "Inmovilizado", category: "state", tone: "info" },
    { id: "condition-paralyzed", name: "Paralizado", category: "state", tone: "critical" },
    { id: "condition-bleeding", name: "Sangrando", category: "injury", tone: "danger" }
];
function normalizeConditionName(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function matchesConditionDefinition(condition, definition) {
    return condition.id === definition.id || normalizeConditionName(condition.name) === normalizeConditionName(definition.name);
}
function getStoredConditionTone(condition) {
    if (condition.category === "injury")
        return "danger";
    if (condition.category === "corruption")
        return "critical";
    if (condition.category === "state")
        return "info";
    return "warning";
}
const WEAPON_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todas" },
    { id: "one-handed", label: "Una mano" },
    { id: "short", label: "Cortas" },
    { id: "long", label: "Largas" },
    { id: "heavy", label: "Pesadas" },
    { id: "ranged", label: "A distancia" },
    { id: "thrown", label: "Arrojadizas" },
    { id: "shield", label: "Escudos" }
];
const ARMOR_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todas" },
    { id: "light", label: "Ligeras" },
    { id: "medium", label: "Medias" },
    { id: "heavy", label: "Pesadas" }
];
const ITEM_CATALOG_FILTER_OPTIONS = [
    { id: "all", label: "Todos" },
    { id: "elixir", label: "Elixires" },
    { id: "minor-artifact", label: "Artefactos menores" },
    { id: "trap", label: "Trampas" },
    { id: "equipment", label: "Equipo general" },
    { id: "container", label: "Receptáculos" },
    { id: "travel", label: "Viaje" },
    { id: "ammunition", label: "Munición" },
    { id: "tool", label: "Herramientas" },
    { id: "material", label: "Materiales" },
    { id: "ritual", label: "Rituales" },
    { id: "valuable", label: "Valiosos" }
];
const SHEET_TAB_STORAGE_PREFIX = "umbra:character-sheet-tabs:";
const DEFAULT_SHEET_TAB_STATE = {
    activeTab: "actions",
    activeMechanicalTab: "actions",
    activeNarrativeTab: "background",
    activeActionTab: "all",
    activeCapabilityTab: "abilities",
    activeInventoryTab: "weapons"
};
const STANDALONE_INFORMATIONAL_ACTION_RULE_NAMES = [
    "Luchar a ciegas",
    "Destrabarse del combate",
    "Usar/aplicar un elixir",
    "Primeros auxilios",
    "Levantarse",
    "Línea de visión",
    "Flanquear"
];
const INFORMATIONAL_ACTION_CATEGORIES = {
    "regla-resumen-40-golpe-limpio": ["feats", "combat", "attacks"],
    "regla-resumen-41-sin-miedo": ["feats", "free"],
    "regla-resumen-42-ignorar-la-corrupcion": ["feats", "free"],
    "regla-resumen-43-defensa-perfecta": ["feats", "reactions"],
    "regla-resumen-44-golpe-rapido": ["feats", "free"],
    "regla-resumen-45-resistencia": ["feats", "free"],
    "regla-resumen-46-mirada-de-acero": ["feats", "free"],
    "regla-resumen-47-ataque-torbellino": ["feats", "combat", "attacks"],
    "regla-resumen-62-apuntar-con-cuidado": ["maneuvers", "movement"],
    "regla-resumen-63-embestir": ["maneuvers", "movement", "combat", "attacks"],
    "regla-resumen-64-retrasar-la-iniciativa": ["maneuvers", "free"],
    "regla-resumen-65-desarmar": ["maneuvers", "combat", "attacks"],
    "regla-resumen-66-defensa-completa": ["maneuvers", "combat"],
    "regla-resumen-67-ofensiva-total": ["maneuvers", "combat", "attacks"],
    "regla-resumen-68-presa": ["maneuvers", "combat", "attacks"],
    "regla-resumen-69-dejar-inconsciente": ["maneuvers", "combat", "attacks"],
    "regla-resumen-70-veneno-en-las-armas": ["maneuvers", "combat"],
    "regla-resumen-71-hacer-retroceder": ["maneuvers", "movement", "combat", "attacks"],
    "regla-resumen-72-placaje": ["maneuvers", "combat", "attacks"],
    "regla-resumen-73-tomar-la-iniciativa": ["maneuvers", "free"],
    "regla-resumen-2-luchar-a-ciegas": ["special"],
    "regla-resumen-3-destrabarse-del-combate": ["special", "movement"],
    "regla-resumen-4-usar-aplicar-un-elixir": ["special", "movement", "combat"],
    "regla-resumen-5-primeros-auxilios": ["special", "combat"],
    "regla-resumen-6-levantarse": ["special", "movement"],
    "regla-resumen-7-linea-de-vision": ["movement"],
    "regla-resumen-9-flanquear": ["movement"],
    "guia-rapida-trabarse-cuerpo-a-cuerpo": ["movement"],
    "guia-rapida-moverse-alrededor-enemigo": ["movement"],
    "guia-rapida-desenvainar-arma": ["movement"],
    "guia-rapida-cambiar-arma": ["movement"],
    "guia-rapida-atacar": ["combat", "attacks"],
    "guia-rapida-habilidad-activa": ["combat"],
    "guia-rapida-movimiento-adicional": ["combat"]
};
function buildVariantInformationalActions(parentId, familyCategory) {
    const parent = ALL_ENTRIES.find((entry) => entry.id === parentId);
    if (!parent)
        return [];
    return (parent.variants ?? [])
        .filter((variant) => {
        const categories = INFORMATIONAL_ACTION_CATEGORIES[variant.id];
        return Boolean(categories && (!familyCategory || categories.includes(familyCategory)));
    })
        .map((variant) => ({
        id: `rule:${variant.id}`,
        label: variant.label,
        familyLabel: parent.nombre,
        familyDetail: parent.detalle,
        detail: variant.detail ?? "Sin detalles adicionales.",
        facts: variant.facts,
        sourceEntry: parent,
        categories: INFORMATIONAL_ACTION_CATEGORIES[variant.id] ?? [familyCategory],
        optional: parent.ruleCategory === "official_optional"
    }));
}
function buildStandaloneInformationalActions() {
    const order = new Map(STANDALONE_INFORMATIONAL_ACTION_RULE_NAMES.map((name, index) => [normalizeCapabilityText(name), index]));
    return ALL_ENTRIES
        .filter((entry) => entry.tipo === "regla" && order.has(normalizeCapabilityText(entry.nombre)))
        .sort((left, right) => (order.get(normalizeCapabilityText(left.nombre)) ?? 999) - (order.get(normalizeCapabilityText(right.nombre)) ?? 999))
        .map((entry) => ({
        id: `rule:${entry.id}`,
        label: entry.nombre,
        familyLabel: INFORMATIONAL_ACTION_CATEGORIES[entry.id]?.includes("special") ? "Acciones especiales" : "Guía rápida de combate",
        familyDetail: "",
        detail: entry.detalle,
        facts: [],
        sourceEntry: entry,
        categories: INFORMATIONAL_ACTION_CATEGORIES[entry.id] ?? ["special"],
        optional: entry.ruleCategory === "official_optional"
    }));
}
function handleHorizontalActionTabWheel(event) {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
        return;
    const previous = element.scrollLeft;
    element.scrollLeft += event.deltaY;
    if (element.scrollLeft !== previous)
        event.preventDefault();
}
function handleActionTabKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button:not(:disabled)"));
    if (buttons.length === 0)
        return;
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
    const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
            ? buttons.length - 1
            : event.key === "ArrowLeft"
                ? Math.max(0, currentIndex - 1)
                : Math.min(buttons.length - 1, currentIndex + 1);
    const target = buttons[nextIndex];
    if (!target)
        return;
    event.preventDefault();
    target.focus();
    target.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" });
}
function buildSheetNoteId() {
    return `sheet-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function sortCharacterPersonalNotes(entries) {
    return [...entries].sort((left, right) => {
        const leftDate = left.updatedAt || left.createdAt || "";
        const rightDate = right.updatedAt || right.createdAt || "";
        return rightDate.localeCompare(leftDate);
    });
}
function summarizeCharacterNote(content) {
    const collapsed = content.replace(/\s+/g, " ").trim();
    if (!collapsed) {
        return "Sin contenido.";
    }
    return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed;
}
function renderSimpleMarkdownInline(text, keyPrefix) {
    const nodes = [];
    const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const [fullMatch, , linkLabel, linkUrl, inlineCode, boldText, italicText] = match;
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        if (linkLabel && linkUrl) {
            nodes.push(_jsx("a", { href: linkUrl, target: "_blank", rel: "noreferrer", children: linkLabel }, `${keyPrefix}-link-${match.index}`));
        }
        else if (inlineCode) {
            nodes.push(_jsx("code", { children: inlineCode }, `${keyPrefix}-code-${match.index}`));
        }
        else if (boldText) {
            nodes.push(_jsx("strong", { children: renderSimpleMarkdownInline(boldText, `${keyPrefix}-bold-${match.index}`) }, `${keyPrefix}-bold-${match.index}`));
        }
        else if (italicText) {
            nodes.push(_jsx("em", { children: renderSimpleMarkdownInline(italicText, `${keyPrefix}-italic-${match.index}`) }, `${keyPrefix}-italic-${match.index}`));
        }
        else {
            nodes.push(fullMatch);
        }
        lastIndex = match.index + fullMatch.length;
    }
    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }
    return nodes;
}
function renderSimpleMarkdownBlocks(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraphBuffer = [];
    let listItems = [];
    let listType = null;
    let codeBlock = [];
    let inCodeBlock = false;
    function flushParagraph() {
        if (paragraphBuffer.length === 0)
            return;
        const textContent = paragraphBuffer.join(" ").trim();
        if (textContent) {
            blocks.push(_jsx("p", { children: renderSimpleMarkdownInline(textContent, `paragraph-${blocks.length}`) }, `paragraph-${blocks.length}`));
        }
        paragraphBuffer = [];
    }
    function flushList() {
        if (listItems.length === 0 || !listType)
            return;
        const Tag = listType;
        blocks.push(_jsx(Tag, { children: listItems.map((item, index) => _jsx("li", { children: renderSimpleMarkdownInline(item, `list-${blocks.length}-${index}`) }, `list-${blocks.length}-${index}`)) }, `list-${blocks.length}`));
        listItems = [];
        listType = null;
    }
    function flushCodeBlock() {
        if (codeBlock.length === 0)
            return;
        blocks.push(_jsx("pre", { className: "campaign-markdown-code-block", children: _jsx("code", { children: codeBlock.join("\n") }) }, `code-${blocks.length}`));
        codeBlock = [];
    }
    lines.forEach((rawLine, index) => {
        const line = rawLine.trimEnd();
        if (line.trim().startsWith("```")) {
            flushParagraph();
            flushList();
            if (inCodeBlock) {
                flushCodeBlock();
                inCodeBlock = false;
            }
            else {
                inCodeBlock = true;
            }
            return;
        }
        if (inCodeBlock) {
            codeBlock.push(rawLine);
            return;
        }
        if (!line.trim()) {
            flushParagraph();
            flushList();
            return;
        }
        const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = Math.min(headingMatch[1].length + 2, 6);
            const content = renderSimpleMarkdownInline(headingMatch[2], `heading-${index}`);
            if (level === 3) {
                blocks.push(_jsx("h3", { children: content }, `heading-${index}`));
            }
            else if (level === 4) {
                blocks.push(_jsx("h4", { children: content }, `heading-${index}`));
            }
            else if (level === 5) {
                blocks.push(_jsx("h5", { children: content }, `heading-${index}`));
            }
            else {
                blocks.push(_jsx("h6", { children: content }, `heading-${index}`));
            }
            return;
        }
        const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (unorderedMatch) {
            flushParagraph();
            if (listType && listType !== "ul") {
                flushList();
            }
            listType = "ul";
            listItems.push(unorderedMatch[1]);
            return;
        }
        const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
        if (orderedMatch) {
            flushParagraph();
            if (listType && listType !== "ol") {
                flushList();
            }
            listType = "ol";
            listItems.push(orderedMatch[1]);
            return;
        }
        const blockquoteMatch = line.match(/^\s*>\s?(.*)$/);
        if (blockquoteMatch) {
            flushParagraph();
            flushList();
            blocks.push(_jsx("blockquote", { children: renderSimpleMarkdownInline(blockquoteMatch[1], `blockquote-${index}`) }, `blockquote-${index}`));
            return;
        }
        flushList();
        paragraphBuffer.push(line.trim());
    });
    flushParagraph();
    flushList();
    flushCodeBlock();
    return blocks.length > 0 ? blocks : _jsx("p", { children: "Sin contenido." });
}
function matchesWeaponCatalogFilter(item, filterId) {
    if (item.category !== "weapon")
        return false;
    if (filterId === "all")
        return true;
    const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
    if (filterId === "shield")
        return qualities.includes("escudo");
    if (filterId === "ranged")
        return qualities.includes("a distancia") || item.slot === "ranged";
    if (filterId === "thrown")
        return qualities.includes("arrojadiza") || item.slot === "none";
    if (filterId === "heavy")
        return qualities.includes("pesada") || item.name.toLowerCase().includes("pesada");
    if (filterId === "long")
        return qualities.includes("larga");
    if (filterId === "short")
        return qualities.includes("corta") || (item.slot === "offHand" && !qualities.includes("escudo"));
    if (filterId === "one-handed") {
        return item.slot === "mainHand"
            && !qualities.includes("corta")
            && !qualities.includes("larga")
            && !qualities.includes("pesada")
            && !qualities.includes("a distancia")
            && !qualities.includes("arrojadiza")
            && !qualities.includes("escudo");
    }
    return true;
}
function WeaponCatalogTypeIcon({ type }) {
    const commonProps = {
        viewBox: "0 0 24 24",
        width: 24,
        height: 24,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
    };
    if (type === "all") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "M4 20 20 4M13 4h7v7M4 4l5 5M4 4v5h5M15 15l5 5M15 20h5v-5" }) });
    }
    if (type === "one-handed") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "m5 19 12-12M14 4l6 6M4 20l4-1-3-3-1 4ZM11 10l3 3" }) });
    }
    if (type === "short") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "m6 18 9-9M13 6l5 5M5 19l3-1-2-2-1 3ZM10 11l3 3" }) });
    }
    if (type === "long") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "M4 20 18 6M15 4l5 5M3 21l5-1-4-4-1 5ZM11 10l3 3" }) });
    }
    if (type === "heavy") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "M5 20 16 9M13 4l7 7-4 4-7-7 4-4ZM4 21l4-1-3-3-1 4" }) });
    }
    if (type === "ranged") {
        return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "M6 3c5 4 5 14 0 18M6 3c9 3 9 15 0 18M5 12h15M17 9l3 3-3 3" }) });
    }
    if (type === "shield") {
        return _jsxs("svg", { ...commonProps, children: [_jsx("path", { d: "M12 3 5 6v5c0 4.4 2.4 7.7 7 10 4.6-2.3 7-5.6 7-10V6l-7-3Z" }), _jsx("path", { d: "M12 6v11M8 10h8" })] });
    }
    return _jsx("svg", { ...commonProps, children: _jsx("path", { d: "M4 20 17 7M14 4l6 6M3 21l5-1-4-4-1 5M11 13l-3-3M8 10l3-1-1 3" }) });
}
function ArmorCatalogTypeIcon({ type }) {
    const commonProps = {
        viewBox: "0 0 24 24",
        width: 24,
        height: 24,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
    };
    if (type === "all") {
        return _jsxs("svg", { ...commonProps, children: [_jsx("path", { d: "M7 3 4 6v5c0 4.6 2.8 8.2 8 10 5.2-1.8 8-5.4 8-10V6l-3-3-5 2-5-2Z" }), _jsx("path", { d: "M8 10h8M12 6v11" })] });
    }
    if (type === "light") {
        return _jsxs("svg", { ...commonProps, children: [_jsx("path", { d: "m8 4-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3-2 2h-4L8 4Z" }), _jsx("path", { d: "M9 14h6" })] });
    }
    if (type === "medium") {
        return _jsxs("svg", { ...commonProps, children: [_jsx("path", { d: "m8 3-4 4 3 3v10h10V10l3-3-4-4-2 3h-4L8 3Z" }), _jsx("path", { d: "M7 11h10M10 6v14M14 6v14" })] });
    }
    return _jsxs("svg", { ...commonProps, children: [_jsx("path", { d: "m8 3-4 4 3 4v9h10v-9l3-4-4-4-2 3h-4L8 3Z" }), _jsx("path", { d: "M7 11h10M9 15h6M10 6v14M14 6v14" }), _jsx("path", { d: "M4 7h4M16 7h4" })] });
}
function matchesArmorCatalogFilter(item, filterId) {
    if (item.category !== "armor")
        return false;
    if (filterId === "all")
        return true;
    const weight = normalizeInventoryItemText(item.weight);
    if (filterId === "light")
        return weight === "ligera";
    if (filterId === "medium")
        return weight === "media";
    if (filterId === "heavy")
        return weight === "pesada";
    return true;
}
function matchesItemCatalogFilter(item, filterId) {
    if (item.category === "weapon" || item.category === "armor")
        return false;
    if (filterId === "all")
        return true;
    const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
    if (filterId === "elixir")
        return item.catalogGroup === "elixir";
    if (filterId === "minor-artifact")
        return item.catalogGroup === "minor-artifact";
    if (filterId === "trap")
        return item.catalogGroup === "trap";
    if (filterId === "equipment")
        return item.catalogGroup === "equipment";
    if (filterId === "container")
        return qualities.includes("contenedor");
    if (filterId === "travel")
        return qualities.includes("viaje");
    if (filterId === "ammunition")
        return qualities.includes("municion");
    if (filterId === "tool")
        return item.catalogGroup === "tool" || qualities.includes("herramienta");
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
        .replace(/^(?:Usar\s+|Lanzar\s+(?!a\s+))/i, "")
        .replace(/\s+\((Principiante|Adepto|Maestro)\)\s*$/i, "")
        .trim();
}
function removeRepeatedWeaponDescription(effectSummary, description) {
    const normalizedSummary = effectSummary.trim();
    const normalizedDescription = description.trim();
    if (!normalizedDescription || !normalizedSummary.startsWith(normalizedDescription)) {
        return normalizedSummary;
    }
    return normalizedSummary.slice(normalizedDescription.length).trim();
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
function getActionSourceLabel(action) {
    switch (action.sourceType) {
        case "weapon":
            return action.sourceName || "Arma";
        case "power":
            return action.sourceName || "Poder mistico";
        case "ritual":
            return action.sourceName || "Ritual";
        case "artifact":
            return action.sourceName || "Artefacto mistico";
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
function parseCapabilityTiers(text) {
    const source = String(text ?? "").trim();
    if (!source) {
        return { tiers: [], reference: null, remainder: null };
    }
    const tierRegex = /(Principiante:|Adepto:|Maestro:)/g;
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
        const parsedLabel = (match[0] ?? "").replace(":", "").trim();
        const rawLabel = parsedLabel;
        const rawContent = source.slice(start + match[0].length, end).trim();
        const referenceIndex = rawContent.indexOf("Ref:");
        const content = (referenceIndex >= 0 ? rawContent.slice(0, referenceIndex) : rawContent).trim();
        if (referenceIndex >= 0 && !reference) {
            reference = rawContent.slice(referenceIndex).trim();
        }
        if (!content) {
            continue;
        }
        if (rawLabel === "Principiante" || rawLabel === "Adepto" || rawLabel === "Maestro") {
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
        case "principiante":
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
        if (/\bprincipiante\b/.test(normalized))
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
    return parseWeaponQualities(item.qualities)
        .map((quality) => findWeaponQualityOption(quality)?.label)
        .filter((quality) => Boolean(quality))
        .filter((quality, index, qualities) => qualities.indexOf(quality) === index);
}
function getCustomWeaponQualities(item) {
    return parseWeaponQualities(item.qualities)
        .filter((quality) => !findWeaponQualityOption(quality));
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
function getArmorDefensePenaltyDetail(item) {
    if (item.category !== "armor") {
        return "";
    }
    const qualityIds = new Set(parseWeaponQualities(item.qualities).map((quality) => normalizeWeaponQualityKey(quality)));
    let basePenalty = 0;
    let label = "";
    const armorWeight = normalizeInventoryItemText(item.weight);
    if (qualityIds.has("ligera") || armorWeight === "ligera") {
        basePenalty = -2;
        label = "Ligera";
    }
    else if (qualityIds.has("media") || armorWeight === "media") {
        basePenalty = -3;
        label = "Media";
    }
    else if (qualityIds.has("pesada") || armorWeight === "pesada") {
        basePenalty = -4;
        label = "Pesada";
    }
    if (basePenalty === 0) {
        return "";
    }
    if (qualityIds.has("flexible")) {
        const reducedPenalty = Math.min(0, basePenalty + 2);
        return reducedPenalty === 0
            ? `Defensa: Flexible anula la penalizacion de ${label.toLowerCase()}.`
            : `Defensa: ${label} ${basePenalty} por incomoda, reducida a ${reducedPenalty} por Flexible.`;
    }
    if (qualityIds.has("aparatosa")) {
        return `Defensa: ${label} ${basePenalty - 1} por Aparatosa.`;
    }
    return `Defensa: ${label} ${basePenalty} por Incómoda.`;
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
    const label = formatSkillLevelLabel(level);
    return label === "Principiante" || label === "Adepto" || label === "Maestro" ? label : null;
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
    const order = ["Principiante", "Adepto", "Maestro"];
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
    if (/(principiante:|adepto:|maestro:)/i.test(note)) {
        return false;
    }
    const combinedTierText = normalizeCapabilityText(tiers.map((tier) => `${tier.label} ${tier.content}`).join(" "));
    if (!combinedTierText) {
        return true;
    }
    return !combinedTierText.includes(normalizedNote);
}
export function UnifiedCharacterSheet({ title, subtitle, sheet, editable, busy = false, onSave, onBack, onOpenBuilder, onUseArtifactAbility, collapsibleHistory = false, onOpenCompendiumCapability, professionMemberships = [], enforceProfessionRestrictions = false, campaignItems = [], canManageCampaignItems = false, campaignCharacterLinkId, onCreateCampaignItem, onUpdateCampaignItem }) {
    const { draft, isSavingLocal, setDraft, updateField, save } = useUnifiedCharacterSheet({
        sheet,
        editable,
        onSave
    });
    const isReadOnly = !editable;
    const canEditNotes = editable;
    const canEditInventory = editable;
    const activeCampaignItems = useMemo(() => campaignItems.filter((item) => !item.archivedAt), [campaignItems]);
    const campaignItemsById = useMemo(() => new Map(campaignItems.map((item) => [item.id, item])), [campaignItems]);
    const campaignCatalogTemplates = useMemo(() => activeCampaignItems.map((item) => ({
        templateId: `campaign:${item.id}`,
        name: item.definition.name,
        category: item.definition.category,
        stackable: item.isUnique ? false : item.definition.stackable,
        isCustom: true,
        description: item.definition.description,
        weight: item.definition.weight,
        value: item.definition.value,
        slot: item.definition.defaultSlot,
        attackAttribute: item.definition.attackAttribute,
        damageFormula: item.definition.damageFormula,
        protectionFormula: item.definition.protectionFormula,
        qualities: item.definition.qualities,
        notes: item.definition.notes,
        grantedActions: item.definition.grantedActions,
        modifiers: item.definition.modifiers,
        defaultQuantity: item.isUnique ? 1 : item.definition.defaultQuantity,
        campaignItemId: item.id
    })), [activeCampaignItems]);
    const availableItemCatalog = useMemo(() => [...ITEM_CATALOG, ...campaignCatalogTemplates], [campaignCatalogTemplates]);
    const [selectedCatalogItemId, setSelectedCatalogItemId] = useState(ITEM_CATALOG[0]?.templateId ?? "");
    const [inventoryCatalogModalTab, setInventoryCatalogModalTab] = useState(null);
    const [selectedWeaponCatalogFilter, setSelectedWeaponCatalogFilter] = useState("all");
    const [weaponCatalogSearch, setWeaponCatalogSearch] = useState("");
    const [selectedArmorCatalogFilter, setSelectedArmorCatalogFilter] = useState("all");
    const [armorCatalogSearch, setArmorCatalogSearch] = useState("");
    const [selectedItemCatalogFilter, setSelectedItemCatalogFilter] = useState("all");
    const [itemCatalogSearch, setItemCatalogSearch] = useState("");
    const [history, setHistory] = useState([]);
    const rollDestination = "roll20";
    const [pendingRollConfirmation, setPendingRollConfirmation] = useState(null);
    const [showPendingRollBreakdown, setShowPendingRollBreakdown] = useState(false);
    const [actionDetailModal, setActionDetailModal] = useState(null);
    const [selectedPersonalNoteId, setSelectedPersonalNoteId] = useState(null);
    const [personalNoteEditor, setPersonalNoteEditor] = useState(null);
    const [personalNoteError, setPersonalNoteError] = useState(null);
    const [isEditingBackground, setIsEditingBackground] = useState(false);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isExperienceRerollConfirmationOpen, setIsExperienceRerollConfirmationOpen] = useState(false);
    const [pendingFeatExpense, setPendingFeatExpense] = useState(null);
    const [artifactUseError, setArtifactUseError] = useState(null);
    const pendingArtifactDamageRef = useRef(new Set());
    const [weaponEditorModal, setWeaponEditorModal] = useState(null);
    const [armorEditorModal, setArmorEditorModal] = useState(null);
    const [itemEditorModal, setItemEditorModal] = useState(null);
    const [inventoryMutationError, setInventoryMutationError] = useState(null);
    const [activeWeaponQualityInfoId, setActiveWeaponQualityInfoId] = useState("");
    const isSheetModalOpen = Boolean(inventoryCatalogModalTab
        || pendingRollConfirmation
        || actionDetailModal
        || selectedPersonalNoteId
        || personalNoteEditor
        || isExperienceRerollConfirmationOpen
        || pendingFeatExpense
        || weaponEditorModal
        || armorEditorModal
        || itemEditorModal);
    useBodyScrollLock(isSheetModalOpen);
    const normalizedSheet = useMemo(() => synchronizeCharacterSheet(draft), [draft]);
    const usesFixedAverages = normalizedSheet.resolutionMode === "fixed_average";
    const activeProfessionIds = useMemo(() => new Set(professionMemberships
        .filter((membership) => membership.state === "active" && evaluateProfession(membership.professionId, {
        race: normalizedSheet.identidad.raza,
        culture: normalizedSheet.identidad.cultura,
        permanentCorruption: normalizedSheet.corrupcion.permanente,
        blessings: normalizedSheet.bendiciones,
        capabilities: normalizeProfessionCapabilities([
            ...normalizedSheet.capabilitySelections,
            ...normalizedSheet.habilidades.map((entry) => ({ name: entry.nombre, kind: "habilidad", level: entry.nivel })),
            ...normalizedSheet.poderesMisticos.map((entry) => ({ name: entry.nombre, kind: "poder_mistico", level: entry.nivel })),
            ...normalizedSheet.rituales.map((entry) => ({ name: entry.nombre, kind: "ritual", level: entry.nivel }))
        ])
    }, { includeAdmissionOnly: false }).eligible)
        .map((membership) => membership.professionId)), [normalizedSheet, professionMemberships]);
    const mechanicalSheet = useMemo(() => {
        const isEnabled = (name) => {
            if (!enforceProfessionRestrictions)
                return true;
            const professionIds = getBenefitProfessionIds(name);
            return professionIds.length === 0 || professionIds.some((id) => activeProfessionIds.has(id));
        };
        return {
            ...normalizedSheet,
            habilidades: normalizedSheet.habilidades.filter((entry) => isEnabled(entry.nombre)),
            poderesMisticos: normalizedSheet.poderesMisticos.filter((entry) => isEnabled(entry.nombre)),
            rituales: normalizedSheet.rituales.filter((entry) => isEnabled(entry.nombre)),
            capabilitySelections: normalizedSheet.capabilitySelections.filter((entry) => isEnabled(entry.name))
        };
    }, [activeProfessionIds, enforceProfessionRestrictions, normalizedSheet]);
    const derived = useMemo(() => computeDerivedStats(mechanicalSheet), [mechanicalSheet]);
    const actions = useMemo(() => deriveCharacterActions(mechanicalSheet), [mechanicalSheet]);
    const defenseAlternativeActions = useMemo(() => actions.filter((action) => isDefenseModifierOnlyAction(action)), [actions]);
    const visibleActions = useMemo(() => actions.filter((action) => !isDefenseModifierOnlyAction(action)), [actions]);
    const favoriteActionIds = useMemo(() => new Set(normalizedSheet.actionFavorites ?? []), [normalizedSheet.actionFavorites]);
    const displayName = normalizedSheet.identidad.nombrePersonaje || title;
    const sheetTabStorageKey = useMemo(() => `${SHEET_TAB_STORAGE_PREFIX}${normalizeCapabilityText(displayName || "default").replace(/[^a-z0-9]+/g, "-")}`, [displayName]);
    const [sheetTabState, setSheetTabState] = useState(DEFAULT_SHEET_TAB_STATE);
    const [mobileActiveTab, setMobileActiveTab] = useState("attributes");
    const mobileTabsRef = useRef(null);
    const [hasHydratedSheetTabs, setHasHydratedSheetTabs] = useState(false);
    const activeTab = sheetTabState.activeTab;
    const activeMechanicalTab = sheetTabState.activeMechanicalTab;
    const activeNarrativeTab = sheetTabState.activeNarrativeTab;
    const activeActionTab = sheetTabState.activeActionTab;
    const activeCapabilityTab = sheetTabState.activeCapabilityTab;
    const activeInventoryTab = sheetTabState.activeInventoryTab;
    const setActiveTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeTab: nextTab }));
    const setActiveMechanicalTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeMechanicalTab: nextTab }));
    const setActiveNarrativeTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeNarrativeTab: nextTab }));
    const setActiveActionTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeActionTab: nextTab }));
    const setActiveCapabilityTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeCapabilityTab: nextTab }));
    const setActiveInventoryTab = (nextTab) => setSheetTabState((current) => ({ ...current, activeInventoryTab: nextTab }));
    const setActiveMobileTab = (nextTab) => {
        setMobileActiveTab(nextTab);
        if (nextTab !== "attributes") {
            setActiveTab(nextTab);
            if (MECHANICAL_TAB_IDS.includes(nextTab)) {
                setActiveMechanicalTab(nextTab);
            }
            else {
                setActiveNarrativeTab(nextTab);
            }
        }
    };
    const handleMobileTabChange = (nextTab, button) => {
        setActiveMobileTab(nextTab);
        mobileTabsRef.current?.scrollIntoView?.({ block: "start" });
        const tabs = mobileTabsRef.current;
        tabs?.scrollTo?.({
            left: Math.max(0, button.offsetLeft - (tabs.clientWidth - button.offsetWidth) / 2),
            behavior: "smooth"
        });
    };
    const personalNotes = useMemo(() => sortCharacterPersonalNotes(normalizedSheet.personalNotes ?? []), [normalizedSheet.personalNotes]);
    const automaticConditions = useMemo(() => normalizedSheet.conditions.filter((condition) => ["legacy-corruption", "legacy-dying"].includes(condition.id) && condition.active), [normalizedSheet.conditions]);
    const additionalConditions = useMemo(() => normalizedSheet.conditions.filter((condition) => (!["legacy-corruption", "legacy-dying", "condition-dying"].includes(condition.id)
        && !CHARACTER_CONDITION_DEFINITIONS.some((definition) => matchesConditionDefinition(condition, definition)))), [normalizedSheet.conditions]);
    const selectedPersonalNote = useMemo(() => personalNotes.find((entry) => entry.id === selectedPersonalNoteId) ?? null, [personalNotes, selectedPersonalNoteId]);
    const filteredActions = useMemo(() => {
        switch (activeActionTab) {
            case "all":
                return visibleActions;
            case "favorites":
                return visibleActions.filter((action) => favoriteActionIds.has(action.id));
            case "attacks":
                return visibleActions.filter((action) => action.categories?.includes("attack"));
            case "combat":
                return visibleActions.filter((action) => action.categories?.includes("combat"));
            case "movement":
                return visibleActions.filter((action) => action.categories?.includes("movement"));
            case "powers":
                return visibleActions.filter((action) => action.categories?.includes("powers"));
            case "artifacts":
                return visibleActions.filter((action) => action.categories?.includes("artifacts"));
            case "other":
                return visibleActions.filter((action) => action.categories?.includes("other"));
            case "free":
                return visibleActions.filter((action) => action.categories?.includes("free"));
            case "reactions":
                return visibleActions.filter((action) => action.categories?.includes("reaction"));
            case "feats":
            case "maneuvers":
            case "special":
            default:
                return [];
        }
    }, [visibleActions, activeActionTab, favoriteActionIds]);
    const informationalActions = useMemo(() => [
        ...buildVariantInformationalActions("regla-resumen-39-hazanas", "feats"),
        ...buildVariantInformationalActions("regla-resumen-61-maniobras-de-combate-combates-mas-tacticos", "maneuvers"),
        ...buildVariantInformationalActions("regla-basica-acciones-de-combate"),
        ...buildStandaloneInformationalActions()
    ], []);
    const filteredInformationalActions = useMemo(() => {
        if (activeActionTab === "all")
            return informationalActions;
        if (activeActionTab === "favorites") {
            return informationalActions.filter((entry) => favoriteActionIds.has(entry.id));
        }
        return informationalActions.filter((entry) => entry.categories.includes(activeActionTab));
    }, [activeActionTab, favoriteActionIds, informationalActions]);
    const pendingAttackModifiers = useMemo(() => (pendingRollConfirmation
        ? getCheckRollModifiers(pendingRollConfirmation.action, pendingRollConfirmation.request, normalizedSheet)
        : []), [pendingRollConfirmation, normalizedSheet]);
    const experience = useMemo(() => getCharacterExperienceSummary(normalizedSheet), [normalizedSheet]);
    const displayedSpentExperience = Math.max(normalizedSheet.progreso.experienciaGastada, experience.computedSpent);
    const activeArmor = useMemo(() => {
        const equippedArmorId = normalizedSheet.equipmentSlots.armor;
        if (equippedArmorId) {
            return normalizedSheet.inventoryItems.find((item) => item.id === equippedArmorId && item.category === "armor" && item.quantity > 0) ?? null;
        }
        return normalizedSheet.inventoryItems.find((item) => item.category === "armor" && item.equipped && item.quantity > 0) ?? null;
    }, [normalizedSheet.equipmentSlots.armor, normalizedSheet.inventoryItems]);
    const moneyCounters = useMemo(() => parseMoneyCounters(normalizedSheet.recursos.dinero), [normalizedSheet.recursos.dinero]);
    const inventorySections = useMemo(() => ({
        weapons: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "weapon" && !item.managedArtifactId),
        armors: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "armor" && !item.managedArtifactId),
        artifacts: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => Boolean(item.managedArtifactId)),
        items: normalizedSheet.inventoryItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.category !== "weapon" && item.category !== "armor" && !item.managedArtifactId)
    }), [normalizedSheet.inventoryItems]);
    const modalCatalogItems = useMemo(() => {
        if (inventoryCatalogModalTab === "weapons") {
            return availableItemCatalog.filter((item) => item.category === "weapon");
        }
        if (inventoryCatalogModalTab === "armors") {
            return availableItemCatalog.filter((item) => item.category === "armor");
        }
        if (inventoryCatalogModalTab === "items") {
            return availableItemCatalog.filter((item) => item.category !== "weapon" && item.category !== "armor");
        }
        return [];
    }, [availableItemCatalog, inventoryCatalogModalTab]);
    const filteredModalCatalogItems = useMemo(() => inventoryCatalogModalTab === "weapons"
        ? modalCatalogItems.filter((item) => {
            if (!matchesWeaponCatalogFilter(item, selectedWeaponCatalogFilter))
                return false;
            const search = normalizeInventoryItemText(weaponCatalogSearch);
            return !search || normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description}`).includes(search);
        })
        : inventoryCatalogModalTab === "armors"
            ? modalCatalogItems.filter((item) => {
                if (!matchesArmorCatalogFilter(item, selectedArmorCatalogFilter))
                    return false;
                const search = normalizeInventoryItemText(armorCatalogSearch);
                return !search || normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description}`).includes(search);
            })
            : inventoryCatalogModalTab === "items"
                ? modalCatalogItems.filter((item) => {
                    if (!matchesItemCatalogFilter(item, selectedItemCatalogFilter))
                        return false;
                    const searchTokens = normalizeInventoryItemText(itemCatalogSearch).split(/\s+/).filter(Boolean);
                    const searchableText = normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description} ${item.value}`);
                    return searchTokens.every((token) => searchableText.includes(token));
                })
                : modalCatalogItems, [inventoryCatalogModalTab, modalCatalogItems, selectedWeaponCatalogFilter, selectedArmorCatalogFilter, selectedItemCatalogFilter, weaponCatalogSearch, armorCatalogSearch, itemCatalogSearch]);
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
                const persistedActiveTab = persistedTabs.activeTab && TAB_IDS.includes(persistedTabs.activeTab)
                    ? persistedTabs.activeTab
                    : DEFAULT_SHEET_TAB_STATE.activeTab;
                const persistedActionTab = persistedTabs.activeActionTab === "actions"
                    ? "combat"
                    : persistedTabs.activeActionTab;
                nextState = {
                    activeTab: persistedActiveTab,
                    activeMechanicalTab: persistedTabs.activeMechanicalTab && MECHANICAL_TAB_IDS.includes(persistedTabs.activeMechanicalTab)
                        ? persistedTabs.activeMechanicalTab
                        : MECHANICAL_TAB_IDS.includes(persistedActiveTab)
                            ? persistedActiveTab
                            : DEFAULT_SHEET_TAB_STATE.activeMechanicalTab,
                    activeNarrativeTab: persistedTabs.activeNarrativeTab && NARRATIVE_TAB_IDS.includes(persistedTabs.activeNarrativeTab)
                        ? persistedTabs.activeNarrativeTab
                        : NARRATIVE_TAB_IDS.includes(persistedActiveTab)
                            ? persistedActiveTab
                            : DEFAULT_SHEET_TAB_STATE.activeNarrativeTab,
                    activeActionTab: persistedActionTab && ACTION_TAB_IDS.includes(persistedActionTab) ? persistedActionTab : DEFAULT_SHEET_TAB_STATE.activeActionTab,
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
            activeMechanicalTab,
            activeNarrativeTab,
            activeActionTab,
            activeCapabilityTab,
            activeInventoryTab
        };
        window.localStorage.setItem(sheetTabStorageKey, JSON.stringify(persistedTabs));
    }, [activeActionTab, activeCapabilityTab, activeInventoryTab, activeMechanicalTab, activeNarrativeTab, activeTab, hasHydratedSheetTabs, sheetTabStorageKey]);
    function pushHistory(titleText, rolls, detail) {
        setHistory((current) => [{ title: titleText, detail, rolls }, ...current].slice(0, 12));
    }
    function openActionDetail(action) {
        if (action.sourceType === "weapon") {
            const item = normalizedSheet.inventoryItems.find((entry) => entry.name === action.sourceName || entry.id === action.id.replace(/^weapon:/, ""));
            const itemDescription = item?.description ?? "";
            const actionDetail = removeRepeatedWeaponDescription(action.effectSummary, itemDescription);
            const detail = [itemDescription, item?.qualities, item?.notes, actionDetail].filter(Boolean).join("\n\n").trim() || "Sin descripcion adicional.";
            setActionDetailModal({
                title: formatActionDisplayLabel(action.label),
                sourceLabel: getActionSourceLabel(action),
                detail
            });
            return;
        }
        if (action.sourceType === "artifact") {
            setActionDetailModal({
                title: formatActionDisplayLabel(action.label),
                sourceLabel: getActionSourceLabel(action),
                detail: [action.effectSummary, action.corruptionFormula ? `Corrupcion: ${action.corruptionFormula}` : "Corrupcion: Ninguna"].filter(Boolean).join("\n\n")
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
                item.damageFormula ? `Daño: ${item.damageFormula}` : "",
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
            removeInventoryIndex: canEditInventory && !item.managedArtifactId && !(item.campaignItemId && campaignItemsById.get(item.campaignItemId)?.isUnique) ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined
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
        const armorPenaltyDetail = getArmorDefensePenaltyDetail(item);
        if (armorPenaltyDetail) {
            notes.unshift(armorPenaltyDetail);
        }
        setActiveWeaponQualityInfoId("");
        setActionDetailModal({
            title: item.name || "Objeto sin nombre",
            sourceLabel: item.isCustom ? "Arma personalizada" : "Arma del catalogo",
            detail: item.description.trim() || "Sin descripcion adicional.",
            notes,
            removeInventoryIndex: canEditInventory && !item.managedArtifactId && !(item.campaignItemId && campaignItemsById.get(item.campaignItemId)?.isUnique) ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canManageCampaignItems && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            inventoryMeta: {
                kind: "weapon",
                damage: item.damageFormula || undefined,
                protection: item.protectionFormula || undefined,
                primaryLabel: "Daño base",
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
            removeInventoryIndex: canEditInventory && !item.managedArtifactId && !(item.campaignItemId && campaignItemsById.get(item.campaignItemId)?.isUnique) ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canManageCampaignItems && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
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
            removeInventoryIndex: canEditInventory && !item.managedArtifactId && !(item.campaignItemId && campaignItemsById.get(item.campaignItemId)?.isUnique) ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
            editInventoryIndex: canManageCampaignItems && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
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
    function openInformationalActionDetail(entry) {
        const sourceEntry = entry.sourceEntry;
        const summaryLink = getCompendiumSummaryLink(sourceEntry);
        const sourceReferences = [
            { source: sourceEntry.fuente, page: sourceEntry.pagina },
            ...(sourceEntry.references ?? [])
        ];
        const references = sourceReferences
            .map((reference) => ({
            url: getCompendiumSourcePdfUrl(reference.source, reference.page, entry.label),
            label: `${reference.source}${reference.page ? ` p. ${reference.page}` : ""}`
        }))
            .filter((reference) => Boolean(reference.url));
        if (summaryLink) {
            references.push({
                url: summaryLink.url,
                label: `${summaryLink.documentLabel} - ${summaryLink.sectionLabel}`
            });
        }
        const uniqueReferences = references.filter((reference, index, collection) => (collection.findIndex((candidate) => candidate.url === reference.url) === index));
        const facts = entry.facts.map((fact) => `${fact.label}: ${fact.value}`).join("\n");
        const isIndividualFeatOrManeuver = entry.categories.includes("feats") || entry.categories.includes("maneuvers");
        setActionDetailModal({
            title: entry.label,
            sourceLabel: `${entry.familyLabel}${entry.optional ? " · Regla opcional" : ""} · ${sourceEntry.fuente}${sourceEntry.pagina ? ` p. ${sourceEntry.pagina}` : ""}`,
            detail: [isIndividualFeatOrManeuver ? "" : entry.familyDetail, facts, entry.detail].filter(Boolean).join("\n\n"),
            references: uniqueReferences
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
        if (usesFixedAverages) {
            const formula = phase === "damage" ? action.damageFormula : "1d20";
            const fixed = formula ? averageDiceFormula(formula) : null;
            pushHistory(action.label, [], fixed == null ? "Acción informativa del DJ: esta ficha no lanza dados automáticamente." : `Valor fijo oficial: ${fixed} (fórmula conservada: ${formula}).`);
            return;
        }
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, phase, `${action.label} - ${phase === "damage" ? "Daño" : "Tirada"}`);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, phase, damageVariantId ? [damageVariantId] : []);
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runDamageVariantAction(action, damageVariantId, damageLabel) {
        if (usesFixedAverages) {
            const variant = action.damageModifiers?.find((entry) => entry.id === damageVariantId);
            const formula = variant?.formula ?? action.damageFormula;
            pushHistory(`${action.label} · ${damageLabel}`, [], formula ? `Valor fijo oficial: ${averageDiceFormula(formula) ?? formula} (fórmula conservada: ${formula}).` : "Acción informativa del DJ.");
            return;
        }
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "damage", `${action.label} - ${damageLabel}`, [], [damageVariantId]);
            return;
        }
        const result = executeCharacterAction(normalizedSheet, action.id, "damage", [damageVariantId]);
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    async function activateArtifactAction(action, phase) {
        if (action.sourceType !== "artifact" || !action.artifactAbilityId || !onUseArtifactAbility)
            return true;
        if (phase === "damage" && pendingArtifactDamageRef.current.has(action.artifactAbilityId)) {
            pendingArtifactDamageRef.current.delete(action.artifactAbilityId);
            return true;
        }
        const item = normalizedSheet.inventoryItems.find((entry) => entry.id === action.id.split(":").slice(1, -1).join(":"))
            ?? normalizedSheet.inventoryItems.find((entry) => entry.grantedActions.some((candidate) => candidate.artifactAbilityId === action.artifactAbilityId));
        if (!item?.managedArtifactId)
            return true;
        try {
            setArtifactUseError(null);
            await onUseArtifactAbility(item.managedArtifactId, action.artifactAbilityId);
            if (phase === "attack" && action.damageFormula) {
                pendingArtifactDamageRef.current.add(action.artifactAbilityId);
            }
            return true;
        }
        catch (error) {
            setArtifactUseError(error instanceof Error ? error.message : "No se pudo activar el artefacto");
            return false;
        }
    }
    async function runAttackAction(action) {
        if (usesFixedAverages) {
            pushHistory(action.label, [], "Acción informativa del DJ: el ataque no lanza dados automáticamente.");
            return;
        }
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "attack", `${action.label} · Tirada`);
            return;
        }
        if (!(await activateArtifactAction(action, "attack")))
            return;
        const result = executeCharacterAction(normalizedSheet, action.id, "attack");
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    async function runDamageAction(action) {
        if (usesFixedAverages) {
            pushHistory(action.label, [], action.damageFormula ? `Valor fijo oficial: ${averageDiceFormula(action.damageFormula) ?? action.damageFormula} (fórmula conservada: ${action.damageFormula}).` : "Acción informativa del DJ.");
            return;
        }
        if (rollDestination !== "umbra") {
            queueRoll20Request(action, "damage", `${action.label} · Daño`);
            return;
        }
        if (!(await activateArtifactAction(action, "damage")))
            return;
        const result = executeCharacterAction(normalizedSheet, action.id, "damage");
        pushHistory(result.action.label, result.rolls, result.action.effectSummary);
    }
    function runAttributeRoll(attribute) {
        const label = `Prueba de ${ATTRIBUTE_LABELS[attribute]}`;
        if (usesFixedAverages) {
            pushHistory(label, [], `Valor fijo del atributo: ${normalizedSheet.atributos[attribute]}. La ficha del DJ no realiza esta tirada.`);
            return;
        }
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
        if (usesFixedAverages) {
            pushHistory(label, [], `Defensa fija: ${derived.defensaTotal}. La ficha del DJ no realiza esta tirada.`);
            return;
        }
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
        const formula = derived.armaduraActiva;
        if (!formula)
            return;
        const label = activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Armadura");
        if (usesFixedAverages) {
            pushHistory(label, [], `Protección fija: ${averageDiceFormula(formula) ?? formula} (fórmula conservada: ${formula}).`);
            return;
        }
        if (rollDestination !== "umbra") {
            const formulaBreakdown = activeArmor?.protectionFormula
                ? activeArmor.protectionFormula.toLowerCase() === formula.toLowerCase()
                    ? [{
                            label: activeArmor?.name || "Armadura",
                            formula
                        }]
                    : [{
                            label: activeArmor?.name || "Armadura",
                            formula: activeArmor.protectionFormula
                        }, {
                            label: "Combate con armadura",
                            detail: `${activeArmor.protectionFormula.toUpperCase()} → ${formula.toUpperCase()}.`
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
            if (pendingRollConfirmation.action && pendingRollConfirmation.phase
                && !(await activateArtifactAction(pendingRollConfirmation.action, pendingRollConfirmation.phase))) {
                return;
            }
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
            [section]: [...draft[section], { nombre: "", tipo: "", efecto: "", nivel: "principiante", fuente: "", pagina: undefined, notas: "", acciones: [] }]
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
    function buildPersonalNoteDraft(entry) {
        const now = new Date().toISOString();
        return {
            id: entry?.id ?? buildSheetNoteId(),
            title: entry?.title ?? "",
            content: entry?.content ?? "",
            category: entry?.category ?? "general",
            createdAt: entry?.createdAt || now,
            updatedAt: entry?.updatedAt || now
        };
    }
    function replacePersonalNotes(nextEntries) {
        setDraft({
            ...draft,
            personalNotes: sortCharacterPersonalNotes(nextEntries)
        });
    }
    function savePersonalNote() {
        if (!personalNoteEditor) {
            return;
        }
        const trimmedTitle = personalNoteEditor.note.title.trim();
        const trimmedContent = personalNoteEditor.note.content.trim();
        if (trimmedTitle.length < 2) {
            setPersonalNoteError("El titulo debe tener al menos 2 caracteres.");
            return;
        }
        const now = new Date().toISOString();
        const normalized = {
            ...personalNoteEditor.note,
            title: trimmedTitle,
            content: trimmedContent,
            createdAt: personalNoteEditor.note.createdAt || now,
            updatedAt: now
        };
        const nextEntries = personalNoteEditor.mode === "create"
            ? [normalized, ...personalNotes]
            : personalNotes.map((entry) => entry.id === normalized.id ? normalized : entry);
        replacePersonalNotes(nextEntries);
        setSelectedPersonalNoteId(normalized.id);
        setPersonalNoteEditor(null);
        setPersonalNoteError(null);
    }
    function deletePersonalNote(noteId) {
        replacePersonalNotes(personalNotes.filter((entry) => entry.id !== noteId));
        if (selectedPersonalNoteId === noteId) {
            setSelectedPersonalNoteId(null);
        }
        setPersonalNoteEditor(null);
        setPersonalNoteError(null);
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
        setInventoryMutationError(null);
        setWeaponEditorModal({
            mode: "create",
            item: createCustomInventoryItem("weapon")
        });
        setActiveInventoryTab("weapons");
    }
    function addCustomArmor() {
        setInventoryMutationError(null);
        setArmorEditorModal({
            mode: "create",
            item: createCustomInventoryItem("armor")
        });
        setActiveInventoryTab("armors");
    }
    function addCustomItemModal() {
        setInventoryMutationError(null);
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
    function campaignDefinitionFromItem(item) {
        return {
            name: item.name.trim(),
            category: item.category,
            stackable: item.stackable,
            description: item.description.trim(),
            weight: item.weight.trim(),
            value: item.value.trim(),
            defaultQuantity: Math.max(1, item.quantity),
            defaultSlot: item.slot,
            attackAttribute: item.attackAttribute,
            damageFormula: item.damageFormula.trim(),
            protectionFormula: item.protectionFormula.trim(),
            qualities: formatWeaponQualities(parseWeaponQualities(item.qualities)),
            notes: item.notes.trim(),
            grantedActions: item.grantedActions,
            modifiers: item.modifiers
        };
    }
    async function persistCampaignEditorItem(item, isUnique) {
        try {
            setInventoryMutationError(null);
            if (item.campaignItemId && onUpdateCampaignItem) {
                const existing = campaignItemsById.get(item.campaignItemId);
                await onUpdateCampaignItem(item.campaignItemId, {
                    definition: campaignDefinitionFromItem(item),
                    isUnique,
                    ownerType: existing?.ownerType ?? undefined,
                    ownerId: existing?.ownerId ?? undefined
                });
                return true;
            }
            if (onCreateCampaignItem) {
                await onCreateCampaignItem({
                    definition: campaignDefinitionFromItem(item),
                    isUnique,
                    assignToType: campaignCharacterLinkId ? "character" : undefined,
                    assignToId: campaignCharacterLinkId
                });
                return true;
            }
            return false;
        }
        catch (error) {
            setInventoryMutationError(error instanceof Error ? error.message : "No se pudo guardar el objeto de campaña.");
            return false;
        }
    }
    async function saveWeaponEditorModal() {
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
        if (canManageCampaignItems) {
            if (await persistCampaignEditorItem(nextItem, Boolean(weaponEditorModal.isUnique)))
                setWeaponEditorModal(null);
            return;
        }
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
    async function saveArmorEditorModal() {
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
        if (canManageCampaignItems) {
            if (await persistCampaignEditorItem(nextItem, Boolean(armorEditorModal.isUnique)))
                setArmorEditorModal(null);
            return;
        }
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
    async function saveItemEditorModal() {
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
        if (canManageCampaignItems) {
            if (await persistCampaignEditorItem(nextItem, Boolean(itemEditorModal.isUnique)))
                setItemEditorModal(null);
            return;
        }
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
        const template = availableItemCatalog.find((entry) => entry.templateId === selectedCatalogItemId);
        if (!template)
            return;
        if (template.campaignItemId && campaignItemsById.get(template.campaignItemId)?.isUnique)
            return;
        setDraft({
            ...draft,
            inventoryItems: [...draft.inventoryItems, createInventoryItemFromTemplate(template)]
        });
    }
    function openInventoryCatalogModal(tab) {
        const filteredItems = availableItemCatalog.filter((item) => {
            if (tab === "weapons")
                return item.category === "weapon";
            if (tab === "armors")
                return item.category === "armor";
            return item.category !== "weapon" && item.category !== "armor";
        });
        setSelectedWeaponCatalogFilter("all");
        setWeaponCatalogSearch("");
        setSelectedArmorCatalogFilter("all");
        setArmorCatalogSearch("");
        setSelectedItemCatalogFilter("all");
        setItemCatalogSearch("");
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
    function setEquippedArmor(index) {
        const armor = draft.inventoryItems[index];
        if (!armor || armor.category !== "armor")
            return;
        const nextArmorId = draft.equipmentSlots.armor === armor.id ? "" : armor.id;
        setDraft({
            ...draft,
            equipmentSlots: {
                ...draft.equipmentSlots,
                armor: nextArmorId
            }
        });
    }
    function toggleFavoriteAction(actionId) {
        if (!editable) {
            return;
        }
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
        const isEquippedArmor = item.category === "armor" && normalizedSheet.equipmentSlots.armor === item.id;
        return (_jsxs("article", { className: `campaign-structured-card${appCardCategoryClass(item.category)}${(isInventoryCombatItem || isManagedInventoryItem) ? " is-clickable-card" : ""}`, onClick: item.category === "weapon" ? () => openInventoryWeaponDetail(item) : item.category === "armor" ? () => openInventoryArmorDetail(item) : () => openManagedInventoryItemDetail(item), onKeyDown: (isInventoryCombatItem || isManagedInventoryItem) ? (event) => {
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
            } : undefined, role: (isInventoryCombatItem || isManagedInventoryItem) ? "button" : undefined, tabIndex: (isInventoryCombatItem || isManagedInventoryItem) ? 0 : undefined, children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: item.name || "Objeto sin nombre" }), (isInventoryCombatItem || item.qualities) ? (_jsxs("div", { className: "unified-sheet-weapon-list-summary", children: [_jsx("p", { className: "meta-text", children: item.qualities || (item.category === "artifact" ? "Mistico" : item.category === "consumable" ? "Consumible" : item.category === "treasure" ? "Valioso" : "Equipo") }), ammoInfo ? _jsxs("p", { className: "meta-text", children: [ammoInfo.label, ": ", ammoInfo.quantity] }) : null, isEquippedArmor ? _jsx("p", { className: "meta-text", children: "Equipada" }) : null] })) : (_jsxs("p", { className: "meta-text", children: [item.category === "armor" ? "Armadura" : "Objeto", item.equipped ? " · equipado" : "", item.slot !== "none" ? ` · ${slotLabel(item.slot)}` : ""] }))] }), _jsxs("div", { className: `unified-sheet-quantity-controls${(isInventoryCombatItem || isManagedInventoryItem) ? " is-weapon-summary" : ""}`, children: [item.category === "weapon" && item.damageFormula ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.damageFormula }) : null, item.category === "armor" && item.protectionFormula ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.protectionFormula }) : null, isManagedInventoryItem && !stackable && item.value ? _jsx("span", { className: "unified-sheet-weapon-list-damage", children: item.value }) : null, stackable ? _jsxs("span", { className: "info-chip", children: ["x", item.quantity] }) : null, canEditInventory && item.category === "armor" ? (_jsx("button", { type: "button", className: `subtle-button${isEquippedArmor ? " is-active" : ""}`, onClick: (event) => {
                                        event.stopPropagation();
                                        setEquippedArmor(index);
                                    }, children: isEquippedArmor ? "Equipada" : "Equipar" })) : null, canEditInventory && stackable ? (_jsxs("div", { className: "unified-sheet-stack-controls", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: (event) => {
                                                event.stopPropagation();
                                                changeInventoryQuantity(index, 1);
                                            }, children: "+" }), _jsx("button", { type: "button", className: "subtle-button", onClick: (event) => {
                                                event.stopPropagation();
                                                changeInventoryQuantity(index, -1);
                                            }, children: "-" })] })) : null] })] }), _jsxs("div", { className: "unified-sheet-item-readonly-grid", children: [(item.attackAttribute || item.damageFormula || item.protectionFormula) && !isInventoryCombatItem && !isManagedInventoryItem ? (_jsxs("div", { className: "info-box", children: [item.attackAttribute ? _jsxs("span", { children: ["Ataque: ", ATTRIBUTE_LABELS[item.attackAttribute]] }) : null, item.damageFormula ? _jsxs("span", { children: ["Da\u00F1o: ", item.damageFormula] }) : null, item.protectionFormula ? _jsxs("span", { children: ["Proteccion: ", item.protectionFormula] }) : null] })) : null, (item.weight || item.value) && !isInventoryCombatItem && !isManagedInventoryItem ? (_jsxs("div", { className: "info-box", children: [item.weight ? _jsxs("span", { children: ["Peso: ", item.weight] }) : null, item.value ? _jsxs("span", { children: ["Valor: ", item.value] }) : null] })) : null, item.qualities && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Cualidades: ", item.qualities] }) }) : null, item.modifiers.length > 0 ? (_jsx("div", { className: "info-box", children: _jsxs("span", { children: ["Modificadores: ", item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")] }) })) : null, item.managedArtifactId ? (_jsxs("div", { className: "info-box", children: [_jsx("span", { children: item.artifactBound ? "Vinculado" : `Sin vincular${item.artifactBindingCostLabel ? ` · ${item.artifactBindingCostLabel}` : ""}` }), (item.artifactResources ?? []).map((resource) => _jsxs("span", { children: [resource.name, ": ", resource.current, "/", resource.maximum] }, resource.id))] })) : null] }), item.description && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("p", { className: "unified-sheet-rich-text", children: item.description }) : null, item.notes && !isInventoryCombatItem && !isManagedInventoryItem ? _jsx("p", { className: "unified-sheet-capability-notes", children: item.notes }) : null] }, item.id));
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
    function toggleDefinedCondition(definition) {
        if (!editable || busy || isSavingLocal) {
            return;
        }
        const conditionIndex = draft.conditions.findIndex((condition) => matchesConditionDefinition(condition, definition));
        if (conditionIndex >= 0) {
            setDraft({
                ...draft,
                conditions: draft.conditions.map((condition, index) => (index === conditionIndex ? { ...condition, active: !condition.active } : condition))
            });
            return;
        }
        setDraft({
            ...draft,
            conditions: [
                ...draft.conditions,
                {
                    id: definition.id,
                    name: definition.name,
                    category: definition.category,
                    active: true,
                    severity: "minor",
                    summary: "",
                    notes: ""
                }
            ]
        });
    }
    function toggleStoredCondition(conditionId) {
        if (!editable || busy || isSavingLocal) {
            return;
        }
        setDraft({
            ...draft,
            conditions: draft.conditions.map((condition) => (condition.id === conditionId ? { ...condition, active: !condition.active } : condition))
        });
    }
    function adjustNumber(path, delta, min = 0) {
        if (!editable) {
            return;
        }
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
    function spendExperienceForReroll() {
        if (!editable || experience.effectiveAvailable < 1) {
            setIsExperienceRerollConfirmationOpen(false);
            return;
        }
        setDraft({
            ...normalizedSheet,
            progreso: {
                ...normalizedSheet.progreso,
                experienciaGastada: displayedSpentExperience + 1,
                gastosExperiencia: [
                    ...normalizedSheet.progreso.gastosExperiencia,
                    {
                        id: globalThis.crypto?.randomUUID?.() ?? `xp-reroll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        tipo: "repeticion_tirada",
                        cantidad: 1,
                        fecha: new Date().toISOString()
                    }
                ]
            }
        });
        setIsExperienceRerollConfirmationOpen(false);
    }
    function spendExperienceForFeat() {
        if (!pendingFeatExpense || !editable || experience.effectiveAvailable < 1) {
            setPendingFeatExpense(null);
            return;
        }
        setDraft({
            ...normalizedSheet,
            progreso: {
                ...normalizedSheet.progreso,
                experienciaGastada: displayedSpentExperience + 1,
                gastosExperiencia: [
                    ...normalizedSheet.progreso.gastosExperiencia,
                    {
                        id: globalThis.crypto?.randomUUID?.() ?? `xp-feat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        tipo: "hazana",
                        cantidad: 1,
                        fecha: new Date().toISOString(),
                        motivo: pendingFeatExpense.label
                    }
                ]
            }
        });
        setPendingFeatExpense(null);
    }
    function renderActionRollControls(action, allowRoll = true) {
        const presentation = getCharacterActionRollPresentation(action, normalizedSheet);
        const hasOptionalModifiers = presentation.hasDamageModifiers
            || getCheckRollModifiers(action, undefined, normalizedSheet).length > 0;
        return (_jsxs("div", { className: "campaign-action-rolls", children: [presentation.attackFormula ? (allowRoll ? (_jsxs("button", { type: "button", className: "campaign-action-roll-button", onClick: () => runAttackAction(action), children: [_jsx("span", { children: getActionRollLabel(action) }), _jsx("strong", { children: presentation.attackFormula })] })) : (_jsxs("span", { className: "campaign-action-roll-readonly", children: [_jsx("span", { children: getActionRollLabel(action) }), _jsx("strong", { children: presentation.attackFormula })] }))) : null, presentation.damageFormula ? (allowRoll ? (_jsxs("button", { type: "button", className: "campaign-action-roll-button is-damage", onClick: () => runDamageAction(action), children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("strong", { children: presentation.damageFormula })] })) : (_jsxs("span", { className: "campaign-action-roll-readonly is-damage", children: [_jsx("span", { children: "Da\u00F1o" }), _jsx("strong", { children: presentation.damageFormula })] }))) : null, !presentation.hasRoll ? (allowRoll && action.sourceType === "artifact" ? (_jsxs("button", { type: "button", className: "campaign-action-roll-button", onClick: () => void activateArtifactAction(action), children: [_jsx("span", { children: "Activar" }), _jsx("strong", { children: "Sin tirada" })] })) : _jsx("span", { className: "campaign-action-no-roll", children: "Sin tirada" })) : null, hasOptionalModifiers ? _jsx("span", { className: "campaign-action-modifier-notice", children: "Modificadores disponibles" }) : null] }));
    }
    function renderTabStage(tabs, stageActiveTab, onTabChange, navigationLabel, className = "unified-sheet-stage campaign-sheet-card") {
        const hasStageSubtabs = stageActiveTab === "actions" || stageActiveTab === "inventory" || stageActiveTab === "abilities";
        return (_jsxs("section", { className: `${className}${hasStageSubtabs ? " has-stage-subtabs" : ""}`, children: [_jsx("nav", { className: "unified-sheet-tabs", "aria-label": navigationLabel, children: tabs.map(([tab, label]) => (_jsx("button", { type: "button", className: stageActiveTab === tab ? "is-active" : "", onClick: () => onTabChange(tab), children: label }, tab))) }), stageActiveTab === "actions" ? (_jsx("nav", { className: "unified-sheet-subtabs unified-sheet-action-subtabs unified-sheet-stage-subtabs is-actions", "aria-label": "Filtros de acciones", onWheel: handleHorizontalActionTabWheel, onKeyDown: handleActionTabKeyDown, children: [
                        ["all", "Todas"],
                        ["favorites", "Favoritas"],
                        ["attacks", "Ataques"],
                        ["combat", "Acciones de combate"],
                        ["movement", "Acciones de movimiento"],
                        ["free", "Acciones gratuitas"],
                        ["reactions", "Reacciones"],
                        ["powers", "Poderes y rituales"],
                        ["artifacts", "Artefactos"],
                        ["feats", "Hazañas"],
                        ["maneuvers", "Maniobras de combate"],
                        ["special", "Acciones especiales"],
                        ["other", "Otras"]
                    ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeActionTab === tab ? "is-active" : "", onClick: () => setActiveActionTab(tab), children: label }, tab))) })) : null, stageActiveTab === "inventory" ? (_jsx("nav", { className: "unified-sheet-subtabs unified-sheet-stage-subtabs is-inventory", "aria-label": "Secciones del inventario", children: [
                        ["money", "Dinero"],
                        ["weapons", "Armas"],
                        ["armors", "Armaduras"],
                        ["artifacts", "Artefactos"],
                        ["items", "Objetos"]
                    ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeInventoryTab === tab ? "is-active" : "", onClick: () => setActiveInventoryTab(tab), children: label }, tab))) })) : null, stageActiveTab === "abilities" ? (_jsx("nav", { className: "unified-sheet-subtabs unified-sheet-stage-subtabs is-abilities", "aria-label": "Tipos de capacidades", children: [
                        ["traits", "Rasgos"],
                        ["blessings", "Bendiciones"],
                        ["burdens", "Cargas"],
                        ["abilities", "Habilidades"],
                        ["powers", "Poderes"],
                        ["rituals", "Rituales"]
                    ].map(([tab, label]) => (_jsx("button", { type: "button", className: activeCapabilityTab === tab ? "is-active" : "", onClick: () => setActiveCapabilityTab(tab), children: label }, tab))) })) : null, _jsxs("div", { className: "unified-sheet-tab-content", role: "region", "aria-label": `${navigationLabel}: contenido`, tabIndex: 0, children: [stageActiveTab === "actions" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions unified-sheet-actions-heading", children: _jsx("h3", { children: "Acciones disponibles" }) }), artifactUseError ? _jsx("p", { className: "error-text", children: artifactUseError }) : null, _jsxs("div", { className: "campaign-sheet-actions", children: [filteredActions.map((action) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row", children: [_jsxs("div", { className: "campaign-action-main", children: [_jsxs("div", { className: "campaign-action-title-row", children: [_jsx("button", { type: "button", className: `campaign-action-favorite-toggle${favoriteActionIds.has(action.id) ? " is-active" : ""}`, onClick: () => toggleFavoriteAction(action.id), "aria-label": favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", title: favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas", children: "\u2605" }), _jsx("button", { type: "button", className: "campaign-action-name-button", onClick: () => openActionDetail(action), children: formatActionDisplayLabel(action.label) })] }), _jsx("span", { className: "campaign-action-source-note", children: getActionSourceLabel(action) })] }), renderActionRollControls(action)] }, action.id))), filteredInformationalActions.map((entry) => (_jsxs("div", { className: "campaign-action-button campaign-action-button--row is-informational", children: [_jsxs("div", { className: "campaign-action-main", children: [_jsxs("div", { className: "campaign-action-title-row", children: [_jsx("button", { type: "button", className: `campaign-action-favorite-toggle${favoriteActionIds.has(entry.id) ? " is-active" : ""}`, onClick: () => toggleFavoriteAction(entry.id), "aria-label": favoriteActionIds.has(entry.id) ? "Quitar de favoritas" : "Guardar en favoritas", title: favoriteActionIds.has(entry.id) ? "Quitar de favoritas" : "Guardar en favoritas", children: "\u2605" }), _jsx("button", { type: "button", className: "campaign-action-name-button", onClick: () => openInformationalActionDetail(entry), children: entry.label })] }), _jsxs("span", { className: "campaign-action-source-note", children: [entry.familyLabel, entry.optional ? " · Regla opcional" : ""] })] }), _jsxs("div", { className: "campaign-action-information", children: [_jsx("span", { className: "compendium-chip", children: "Ver detalles" }), editable && entry.categories.includes("feats") ? (_jsx("button", { type: "button", className: "vital-action loss campaign-action-feat-expense", "aria-label": `Gastar 1 PX en ${entry.label}`, title: `Gastar 1 PX para realizar ${entry.label}`, disabled: experience.effectiveAvailable < 1 || busy || isSavingLocal, onClick: () => setPendingFeatExpense(entry), children: "Gastar 1 PX" })) : null] })] }, entry.id))), filteredActions.length === 0 && filteredInformationalActions.length === 0
                                                ? _jsx("p", { className: "section-help", children: "Sin acciones registradas en esta categor\u00EDa." })
                                                : null] }), _jsxs("div", { className: "unified-sheet-action-history", "aria-live": "polite", children: [_jsx("h4", { children: "Historial de acciones" }), history.length > 0 ? (_jsx("div", { className: "roll-log", children: history.map((entry, index) => (_jsxs("div", { className: "character-action-history-entry", children: [_jsx("strong", { children: entry.title }), entry.rolls.map((roll, rollIndex) => (_jsxs("span", { children: [roll.label, ": ", roll.formula, " = ", roll.total, roll.success == null ? "" : roll.success ? " · Éxito" : " · Fallo"] }, `${roll.kind}-${rollIndex}`))), entry.detail ? _jsx("p", { children: entry.detail }) : null] }, `${entry.title}-${index}`))) })) : (_jsx("p", { className: "section-help", children: "A\u00FAn no hay acciones resueltas desde esta hoja." }))] })] }) })) : null, stageActiveTab === "inventory" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Inventario y equipo" }) }), activeInventoryTab === "money" ? (_jsx("div", { className: "unified-sheet-money-grid", children: [
                                            ["taleros", "Taleros"],
                                            ["chelines", "Chelines"],
                                            ["ortegs", "Ortegs"]
                                        ].map(([key, label]) => (_jsxs("article", { className: "campaign-structured-card unified-sheet-money-card", children: [_jsx("strong", { children: label }), _jsxs("div", { className: "unified-sheet-money-control-row", children: [canEditInventory ? (_jsx("button", { type: "button", className: "subtle-button unified-sheet-money-button", "aria-label": `Restar ${label}`, onClick: () => changeMoneyCounter(key, -1), children: "\u2212" })) : null, _jsx("div", { className: `unified-sheet-money-coin is-${key}`, "aria-hidden": "true", children: _jsx("span", { children: key === "taleros" ? "T" : key === "chelines" ? "C" : "O" }) }), canEditInventory ? (_jsx("button", { type: "button", className: "subtle-button unified-sheet-money-button", "aria-label": `Sumar ${label}`, onClick: () => changeMoneyCounter(key, 1), children: "+" })) : null] }), _jsxs("span", { className: "unified-sheet-money-amount", children: ["x", moneyCounters[key]] })] }, key))) })) : null, activeInventoryTab === "weapons" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armas" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [canManageCampaignItems ? _jsx("button", { type: "button", className: "subtle-button", onClick: addCustomWeapon, children: "Arma personalizada" }) : null, _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("weapons"), children: "Agregar arma" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.weapons.length > 0
                                                    ? inventorySections.weapons.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armas registradas." }) })] })) : null, activeInventoryTab === "armors" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Armaduras" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [canManageCampaignItems ? _jsx("button", { type: "button", className: "subtle-button", onClick: addCustomArmor, children: "Armadura personalizada" }) : null, _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("armors"), children: "Agregar armadura" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.armors.length > 0
                                                    ? inventorySections.armors.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin armaduras registradas." }) })] })) : null, activeInventoryTab === "items" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Objetos" }), canEditInventory ? (_jsxs("div", { className: "toolbar", children: [canManageCampaignItems ? _jsx("button", { type: "button", className: "subtle-button", onClick: addCustomItemModal, children: "Objeto personalizado" }) : null, _jsx("button", { type: "button", onClick: () => openInventoryCatalogModal("items"), children: "Agregar objeto" })] })) : null] }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.items.length > 0
                                                    ? inventorySections.items.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "Sin otros objetos registrados." }) })] })) : null, activeInventoryTab === "artifacts" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Artefactos misticos" }) }), _jsx("div", { className: "unified-sheet-list", children: inventorySections.artifacts.length > 0
                                                    ? inventorySections.artifacts.map(({ item, index }) => renderInventoryItemEditor(item, index))
                                                    : _jsx("p", { className: "section-help", children: "El DJ todavia no ha entregado artefactos a este personaje." }) })] })) : null] }) })) : null, stageActiveTab === "abilities" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [professionMemberships.length > 0 ? (_jsxs("section", { className: "sheet-profession-summary", children: [_jsx("h3", { children: "Profesiones avanzadas" }), _jsx("div", { className: "toolbar", children: professionMemberships.map((membership) => (_jsxs("span", { className: `profession-state profession-state--${membership.effectiveState}`, children: [membership.professionName, ": ", membership.effectiveState === "active" ? "Activa" : membership.effectiveState === "suspended" ? "Suspendida" : membership.effectiveState === "pending" ? "Pendiente" : membership.effectiveState === "rejected" ? "Rechazada" : "Objetivo"] }, membership.id))) }), professionMemberships.some((membership) => membership.effectiveState === "suspended") ? _jsx("p", { className: "section-help", children: "Los beneficios de profesiones suspendidas se conservan, pero sus acciones y modificadores quedan inactivos." }) : null] })) : null, activeCapabilityTab === "traits" ? (_jsx(SimpleStringList, { title: "Rasgos", entries: normalizedSheet.rasgos, emptyText: "Sin rasgos registrados.", categoryKey: "rasgo" })) : null, activeCapabilityTab === "blessings" ? (_jsx(SimpleStringList, { title: "Bendiciones", entries: normalizedSheet.bendiciones, emptyText: "Sin bendiciones registradas.", categoryKey: "bendicion", onOpenDetail: (entry) => openSimpleCompendiumDetail("bendicion", "Bendicion", entry) })) : null, activeCapabilityTab === "burdens" ? (_jsx(SimpleStringList, { title: "Cargas", entries: normalizedSheet.cargas, emptyText: "Sin cargas registradas.", categoryKey: "carga", onOpenDetail: (entry) => openSimpleCompendiumDetail("carga", "Carga", entry) })) : null, activeCapabilityTab === "abilities" ? (_jsx(CapabilityTextList, { title: "Habilidades", entries: normalizedSheet.habilidades, categoryKey: "habilidad", onOpenDetail: (entry) => openCapabilityDetail("habilidad", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined })) : null, activeCapabilityTab === "powers" ? (_jsx(CapabilityTextList, { title: "Poderes misticos", entries: normalizedSheet.poderesMisticos, categoryKey: "poder_mistico", onOpenDetail: (entry) => openCapabilityDetail("poder_mistico", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined })) : null, activeCapabilityTab === "rituals" ? (_jsx(CapabilityTextList, { title: "Rituales", entries: normalizedSheet.rituales, categoryKey: "ritual", onOpenDetail: (entry) => openCapabilityDetail("ritual", entry), onOpenCompendium: onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined })) : null] }) })) : null, stageActiveTab === "background" ? (_jsx("section", { className: "unified-sheet-panel", children: _jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions unified-sheet-section-heading", children: [_jsx("h3", { children: "Trasfondo" }), editable ? (isEditingBackground ? (_jsx("button", { type: "button", disabled: isSavingLocal, onClick: () => void save().finally(() => setIsEditingBackground(false)), children: isSavingLocal ? "Guardando..." : "Guardar" })) : _jsx("button", { type: "button", "aria-label": "Editar trasfondo", onClick: () => setIsEditingBackground(true), children: "Editar" })) : null] }), isEditingBackground ? (_jsxs("div", { className: "unified-sheet-section-editor", children: [_jsxs("div", { className: "form-grid unified-sheet-background-meta-grid", children: [_jsx(Field, { label: "Sombra", children: _jsx("input", { value: normalizedSheet.identidad.sombra, onChange: (event) => updateField("identidad.sombra", event.target.value) }) }), _jsx(Field, { label: "Cita", children: _jsx("input", { value: normalizedSheet.identidad.cita, onChange: (event) => updateField("identidad.cita", event.target.value) }) }), _jsx(Field, { label: "Edad", children: _jsx("input", { value: normalizedSheet.identidad.edad, onChange: (event) => updateField("identidad.edad", event.target.value) }) }), _jsx(Field, { label: "Altura", children: _jsx("input", { value: normalizedSheet.identidad.altura, onChange: (event) => updateField("identidad.altura", event.target.value) }) }), _jsx(Field, { label: "Peso", children: _jsx("input", { value: normalizedSheet.identidad.peso, onChange: (event) => updateField("identidad.peso", event.target.value) }) })] }), _jsx(Field, { label: "Apariencia", children: _jsx("textarea", { rows: 2, value: normalizedSheet.identidad.apariencia, onChange: (event) => updateField("identidad.apariencia", event.target.value) }) }), _jsx(Field, { label: "Objetivo personal", children: _jsx("textarea", { rows: 2, value: normalizedSheet.identidad.objetivoPersonal, onChange: (event) => updateField("identidad.objetivoPersonal", event.target.value) }) }), _jsx(Field, { label: "Historia (Markdown)", children: _jsx("textarea", { rows: 12, value: normalizedSheet.noteSections.background, onChange: (event) => updateField("noteSections.background", event.target.value) }) })] })) : (_jsxs("div", { className: "unified-sheet-read-view", children: [_jsx("dl", { className: "unified-sheet-read-meta unified-sheet-background-meta-grid", children: [["Sombra", normalizedSheet.identidad.sombra], ["Cita", normalizedSheet.identidad.cita], ["Edad", normalizedSheet.identidad.edad], ["Altura", normalizedSheet.identidad.altura], ["Peso", normalizedSheet.identidad.peso]].map(([label, value]) => (_jsxs("div", { children: [_jsx("dt", { children: label }), _jsx("dd", { children: value || "Sin especificar" })] }, label))) }), _jsxs("section", { className: "unified-sheet-read-section", children: [_jsx("h4", { children: "Apariencia" }), _jsx("p", { children: normalizedSheet.identidad.apariencia || "Sin apariencia registrada." })] }), _jsxs("section", { className: "unified-sheet-read-section", children: [_jsx("h4", { children: "Objetivo personal" }), _jsx("p", { children: normalizedSheet.identidad.objetivoPersonal || "Sin objetivo personal registrado." })] }), collapsibleHistory ? (_jsxs("details", { className: "unified-sheet-read-section narrative-collapsible-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: "Historia" }), _jsx("small", { children: "Mostrar u ocultar" })] }), _jsx("div", { className: "narrative-collapsible-content campaign-markdown unified-sheet-history-markdown", children: renderSimpleMarkdownBlocks(normalizedSheet.noteSections.background || "Sin historia registrada.") })] })) : (_jsxs("section", { className: "unified-sheet-read-section", children: [_jsx("h4", { children: "Historia" }), _jsx("div", { className: "campaign-markdown unified-sheet-history-markdown", children: renderSimpleMarkdownBlocks(normalizedSheet.noteSections.background || "Sin historia registrada.") })] }))] }))] }) })) : null, stageActiveTab === "notes" ? (_jsxs("section", { className: "unified-sheet-panel", children: [_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Notas personales" }), _jsx("p", { className: "section-help", children: "Entradas ordenadas en Markdown para diario, pistas, recuerdos y apuntes de campa\u00F1a del personaje." })] }), editable ? (_jsx("div", { className: "toolbar", children: isEditingNotes ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                                    setPersonalNoteError(null);
                                                                    setPersonalNoteEditor({ mode: "create", note: buildPersonalNoteDraft() });
                                                                }, children: "Nueva nota" }), _jsx("button", { type: "button", disabled: isSavingLocal, onClick: () => void save().finally(() => setIsEditingNotes(false)), children: isSavingLocal ? "Guardando..." : "Guardar" })] })) : _jsx("button", { type: "button", "aria-label": "Editar notas del personaje", onClick: () => setIsEditingNotes(true), children: "Editar" }) })) : null] }), _jsxs("div", { className: "unified-sheet-list", children: [personalNotes.map((entry) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("strong", { children: entry.title }), _jsx("p", { className: "section-help", children: summarizeCharacterNote(entry.content) })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => {
                                                                    setPersonalNoteError(null);
                                                                    setSelectedPersonalNoteId(entry.id);
                                                                }, children: "Ver nota" })] }) }, entry.id))), personalNotes.length === 0 ? _jsx("p", { className: "section-help", children: "Sin notas personales registradas." }) : null] })] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contexto" }), isEditingNotes ? (_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Grupo", children: _jsx("input", { value: normalizedSheet.grupo.nombre, onChange: (event) => updateField("grupo.nombre", event.target.value) }) }), _jsx(Field, { label: "Objetivo del grupo", children: _jsx("textarea", { rows: 2, value: normalizedSheet.grupo.objetivo, onChange: (event) => updateField("grupo.objetivo", event.target.value) }) })] })) : (_jsxs("dl", { className: "unified-sheet-read-meta is-two-columns", children: [_jsxs("div", { children: [_jsx("dt", { children: "Grupo" }), _jsx("dd", { children: normalizedSheet.grupo.nombre || "Sin grupo registrado." })] }), _jsxs("div", { children: [_jsx("dt", { children: "Objetivo del grupo" }), _jsx("dd", { children: normalizedSheet.grupo.objetivo || "Sin objetivo de grupo registrado." })] })] }))] }), _jsxs("article", { className: "campaign-sheet-card", children: [_jsx("h3", { children: "Contactos" }), isEditingNotes ? (_jsx("div", { className: "unified-sheet-list", children: normalizedSheet.contactosHoja.map((contacto, index) => (_jsx("article", { className: "campaign-structured-card", children: _jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: contacto.nombre, onChange: (event) => updateField(`contactosHoja.${index}.nombre`, event.target.value) }) }), _jsx(Field, { label: "Raza", children: _jsx("input", { value: contacto.raza, onChange: (event) => updateField(`contactosHoja.${index}.raza`, event.target.value) }) }), _jsx(Field, { label: "Ocupacion", children: _jsx("input", { value: contacto.ocupacion, onChange: (event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value) }) }), _jsx(Field, { label: "Jugador", children: _jsx("input", { value: contacto.jugador, onChange: (event) => updateField(`contactosHoja.${index}.jugador`, event.target.value) }) })] }) }, `contacto-${index}`))) })) : (_jsx("div", { className: "unified-sheet-contact-list", children: normalizedSheet.contactosHoja.some((contacto) => Object.values(contacto).some((value) => value.trim())) ? normalizedSheet.contactosHoja.map((contacto, index) => (Object.values(contacto).some((value) => value.trim()) ? (_jsxs("article", { className: "campaign-structured-card unified-sheet-contact-card", children: [_jsx("strong", { children: contacto.nombre || "Contacto sin nombre" }), _jsxs("dl", { className: "unified-sheet-read-meta is-contact", children: [_jsxs("div", { children: [_jsx("dt", { children: "Raza" }), _jsx("dd", { children: contacto.raza || "Sin especificar" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Ocupacion" }), _jsx("dd", { children: contacto.ocupacion || "Sin especificar" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Jugador" }), _jsx("dd", { children: contacto.jugador || "Sin especificar" })] })] })] }, `contacto-${index}`)) : null)) : _jsx("p", { className: "section-help", children: "Sin contactos registrados." }) }))] })] })) : null] })] }));
    }
    return (_jsxs("div", { className: `unified-sheet is-tab-${activeMechanicalTab} is-mobile-tab-${mobileActiveTab}`, children: [_jsx("nav", { ref: mobileTabsRef, className: "unified-sheet-mobile-tabs", "aria-label": "Secciones de la ficha", children: [
                    ["attributes", "Atributos"],
                    ["actions", "Acciones"],
                    ["inventory", "Inventario"],
                    ["abilities", "Capacidades"],
                    ["background", "Trasfondo"],
                    ["notes", "Notas"]
                ].map(([tab, label]) => (_jsx("button", { type: "button", className: mobileActiveTab === tab ? "is-active" : "", "aria-current": mobileActiveTab === tab ? "page" : undefined, onClick: (event) => handleMobileTabChange(tab, event.currentTarget), children: label }, tab))) }), _jsxs("div", { className: "unified-sheet-top-grid", children: [_jsx("section", { className: "unified-sheet-module unified-sheet-identity-module campaign-sheet-card", "aria-label": "Identidad del personaje", children: _jsx("div", { className: "unified-sheet-hero-main", children: _jsxs("div", { className: "unified-sheet-identity", children: [_jsx("h2", { className: "unified-sheet-title", children: displayName }), subtitle ? _jsx("span", { className: "unified-sheet-inline-subtitle", children: subtitle }) : null] }) }) }), _jsxs("section", { className: "unified-sheet-module unified-sheet-resources-module campaign-sheet-card", "aria-labelledby": "unified-sheet-resources-title", children: [_jsx("h2", { id: "unified-sheet-resources-title", className: "unified-sheet-module-title", children: "Recursos" }), _jsxs("div", { className: "unified-sheet-header-stats", children: [_jsxs("div", { className: "unified-sheet-vital-card is-health", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Robustez" }), _jsxs("strong", { children: [derived.robustezActualTotal, " / ", derived.robustezMaximaTotal] })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` } }) }), editable ? (_jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action loss", onClick: () => adjustNumber("combate.robustezActual", -1), children: "-1 Da\u00F1o" }), _jsx("button", { type: "button", className: "vital-action gain", onClick: () => adjustNumber("combate.robustezActual", 1), children: "+1 Vida" })] })) : null] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion temporal" }), _jsx("strong", { children: normalizedSheet.corrupcion.temporal })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), editable ? (_jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action recovery", "aria-label": "Limpiar toda la Corrupcion temporal", disabled: normalizedSheet.corrupcion.temporal < 1 || busy || isSavingLocal, onClick: () => updateField("corrupcion.temporal", 0), children: "Limpiar" }), _jsx("button", { type: "button", className: "vital-action corruption", onClick: () => adjustNumber("corrupcion.temporal", 1), children: "+1 Temp" })] })) : null] }), _jsxs("div", { className: "unified-sheet-vital-card is-corruption-deep", children: [_jsxs("div", { className: "unified-sheet-vital-header", children: [_jsx("span", { children: "Corrupcion permanente" }), _jsx("strong", { children: normalizedSheet.corrupcion.permanente })] }), _jsx("div", { className: "unified-sheet-vital-track", children: _jsx("div", { style: { width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` } }) }), editable ? (_jsxs("div", { className: "unified-sheet-vital-actions", children: [_jsx("button", { type: "button", className: "vital-action recovery", onClick: () => adjustNumber("corrupcion.permanente", -1), children: "-1 Perm" }), _jsx("button", { type: "button", className: "vital-action corruption-deep", "aria-label": "Sumar 1 de Corrupcion permanente", onClick: () => adjustNumber("corrupcion.permanente", 1), children: "+1 Perm" })] })) : null] })] })] }), _jsxs("section", { className: "unified-sheet-module unified-sheet-experience-module unified-sheet-xp-card campaign-sheet-card", "aria-labelledby": "unified-sheet-experience-title", children: [_jsxs("div", { className: "unified-sheet-experience-heading", children: [_jsx("h2", { id: "unified-sheet-experience-title", className: "unified-sheet-module-title", children: "Experiencia" }), editable && onOpenBuilder ? (_jsx("button", { type: "button", className: "unified-sheet-builder-launch unified-sheet-builder-icon", "aria-label": "Constructor", title: "Abrir constructor", onClick: onOpenBuilder, children: _jsx("span", { "aria-hidden": "true", children: "\u2692" }) })) : null] }), _jsxs("div", { className: "unified-sheet-xp-row", children: [_jsx("span", { children: "PX total" }), _jsx("strong", { children: normalizedSheet.progreso.experienciaTotal })] }), _jsxs("div", { className: "unified-sheet-xp-row is-reroll", children: [_jsx("span", { children: "PX disponible" }), _jsxs("div", { className: "unified-sheet-xp-controls", children: [_jsx("strong", { children: experience.effectiveAvailable }), editable ? (_jsxs("button", { type: "button", className: "vital-action loss unified-sheet-reroll-action", "aria-label": "Gastar 1 PX para repetir un dado", title: "Gasta 1 PX disponible y repite el dado manualmente", disabled: experience.effectiveAvailable < 1 || busy || isSavingLocal, onClick: () => setIsExperienceRerollConfirmationOpen(true), children: [_jsx("span", { "aria-hidden": "true", children: "\u21bb" }), " -1 PX"] })) : null] })] })] })] }), _jsxs("div", { className: "unified-sheet-status-grid", children: [_jsxs("section", { className: "unified-sheet-module unified-sheet-attributes-module campaign-sheet-card", "aria-labelledby": "unified-sheet-attributes-title", children: [_jsx("h2", { id: "unified-sheet-attributes-title", className: "unified-sheet-module-title", children: "Atributos" }), _jsx("div", { className: "unified-sheet-attribute-rail", children: ATTRIBUTE_KEYS.map((key) => (_jsxs("div", { className: "unified-sheet-attribute-chip", children: [_jsx("span", { children: ATTRIBUTE_LABELS[key] }), _jsx("strong", { children: normalizedSheet.atributos[key] }), isReadOnly ? null : _jsx("button", { type: "button", className: "vital-action subtle", onClick: () => runAttributeRoll(key), children: "Tirar" })] }, key))) })] }), _jsxs("section", { className: "unified-sheet-module unified-sheet-combat-module campaign-sheet-card", "aria-labelledby": "unified-sheet-combat-title", children: [_jsx("h2", { id: "unified-sheet-combat-title", className: "unified-sheet-module-title", children: "Combate" }), _jsxs("div", { className: "unified-sheet-quick-row is-combat-values", children: [_jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Iniciativa" }), _jsx("strong", { children: derived.iniciativaTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-defense-card", children: [_jsx("h3", { children: "Defensa" }), _jsx("strong", { className: "unified-sheet-combat-value", children: derived.defensaTotal }), derived.defensaArmaduraDetalle ? _jsx("p", { className: "section-help", children: derived.defensaArmaduraDetalle }) : null, isReadOnly ? null : (_jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle is-defense-roll", onClick: runDefenseRoll, children: "Tirar Defensa" }) }))] }), _jsxs("article", { className: "unified-sheet-quick-card", children: [_jsx("h3", { children: "Armadura" }), _jsx("strong", { className: "unified-sheet-combat-value", children: derived.armaduraActiva || "-" }), _jsx("strong", { children: activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Sin armadura") }), isReadOnly ? null : (_jsx("div", { className: "unified-sheet-vital-actions", children: _jsx("button", { type: "button", className: "vital-action subtle", onClick: runArmorRoll, disabled: !derived.armaduraActiva, children: "Tirar Armadura" }) }))] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de dolor" }), _jsx("strong", { children: derived.umbralDolorTotal })] }), _jsxs("article", { className: "unified-sheet-quick-card is-derived-card", children: [_jsx("h3", { children: "Umbral de corrupcion" }), _jsx("strong", { children: derived.umbralCorrupcionTotal })] })] })] }), _jsxs("section", { className: "unified-sheet-module unified-sheet-conditions-module campaign-sheet-card", "aria-labelledby": "unified-sheet-conditions-title", children: [_jsx("h2", { id: "unified-sheet-conditions-title", className: "unified-sheet-module-title", children: "Condiciones" }), _jsx("div", { className: "unified-sheet-quick-row is-conditions", children: _jsx("article", { className: "unified-sheet-quick-card is-wide", children: _jsxs("div", { className: "unified-sheet-condition-grid", children: [automaticConditions.map((condition) => (_jsx("span", { className: `unified-sheet-condition-badge is-active ${condition.id === "legacy-corruption" ? "is-tone-corruption" : "is-tone-critical"}`, title: "Condici\u00F3n activada autom\u00E1ticamente", children: condition.name }, condition.id))), CHARACTER_CONDITION_DEFINITIONS.map((definition) => {
                                                const condition = normalizedSheet.conditions.find((entry) => matchesConditionDefinition(entry, definition));
                                                const isActive = condition?.active === true;
                                                return (_jsx("button", { type: "button", className: `unified-sheet-condition-toggle is-tone-${definition.tone}${isActive ? " is-active" : ""}`, "aria-pressed": isActive, "aria-disabled": !editable || busy || isSavingLocal, title: `${isActive ? "Desactivar" : "Activar"} ${definition.name}`, tabIndex: editable ? 0 : -1, onClick: () => toggleDefinedCondition(definition), children: definition.name }, definition.id));
                                            }), additionalConditions.map((condition) => (_jsx("button", { type: "button", className: `unified-sheet-condition-toggle is-tone-${getStoredConditionTone(condition)}${condition.active ? " is-active" : ""}`, "aria-pressed": condition.active, "aria-disabled": !editable || busy || isSavingLocal, title: `${condition.active ? "Desactivar" : "Activar"} ${condition.name}`, tabIndex: editable ? 0 : -1, onClick: () => toggleStoredCondition(condition.id), children: condition.name }, condition.id)))] }) }) })] })] }), _jsxs("div", { className: "unified-sheet-workspace", children: [renderTabStage([["background", "Trasfondo"], ["notes", "Notas"]], activeNarrativeTab, (tab) => setActiveNarrativeTab(tab), "Trasfondo y notas", "unified-sheet-module unified-sheet-reader unified-sheet-reader-narrative unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card"), renderTabStage([["actions", "Acciones"], ["inventory", "Inventario"], ["abilities", "Capacidades"]], activeMechanicalTab, (tab) => setActiveMechanicalTab(tab), "Acciones, inventario y capacidades", "unified-sheet-module unified-sheet-reader unified-sheet-reader-mechanical unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card")] }), isExperienceRerollConfirmationOpen ? (_jsx("div", { className: "modal-backdrop", onClick: () => setIsExperienceRerollConfirmationOpen(false), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: "Gastar PX para repetir" }), _jsx("p", { className: "section-help", children: "Gastaras 1 PX disponible para repetir manualmente un dado. Esta PX se a\u00F1adira al gasto acumulado y no puede recuperarse." }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "destructive-button", disabled: experience.effectiveAvailable < 1 || busy || isSavingLocal, onClick: spendExperienceForReroll, children: "Gastar 1 PX" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsExperienceRerollConfirmationOpen(false), children: "Cancelar" })] })] }) })) : null, pendingFeatExpense ? (_jsx("div", { className: "modal-backdrop", onClick: () => setPendingFeatExpense(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "feat-expense-confirmation-title", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { id: "feat-expense-confirmation-title", children: "Gastar PX en una haza\u00F1a" }), _jsxs("p", { className: "section-help", children: ["Gastar\u00E1s 1 PX disponible para realizar \u00AB", pendingFeatExpense.label, "\u00BB. El gasto quedar\u00E1 registrado con su fecha y motivo y no puede recuperarse."] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "destructive-button", disabled: experience.effectiveAvailable < 1 || busy || isSavingLocal, onClick: spendExperienceForFeat, children: "Gastar 1 PX" }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPendingFeatExpense(null), children: "Cancelar" })] })] }) })) : null, selectedPersonalNote ? (_jsx("div", { className: "modal-backdrop", onClick: () => setSelectedPersonalNoteId(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: selectedPersonalNote.title }), _jsxs("p", { className: "section-help", children: ["Actualizada ", selectedPersonalNote.updatedAt || selectedPersonalNote.createdAt || "sin fecha"] }), _jsx("div", { className: "unified-sheet-action-detail-body", children: _jsx("div", { className: "campaign-markdown", children: renderSimpleMarkdownBlocks(selectedPersonalNote.content || "Sin contenido detallado.") }) }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [canEditNotes ? (_jsx("button", { type: "button", onClick: () => {
                                        setPersonalNoteError(null);
                                        setPersonalNoteEditor({ mode: "edit", note: buildPersonalNoteDraft(selectedPersonalNote) });
                                    }, children: "Editar" })) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => setSelectedPersonalNoteId(null), children: "Cerrar" })] })] }) })) : null, personalNoteEditor ? (_jsx("div", { className: "modal-backdrop", onClick: () => setPersonalNoteEditor(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: personalNoteEditor.mode === "create" ? "Nueva nota personal" : "Editar nota personal" }), _jsx("p", { className: "section-help", children: "La nota acepta Markdown y se guarda dentro de la hoja del personaje." }), personalNoteError ? _jsx("p", { className: "error-text", children: personalNoteError }) : null, _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsx("div", { className: "form-grid", children: _jsx(Field, { label: "Titulo", children: _jsx("input", { value: personalNoteEditor.note.title, onChange: (event) => setPersonalNoteEditor((current) => current ? {
                                                ...current,
                                                note: { ...current.note, title: event.target.value }
                                            } : null) }) }) }), _jsx(Field, { label: "Contenido", children: _jsx("textarea", { rows: 12, value: personalNoteEditor.note.content, onChange: (event) => setPersonalNoteEditor((current) => current ? {
                                            ...current,
                                            note: { ...current.note, content: event.target.value }
                                        } : null) }) })] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", onClick: savePersonalNote, children: "Guardar" }), personalNoteEditor.mode === "edit" ? (_jsx("button", { type: "button", className: "destructive-button", onClick: () => deletePersonalNote(personalNoteEditor.note.id), children: "Quitar" })) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => setPersonalNoteEditor(null), children: "Cerrar" })] })] }) })) : null, pendingRollConfirmation ? (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal", children: [_jsx("h3", { children: "Enviar tirada" }), _jsx("p", { className: "section-help", children: pendingRollConfirmation.title }), pendingAttackModifiers.length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de tirada" }), pendingAttackModifiers.map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
                                                ...current,
                                                selectedAttackModifierIds: event.target.checked
                                                    ? [...current.selectedAttackModifierIds, modifier.id]
                                                    : current.selectedAttackModifierIds.filter((entry) => entry !== modifier.id)
                                            } : current) }), _jsx("span", { children: modifier.label })] }, `${pendingRollConfirmation.action?.id}-${modifier.id}`))), _jsxs("p", { className: "section-help", children: ["Objetivo final: ", getPendingAttackTarget(buildPendingConfirmationRequest(pendingRollConfirmation), pendingRollConfirmation.selectedAttackModifierIds, pendingAttackModifiers) ?? "-"] })] })) : null, pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage" && getActionDamageVariants(pendingRollConfirmation.action).length > 0 ? (_jsxs("div", { className: "character-roll-confirm-modifiers", children: [_jsx("span", { children: "Modificadores de da\u00F1o" }), getActionDamageVariants(pendingRollConfirmation.action).map((modifier) => (_jsxs("label", { className: "character-roll-confirm-modifier", children: [_jsx("input", { type: "checkbox", checked: pendingRollConfirmation.selectedDamageModifierIds.includes(modifier.id), onChange: (event) => setPendingRollConfirmation((current) => current ? {
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
                                                })()) : null] })) : null, actionDetailModal.inventoryMeta.notes && actionDetailModal.inventoryMeta.notes.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-notes", children: [_jsx("h4", { children: "Notas" }), actionDetailModal.inventoryMeta.notes.map((note, index) => (_jsx("p", { className: "unified-sheet-capability-notes", children: note }, `${actionDetailModal.title}-inventory-note-${index}`)))] })) : null] })) : actionDetailModal.tiers && actionDetailModal.tiers.length > 0 ? (_jsx("div", { className: "unified-sheet-capability-tier-list", children: actionDetailModal.tiers.map((tier) => (_jsxs("section", { className: "unified-sheet-capability-tier", children: [_jsx("h4", { children: tier.label }), _jsx("p", { className: "unified-sheet-rich-text", children: tier.content })] }, `${actionDetailModal.title}-${tier.label}`))) })) : (_jsx("p", { className: "unified-sheet-rich-text", children: actionDetailModal.detail })), !actionDetailModal.inventoryMeta && actionDetailModal.notes?.map((note, index) => (_jsx("p", { className: "unified-sheet-capability-notes", children: note }, `${actionDetailModal.title}-note-${index}`))), actionDetailModal.references && actionDetailModal.references.length > 0 ? (_jsx("div", { className: "unified-sheet-capability-meta", children: actionDetailModal.references.map((reference) => (_jsx(SourceReferenceLink, { href: reference.url, source: reference.label }, reference.url))) })) : null] }), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [typeof actionDetailModal.editInventoryIndex === "number" ? (_jsx("button", { type: "button", className: "accent-button", onClick: () => {
                                        const item = normalizedSheet.inventoryItems[actionDetailModal.editInventoryIndex];
                                        if (!item)
                                            return;
                                        if (item.category === "weapon") {
                                            setWeaponEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex,
                                                isUnique: item.campaignItemId ? campaignItemsById.get(item.campaignItemId)?.isUnique : false
                                            });
                                        }
                                        else if (item.category === "armor") {
                                            setArmorEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex,
                                                isUnique: item.campaignItemId ? campaignItemsById.get(item.campaignItemId)?.isUnique : false
                                            });
                                        }
                                        else {
                                            setItemEditorModal({
                                                mode: "edit",
                                                item: { ...item },
                                                index: actionDetailModal.editInventoryIndex,
                                                isUnique: item.campaignItemId ? campaignItemsById.get(item.campaignItemId)?.isUnique : false
                                            });
                                        }
                                        setActionDetailModal(null);
                                    }, children: "Editar" })) : null, typeof actionDetailModal.removeInventoryIndex === "number" ? (_jsx("button", { type: "button", className: "destructive-button", onClick: () => {
                                        removeInventoryItem(actionDetailModal.removeInventoryIndex);
                                        setActionDetailModal(null);
                                    }, children: "Quitar" })) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => setActionDetailModal(null), children: "Cerrar" })] })] }) })) : null, weaponEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setWeaponEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: weaponEditorModal.mode === "create" ? "Arma personalizada" : "Editar arma personalizada" }), _jsx("p", { className: "section-help", children: "Configura el arma y guardala para que aparezca en el inventario como cualquier otra arma." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: weaponEditorModal.item.name, onChange: (event) => updateWeaponEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Da\u00F1o", children: _jsx("input", { value: weaponEditorModal.item.damageFormula, onChange: (event) => updateWeaponEditorItem("damageFormula", event.target.value) }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: weaponEditorModal.item.slot, onChange: (event) => updateWeaponEditorItem("slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "mainHand", children: "Mano principal" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "ranged", children: "A distancia" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 1, disabled: weaponEditorModal.isUnique, value: weaponEditorModal.isUnique ? 1 : weaponEditorModal.item.quantity, onChange: (event) => updateWeaponEditorItem("quantity", Number(event.target.value || 1)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { disabled: weaponEditorModal.isUnique, value: weaponEditorModal.isUnique ? "no" : weaponEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateWeaponEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: weaponEditorModal.item.value, onChange: (event) => updateWeaponEditorItem("value", event.target.value) }) })] }), _jsxs("label", { className: "campaign-item-unique-toggle", children: [_jsx("input", { type: "checkbox", checked: Boolean(weaponEditorModal.isUnique), onChange: (event) => setWeaponEditorModal((current) => current ? ({ ...current, isUnique: event.target.checked, item: event.target.checked ? { ...current.item, quantity: 1, stackable: false } : current.item }) : current) }), _jsxs("span", { children: [_jsx("strong", { children: "Poseedor \u00FAnico" }), _jsx("small", { children: "Pieza con nombre propio que solo el DJ puede asignar a un PJ o PNJ." })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: WEAPON_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownWeaponQualities(weaponEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleWeaponEditorQuality(quality.label), children: quality.label }, `${weaponEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomWeaponQualities(weaponEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateWeaponEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: weaponEditorModal.item.description, placeholder: "Descripcion del arma", onChange: (event) => updateWeaponEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: weaponEditorModal.item.notes, placeholder: "Notas de uso, mantenimiento o procedencia", onChange: (event) => updateWeaponEditorItem("notes", event.target.value) }) })] }), inventoryMutationError ? _jsx("p", { className: "error-text", children: inventoryMutationError }) : null, _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setWeaponEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveWeaponEditorModal, children: "Guardar" })] })] }) })) : null, armorEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setArmorEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: armorEditorModal.mode === "create" ? "Armadura personalizada" : "Editar armadura personalizada" }), _jsx("p", { className: "section-help", children: "Configura la armadura y guardala para que aparezca en el inventario como cualquier otra armadura." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: armorEditorModal.item.name, onChange: (event) => updateArmorEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Proteccion", children: _jsx("input", { value: armorEditorModal.item.protectionFormula, onChange: (event) => updateArmorEditorItem("protectionFormula", event.target.value) }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: armorEditorModal.item.slot, onChange: (event) => updateArmorEditorItem("slot", event.target.value), children: [_jsx("option", { value: "armor", children: "Armadura" }), _jsx("option", { value: "offHand", children: "Mano secundaria" }), _jsx("option", { value: "worn", children: "Llevada" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 1, disabled: armorEditorModal.isUnique, value: armorEditorModal.isUnique ? 1 : armorEditorModal.item.quantity, onChange: (event) => updateArmorEditorItem("quantity", Number(event.target.value || 1)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { disabled: armorEditorModal.isUnique, value: armorEditorModal.isUnique ? "no" : armorEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateArmorEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: armorEditorModal.item.value, onChange: (event) => updateArmorEditorItem("value", event.target.value) }) })] }), _jsxs("label", { className: "campaign-item-unique-toggle", children: [_jsx("input", { type: "checkbox", checked: Boolean(armorEditorModal.isUnique), onChange: (event) => setArmorEditorModal((current) => current ? ({ ...current, isUnique: event.target.checked, item: event.target.checked ? { ...current.item, quantity: 1, stackable: false } : current.item }) : current) }), _jsxs("span", { children: [_jsx("strong", { children: "Poseedor \u00FAnico" }), _jsx("small", { children: "Pieza con nombre propio que solo el DJ puede asignar a un PJ o PNJ." })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: ARMOR_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownArmorQualities(armorEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleArmorEditorQuality(quality.label), children: quality.label }, `${armorEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomArmorQualities(armorEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateArmorEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: armorEditorModal.item.description, placeholder: "Descripcion de la armadura", onChange: (event) => updateArmorEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: armorEditorModal.item.notes, placeholder: "Notas de uso, mantenimiento o procedencia", onChange: (event) => updateArmorEditorItem("notes", event.target.value) }) })] }), inventoryMutationError ? _jsx("p", { className: "error-text", children: inventoryMutationError }) : null, _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setArmorEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveArmorEditorModal, children: "Guardar" })] })] }) })) : null, itemEditorModal ? (_jsx("div", { className: "modal-backdrop", onClick: () => setItemEditorModal(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: itemEditorModal.mode === "create" ? "Objeto personalizado" : "Editar objeto personalizado" }), _jsx("p", { className: "section-help", children: "Configura el objeto para que aparezca en el inventario con el mismo flujo de detalle que el catalogo." }), _jsxs("div", { className: "unified-sheet-action-detail-body", children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { value: itemEditorModal.item.name, onChange: (event) => updateItemEditorItem("name", event.target.value) }) }), _jsx(Field, { label: "Categoria", children: _jsxs("select", { value: itemEditorModal.item.category, onChange: (event) => updateItemEditorItem("category", event.target.value), children: [_jsx("option", { value: "gear", children: "Equipo" }), _jsx("option", { value: "consumable", children: "Consumible" }), _jsx("option", { value: "artifact", children: "Artefacto" }), _jsx("option", { value: "treasure", children: "Tesoro" }), _jsx("option", { value: "other", children: "Otro" })] }) }), _jsx(Field, { label: "Cantidad", children: _jsx("input", { type: "number", min: 1, disabled: itemEditorModal.isUnique, value: itemEditorModal.isUnique ? 1 : itemEditorModal.item.quantity, onChange: (event) => updateItemEditorItem("quantity", Number(event.target.value || 1)) }) }), _jsx(Field, { label: "Apilable", children: _jsxs("select", { disabled: itemEditorModal.isUnique, value: itemEditorModal.isUnique ? "no" : itemEditorModal.item.stackable ? "si" : "no", onChange: (event) => updateItemEditorItem("stackable", event.target.value === "si"), children: [_jsx("option", { value: "no", children: "No" }), _jsx("option", { value: "si", children: "Si" })] }) }), _jsx(Field, { label: "Ranura", children: _jsxs("select", { value: itemEditorModal.item.slot, onChange: (event) => updateItemEditorItem("slot", event.target.value), children: [_jsx("option", { value: "none", children: "Ninguna" }), _jsx("option", { value: "worn", children: "Vestido" }), _jsx("option", { value: "artifact", children: "Artefacto" })] }) }), _jsx(Field, { label: "Valor", children: _jsx("input", { value: itemEditorModal.item.value, onChange: (event) => updateItemEditorItem("value", event.target.value) }) })] }), _jsxs("label", { className: "campaign-item-unique-toggle", children: [_jsx("input", { type: "checkbox", checked: Boolean(itemEditorModal.isUnique), onChange: (event) => setItemEditorModal((current) => current ? ({ ...current, isUnique: event.target.checked, item: event.target.checked ? { ...current.item, quantity: 1, stackable: false } : current.item }) : current) }), _jsxs("span", { children: [_jsx("strong", { children: "Poseedor \u00FAnico" }), _jsx("small", { children: "Pieza con nombre propio que solo el DJ puede asignar a un PJ o PNJ." })] })] }), _jsxs("div", { className: "field", children: [_jsx("span", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-quality-picker", children: ITEM_QUALITY_OPTIONS.map((quality) => {
                                                const active = getKnownItemQualities(itemEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                                                return (_jsx("button", { type: "button", className: active ? "is-active" : "", onClick: () => toggleItemEditorQuality(quality.label), children: quality.label }, `${itemEditorModal.item.id}-${quality.id}`));
                                            }) })] }), _jsx(Field, { label: "Cualidades adicionales", children: _jsx("input", { value: getCustomItemQualities(itemEditorModal.item).join(", "), placeholder: "Separadas por comas", onChange: (event) => updateItemEditorCustomQualities(event.target.value) }) }), _jsx(Field, { label: "Descripcion", children: _jsx("textarea", { rows: 3, value: itemEditorModal.item.description, placeholder: "Descripcion del objeto", onChange: (event) => updateItemEditorItem("description", event.target.value) }) }), _jsx(Field, { label: "Notas", children: _jsx("textarea", { rows: 3, value: itemEditorModal.item.notes, placeholder: "Notas de uso, procedencia o comercio", onChange: (event) => updateItemEditorItem("notes", event.target.value) }) })] }), inventoryMutationError ? _jsx("p", { className: "error-text", children: inventoryMutationError }) : null, _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setItemEditorModal(null), children: "Cancelar" }), _jsx("button", { type: "button", className: "accent-button", onClick: saveItemEditorModal, children: "Guardar" })] })] }) })) : null, inventoryCatalogModalTab ? (_jsx("div", { className: "modal-backdrop", onClick: () => setInventoryCatalogModalTab(null), children: _jsxs("div", { className: "panel modal-panel character-roll-confirm-modal unified-sheet-item-catalog-modal", onClick: (event) => event.stopPropagation(), children: [_jsx("h3", { children: inventoryCatalogModalTab === "weapons"
                                ? "Agregar arma"
                                : inventoryCatalogModalTab === "armors"
                                    ? "Agregar armadura"
                                    : "Agregar objeto" }), _jsx("p", { className: "section-help", children: "Selecciona un objeto existente del catalogo para anadirlo al inventario." }), _jsxs("div", { className: "unified-sheet-item-catalog-fields", children: [inventoryCatalogModalTab === "weapons" ? (_jsxs("fieldset", { className: "unified-sheet-weapon-type-picker", children: [_jsx("legend", { children: "Tipo de arma" }), _jsx("div", { className: "unified-sheet-weapon-type-options", children: WEAPON_CATALOG_FILTER_OPTIONS.map((option) => (_jsxs("button", { type: "button", className: selectedWeaponCatalogFilter === option.id ? "is-active" : "", "aria-pressed": selectedWeaponCatalogFilter === option.id, title: option.label, onClick: () => setSelectedWeaponCatalogFilter(option.id), children: [_jsx(WeaponCatalogTypeIcon, { type: option.id }), _jsx("span", { children: option.label })] }, option.id))) })] })) : inventoryCatalogModalTab === "armors" ? (_jsxs("fieldset", { className: "unified-sheet-weapon-type-picker", children: [_jsx("legend", { children: "Tipo de armadura" }), _jsx("div", { className: "unified-sheet-weapon-type-options unified-sheet-armor-type-options", children: ARMOR_CATALOG_FILTER_OPTIONS.map((option) => (_jsxs("button", { type: "button", className: selectedArmorCatalogFilter === option.id ? "is-active" : "", "aria-pressed": selectedArmorCatalogFilter === option.id, title: option.label, onClick: () => setSelectedArmorCatalogFilter(option.id), children: [_jsx(ArmorCatalogTypeIcon, { type: option.id }), _jsx("span", { children: option.label })] }, option.id))) })] })) : inventoryCatalogModalTab === "items" ? (_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: selectedItemCatalogFilter, onChange: (event) => setSelectedItemCatalogFilter(event.target.value), children: ITEM_CATALOG_FILTER_OPTIONS.map((option) => (_jsx("option", { value: option.id, children: option.label }, option.id))) })] })) : null, inventoryCatalogModalTab === "weapons" ? (_jsxs("div", { className: "unified-sheet-weapon-search-selector", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Arma" }), _jsx("input", { type: "search", role: "combobox", "aria-label": "Buscar arma", "aria-controls": "weapon-catalog-results", "aria-expanded": filteredModalCatalogItems.length > 0, "aria-autocomplete": "list", placeholder: "Buscar por nombre o cualidad...", value: weaponCatalogSearch, onChange: (event) => setWeaponCatalogSearch(event.target.value) })] }), _jsx("div", { id: "weapon-catalog-results", className: "unified-sheet-weapon-search-results", role: "listbox", "aria-label": "Armas disponibles", children: filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (_jsxs("button", { type: "button", role: "option", "aria-selected": item.templateId === selectedCatalogItemId, className: item.templateId === selectedCatalogItemId ? "is-active" : "", onClick: () => setSelectedCatalogItemId(item.templateId), children: [_jsx("span", { children: item.name }), _jsx("small", { children: item.damageFormula || "Especial" })] }, item.templateId))) : _jsx("p", { children: "No hay armas que coincidan con la busqueda." }) })] })) : inventoryCatalogModalTab === "armors" ? (_jsxs("div", { className: "unified-sheet-weapon-search-selector", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Armadura" }), _jsx("input", { type: "search", role: "combobox", "aria-label": "Buscar armadura", "aria-controls": "armor-catalog-results", "aria-expanded": filteredModalCatalogItems.length > 0, "aria-autocomplete": "list", placeholder: "Buscar por nombre o cualidad...", value: armorCatalogSearch, onChange: (event) => setArmorCatalogSearch(event.target.value) })] }), _jsx("div", { id: "armor-catalog-results", className: "unified-sheet-weapon-search-results", role: "listbox", "aria-label": "Armaduras disponibles", children: filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (_jsxs("button", { type: "button", role: "option", "aria-selected": item.templateId === selectedCatalogItemId, className: item.templateId === selectedCatalogItemId ? "is-active" : "", onClick: () => setSelectedCatalogItemId(item.templateId), children: [_jsx("span", { children: item.name }), _jsx("small", { children: item.protectionFormula || "Especial" })] }, item.templateId))) : _jsx("p", { children: "No hay armaduras que coincidan con la busqueda." }) })] })) : inventoryCatalogModalTab === "items" ? (_jsxs("div", { className: "unified-sheet-weapon-search-selector unified-sheet-object-search-selector", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Objeto" }), _jsx("input", { type: "search", role: "combobox", "aria-label": "Buscar objeto", "aria-controls": "item-catalog-results", "aria-expanded": filteredModalCatalogItems.length > 0, "aria-autocomplete": "list", placeholder: "Buscar por nombre, efecto o precio...", value: itemCatalogSearch, onChange: (event) => setItemCatalogSearch(event.target.value) })] }), _jsx("div", { id: "item-catalog-results", className: "unified-sheet-weapon-search-results", role: "listbox", "aria-label": "Objetos disponibles", children: filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (_jsxs("button", { type: "button", role: "option", "aria-selected": item.templateId === selectedCatalogItemId, className: item.templateId === selectedCatalogItemId ? "is-active" : "", onClick: () => setSelectedCatalogItemId(item.templateId), children: [_jsx("span", { children: item.name }), _jsx("small", { children: item.value || "Sin precio" })] }, item.templateId))) : _jsx("p", { children: "No hay objetos que coincidan con la b\u00FAsqueda." }) })] })) : (_jsxs("label", { className: "field", children: [_jsx("span", { children: inventoryCatalogModalTab === "items" ? "Objeto" : "Catalogo" }), _jsx("select", { value: selectedCatalogItemId, onChange: (event) => setSelectedCatalogItemId(event.target.value), children: filteredModalCatalogItems.map((item) => (_jsx("option", { value: item.templateId, children: item.name }, item.templateId))) })] }))] }), filteredModalCatalogItems.length > 0 ? (_jsx("div", { className: "unified-sheet-item-catalog-preview", children: (() => {
                                const selectedItem = filteredModalCatalogItems.find((item) => item.templateId === selectedCatalogItemId) ?? filteredModalCatalogItems[0];
                                if (!selectedItem)
                                    return null;
                                const selectedItemQualities = parseWeaponQualities(selectedItem.qualities);
                                const selectedCampaignItem = selectedItem.campaignItemId ? campaignItemsById.get(selectedItem.campaignItemId) : undefined;
                                return (_jsxs(_Fragment, { children: [selectedCampaignItem?.isUnique ? (_jsxs("div", { className: "unified-sheet-campaign-item-owner", children: [_jsx("span", { className: "campaign-item-unique-badge", children: "Pieza \u00FAnica" }), _jsxs("strong", { children: ["Poseedor: ", selectedCampaignItem.ownerName ?? "Sin poseedor"] })] })) : null, selectedItem.category === "weapon" ? (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: "Arma del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [selectedItem.damageFormula ? _jsx("strong", { children: selectedItem.damageFormula }) : _jsx("strong", { children: "-" }), _jsx("span", { children: "Da\u00F1o base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, selectedItemQualities.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: selectedItemQualities.map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] })) : selectedItem.category === "armor" ? (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: "Armadura del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [selectedItem.protectionFormula ? _jsx("strong", { children: selectedItem.protectionFormula }) : _jsx("strong", { children: "-" }), _jsx("span", { children: "Proteccion base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, parseWeaponQualities(selectedItem.qualities).length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: parseWeaponQualities(selectedItem.qualities).map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] })) : (_jsxs("div", { className: "unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview", children: [_jsxs("div", { className: "unified-sheet-item-catalog-preview-header", children: [_jsx("strong", { children: selectedItem.name }), _jsx("span", { children: selectedItem.category === "artifact" ? "Artefacto del catalogo" : "Objeto del catalogo" })] }), _jsxs("section", { className: "unified-sheet-weapon-detail-hero", children: [_jsxs("div", { className: "unified-sheet-weapon-detail-primary", children: [_jsxs("strong", { children: ["x", selectedItem.defaultQuantity ?? 1] }), _jsx("span", { children: "Cantidad base" })] }), _jsx("div", { className: "unified-sheet-weapon-detail-stats", children: selectedItem.value ? (_jsxs("article", { className: "unified-sheet-weapon-detail-stat", children: [_jsx("span", { children: "Valor" }), _jsx("strong", { children: selectedItem.value })] })) : null })] }), selectedItem.description ? (_jsx("section", { className: "unified-sheet-weapon-detail-copy", children: _jsx("p", { children: selectedItem.description }) })) : null, selectedItemQualities.length > 0 ? (_jsxs("section", { className: "unified-sheet-weapon-detail-qualities", children: [_jsx("h4", { children: "Cualidades" }), _jsx("div", { className: "unified-sheet-item-catalog-meta", children: selectedItemQualities.map((quality) => _jsx("span", { children: quality }, `${selectedItem.templateId}-${quality}`)) })] })) : null] }))] }));
                            })() })) : (_jsx("p", { className: "section-help", children: "No hay elementos disponibles en esta categoria." })), _jsxs("div", { className: "row-actions character-roll-confirm-actions", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setInventoryCatalogModalTab(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: filteredModalCatalogItems.length === 0 || !selectedCatalogItemId || Boolean((() => {
                                        const selected = availableItemCatalog.find((item) => item.templateId === selectedCatalogItemId);
                                        return selected?.campaignItemId && campaignItemsById.get(selected.campaignItemId)?.isUnique;
                                    })()), onClick: addSelectedCatalogItemFromModal, children: (() => {
                                        const selected = availableItemCatalog.find((item) => item.templateId === selectedCatalogItemId);
                                        return selected?.campaignItemId && campaignItemsById.get(selected.campaignItemId)?.isUnique ? "Solo el DJ puede asignarlo" : "Agregar";
                                    })() })] })] }) })) : null] }));
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
function appCardCategoryClass(category) {
    return category ? ` app-card-accent app-card-accent--${category}` : "";
}
function CapabilityTextList({ title, entries, onOpenDetail, categoryKey }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsxs("article", { className: `unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}${appCardCategoryClass(categoryKey)}`, onClick: onOpenDetail ? () => onOpenDetail(entry) : undefined, onKeyDown: onOpenDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDetail(entry);
                }
            } : undefined, role: onOpenDetail ? "button" : undefined, tabIndex: onOpenDetail ? 0 : undefined, children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: entry.nombre || title }) }), _jsxs("div", { className: "unified-sheet-capability-meta", children: [entry.tipo ? _jsx("span", { children: entry.tipo }) : null, entry.nivel ? _jsx("span", { children: formatSkillLevelLabel(entry.nivel) }) : null, entry.fuente ? _jsxs("span", { children: [entry.fuente, entry.pagina ? ` p. ${entry.pagina}` : ""] }) : entry.pagina ? _jsxs("span", { children: ["p. ", entry.pagina] }) : null] })] }, `${title}-${index}-${entry.nombre}`)))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: "Sin entradas." })) }));
}
function SimpleStringList({ title, entries, emptyText, onOpenDetail, categoryKey }) {
    return (_jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsxs("article", { className: `unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}${appCardCategoryClass(categoryKey)}`, onClick: onOpenDetail ? () => onOpenDetail(entry) : undefined, onKeyDown: onOpenDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDetail(entry);
                }
            } : undefined, tabIndex: onOpenDetail ? 0 : undefined, role: onOpenDetail ? "button" : undefined, children: [_jsx("h3", { children: entry }), _jsx("div", { className: "unified-sheet-capability-meta", children: _jsx("span", { children: title }) })] }, `${title}-${index}-${entry}`)))) : (_jsx("p", { className: "unified-sheet-capability-empty", children: emptyText })) }));
}
function SimpleStringListEditor({ title, entries, editable, rows, helpText, onChange, onAdd, onRemove, categoryKey }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar linea" }) : null] }), helpText ? _jsx("p", { className: "section-help", children: helpText }) : null, _jsx(Field, { label: title, children: _jsx("textarea", { disabled: !editable, rows: rows, value: entries.join("\n"), onChange: (event) => onChange(event.target.value) }) }), _jsx("div", { className: "unified-sheet-list", children: entries.length > 0 ? (entries.map((entry, index) => (_jsx("article", { className: `campaign-structured-card${appCardCategoryClass(categoryKey)}`, children: _jsxs("div", { className: "row-actions", children: [_jsx("strong", { children: entry || `${title} ${index + 1}` }), editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] }) }, `${title}-editor-${index}-${entry}`)))) : (_jsx("p", { className: "section-help", children: "Sin entradas." })) })] }));
}
function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenDetail, onOpenCompendium, categoryKey }) {
    return (_jsxs("article", { className: "campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: title }), editable ? _jsx("button", { type: "button", onClick: onAdd, children: "Agregar" }) : null] }), _jsxs("div", { className: "unified-sheet-list", children: [entries.map((entry, index) => (_jsxs("article", { className: `campaign-structured-card${appCardCategoryClass(categoryKey)}`, children: [_jsxs("div", { className: "form-grid", children: [_jsx(Field, { label: "Nombre", children: _jsx("input", { disabled: !editable, value: entry.nombre, onChange: (event) => onUpdate(index, "nombre", event.target.value) }) }), _jsx(Field, { label: "Tipo", children: _jsx("input", { disabled: !editable, value: entry.tipo, onChange: (event) => onUpdate(index, "tipo", event.target.value) }) }), _jsx(Field, { label: "Nivel", children: _jsxs("select", { disabled: !editable, value: entry.nivel, onChange: (event) => onUpdate(index, "nivel", event.target.value), children: [_jsx("option", { value: "principiante", children: "Principiante" }), _jsx("option", { value: "adepto", children: "Adepto" }), _jsx("option", { value: "maestro", children: "Maestro" })] }) }), _jsx(Field, { label: "Fuente", children: _jsx("input", { disabled: !editable, value: entry.fuente, onChange: (event) => onUpdate(index, "fuente", event.target.value) }) }), _jsx(Field, { label: "Pagina", children: _jsx("input", { disabled: !editable, type: "number", min: 0, value: entry.pagina ?? "", onChange: (event) => onUpdate(index, "pagina", Number(event.target.value || 0)) }) })] }), _jsx("textarea", { disabled: !editable, rows: 3, value: entry.efecto, onChange: (event) => onUpdate(index, "efecto", event.target.value) }), _jsx("textarea", { disabled: !editable, rows: 2, value: entry.notas, onChange: (event) => onUpdate(index, "notas", event.target.value) }), _jsxs("div", { className: "card-actions", children: [onOpenDetail ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenDetail(entry), children: "Ver detalle" }) : null, onOpenCompendium ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onOpenCompendium(entry.nombre), children: "Ver en compendio" }) : null, editable ? _jsx("button", { type: "button", className: "subtle-button", onClick: () => onRemove(index), children: "Quitar" }) : null] })] }, `${title}-${index}-${entry.nombre}`))), entries.length === 0 ? _jsx("p", { className: "section-help", children: "Sin entradas." }) : null] })] }));
}
