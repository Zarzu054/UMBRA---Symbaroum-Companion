import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS } from "../models/compendiumEntries";
const BUILDER_ABILITIES = SYMBAROUM_ABILITIES.filter((entry) => normalizeName(entry.nombre) !== "rituales");
const BUILDER_MONSTER_TRAITS = ALL_ENTRIES
    .filter((entry) => entry.tipo === "rasgo")
    .map((entry) => ({
    id: entry.id,
    nombre: entry.nombre,
    tipo: "habilidad",
    tradiciones: [],
    libro: entry.fuente,
    pagina: entry.pagina ?? 0,
    efectoResumen: entry.detalle,
    acciones: []
}));
const BUILDER_MONSTER_TRAIT_NAME_SET = new Set(BUILDER_MONSTER_TRAITS.map((entry) => normalizeName(entry.nombre)));
const ROMAN_LEVEL_LABELS = {
    novato: "I",
    adepto: "II",
    maestro: "III"
};
const LEVEL_OPTIONS = [
    { value: "novato", label: "Novato" },
    { value: "adepto", label: "Adepto" },
    { value: "maestro", label: "Maestro" }
];
const INITIAL_CATALOG_SELECTIONS = {
    habilidades: BUILDER_ABILITIES[0]?.id ?? "",
    rasgosMonstruosos: BUILDER_MONSTER_TRAITS[0]?.id ?? "",
    poderesMisticos: SYMBAROUM_MYSTIC_POWERS[0]?.id ?? "",
    rituales: SYMBAROUM_RITUALS[0]?.id ?? "",
    bendiciones: SYMBAROUM_BLESSINGS[0]?.id ?? "",
    cargas: SYMBAROUM_BURDENS[0]?.id ?? ""
};
const SIMPLE_SECTION_LABELS = {
    bendiciones: "Bendiciones",
    cargas: "Cargas",
    rasgos: "Rasgos"
};
const BUILDER_TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "identidad", label: "Identidad" },
    { id: "compras", label: "Compras PX" },
    { id: "rasgos", label: "Rasgos y cargas" }
];
function normalizeName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function getRatedEntryCost(level) {
    switch (level) {
        case "maestro":
            return 60;
        case "adepto":
            return 30;
        case "novato":
        default:
            return 10;
    }
}
function getSimpleEntryDelta(section) {
    if (section === "bendiciones")
        return -5;
    return 0;
}
function isMonsterTraitCapability(name) {
    return BUILDER_MONSTER_TRAIT_NAME_SET.has(normalizeName(name));
}
function getStoredRatedSection(section) {
    return section === "rasgosMonstruosos" ? "habilidades" : section;
}
function getRatedEntriesForSection(sheet, section) {
    if (section === "habilidades") {
        return sheet.habilidades.filter((entry) => !isMonsterTraitCapability(entry.nombre));
    }
    if (section === "rasgosMonstruosos") {
        return sheet.habilidades.filter((entry) => isMonsterTraitCapability(entry.nombre));
    }
    return sheet[getStoredRatedSection(section)];
}
function replaceRatedEntriesForSection(sheet, section, nextEntries) {
    if (section === "habilidades") {
        return {
            ...sheet,
            habilidades: [...nextEntries, ...sheet.habilidades.filter((entry) => isMonsterTraitCapability(entry.nombre))]
        };
    }
    if (section === "rasgosMonstruosos") {
        return {
            ...sheet,
            habilidades: [...sheet.habilidades.filter((entry) => !isMonsterTraitCapability(entry.nombre)), ...nextEntries]
        };
    }
    const storedSection = getStoredRatedSection(section);
    return {
        ...sheet,
        [storedSection]: nextEntries
    };
}
function getSectionTitle(section) {
    if (section === "habilidades")
        return "Habilidades";
    if (section === "rasgosMonstruosos")
        return "Rasgos monstruosos";
    if (section === "poderesMisticos")
        return "Poderes";
    return "Rituales";
}
function getAcquireButtonLabel(section) {
    if (section === "habilidades")
        return "Obtener nueva habilidad";
    if (section === "rasgosMonstruosos")
        return "Obtener nuevo rasgo";
    if (section === "poderesMisticos")
        return "Obtener nuevo poder";
    return "Obtener nuevo ritual";
}
function getLevelLabel(section, level) {
    return section === "rasgosMonstruosos"
        ? ROMAN_LEVEL_LABELS[level]
        : LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}
function buildRatedEntry(entry, section) {
    return {
        nombre: entry.nombre,
        tipo: section === "habilidades" ? "Habilidad" : section === "rasgosMonstruosos" ? "Rasgo monstruoso" : section === "poderesMisticos" ? "Poder mistico" : "Ritual",
        efecto: entry.efectoResumen,
        nivel: "novato",
        fuente: entry.libro,
        pagina: entry.pagina,
        notas: entry.efectoResumen,
        acciones: entry.acciones
    };
}
function getCatalogEntries(section) {
    if (section === "habilidades")
        return [...BUILDER_ABILITIES];
    if (section === "rasgosMonstruosos")
        return [...BUILDER_MONSTER_TRAITS];
    if (section === "poderesMisticos")
        return [...SYMBAROUM_MYSTIC_POWERS];
    return [...SYMBAROUM_RITUALS];
}
function getSectionCostLabel(section) {
    return section === "rituales" ? "10 PX por ritual" : "10 / 30 / 60 PX";
}
function getNextLevel(level) {
    if (level === "novato")
        return "adepto";
    if (level === "adepto")
        return "maestro";
    return null;
}
function getPreviousLevel(level) {
    if (level === "maestro")
        return "adepto";
    if (level === "adepto")
        return "novato";
    return null;
}
function getUpgradeCost(section, currentLevel) {
    if (section === "rituales") {
        return 0;
    }
    if (currentLevel === "novato") {
        return 20;
    }
    if (currentLevel === "adepto") {
        return 30;
    }
    return 0;
}
function parseCapabilityTiers(detail, section) {
    const text = String(detail ?? "").trim();
    if (!text) {
        return [];
    }
    const labels = section === "rasgosMonstruosos" ? ["I", "II", "III"] : ["Novato", "Adepto", "Maestro"];
    const labelPattern = section === "rasgosMonstruosos" ? "I|II|III" : "Novato|Adepto|Maestro";
    const matches = [...text.matchAll(new RegExp(`(${labelPattern}):\\s*([\\s\\S]*?)(?=(?:${labelPattern}):|$)`, "gi"))];
    const mapped = new Map();
    for (const match of matches) {
        const rawLabel = String(match[1] ?? "").trim();
        const content = match[2]?.trim();
        if (!content)
            continue;
        const label = labels.find((entry) => normalizeName(entry) === normalizeName(rawLabel)) ?? null;
        if (!label || mapped.has(label))
            continue;
        mapped.set(label, { label, content });
    }
    return labels.map((label) => mapped.get(label)).filter((tier) => Boolean(tier));
}
function getCapabilityTierForLevel(tiers, level, section) {
    const targetLabel = getLevelLabel(section, level);
    return tiers.find((tier) => tier.label === targetLabel) ?? null;
}
export function CharacterBuilderView({ character, busy = false, onBackToCharacters, onOpenSheet, onSave, backLabel = "Volver a personajes", sheetLabel = "Abrir hoja", saveLabel = "Guardar constructor" }) {
    const [draft, setDraft] = useState(() => parseCharacterSheet(character.sheet));
    const [catalogSelections, setCatalogSelections] = useState(INITIAL_CATALOG_SELECTIONS);
    const [simpleInputs, setSimpleInputs] = useState({
        bendiciones: "",
        cargas: "",
        rasgos: ""
    });
    const [manualSpentAdjustment, setManualSpentAdjustment] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("resumen");
    const [acquisitionModal, setAcquisitionModal] = useState(null);
    const [capabilityConfirmationModal, setCapabilityConfirmationModal] = useState(null);
    useEffect(() => {
        const parsedSheet = parseCharacterSheet(character.sheet);
        const experience = getCharacterExperienceSummary(parsedSheet);
        setDraft(parsedSheet);
        setCatalogSelections(INITIAL_CATALOG_SELECTIONS);
        setSimpleInputs({
            bendiciones: "",
            cargas: "",
            rasgos: ""
        });
        setManualSpentAdjustment(Math.max(0, parsedSheet.progreso.experienciaGastada - experience.computedSpent));
        setError(null);
        setActiveTab("resumen");
        setAcquisitionModal(null);
        setCapabilityConfirmationModal(null);
    }, [character]);
    const experience = useMemo(() => getCharacterExperienceSummary(draft), [draft]);
    const manualSpentTotal = useMemo(() => Math.max(0, manualSpentAdjustment), [manualSpentAdjustment]);
    const effectiveSpent = useMemo(() => Math.max(0, experience.computedSpent + manualSpentTotal), [experience.computedSpent, manualSpentTotal]);
    const effectiveAvailable = useMemo(() => Math.max(0, draft.progreso.experienciaTotal - effectiveSpent), [draft.progreso.experienciaTotal, effectiveSpent]);
    const subtitle = `${draft.identidad.cultura || "Sin cultura"} · ${draft.identidad.arquetipo || "Sin arquetipo"} · ${draft.identidad.raza || "Sin raza"}`;
    const acquisitionCatalogEntries = useMemo(() => acquisitionModal ? getCatalogEntries(acquisitionModal.section) : [], [acquisitionModal]);
    const filteredAcquisitionEntries = useMemo(() => {
        if (!acquisitionModal) {
            return [];
        }
        const query = normalizeName(acquisitionModal.query);
        const sectionEntries = getRatedEntriesForSection(draft, acquisitionModal.section);
        const entries = acquisitionCatalogEntries.filter((entry) => !sectionEntries.some((current) => normalizeName(current.nombre) === normalizeName(entry.nombre)));
        if (!query) {
            return entries.slice(0, 12);
        }
        return entries
            .filter((entry) => normalizeName(entry.nombre).includes(query) ||
            normalizeName(entry.efectoResumen).includes(query) ||
            normalizeName(entry.libro).includes(query))
            .slice(0, 12);
    }, [acquisitionCatalogEntries, acquisitionModal, draft]);
    const selectedAcquisitionEntry = useMemo(() => {
        if (!acquisitionModal) {
            return null;
        }
        return filteredAcquisitionEntries.find((entry) => entry.id === acquisitionModal.selectedId)
            ?? filteredAcquisitionEntries[0]
            ?? null;
    }, [acquisitionModal, filteredAcquisitionEntries]);
    const acquisitionPreviewTiers = useMemo(() => parseCapabilityTiers(selectedAcquisitionEntry?.efectoResumen ?? "", acquisitionModal?.section ?? "habilidades"), [acquisitionModal?.section, selectedAcquisitionEntry]);
    function findCatalogEntryByName(section, name) {
        return getCatalogEntries(section).find((entry) => normalizeName(entry.nombre) === normalizeName(name)) ?? null;
    }
    function closeCapabilityConfirmationModal() {
        setCapabilityConfirmationModal(null);
    }
    function updateIdentityField(field, value) {
        setDraft((current) => ({
            ...current,
            identidad: {
                ...current.identidad,
                [field]: value
            }
        }));
    }
    function applyRatedEntryLevelUp(section, index) {
        const sectionEntries = getRatedEntriesForSection(draft, section);
        const entry = sectionEntries[index];
        if (!entry) {
            return;
        }
        const nextLevel = getNextLevel(entry.nivel);
        if (!nextLevel) {
            return;
        }
        const upgradeCost = getUpgradeCost(section, entry.nivel);
        if (upgradeCost > effectiveAvailable) {
            setError(`No hay PX suficientes para subir ${entry.nombre} a ${nextLevel}.`);
            return;
        }
        setError(null);
        setDraft((current) => replaceRatedEntriesForSection(current, section, getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) => entryIndex === index ? { ...ratedEntry, nivel: nextLevel } : ratedEntry)));
    }
    function openUpgradeConfirmation(section, index) {
        const entry = getRatedEntriesForSection(draft, section)[index];
        if (!entry) {
            return;
        }
        const targetLevel = getNextLevel(entry.nivel);
        if (!targetLevel) {
            return;
        }
        const cost = getUpgradeCost(section, entry.nivel);
        if (cost > effectiveAvailable) {
            setError(`No hay PX suficientes para subir ${entry.nombre} a ${targetLevel}.`);
            return;
        }
        const catalogEntry = findCatalogEntryByName(section, entry.nombre);
        const previewSource = catalogEntry?.efectoResumen ?? entry.efecto ?? entry.notas ?? "";
        const previewTiers = parseCapabilityTiers(previewSource, section);
        setError(null);
        setCapabilityConfirmationModal({
            mode: "upgrade",
            section,
            name: entry.nombre,
            sourceLabel: catalogEntry?.libro
                ? `${catalogEntry.libro}${catalogEntry.pagina ? ` p. ${catalogEntry.pagina}` : ""}`
                : entry.fuente
                    ? `${entry.fuente}${entry.pagina ? ` p. ${entry.pagina}` : ""}`
                    : "",
            targetLevel,
            cost,
            previewSummary: previewSource,
            targetTier: getCapabilityTierForLevel(previewTiers, targetLevel, section),
            confirmLabel: section === "rituales" ? `Subir a ${getLevelLabel(section, targetLevel)}` : `Gastar ${cost} PX`,
            onConfirm: () => {
                applyRatedEntryLevelUp(section, index);
                setCapabilityConfirmationModal(null);
            }
        });
    }
    function levelDownRatedEntry(section, index) {
        const entry = getRatedEntriesForSection(draft, section)[index];
        if (!entry) {
            return;
        }
        const previousLevel = getPreviousLevel(entry.nivel);
        if (!previousLevel) {
            return;
        }
        setError(null);
        setDraft((current) => replaceRatedEntriesForSection(current, section, getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) => entryIndex === index ? { ...ratedEntry, nivel: previousLevel } : ratedEntry)));
    }
    function openDowngradeConfirmation(section, index) {
        const entry = getRatedEntriesForSection(draft, section)[index];
        if (!entry) {
            return;
        }
        const targetLevel = getPreviousLevel(entry.nivel);
        if (!targetLevel) {
            return;
        }
        const catalogEntry = findCatalogEntryByName(section, entry.nombre);
        const previewSource = catalogEntry?.efectoResumen ?? entry.efecto ?? entry.notas ?? "";
        const previewTiers = parseCapabilityTiers(previewSource, section);
        setError(null);
        setCapabilityConfirmationModal({
            mode: "downgrade",
            section,
            name: entry.nombre,
            sourceLabel: catalogEntry?.libro
                ? `${catalogEntry.libro}${catalogEntry.pagina ? ` p. ${catalogEntry.pagina}` : ""}`
                : entry.fuente
                    ? `${entry.fuente}${entry.pagina ? ` p. ${entry.pagina}` : ""}`
                    : "",
            targetLevel,
            cost: 0,
            previewSummary: previewSource,
            targetTier: getCapabilityTierForLevel(previewTiers, targetLevel, section),
            confirmLabel: `Confirmar bajada a ${getLevelLabel(section, targetLevel)}`,
            onConfirm: () => {
                levelDownRatedEntry(section, index);
                setCapabilityConfirmationModal(null);
            }
        });
    }
    function removeRatedEntry(section, index) {
        const entry = getRatedEntriesForSection(draft, section)[index];
        if (!entry) {
            return;
        }
        setError(null);
        setDraft((current) => replaceRatedEntriesForSection(current, section, getRatedEntriesForSection(current, section).filter((_, entryIndex) => entryIndex !== index)));
    }
    function openAcquisitionModal(section) {
        const entries = getCatalogEntries(section).filter((entry) => !getRatedEntriesForSection(draft, section).some((current) => normalizeName(current.nombre) === normalizeName(entry.nombre)));
        setAcquisitionModal({
            section,
            query: "",
            selectedId: entries[0]?.id ?? ""
        });
    }
    function applyAcquisition() {
        if (!acquisitionModal) {
            return;
        }
        const entry = acquisitionCatalogEntries.find((candidate) => candidate.id === (selectedAcquisitionEntry?.id ?? acquisitionModal.selectedId));
        if (!entry) {
            return;
        }
        const section = acquisitionModal.section;
        const acquisitionCost = 10;
        if (acquisitionCost > effectiveAvailable) {
            setError(`No hay PX suficientes para obtener ${entry.nombre}.`);
            return;
        }
        if (getRatedEntriesForSection(draft, section).some((current) => normalizeName(current.nombre) === normalizeName(entry.nombre))) {
            setError(`${entry.nombre} ya esta en la hoja.`);
            return;
        }
        setError(null);
        setDraft((current) => replaceRatedEntriesForSection(current, section, [...getRatedEntriesForSection(current, section), buildRatedEntry(entry, section)]));
        setAcquisitionModal(null);
    }
    function openAcquisitionConfirmation() {
        if (!acquisitionModal || !selectedAcquisitionEntry) {
            return;
        }
        const cost = 10;
        if (cost > effectiveAvailable) {
            setError(`No hay PX suficientes para obtener ${selectedAcquisitionEntry.nombre}.`);
            return;
        }
        setError(null);
        setCapabilityConfirmationModal({
            mode: "acquire",
            section: acquisitionModal.section,
            name: selectedAcquisitionEntry.nombre,
            sourceLabel: `${selectedAcquisitionEntry.libro}${selectedAcquisitionEntry.pagina ? ` p. ${selectedAcquisitionEntry.pagina}` : ""}`,
            targetLevel: "novato",
            cost,
            previewSummary: selectedAcquisitionEntry.efectoResumen,
            targetTier: getCapabilityTierForLevel(acquisitionPreviewTiers, "novato", acquisitionModal.section),
            confirmLabel: `Confirmar ${cost} PX`,
            onConfirm: () => {
                applyAcquisition();
                setCapabilityConfirmationModal(null);
            }
        });
    }
    function updateSimpleInput(section, value) {
        setSimpleInputs((current) => ({
            ...current,
            [section]: value
        }));
    }
    function addSimpleEntry(section) {
        const value = simpleInputs[section].trim();
        if (!value)
            return;
        if (section === "bendiciones" && effectiveAvailable < 5) {
            setError(`No hay PX suficientes para obtener ${value}.`);
            return;
        }
        if (draft[section].some((entry) => normalizeName(entry) === normalizeName(value))) {
            setError(`${value} ya esta en ${SIMPLE_SECTION_LABELS[section].toLowerCase()}.`);
            return;
        }
        setError(null);
        setDraft((current) => ({
            ...current,
            [section]: [...current[section], value]
        }));
        setSimpleInputs((current) => ({
            ...current,
            [section]: ""
        }));
    }
    function removeSimpleEntry(section, index) {
        setDraft((current) => ({
            ...current,
            [section]: current[section].filter((_, entryIndex) => entryIndex !== index)
        }));
    }
    function addCatalogSimpleEntry(section) {
        const sourceEntries = section === "bendiciones" ? SYMBAROUM_BLESSINGS : SYMBAROUM_BURDENS;
        const selectedId = catalogSelections[section];
        const entry = sourceEntries.find((candidate) => candidate.id === selectedId);
        if (!entry) {
            return;
        }
        if (section === "bendiciones" && effectiveAvailable < 5) {
            setError(`No hay PX suficientes para obtener ${entry.nombre}.`);
            return;
        }
        if (draft[section].some((current) => normalizeName(current) === normalizeName(entry.nombre))) {
            setError(`${entry.nombre} ya esta en ${SIMPLE_SECTION_LABELS[section].toLowerCase()}.`);
            return;
        }
        setError(null);
        setDraft((current) => ({
            ...current,
            [section]: [...current[section], entry.nombre]
        }));
    }
    async function handleSave() {
        setIsSaving(true);
        setError(null);
        try {
            if (effectiveSpent > draft.progreso.experienciaTotal) {
                setError(`No puedes gastar ${effectiveSpent} PX: el personaje solo tiene ${draft.progreso.experienciaTotal} PX concedidos.`);
                return;
            }
            const nextSheet = synchronizeCharacterSheet({
                ...draft,
                progreso: {
                    ...draft.progreso,
                    experienciaGastada: effectiveSpent
                }
            });
            await onSave(nextSheet);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar el constructor.");
        }
        finally {
            setIsSaving(false);
        }
    }
    return (_jsxs("section", { className: "character-builder-page unified-sheet", children: [_jsxs("section", { className: "character-builder-shell campaign-sheet-card", children: [_jsxs("div", { className: "character-builder-header-band", children: [_jsxs("div", { className: "unified-sheet-portrait", children: [_jsx("div", { className: "unified-sheet-portrait-ring" }), _jsx("div", { className: "unified-sheet-portrait-content", children: _jsx("span", { children: String(draft.identidad.arquetipo || character.archetype || "C").slice(0, 1) }) })] }), _jsxs("div", { className: "character-builder-identity", children: [_jsx("h2", { className: "unified-sheet-title", children: draft.identidad.nombrePersonaje || character.name }), _jsx("p", { className: "unified-sheet-inline-subtitle", children: subtitle })] }), _jsxs("div", { className: "toolbar character-builder-toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: onBackToCharacters, children: backLabel }), _jsx("button", { type: "button", className: "subtle-button", onClick: onOpenSheet, children: sheetLabel }), _jsx("button", { type: "button", onClick: () => void handleSave(), disabled: busy || isSaving, children: isSaving ? "Guardando..." : saveLabel })] })] }), error ? (_jsx("section", { className: "panel error-list", children: _jsx("p", { children: error }) })) : null, _jsxs("section", { className: "character-builder-stage", children: [_jsx("div", { className: "unified-sheet-tabs character-builder-tabs", children: BUILDER_TABS.map((tab) => (_jsx("button", { type: "button", className: activeTab === tab.id ? "is-active" : "", onClick: () => setActiveTab(tab.id), children: tab.label }, tab.id))) }), _jsxs("section", { className: "character-builder-layout", children: [activeTab === "resumen" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Constructor" }), _jsx("span", { className: "meta-text", children: "Edicion narrativa y progreso de PX" })] }), _jsxs("div", { className: "character-builder-xp-grid", children: [_jsxs("article", { className: "character-builder-xp-card", children: [_jsx("span", { children: "PX total" }), _jsx("strong", { children: draft.progreso.experienciaTotal })] }), _jsxs("article", { className: "character-builder-xp-card", children: [_jsx("span", { children: "PX gastada" }), _jsx("strong", { children: effectiveSpent })] }), _jsxs("article", { className: "character-builder-xp-card", children: [_jsx("span", { children: "PX disponible" }), _jsx("strong", { children: effectiveAvailable })] })] }), _jsxs("div", { className: "character-builder-summary-notes", children: [_jsxs("p", { children: [_jsx("strong", { children: "PX concedidos:" }), " el total lo gestiona el director de juego desde la campa\u00F1a. El constructor solo permite invertir los puntos disponibles."] }), _jsxs("p", { children: [_jsx("strong", { children: "Origen del PX gastado:" }), " ", experience.spentFromCapabilities, " en capacidades y poderes + ", experience.spentFromRituals, " en rituales + ", experience.spentFromBlessings, " en bendiciones", manualSpentTotal > 0 ? ` + ${manualSpentTotal} de ajuste manual` : "", "."] }), _jsxs("p", { children: [_jsx("strong", { children: "Rituales y rasgos:" }), " los rituales cuestan 10 PX cada uno; los rasgos y las cargas no modifican autom\u00E1ticamente el total concedido."] })] })] })) : null, activeTab === "identidad" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Identidad" }) }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del personaje" }), _jsx("input", { value: draft.identidad.nombrePersonaje, onChange: (event) => updateIdentityField("nombrePersonaje", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del jugador" }), _jsx("input", { value: draft.identidad.nombreJugador, onChange: (event) => updateIdentityField("nombreJugador", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Marcador especial" }), _jsxs("label", { className: "checkbox-row", children: [_jsx("input", { type: "checkbox", checked: draft.identidad.esFamiliar, onChange: (event) => updateIdentityField("esFamiliar", event.target.checked) }), _jsx("span", { children: "Es familiar (empieza con 20 PX)" })] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: draft.identidad.raza, onChange: (event) => updateIdentityField("raza", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cultura" }), _jsx("input", { value: draft.identidad.cultura, onChange: (event) => updateIdentityField("cultura", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("input", { value: draft.identidad.arquetipo, onChange: (event) => updateIdentityField("arquetipo", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Profesion" }), _jsx("input", { value: draft.identidad.profesion, onChange: (event) => updateIdentityField("profesion", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Edad" }), _jsx("input", { value: draft.identidad.edad, onChange: (event) => updateIdentityField("edad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Apariencia" }), _jsx("input", { value: draft.identidad.apariencia, onChange: (event) => updateIdentityField("apariencia", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Objetivo personal" }), _jsx("input", { value: draft.identidad.objetivoPersonal, onChange: (event) => updateIdentityField("objetivoPersonal", event.target.value) })] }), _jsxs("label", { className: "field field-span-2", children: [_jsx("span", { children: "Trasfondo" }), _jsx("textarea", { rows: 6, value: draft.identidad.trasfondo, onChange: (event) => updateIdentityField("trasfondo", event.target.value) })] })] })] })) : null, activeTab === "compras" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Compras de PX" }), _jsxs("span", { className: "meta-text", children: ["PX disponibles: ", effectiveAvailable] })] }), _jsx("div", { className: "character-builder-purchase-stack", children: ["habilidades", "rasgosMonstruosos", "poderesMisticos", "rituales"].map((section) => {
                                                    const sectionEntries = getRatedEntriesForSection(draft, section);
                                                    return (_jsxs("article", { className: `character-builder-block character-builder-block--${section}`, children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: getSectionTitle(section) }), _jsxs("div", { className: "toolbar", children: [_jsx("span", { className: "meta-text", children: getSectionCostLabel(section) }), _jsxs("button", { type: "button", onClick: () => openAcquisitionModal(section), children: [_jsx("span", { "aria-hidden": "true", children: "+" }), " ", getAcquireButtonLabel(section)] })] })] }), _jsx("div", { className: "character-builder-entry-list", children: sectionEntries.length > 0 ? sectionEntries.map((entry, index) => (_jsxs("article", { className: `character-builder-entry-card character-builder-entry-card--${section}`, children: [_jsxs("div", { className: "character-builder-entry-head", children: [_jsxs("div", { className: "character-builder-entry-copy", children: [_jsx("strong", { children: entry.nombre }), _jsxs("div", { className: "character-builder-entry-meta meta-text", children: [section === "rituales" ? "10 PX invertidos" : `${getRatedEntryCost(entry.nivel)} PX invertidos`, entry.fuente ? ` · ${entry.fuente}` : ""] })] }), _jsxs("div", { className: "card-actions character-builder-entry-actions", children: [section !== "rituales" ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "meta-text", children: ["Nivel actual: ", getLevelLabel(section, entry.nivel)] }), getPreviousLevel(entry.nivel) ? (_jsxs("button", { type: "button", className: "subtle-button", onClick: () => openDowngradeConfirmation(section, index), children: [_jsx("span", { "aria-hidden": "true", children: "\u2193" }), " ", "Bajar a ", getLevelLabel(section, getPreviousLevel(entry.nivel))] })) : null, getNextLevel(entry.nivel) ? (_jsxs("button", { type: "button", onClick: () => openUpgradeConfirmation(section, index), disabled: getUpgradeCost(section, entry.nivel) > effectiveAvailable, children: [_jsx("span", { "aria-hidden": "true", children: "\u2191" }), " ", "Subir a ", getLevelLabel(section, getNextLevel(entry.nivel)), " (", getUpgradeCost(section, entry.nivel), " PX)"] })) : (_jsx("span", { className: "meta-text", children: "Nivel maximo" }))] })) : null, _jsx("button", { type: "button", className: "destructive-button", onClick: () => removeRatedEntry(section, index), children: "Quitar" })] })] }), entry.efecto ? _jsx("p", { className: "section-help", children: entry.efecto }) : null] }, `${section}-${entry.nombre}-${index}`))) : (_jsx("p", { className: "section-help", children: "Sin entradas registradas." })) })] }, section));
                                                }) })] })) : null, activeTab === "rasgos" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Bendiciones, cargas y rasgos" }), _jsx("span", { className: "meta-text", children: "Listas simples para progreso y narrativa." })] }), _jsx("div", { className: "character-builder-purchase-stack", children: ["bendiciones", "cargas", "rasgos"].map((section) => (_jsxs("article", { className: "character-builder-block", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: SIMPLE_SECTION_LABELS[section] }), _jsx("span", { className: "meta-text", children: getSimpleEntryDelta(section) === 0 ? "Sin coste automatico" : getSimpleEntryDelta(section) > 0 ? `+${getSimpleEntryDelta(section)} PX` : `${getSimpleEntryDelta(section)} PX` })] }), section === "bendiciones" || section === "cargas" ? (_jsxs("div", { className: "character-builder-purchase-stack", children: [_jsxs("div", { className: "character-builder-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Catalogo" }), _jsx("select", { value: catalogSelections[section], onChange: (event) => setCatalogSelections((current) => ({ ...current, [section]: event.target.value })), children: (section === "bendiciones" ? SYMBAROUM_BLESSINGS : SYMBAROUM_BURDENS).map((entry) => (_jsx("option", { value: entry.id, children: entry.nombre }, entry.id))) })] }), _jsx("button", { type: "button", onClick: () => addCatalogSimpleEntry(section), disabled: section === "bendiciones" && effectiveAvailable < 5, children: section === "bendiciones" ? "Comprar del catalogo" : "Anadir del catalogo" })] }), _jsxs("div", { className: "character-builder-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Personalizada" }), _jsx("input", { value: simpleInputs[section], onChange: (event) => updateSimpleInput(section, event.target.value) })] }), _jsx("button", { type: "button", onClick: () => addSimpleEntry(section), disabled: section === "bendiciones" && effectiveAvailable < 5, children: section === "bendiciones" ? "Comprar personalizada" : "Anadir personalizada" })] })] })) : (_jsxs("div", { className: "character-builder-inline-form", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Anadir" }), _jsx("input", { value: simpleInputs[section], onChange: (event) => updateSimpleInput(section, event.target.value) })] }), _jsx("button", { type: "button", onClick: () => addSimpleEntry(section), children: "Anadir" })] })), _jsx("div", { className: "character-builder-token-list", children: draft[section].length > 0 ? draft[section].map((entry, index) => (_jsxs("span", { className: "character-builder-token", children: [_jsx("span", { children: entry }), _jsx("button", { type: "button", onClick: () => removeSimpleEntry(section, index), children: "x" })] }, `${section}-${entry}-${index}`))) : (_jsx("p", { className: "section-help", children: "Sin entradas registradas." })) })] }, section))) })] })) : null] })] })] }), acquisitionModal ? (_jsx("section", { className: "modal-backdrop", onClick: () => setAcquisitionModal(null), children: _jsxs("div", { className: "panel modal-panel character-builder-acquisition-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: getAcquireButtonLabel(acquisitionModal.section) }), _jsxs("span", { className: "meta-text", children: ["PX disponibles: ", effectiveAvailable] })] }), _jsxs("div", { className: "character-builder-acquisition-layout", children: [_jsxs("div", { className: "character-builder-acquisition-search", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { value: acquisitionModal.query, placeholder: "Escribe para buscar...", onChange: (event) => setAcquisitionModal((current) => current ? ({ ...current, query: event.target.value, selectedId: current.selectedId }) : null) })] }), _jsxs("div", { className: "character-builder-acquisition-results", children: [filteredAcquisitionEntries.map((entry) => (_jsxs("button", { type: "button", className: `character-builder-acquisition-result${selectedAcquisitionEntry?.id === entry.id ? " is-active" : ""}`, onClick: () => setAcquisitionModal((current) => current ? ({ ...current, selectedId: entry.id }) : null), children: [_jsx("strong", { children: entry.nombre }), _jsxs("span", { children: [entry.libro, entry.pagina ? ` p. ${entry.pagina}` : ""] })] }, entry.id))), filteredAcquisitionEntries.length === 0 ? _jsx("p", { className: "section-help", children: "No hay resultados disponibles." }) : null] })] }), _jsx("div", { className: "character-builder-acquisition-preview", children: selectedAcquisitionEntry ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "character-builder-acquisition-header", children: [_jsx("strong", { children: selectedAcquisitionEntry.nombre }), _jsxs("span", { className: "meta-text", children: [selectedAcquisitionEntry.libro, selectedAcquisitionEntry.pagina ? ` p. ${selectedAcquisitionEntry.pagina}` : "", " \u00B7 10 PX"] })] }), acquisitionPreviewTiers.length > 0 ? (_jsx("div", { className: "character-builder-tier-preview-list", children: acquisitionPreviewTiers.map((tier) => (_jsxs("section", { className: "character-builder-tier-preview", children: [_jsx("h4", { children: tier.label }), _jsx("p", { children: tier.content })] }, `${selectedAcquisitionEntry.id}-${tier.label}`))) })) : (_jsx("p", { className: "section-help", children: selectedAcquisitionEntry.efectoResumen }))] })) : (_jsx("p", { className: "section-help", children: "Selecciona una entrada para ver su detalle." })) })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setAcquisitionModal(null), children: "Cancelar" }), _jsx("button", { type: "button", onClick: openAcquisitionConfirmation, disabled: !selectedAcquisitionEntry || effectiveAvailable < 10, children: "Revisar compra" })] })] }) })) : null, capabilityConfirmationModal ? (_jsx("section", { className: "modal-backdrop", onClick: closeCapabilityConfirmationModal, children: _jsxs("div", { className: "panel modal-panel character-builder-confirmation-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: capabilityConfirmationModal.mode === "acquire"
                                        ? "Confirmar compra"
                                        : capabilityConfirmationModal.mode === "downgrade"
                                            ? "Confirmar bajada"
                                            : "Confirmar mejora" }), _jsxs("span", { className: "meta-text", children: ["Nivel objetivo: ", getLevelLabel(capabilityConfirmationModal.section, capabilityConfirmationModal.targetLevel)] })] }), _jsxs("div", { className: "character-builder-confirmation-copy", children: [_jsx("strong", { children: capabilityConfirmationModal.name }), _jsxs("span", { className: "meta-text", children: [capabilityConfirmationModal.sourceLabel
                                            ? `${capabilityConfirmationModal.sourceLabel} · `
                                            : "", `${capabilityConfirmationModal.cost} PX`] })] }), capabilityConfirmationModal.targetTier ? (_jsxs("section", { className: "character-builder-confirmation-tier", children: [_jsx("h4", { children: capabilityConfirmationModal.targetTier.label }), _jsx("p", { children: capabilityConfirmationModal.targetTier.content })] })) : (_jsx("p", { className: "section-help", children: capabilityConfirmationModal.previewSummary })), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: closeCapabilityConfirmationModal, children: "Cancelar" }), _jsx("button", { type: "button", onClick: capabilityConfirmationModal.onConfirm, children: capabilityConfirmationModal.confirmLabel })] })] }) })) : null] }));
}
