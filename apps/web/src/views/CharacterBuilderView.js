import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, SYMBAROUM_PROFESSIONS, evaluateProfession, getBenefitProfessionIds, getHigherRitualBase, normalizeProfessionText, normalizeProfessionCapabilities, parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS, SYMBAROUM_CHARACTER_TRAITS } from "../models/compendiumEntries";
import { useConfirmationDialog } from "../components/ConfirmationDialogProvider";
import { MysticArtifactDetailsModal } from "../components/MysticArtifactDetailsModal";
const BUILDER_ARTIFACT_KIND_LABELS = { weapon: "Arma", armor: "Armadura", object: "Objeto" };
function formatBuilderArtifactBindingCosts(bindingCosts) {
    return bindingCosts
        .map((cost) => cost.paymentType === "xp" ? `${cost.amount} PX` : `${cost.amount} Corrupción permanente`)
        .join(" o ");
}
const BUILDER_ABILITIES = SYMBAROUM_ABILITIES.filter((entry) => normalizeName(entry.nombre) !== "rituales");
const BUILDER_MONSTER_TRAITS = ALL_ENTRIES
    .filter((entry) => entry.tipo === "rasgo" && !entry.tags.includes("rasgo-personaje"))
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
    principiante: "I",
    adepto: "II",
    maestro: "III"
};
const LEVEL_OPTIONS = [
    { value: "principiante", label: "Principiante" },
    { value: "adepto", label: "Adepto" },
    { value: "maestro", label: "Maestro" }
];
const INITIAL_CATALOG_SELECTIONS = {
    habilidades: BUILDER_ABILITIES[0]?.id ?? "",
    rasgosMonstruosos: BUILDER_MONSTER_TRAITS[0]?.id ?? "",
    poderesMisticos: SYMBAROUM_MYSTIC_POWERS[0]?.id ?? "",
    rituales: SYMBAROUM_RITUALS[0]?.id ?? ""
};
const SIMPLE_SECTION_LABELS = {
    bendiciones: "Bendiciones",
    cargas: "Cargas",
    rasgos: "Rasgos"
};
const BUILDER_TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "identidad", label: "Identidad" },
    { id: "profesiones", label: "Profesiones" },
    { id: "compras", label: "Compras PX" },
    { id: "artefactos", label: "Artefactos" },
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
        case "principiante":
        default:
            return 10;
    }
}
function getSimpleCatalogEntries(section) {
    if (section === "bendiciones")
        return SYMBAROUM_BLESSINGS;
    if (section === "cargas")
        return SYMBAROUM_BURDENS;
    return SYMBAROUM_CHARACTER_TRAITS;
}
function getSimpleEntryCost(section) {
    return section === "bendiciones" ? 5 : 0;
}
function getSimpleAddLabel(section) {
    if (section === "bendiciones")
        return "Añadir bendición";
    if (section === "cargas")
        return "Añadir carga";
    return "Añadir rasgo";
}
function getSimpleCapabilityKind(section) {
    if (section === "bendiciones")
        return "bendicion";
    if (section === "cargas")
        return "carga";
    return "rasgo_personaje";
}
function isMonsterTraitCapability(name) {
    return BUILDER_MONSTER_TRAIT_NAME_SET.has(normalizeName(name));
}
function getStoredRatedSection(section) {
    return section === "rasgosMonstruosos" ? "habilidades" : section;
}
function getCapabilityKind(section) {
    if (section === "poderesMisticos")
        return "poder_mistico";
    if (section === "rituales")
        return "ritual";
    if (section === "rasgosMonstruosos")
        return "rasgo_monstruoso";
    return "habilidad";
}
function upsertCapabilitySelection(sheet, section, entry, level, activeProfessionIds) {
    const key = normalizeName(entry.nombre);
    const current = sheet.capabilitySelections.find((selection) => normalizeName(selection.name) === key);
    const unlockingProfessionId = getBenefitProfessionIds(entry.nombre).find((id) => activeProfessionIds.has(id));
    const next = {
        catalogId: entry.id,
        name: entry.nombre,
        kind: getCapabilityKind(section),
        level,
        origin: unlockingProfessionId ? "profesion" : current?.origin ?? "comprada",
        source: entry.libro,
        page: entry.pagina || undefined,
        unlockProfessionId: unlockingProfessionId ?? current?.unlockProfessionId
    };
    return current
        ? sheet.capabilitySelections.map((selection) => normalizeName(selection.name) === key ? { ...selection, ...next } : selection)
        : [...sheet.capabilitySelections, next];
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
function getSectionItemLabel(section) {
    if (section === "habilidades")
        return "Habilidad";
    if (section === "rasgosMonstruosos")
        return "Rasgo monstruoso";
    if (section === "poderesMisticos")
        return "Poder místico";
    return "Ritual";
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
        nivel: "principiante",
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
    if (level === "principiante")
        return "adepto";
    if (level === "adepto")
        return "maestro";
    return null;
}
function getPreviousLevel(level) {
    if (level === "maestro")
        return "adepto";
    if (level === "adepto")
        return "principiante";
    return null;
}
function getUpgradeCost(section, currentLevel) {
    if (section === "rituales") {
        return 0;
    }
    if (currentLevel === "principiante") {
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
    const labels = section === "rasgosMonstruosos" ? ["I", "II", "III"] : ["Principiante", "Adepto", "Maestro"];
    const labelPattern = section === "rasgosMonstruosos" ? "I|II|III" : "Principiante|Adepto|Maestro";
    const matches = [...text.matchAll(new RegExp(`(${labelPattern}):\\s*([\\s\\S]*?)(?=(?:${labelPattern}):|$)`, "gi"))];
    const mapped = new Map();
    for (const match of matches) {
        const parsedLabel = String(match[1] ?? "").trim();
        const rawLabel = normalizeName(parsedLabel) === "principiante" ? "Principiante" : parsedLabel;
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
export function CharacterBuilderView({ character, busy = false, onBackToCharacters, onOpenSheet, onSave, backLabel = "Volver a personajes", sheetLabel = "Abrir hoja", saveLabel = "Guardar constructor", onBindMysticArtifact, onOpenMysticArtifactSource, onAspireProfession, onRemoveProfessionAspiration, onRequestProfession, onLeaveProfession, onOpenCompendiumCapability, professionRemovalLabel = "Abandonar profesión" }) {
    const confirm = useConfirmationDialog();
    const [draft, setDraft] = useState(() => parseCharacterSheet(character.sheet));
    const [catalogSelections, setCatalogSelections] = useState(INITIAL_CATALOG_SELECTIONS);
    const [historicalRerollSpent, setHistoricalRerollSpent] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("resumen");
    const [acquisitionModal, setAcquisitionModal] = useState(null);
    const [simpleCatalogModal, setSimpleCatalogModal] = useState(null);
    const [capabilityConfirmationModal, setCapabilityConfirmationModal] = useState(null);
    const [capabilityDetailsSelection, setCapabilityDetailsSelection] = useState(null);
    const [bindingArtifactId, setBindingArtifactId] = useState(null);
    const [selectedMysticArtifactId, setSelectedMysticArtifactId] = useState(null);
    const [professionBusyId, setProfessionBusyId] = useState(null);
    const [selectedProfessionDetailsId, setSelectedProfessionDetailsId] = useState(null);
    const [isXpDetailsOpen, setIsXpDetailsOpen] = useState(false);
    const artifactBindingXpSpent = character.artifactBindingXpSpent ?? 0;
    const loadedCharacterRef = useRef(null);
    useEffect(() => {
        const parsedSheet = parseCharacterSheet(character.sheet);
        const experience = getCharacterExperienceSummary(parsedSheet);
        setDraft(parsedSheet);
        setCatalogSelections(INITIAL_CATALOG_SELECTIONS);
        const nextArtifactBindingXpSpent = character.artifactBindingXpSpent ?? 0;
        const derivedHistoricalRerollSpent = Math.max(0, parsedSheet.progreso.experienciaGastada - experience.computedSpent - nextArtifactBindingXpSpent);
        const previousCharacter = loadedCharacterRef.current;
        if (previousCharacter && previousCharacter.id !== character.id) {
            setSelectedMysticArtifactId(null);
        }
        setHistoricalRerollSpent((currentHistoricalRerollSpent) => {
            const receivedNewBinding = previousCharacter?.id === character.id
                && nextArtifactBindingXpSpent > previousCharacter.artifactBindingXpSpent;
            return receivedNewBinding
                ? Math.max(currentHistoricalRerollSpent, derivedHistoricalRerollSpent)
                : derivedHistoricalRerollSpent;
        });
        loadedCharacterRef.current = { id: character.id, artifactBindingXpSpent: nextArtifactBindingXpSpent };
        setError(null);
        setActiveTab("resumen");
        setAcquisitionModal(null);
        setSimpleCatalogModal(null);
        setCapabilityConfirmationModal(null);
        setCapabilityDetailsSelection(null);
        setSelectedProfessionDetailsId(null);
    }, [character]);
    const experience = useMemo(() => getCharacterExperienceSummary(draft), [draft]);
    const rerollSpentTotal = experience.spentFromRerolls + historicalRerollSpent;
    const featSpentTotal = experience.spentFromFeats;
    const selectedMysticArtifact = useMemo(() => (character.mysticArtifacts ?? []).find((artifact) => artifact.id === selectedMysticArtifactId) ?? null, [character.mysticArtifacts, selectedMysticArtifactId]);
    useEffect(() => {
        if (selectedMysticArtifactId && !selectedMysticArtifact) {
            setSelectedMysticArtifactId(null);
        }
    }, [selectedMysticArtifact, selectedMysticArtifactId]);
    const artifactBindingXpExpenses = character.artifactBindingXpExpenses ?? [];
    const rerollExpenseDetails = [
        ...experience.rerollExpenses,
        ...(historicalRerollSpent > 0
            ? [{ id: "historical-rerolls", tipo: "repeticion_tirada", cantidad: historicalRerollSpent, fecha: "" }]
            : [])
    ];
    const effectiveSpent = useMemo(() => Math.max(0, experience.computedSpent + artifactBindingXpSpent + historicalRerollSpent), [artifactBindingXpSpent, experience.computedSpent, historicalRerollSpent]);
    const effectiveAvailable = useMemo(() => Math.max(0, experience.effectiveTotal - effectiveSpent), [experience.effectiveTotal, effectiveSpent]);
    const professionContext = useMemo(() => ({
        race: draft.identidad.raza,
        culture: draft.identidad.cultura,
        permanentCorruption: draft.corrupcion.permanente,
        blessings: draft.bendiciones,
        capabilities: normalizeProfessionCapabilities([
            ...draft.capabilitySelections,
            ...draft.habilidades.map((entry) => ({ name: entry.nombre, kind: "habilidad", level: entry.nivel })),
            ...draft.poderesMisticos.map((entry) => ({ name: entry.nombre, kind: "poder_mistico", level: entry.nivel })),
            ...draft.rituales.map((entry) => ({ name: entry.nombre, kind: "ritual", level: entry.nivel }))
        ])
    }), [draft]);
    const professionProgress = useMemo(() => new Map(SYMBAROUM_PROFESSIONS.map((profession) => [profession.id, evaluateProfession(profession, professionContext)])), [professionContext]);
    const selectedProfessionDetails = useMemo(() => SYMBAROUM_PROFESSIONS.find((profession) => profession.id === selectedProfessionDetailsId) ?? null, [selectedProfessionDetailsId]);
    const selectedProfessionMembership = selectedProfessionDetails
        ? (character.professionMemberships ?? []).find((entry) => entry.professionId === selectedProfessionDetails.id) ?? null
        : null;
    const selectedProfessionEligibility = selectedProfessionDetails
        ? professionProgress.get(selectedProfessionDetails.id) ?? null
        : null;
    const selectedProfessionState = selectedProfessionMembership?.effectiveState ?? selectedProfessionMembership?.state ?? null;
    const selectedProfessionStateLabel = selectedProfessionState === "active"
        ? "Activa"
        : selectedProfessionState === "suspended"
            ? "Suspendida"
            : selectedProfessionState === "pending"
                ? "Pendiente"
                : selectedProfessionState === "rejected"
                    ? "Rechazada"
                    : selectedProfessionMembership
                        ? "Objetivo"
                        : "Disponible";
    const activeProfessionIds = useMemo(() => new Set((character.professionMemberships ?? [])
        .filter((membership) => membership.state === "active" && evaluateProfession(membership.professionId, professionContext, { includeAdmissionOnly: false }).eligible)
        .map((membership) => membership.professionId)), [character.professionMemberships, professionContext]);
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
    const selectedBenefitProfessionIds = selectedAcquisitionEntry ? getBenefitProfessionIds(selectedAcquisitionEntry.nombre) : [];
    const selectedBenefitUnlocked = selectedBenefitProfessionIds.length === 0 || selectedBenefitProfessionIds.some((id) => activeProfessionIds.has(id));
    const selectedHigherRitualBase = selectedAcquisitionEntry ? getHigherRitualBase(selectedAcquisitionEntry.nombre) : undefined;
    const selectedHigherRitualBaseMet = !selectedHigherRitualBase || draft.rituales.some((entry) => normalizeProfessionText(entry.nombre) === normalizeProfessionText(selectedHigherRitualBase));
    const simpleCatalogEntries = useMemo(() => simpleCatalogModal ? getSimpleCatalogEntries(simpleCatalogModal.section) : [], [simpleCatalogModal]);
    const filteredSimpleCatalogEntries = useMemo(() => {
        if (!simpleCatalogModal)
            return [];
        const query = normalizeName(simpleCatalogModal.query);
        return simpleCatalogEntries
            .filter((entry) => !draft[simpleCatalogModal.section].some((current) => normalizeName(current) === normalizeName(entry.nombre)))
            .filter((entry) => !query
            || normalizeName(entry.nombre).includes(query)
            || normalizeName(entry.resumen).includes(query)
            || normalizeName(entry.fuente).includes(query));
    }, [draft, simpleCatalogEntries, simpleCatalogModal]);
    const selectedSimpleCatalogEntry = useMemo(() => {
        if (!simpleCatalogModal)
            return null;
        return filteredSimpleCatalogEntries.find((entry) => entry.id === simpleCatalogModal.selectedId)
            ?? filteredSimpleCatalogEntries[0]
            ?? null;
    }, [filteredSimpleCatalogEntries, simpleCatalogModal]);
    async function runProfessionAction(professionId, action) {
        if (!action)
            return;
        setProfessionBusyId(professionId);
        setError(null);
        try {
            await action();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo actualizar la profesión.");
        }
        finally {
            setProfessionBusyId(null);
        }
    }
    function findCatalogEntryByName(section, name) {
        return getCatalogEntries(section).find((entry) => normalizeName(entry.nombre) === normalizeName(name)) ?? null;
    }
    const capabilityDetails = (() => {
        if (!capabilityDetailsSelection)
            return null;
        const entries = getRatedEntriesForSection(draft, capabilityDetailsSelection.section);
        const index = entries.findIndex((entry) => normalizeName(entry.nombre) === normalizeName(capabilityDetailsSelection.name));
        const entry = entries[index];
        if (!entry)
            return null;
        const catalogEntry = findCatalogEntryByName(capabilityDetailsSelection.section, entry.nombre);
        const description = catalogEntry?.efectoResumen ?? entry.efecto ?? entry.notas ?? "";
        const tiers = parseCapabilityTiers(description, capabilityDetailsSelection.section);
        return {
            section: capabilityDetailsSelection.section,
            index,
            entry,
            description,
            tiers,
            sourceLabel: catalogEntry?.libro
                ? `${catalogEntry.libro}${catalogEntry.pagina ? ` p. ${catalogEntry.pagina}` : ""}`
                : entry.fuente
                    ? `${entry.fuente}${entry.pagina ? ` p. ${entry.pagina}` : ""}`
                    : ""
        };
    })();
    function openCapabilityDetails(section, name) {
        setCapabilityDetailsSelection({ section, name });
    }
    function closeCapabilityDetails() {
        setCapabilityDetailsSelection(null);
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
        setDraft((current) => {
            const next = replaceRatedEntriesForSection(current, section, getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) => entryIndex === index ? { ...ratedEntry, nivel: nextLevel } : ratedEntry));
            const catalogEntry = findCatalogEntryByName(section, entry.nombre);
            return catalogEntry ? { ...next, capabilitySelections: upsertCapabilitySelection(next, section, catalogEntry, nextLevel, activeProfessionIds) } : next;
        });
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
            xpLabel: `Gastar ${cost} PX`,
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
        setDraft((current) => {
            const next = replaceRatedEntriesForSection(current, section, getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) => entryIndex === index ? { ...ratedEntry, nivel: previousLevel } : ratedEntry));
            const catalogEntry = findCatalogEntryByName(section, entry.nombre);
            return catalogEntry ? { ...next, capabilitySelections: upsertCapabilitySelection(next, section, catalogEntry, previousLevel, activeProfessionIds) } : next;
        });
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
        const releasedXp = getRatedEntryCost(entry.nivel) - getRatedEntryCost(targetLevel);
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
            cost: releasedXp,
            xpLabel: `Liberar ${releasedXp} PX`,
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
        setDraft((current) => replaceRatedEntriesForSection({ ...current, capabilitySelections: current.capabilitySelections.filter((selection) => normalizeName(selection.name) !== normalizeName(entry.nombre)) }, section, getRatedEntriesForSection(current, section).filter((_, entryIndex) => entryIndex !== index)));
    }
    async function confirmRemoveRatedEntry(section, index) {
        const entry = getRatedEntriesForSection(draft, section)[index];
        if (!entry)
            return;
        const releasedXp = section === "rituales" ? 10 : getRatedEntryCost(entry.nivel);
        const accepted = await confirm({
            title: `Quitar ${entry.nombre}`,
            message: `Se quitará ${entry.nombre} del personaje y se liberarán ${releasedXp} PX en el constructor.`,
            confirmLabel: `Quitar y liberar ${releasedXp} PX`,
            tone: "danger"
        });
        if (!accepted)
            return;
        removeRatedEntry(section, index);
        setCapabilityDetailsSelection(null);
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
        if (!selectedBenefitUnlocked) {
            setError(`${entry.nombre} requiere una profesión activa que lo desbloquee.`);
            return;
        }
        if (!selectedHigherRitualBaseMet) {
            setError(`${entry.nombre} requiere poseer antes ${selectedHigherRitualBase}.`);
            return;
        }
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
        setDraft((current) => {
            const next = replaceRatedEntriesForSection(current, section, [...getRatedEntriesForSection(current, section), buildRatedEntry(entry, section)]);
            return { ...next, capabilitySelections: upsertCapabilitySelection(next, section, entry, "principiante", activeProfessionIds) };
        });
        setAcquisitionModal(null);
    }
    function openAcquisitionConfirmation() {
        if (!acquisitionModal || !selectedAcquisitionEntry) {
            return;
        }
        const cost = 10;
        if (!selectedBenefitUnlocked || !selectedHigherRitualBaseMet) {
            setError(!selectedBenefitUnlocked
                ? `${selectedAcquisitionEntry.nombre} requiere una profesión activa que lo desbloquee.`
                : `${selectedAcquisitionEntry.nombre} requiere poseer antes ${selectedHigherRitualBase}.`);
            return;
        }
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
            targetLevel: "principiante",
            cost,
            xpLabel: `Gastar ${cost} PX`,
            previewSummary: selectedAcquisitionEntry.efectoResumen,
            targetTier: getCapabilityTierForLevel(acquisitionPreviewTiers, "principiante", acquisitionModal.section),
            confirmLabel: `Confirmar ${cost} PX`,
            onConfirm: () => {
                applyAcquisition();
                setCapabilityConfirmationModal(null);
            }
        });
    }
    function removeSimpleEntry(section, index) {
        const removedName = draft[section][index];
        const removedKind = getSimpleCapabilityKind(section);
        setDraft((current) => ({
            ...current,
            [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
            capabilitySelections: current.capabilitySelections.filter((selection) => !(selection.kind === removedKind && normalizeName(selection.name) === normalizeName(removedName ?? "")))
        }));
    }
    function openSimpleCatalogModal(section) {
        const availableEntries = getSimpleCatalogEntries(section).filter((entry) => !draft[section].some((current) => normalizeName(current) === normalizeName(entry.nombre)));
        setSimpleCatalogModal({ section, query: "", selectedId: availableEntries[0]?.id ?? "" });
    }
    async function addSelectedSimpleCatalogEntry() {
        if (!simpleCatalogModal || !selectedSimpleCatalogEntry)
            return;
        const section = simpleCatalogModal.section;
        const entry = selectedSimpleCatalogEntry;
        const cost = getSimpleEntryCost(section);
        if (draft[section].some((current) => normalizeName(current) === normalizeName(entry.nombre))) {
            setError(`${entry.nombre} ya está en ${SIMPLE_SECTION_LABELS[section].toLowerCase()}.`);
            return;
        }
        if (cost > effectiveAvailable) {
            setError(`No hay PX suficientes para obtener ${entry.nombre}.`);
            return;
        }
        if (cost > 0 && !await confirm({
            title: `Comprar ${entry.nombre}`,
            message: `Añadir ${entry.nombre} a las bendiciones del personaje cuesta ${cost} PX.`,
            confirmLabel: `Gastar ${cost} PX`,
            tone: "danger"
        }))
            return;
        setError(null);
        setDraft((current) => ({
            ...current,
            [section]: [...current[section], entry.nombre],
            capabilitySelections: [
                ...current.capabilitySelections,
                {
                    catalogId: entry.id,
                    name: entry.nombre,
                    kind: getSimpleCapabilityKind(section),
                    origin: "comprada",
                    source: entry.fuente,
                    page: entry.pagina
                }
            ]
        }));
        setSimpleCatalogModal(null);
    }
    async function handleSave() {
        setIsSaving(true);
        setError(null);
        try {
            if (effectiveSpent > experience.effectiveTotal) {
                setError(`No puedes gastar ${effectiveSpent} PX: el personaje solo tiene ${experience.effectiveTotal} PX efectivos.`);
                return;
            }
            const nextSheet = synchronizeCharacterSheet({
                ...draft,
                progreso: {
                    ...draft.progreso,
                    experienciaGastada: effectiveSpent,
                    gastosExperiencia: historicalRerollSpent > 0
                        ? [
                            ...draft.progreso.gastosExperiencia,
                            {
                                id: globalThis.crypto?.randomUUID?.() ?? `xp-reroll-history-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                tipo: "repeticion_tirada",
                                cantidad: historicalRerollSpent,
                                fecha: new Date().toISOString()
                            }
                        ]
                        : draft.progreso.gastosExperiencia
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
    async function handleBindArtifact(artifactId, paymentType) {
        if (!onBindMysticArtifact)
            return;
        const artifact = (character.mysticArtifacts ?? []).find((entry) => entry.id === artifactId);
        const cost = artifact?.bindingCosts.find((entry) => entry.paymentType === paymentType);
        const consequence = paymentType === "xp"
            ? `${cost?.amount ?? 0} PX pasarán a experiencia gastada`
            : `ganarás ${cost?.amount ?? 0} punto(s) de Corrupción permanente; esto puede superar tus umbrales, aunque la ficha no te convertirá automáticamente en PNJ`;
        if (!await confirm({
            title: "Vincular artefacto",
            message: `Vincular ${artifact?.name ?? "este artefacto"}: ${consequence}. Romper el vínculo no devuelve el pago.`,
            confirmLabel: "Vincular artefacto",
            tone: "danger"
        }))
            return;
        setBindingArtifactId(artifactId);
        setError(null);
        try {
            await onBindMysticArtifact(artifactId, paymentType);
            setActiveTab("artefactos");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo completar el vinculo.");
        }
        finally {
            setBindingArtifactId(null);
        }
    }
    return (_jsxs("section", { className: "character-builder-page unified-sheet", children: [_jsxs("section", { className: "character-builder-shell campaign-sheet-card", children: [_jsxs("div", { className: "character-builder-sticky-controls", children: [_jsxs("header", { className: "character-builder-header-band module-sticky-header module-sticky-header--single-row", children: [_jsxs("div", { className: "unified-sheet-portrait", children: [_jsx("div", { className: "unified-sheet-portrait-ring" }), _jsx("div", { className: "unified-sheet-portrait-content", children: _jsx("span", { children: String(draft.identidad.arquetipo || character.archetype || "C").slice(0, 1) }) })] }), _jsxs("div", { className: "character-builder-identity", children: [_jsx("h2", { className: "unified-sheet-title", children: draft.identidad.nombrePersonaje || character.name }), _jsx("p", { className: "unified-sheet-inline-subtitle", children: subtitle })] }), _jsxs("div", { className: "toolbar character-builder-toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: onBackToCharacters, children: backLabel }), _jsx("button", { type: "button", className: "subtle-button", onClick: onOpenSheet, children: sheetLabel }), _jsx("button", { type: "button", onClick: () => void handleSave(), disabled: busy || isSaving || bindingArtifactId !== null, children: isSaving ? "Guardando..." : saveLabel })] })] }), _jsx("div", { className: "unified-sheet-tabs character-builder-tabs", children: BUILDER_TABS.map((tab) => (_jsx("button", { type: "button", className: activeTab === tab.id ? "is-active" : "", onClick: () => setActiveTab(tab.id), children: tab.label }, tab.id))) })] }), error ? (_jsx("section", { className: "panel error-list", children: _jsx("p", { children: error }) })) : null, _jsx("section", { className: "character-builder-stage", children: _jsxs("section", { className: "character-builder-layout", children: [activeTab === "resumen" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Constructor" }), _jsx("span", { className: "meta-text", children: "Edicion narrativa y progreso de PX" })] }), _jsxs("div", { className: "character-builder-xp-grid", children: [_jsxs("article", { className: "character-builder-xp-card", children: [_jsx("span", { children: "PX total" }), _jsx("strong", { children: draft.progreso.experienciaTotal })] }), _jsxs("article", { className: "character-builder-xp-card", children: [_jsxs("div", { className: "character-builder-xp-card-heading", children: [_jsx("span", { children: "PX gastada" }), _jsx("button", { type: "button", className: "character-builder-xp-info-button", "aria-label": "Ver detalle de PX gastada", title: "Ver detalle de gastos", onClick: () => setIsXpDetailsOpen(true), children: "i" })] }), _jsx("strong", { children: effectiveSpent })] }), _jsxs("article", { className: "character-builder-xp-card", children: [_jsx("span", { children: "PX disponible" }), _jsx("strong", { children: effectiveAvailable })] })] }), _jsxs("div", { className: "character-builder-summary-notes", children: [_jsxs("p", { children: [_jsx("strong", { children: "PX concedidos:" }), " el total lo gestiona el director de juego desde la campa\u00F1a. El constructor solo permite invertir los puntos disponibles."] }), _jsxs("p", { children: [_jsx("strong", { children: "Origen del PX gastado:" }), " ", experience.spentFromCapabilities, " en capacidades y poderes + ", experience.spentFromRituals, " en rituales + ", experience.spentFromBlessings, " en bendiciones", artifactBindingXpSpent > 0 ? ` + ${artifactBindingXpSpent} en vínculos de artefactos` : "", rerollSpentTotal > 0 ? ` + ${rerollSpentTotal} en repeticiones de dados` : "", featSpentTotal > 0 ? ` + ${featSpentTotal} en hazañas` : "", "."] }), _jsxs("p", { children: [_jsx("strong", { children: "Rituales y rasgos:" }), " los rituales cuestan 10 PX cada uno; los rasgos y las cargas no modifican autom\u00E1ticamente el total concedido."] })] })] })) : null, activeTab === "identidad" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsx("div", { className: "row-actions", children: _jsx("h3", { children: "Identidad" }) }), _jsxs("div", { className: "character-builder-identity-form", children: [_jsxs("section", { className: "character-builder-identity-section", "aria-labelledby": "character-builder-personal-title", children: [_jsx("h4", { id: "character-builder-personal-title", children: "Datos personales" }), _jsxs("div", { className: "character-builder-identity-grid is-personal", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del personaje" }), _jsx("input", { value: draft.identidad.nombrePersonaje, onChange: (event) => updateIdentityField("nombrePersonaje", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Nombre del jugador" }), _jsx("input", { value: draft.identidad.nombreJugador, onChange: (event) => updateIdentityField("nombreJugador", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Edad" }), _jsx("input", { value: draft.identidad.edad, onChange: (event) => updateIdentityField("edad", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Ocupaci\u00F3n descriptiva" }), _jsx("input", { value: draft.identidad.profesion, onChange: (event) => updateIdentityField("profesion", event.target.value) })] })] })] }), _jsxs("section", { className: "character-builder-identity-section", "aria-labelledby": "character-builder-origin-title", children: [_jsx("h4", { id: "character-builder-origin-title", children: "Origen" }), _jsxs("div", { className: "character-builder-identity-grid is-origin", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Raza" }), _jsx("input", { value: draft.identidad.raza, onChange: (event) => updateIdentityField("raza", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cultura" }), _jsx("input", { value: draft.identidad.cultura, onChange: (event) => updateIdentityField("cultura", event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Arquetipo" }), _jsx("input", { value: draft.identidad.arquetipo, onChange: (event) => updateIdentityField("arquetipo", event.target.value) })] })] })] }), _jsxs("section", { className: "character-builder-identity-section", "aria-labelledby": "character-builder-description-title", children: [_jsx("h4", { id: "character-builder-description-title", children: "Descripci\u00F3n" }), _jsxs("div", { className: "character-builder-identity-grid is-description", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Apariencia" }), _jsx("input", { value: draft.identidad.apariencia, onChange: (event) => updateIdentityField("apariencia", event.target.value) })] }), _jsxs("label", { className: "field is-wide", children: [_jsx("span", { children: "Objetivo personal" }), _jsx("input", { value: draft.identidad.objetivoPersonal, onChange: (event) => updateIdentityField("objetivoPersonal", event.target.value) })] }), _jsxs("label", { className: "field is-full", children: [_jsx("span", { children: "Trasfondo" }), _jsx("textarea", { rows: 6, value: draft.identidad.trasfondo, onChange: (event) => updateIdentityField("trasfondo", event.target.value) })] })] })] })] })] })) : null, activeTab === "profesiones" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card profession-builder-panel", children: [_jsx("div", { className: "row-actions", children: _jsxs("div", { children: [_jsx("h3", { children: "Profesiones avanzadas" }), _jsx("p", { className: "section-help", children: "Abre una profesi\u00F3n para consultar sus requisitos, marcarla como objetivo o gestionar su ingreso. Puedes aspirar a varias profesiones." })] }) }), _jsx("div", { className: "profession-builder-list", children: SYMBAROUM_PROFESSIONS.map((profession) => {
                                                const membership = (character.professionMemberships ?? []).find((entry) => entry.professionId === profession.id);
                                                const state = membership?.effectiveState ?? membership?.state ?? null;
                                                const stateLabel = state === "active" ? "Activa" : state === "suspended" ? "Suspendida" : state === "pending" ? "Pendiente" : state === "rejected" ? "Rechazada" : membership ? "Objetivo" : "Disponible";
                                                return (_jsxs("button", { type: "button", className: `profession-list-item profession-list-item--${state ?? "available"}`, onClick: () => setSelectedProfessionDetailsId(profession.id), "aria-label": `Ver detalles de ${profession.name}`, children: [_jsxs("div", { className: "profession-list-item-copy", children: [_jsx("h4", { children: profession.name }), _jsxs("span", { children: [profession.archetype, " \u00B7 Gu\u00EDa Avanzada p. ", profession.page] })] }), _jsxs("div", { className: "profession-list-item-status", children: [_jsx("span", { className: `profession-state profession-state--${state ?? "available"}`, children: stateLabel }), _jsx("span", { className: "profession-list-item-chevron", "aria-hidden": "true", children: "\u203A" })] })] }, profession.id));
                                            }) })] })) : null, activeTab === "compras" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Compras de PX" }), _jsxs("span", { className: "meta-text", children: ["PX disponibles: ", effectiveAvailable] })] }), _jsx("div", { className: "character-builder-purchase-stack", children: ["habilidades", "rasgosMonstruosos", "poderesMisticos", "rituales"].map((section) => {
                                                const sectionEntries = getRatedEntriesForSection(draft, section);
                                                return (_jsxs("article", { className: `character-builder-block character-builder-block--${section}`, children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: getSectionTitle(section) }), _jsxs("div", { className: "toolbar", children: [_jsx("span", { className: "meta-text", children: getSectionCostLabel(section) }), _jsxs("button", { type: "button", onClick: () => openAcquisitionModal(section), children: [_jsx("span", { "aria-hidden": "true", children: "+" }), " ", getAcquireButtonLabel(section)] })] })] }), _jsx("div", { className: "character-builder-entry-list", children: sectionEntries.length > 0 ? sectionEntries.map((entry, index) => {
                                                                const nextLevel = section === "rituales" ? null : getNextLevel(entry.nivel);
                                                                const investedXp = section === "rituales" ? 10 : getRatedEntryCost(entry.nivel);
                                                                return (_jsxs("button", { type: "button", className: `character-builder-entry-card character-builder-entry-card--${section} character-builder-entry-trigger`, "aria-label": `Ver detalles de ${entry.nombre}`, onClick: () => openCapabilityDetails(section, entry.nombre), children: [_jsxs("span", { className: "character-builder-entry-copy", children: [_jsx("strong", { children: entry.nombre }), _jsx("span", { className: "character-builder-entry-level", children: section === "rituales" ? "Nivel único" : `Nivel ${getLevelLabel(section, entry.nivel)}` })] }), _jsxs("span", { className: "character-builder-entry-metric", children: [_jsx("span", { children: "Invertidos" }), _jsxs("strong", { children: [investedXp, " PX"] })] }), _jsxs("span", { className: "character-builder-entry-metric is-next", children: [_jsx("span", { children: section === "rituales" ? "Progresión" : nextLevel ? "Siguiente nivel" : "Progresión" }), _jsx("strong", { children: section === "rituales"
                                                                                        ? "Sin niveles"
                                                                                        : nextLevel
                                                                                            ? `${getLevelLabel(section, nextLevel)} · ${getUpgradeCost(section, entry.nivel)} PX`
                                                                                            : "Nivel máximo" })] })] }, `${section}-${entry.nombre}-${index}`));
                                                            }) : (_jsx("p", { className: "section-help", children: "Sin entradas registradas." })) })] }, section));
                                            }) })] })) : null, activeTab === "rasgos" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Bendiciones, cargas y rasgos" }), _jsx("span", { className: "meta-text", children: "Listas simples para progreso y narrativa." })] }), _jsx("div", { className: "character-builder-simple-sections", children: ["bendiciones", "cargas", "rasgos"].map((section) => {
                                                const sectionTitleId = `character-builder-${section}-title`;
                                                return (_jsxs("article", { className: "character-builder-block character-builder-simple-section", "aria-labelledby": sectionTitleId, children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h4", { id: sectionTitleId, children: SIMPLE_SECTION_LABELS[section] }), _jsx("span", { className: "meta-text", children: section === "bendiciones" ? "5 PX por bendición" : section === "cargas" ? "+5 PX efectivos por carga" : "Sin coste de PX" })] }), _jsx("button", { type: "button", onClick: () => openSimpleCatalogModal(section), children: getSimpleAddLabel(section) })] }), _jsx("div", { className: "character-builder-simple-list", children: draft[section].length > 0 ? draft[section].map((entry, index) => {
                                                                const catalogEntry = getSimpleCatalogEntries(section).find((candidate) => normalizeName(candidate.nombre) === normalizeName(entry));
                                                                return (_jsxs("article", { className: "character-builder-simple-row", children: [_jsxs("div", { className: "character-builder-simple-row__identity", children: [_jsx("strong", { children: entry }), _jsx("span", { children: catalogEntry ? `${catalogEntry.fuente}${catalogEntry.pagina ? ` · p. ${catalogEntry.pagina}` : ""}` : "Entrada histórica fuera del catálogo actual" })] }), _jsxs("div", { className: "character-builder-simple-row__actions", children: [_jsx("span", { className: `compendium-chip${catalogEntry ? " is-active" : ""}`, children: catalogEntry ? "Catálogo oficial" : "Histórica" }), _jsx("button", { type: "button", className: "subtle-button", "aria-label": `Quitar ${entry}`, onClick: () => removeSimpleEntry(section, index), children: "Quitar" })] })] }, `${section}-${entry}-${index}`));
                                                            }) : (_jsx("p", { className: "section-help", children: "Sin entradas registradas." })) })] }, section));
                                            }) })] })) : null, activeTab === "artefactos" ? (_jsxs("section", { className: "character-builder-panel campaign-sheet-card", children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: "Artefactos misticos" }), _jsx("p", { className: "section-help", children: "Solo aparecen los artefactos que el DJ ha entregado a este personaje." })] }), _jsxs("span", { className: "meta-text", children: ["PX disponibles: ", effectiveAvailable] })] }), _jsxs("div", { className: "character-builder-artifact-list", children: [(character.mysticArtifacts ?? []).map((artifact) => (_jsxs("button", { type: "button", className: "character-builder-artifact-row", "aria-label": `Ver detalles de ${artifact.name}`, onClick: () => setSelectedMysticArtifactId(artifact.id), children: [_jsxs("div", { className: "character-builder-artifact-row__identity", children: [_jsx("strong", { children: artifact.name }), _jsxs("span", { children: [BUILDER_ARTIFACT_KIND_LABELS[artifact.kind], " \u00B7 ", artifact.campaignName] })] }), _jsxs("div", { className: "character-builder-artifact-row__status", children: [_jsx("span", { className: `compendium-chip${artifact.isBound ? " is-active" : ""}`, children: artifact.isBound ? "Vinculado" : "Sin vincular" }), _jsx("span", { children: formatBuilderArtifactBindingCosts(artifact.bindingCosts) || "Sin coste configurado" })] })] }, artifact.id))), (character.mysticArtifacts ?? []).length === 0 ? _jsx("p", { className: "section-help", children: "Este personaje no posee artefactos de campa\u00F1a." }) : null] })] })) : null] }) })] }), selectedMysticArtifact ? (_jsx(MysticArtifactDetailsModal, { artifact: selectedMysticArtifact, campaignName: selectedMysticArtifact.campaignName, availableExperience: effectiveAvailable, busy: busy || bindingArtifactId === selectedMysticArtifact.id, onClose: () => setSelectedMysticArtifactId(null), onBind: onBindMysticArtifact ? handleBindArtifact : undefined, onOpenSource: onOpenMysticArtifactSource })) : null, isXpDetailsOpen ? (_jsx("section", { className: "modal-backdrop", onClick: () => setIsXpDetailsOpen(false), children: _jsxs("div", { className: "panel modal-panel character-builder-xp-details-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "character-builder-xp-details-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { id: "character-builder-xp-details-title", children: "Detalle de PX gastada" }), _jsxs("p", { className: "section-help", children: [effectiveSpent, " PX gastados \u00B7 ", effectiveAvailable, " PX disponibles"] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setIsXpDetailsOpen(false), children: "Cerrar" })] }), _jsxs("div", { className: "character-builder-xp-details-body", children: [_jsxs("section", { className: "character-builder-xp-details-section", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: "Capacidades, poderes, rituales y bendiciones" }), _jsxs("strong", { children: [experience.computedSpent - experience.spentFromRerolls - experience.spentFromFeats, " PX"] })] }), _jsxs("div", { className: "character-builder-xp-expense-list", children: [experience.capabilityExpenses.map((expense, index) => (_jsxs("article", { className: "character-builder-xp-expense-row", children: [_jsxs("div", { children: [_jsx("strong", { children: expense.name }), _jsxs("span", { children: [expense.kind === "poder_mistico" ? "Poder místico" : expense.kind === "habilidad" ? "Habilidad" : expense.kind === "ritual" ? "Ritual" : expense.kind === "bendicion" ? "Bendición" : "Capacidad", expense.level ? ` · ${expense.level[0].toUpperCase()}${expense.level.slice(1)}` : ""] })] }), _jsxs("strong", { children: [expense.cost, " PX"] })] }, `${expense.kind}-${expense.name}-${index}`))), experience.capabilityExpenses.length === 0 ? _jsx("p", { className: "section-help", children: "No hay capacidades con coste de PX." }) : null] })] }), _jsxs("section", { className: "character-builder-xp-details-section", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: "V\u00EDnculos de artefactos" }), _jsxs("strong", { children: [artifactBindingXpSpent, " PX"] })] }), _jsxs("div", { className: "character-builder-xp-expense-list", children: [artifactBindingXpExpenses.map((expense) => (_jsxs("article", { className: "character-builder-xp-expense-row", children: [_jsxs("div", { children: [_jsx("strong", { children: expense.artifactName }), _jsxs("span", { children: ["Vinculado \u00B7 ", expense.boundAt ? new Date(expense.boundAt).toLocaleString("es-ES") : "Fecha no disponible"] })] }), _jsxs("strong", { children: [expense.amount, " PX"] })] }, expense.id))), artifactBindingXpExpenses.length === 0 && artifactBindingXpSpent > 0 ? _jsxs("p", { className: "section-help", children: ["Hay ", artifactBindingXpSpent, " PX de v\u00EDnculos hist\u00F3ricos sin detalle nominal disponible."] }) : null, artifactBindingXpSpent === 0 ? _jsx("p", { className: "section-help", children: "No hay v\u00EDnculos pagados con PX." }) : null] })] }), _jsxs("section", { className: "character-builder-xp-details-section", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: "Repeticiones de dados" }), _jsxs("strong", { children: [rerollSpentTotal, " PX"] })] }), _jsxs("div", { className: "character-builder-xp-expense-list", children: [rerollExpenseDetails.map((expense) => (_jsxs("article", { className: "character-builder-xp-expense-row", children: [_jsxs("div", { children: [_jsx("strong", { children: expense.cantidad === 1 ? "Repetición de dado" : `${expense.cantidad} repeticiones de dados` }), _jsx("span", { children: expense.fecha ? new Date(expense.fecha).toLocaleString("es-ES") : "Fecha histórica no disponible" })] }), _jsxs("strong", { children: [expense.cantidad, " PX"] })] }, expense.id))), rerollExpenseDetails.length === 0 ? _jsx("p", { className: "section-help", children: "No se ha gastado PX en repeticiones." }) : null] })] }), _jsxs("section", { className: "character-builder-xp-details-section", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: "Haza\u00F1as" }), _jsxs("strong", { children: [featSpentTotal, " PX"] })] }), _jsxs("div", { className: "character-builder-xp-expense-list", children: [experience.featExpenses.map((expense) => (_jsxs("article", { className: "character-builder-xp-expense-row", children: [_jsxs("div", { children: [_jsx("strong", { children: expense.motivo || "Hazaña sin motivo registrado" }), _jsxs("span", { children: ["Haza\u00F1a \u00B7 ", expense.fecha ? new Date(expense.fecha).toLocaleString("es-ES") : "Fecha no disponible"] })] }), _jsxs("strong", { children: [expense.cantidad, " PX"] })] }, expense.id))), experience.featExpenses.length === 0 ? _jsx("p", { className: "section-help", children: "No se ha gastado PX en haza\u00F1as." }) : null] })] })] })] }) })) : null, selectedProfessionDetails && selectedProfessionEligibility ? (_jsx("section", { className: "modal-backdrop", onClick: () => setSelectedProfessionDetailsId(null), children: _jsxs("div", { className: "modal-panel profession-detail-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "profession-detail-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "profession-detail-header", children: [_jsxs("div", { children: [_jsxs("span", { className: "eyebrow", children: [selectedProfessionDetails.archetype, " \u00B7 Gu\u00EDa Avanzada p. ", selectedProfessionDetails.page] }), _jsx("h3", { id: "profession-detail-title", children: selectedProfessionDetails.name })] }), _jsxs("div", { className: "profession-detail-header-actions", children: [_jsx("span", { className: `profession-state profession-state--${selectedProfessionState ?? "available"}`, children: selectedProfessionStateLabel }), _jsx("button", { type: "button", className: "subtle-button", onClick: () => setSelectedProfessionDetailsId(null), children: "Cerrar" })] })] }), _jsxs("div", { className: "profession-detail-content", children: [_jsx("p", { children: selectedProfessionDetails.summary }), _jsxs("section", { children: [_jsx("h4", { children: "Requisitos" }), _jsxs("div", { className: "profession-requirement-list", children: [selectedProfessionEligibility.requirementResults.map((requirement) => (_jsxs("div", { className: requirement.met ? "is-met" : "is-pending", children: [_jsx("span", { "aria-hidden": "true", children: requirement.met ? "✓" : "○" }), _jsx("span", { children: requirement.label }), _jsxs("strong", { children: [requirement.matchedNames.length > 0 ? requirement.matchedNames.join(" / ") : "Pendiente", requirement.hasMaster ? " · Maestro" : ""] })] }, requirement.id))), _jsxs("div", { className: selectedProfessionEligibility.masterRequirementMet ? "is-met" : "is-pending", children: [_jsx("span", { "aria-hidden": "true", children: selectedProfessionEligibility.masterRequirementMet ? "✓" : "○" }), _jsx("span", { children: "Una capacidad requerida en maestro" })] }), selectedProfessionDetails.otherRequirement ? (_jsxs("div", { className: selectedProfessionEligibility.otherRequirementMet ? "is-met" : "is-pending", children: [_jsx("span", { "aria-hidden": "true", children: selectedProfessionEligibility.otherRequirementMet ? "✓" : "○" }), _jsx("span", { children: selectedProfessionDetails.otherRequirement.label })] })) : null] })] }), _jsxs("section", { className: "profession-benefit-list", children: [_jsx("h4", { children: "Beneficios desbloqueables" }), _jsx("div", { className: "toolbar", children: selectedProfessionDetails.benefits.map((benefit) => onOpenCompendiumCapability && benefit.kind !== "rasgo_monstruoso" ? (_jsx("button", { type: "button", className: "link-button", onClick: () => onOpenCompendiumCapability(benefit.kind, benefit.name), children: benefit.name }, benefit.name)) : _jsx("span", { children: benefit.name }, benefit.name)) })] })] }), _jsxs("footer", { className: "toolbar profession-actions profession-detail-actions", children: [!selectedProfessionMembership && onAspireProfession ? (_jsx("button", { type: "button", disabled: professionBusyId === selectedProfessionDetails.id, onClick: () => void runProfessionAction(selectedProfessionDetails.id, () => onAspireProfession(selectedProfessionDetails.id)), children: "Marcar como objetivo" })) : null, selectedProfessionMembership && ["aspiration", "rejected"].includes(selectedProfessionMembership.state) && onRemoveProfessionAspiration ? (_jsx("button", { type: "button", className: "subtle-button", disabled: professionBusyId === selectedProfessionDetails.id, onClick: () => void runProfessionAction(selectedProfessionDetails.id, () => onRemoveProfessionAspiration(selectedProfessionDetails.id)), children: "Retirar objetivo" })) : null, selectedProfessionMembership && ["aspiration", "rejected"].includes(selectedProfessionMembership.state) && selectedProfessionEligibility.eligible && onRequestProfession ? (_jsx("button", { type: "button", disabled: professionBusyId === selectedProfessionDetails.id, onClick: async () => {
                                        if (!await confirm({
                                            title: "Solicitar ingreso",
                                            message: "Se comprobarán de nuevo todos los requisitos. Si el personaje está en campaña, la solicitud quedará pendiente de aprobación del DJ; si no lo está, el ingreso se activará directamente.",
                                            confirmLabel: "Continuar"
                                        }))
                                            return;
                                        void runProfessionAction(selectedProfessionDetails.id, () => onRequestProfession(selectedProfessionDetails.id));
                                    }, children: "Solicitar ingreso" })) : null, selectedProfessionMembership?.state === "active" && onLeaveProfession ? (_jsx("button", { type: "button", className: "destructive-button", disabled: professionBusyId === selectedProfessionDetails.id, onClick: async () => {
                                        if (!await confirm({
                                            title: "Abandonar profesión",
                                            message: `¿Abandonar ${selectedProfessionDetails.name}? Las capacidades compradas no se borrarán ni reembolsarán.`,
                                            confirmLabel: professionRemovalLabel,
                                            tone: "danger"
                                        }))
                                            return;
                                        void runProfessionAction(selectedProfessionDetails.id, () => onLeaveProfession(selectedProfessionDetails.id));
                                    }, children: professionRemovalLabel })) : null] })] }) })) : null, capabilityDetails ? (() => {
                const { section, entry, index, description, tiers, sourceLabel } = capabilityDetails;
                const isRitual = section === "rituales";
                const investedXp = isRitual ? 10 : getRatedEntryCost(entry.nivel);
                const previousLevel = isRitual ? null : getPreviousLevel(entry.nivel);
                const nextLevel = isRitual ? null : getNextLevel(entry.nivel);
                const upgradeCost = nextLevel ? getUpgradeCost(section, entry.nivel) : 0;
                const currentLevelLabel = isRitual ? "Nivel único" : getLevelLabel(section, entry.nivel);
                const hasCompleteTierBreakdown = !isRitual && tiers.length === 3;
                return (_jsx("section", { className: "modal-backdrop", onClick: closeCapabilityDetails, children: _jsxs("div", { className: "panel modal-panel character-builder-capability-detail-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "character-builder-capability-detail-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "character-builder-capability-detail-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: getSectionItemLabel(section) }), _jsx("h3", { id: "character-builder-capability-detail-title", children: entry.nombre }), _jsx("p", { className: "section-help", children: sourceLabel || "Fuente no registrada" })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: closeCapabilityDetails, children: "Cerrar" })] }), _jsxs("div", { className: "character-builder-capability-detail-summary", children: [_jsxs("article", { children: [_jsx("span", { children: "Nivel actual" }), _jsx("strong", { children: currentLevelLabel })] }), _jsxs("article", { children: [_jsx("span", { children: "PX invertidos" }), _jsxs("strong", { children: [investedXp, " PX"] })] }), _jsxs("article", { children: [_jsx("span", { children: "PX disponibles" }), _jsx("strong", { children: effectiveAvailable })] })] }), _jsx("div", { className: "character-builder-capability-detail-body", children: hasCompleteTierBreakdown ? (_jsx("div", { className: "character-builder-capability-tier-list", "aria-label": "Descripci\u00F3n por niveles", children: tiers.map((tier) => {
                                        const isCurrent = tier.label === currentLevelLabel;
                                        return (_jsxs("section", { className: `character-builder-capability-tier${isCurrent ? " is-current" : ""}`, children: [_jsxs("div", { className: "row-actions", children: [_jsx("h4", { children: tier.label }), isCurrent ? _jsx("span", { className: "character-builder-current-level-badge", children: "Nivel actual" }) : null] }), _jsx("p", { children: tier.content })] }, tier.label));
                                    }) })) : (_jsxs("section", { className: "character-builder-capability-description", children: [_jsx("h4", { children: "Descripci\u00F3n" }), _jsx("p", { children: description || "No hay una descripción detallada registrada." })] })) }), _jsxs("footer", { className: "character-builder-capability-detail-actions", children: [_jsxs("div", { className: "toolbar", children: [previousLevel ? (_jsxs("button", { type: "button", className: "subtle-button", onClick: () => openDowngradeConfirmation(section, index), children: ["Bajar a ", getLevelLabel(section, previousLevel), " \u00B7 liberar ", investedXp - getRatedEntryCost(previousLevel), " PX"] })) : null, nextLevel ? (_jsxs("button", { type: "button", disabled: upgradeCost > effectiveAvailable, title: upgradeCost > effectiveAvailable ? `Faltan ${upgradeCost - effectiveAvailable} PX` : undefined, onClick: () => openUpgradeConfirmation(section, index), children: ["Subir a ", getLevelLabel(section, nextLevel), " \u00B7 ", upgradeCost, " PX"] })) : !isRitual ? _jsx("span", { className: "meta-text", children: "Nivel m\u00E1ximo alcanzado" }) : null, _jsxs("button", { type: "button", className: "destructive-button", onClick: () => void confirmRemoveRatedEntry(section, index), children: ["Quitar \u00B7 liberar ", investedXp, " PX"] })] }), _jsx("button", { type: "button", className: "subtle-button", onClick: closeCapabilityDetails, children: "Cerrar" })] })] }) }));
            })() : null, simpleCatalogModal ? (_jsx("section", { className: "modal-backdrop", onClick: () => setSimpleCatalogModal(null), children: _jsxs("div", { className: "panel modal-panel character-builder-acquisition-modal character-builder-simple-catalog-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "character-builder-simple-catalog-title", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { id: "character-builder-simple-catalog-title", children: getSimpleAddLabel(simpleCatalogModal.section) }), _jsx("span", { className: "meta-text", children: "Solo se muestran entradas del cat\u00E1logo oficial que el personaje a\u00FAn no posee." })] }), _jsx("span", { className: "meta-text", children: simpleCatalogModal.section === "bendiciones" ? `PX disponibles: ${effectiveAvailable}` : SIMPLE_SECTION_LABELS[simpleCatalogModal.section] })] }), _jsxs("div", { className: "character-builder-acquisition-layout", children: [_jsxs("div", { className: "character-builder-acquisition-search", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar en el cat\u00E1logo" }), _jsx("input", { autoFocus: true, value: simpleCatalogModal.query, placeholder: `Buscar ${SIMPLE_SECTION_LABELS[simpleCatalogModal.section].toLowerCase()}...`, onChange: (event) => setSimpleCatalogModal((current) => current ? ({ ...current, query: event.target.value }) : null) })] }), _jsxs("div", { className: "character-builder-acquisition-results", children: [filteredSimpleCatalogEntries.map((entry) => (_jsxs("button", { type: "button", className: `character-builder-acquisition-result${selectedSimpleCatalogEntry?.id === entry.id ? " is-active" : ""}`, onClick: () => setSimpleCatalogModal((current) => current ? ({ ...current, selectedId: entry.id }) : null), children: [_jsx("strong", { children: entry.nombre }), _jsxs("span", { children: [entry.fuente, entry.pagina ? ` · p. ${entry.pagina}` : ""] })] }, entry.id))), filteredSimpleCatalogEntries.length === 0 ? _jsx("p", { className: "section-help", children: "No hay entradas disponibles con este filtro." }) : null] })] }), _jsx("div", { className: "character-builder-acquisition-preview", children: selectedSimpleCatalogEntry ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "character-builder-acquisition-header", children: [_jsx("strong", { children: selectedSimpleCatalogEntry.nombre }), _jsxs("span", { className: "meta-text", children: [selectedSimpleCatalogEntry.fuente, selectedSimpleCatalogEntry.pagina ? ` · p. ${selectedSimpleCatalogEntry.pagina}` : "", getSimpleEntryCost(simpleCatalogModal.section) > 0 ? ` · ${getSimpleEntryCost(simpleCatalogModal.section)} PX` : " · Sin coste de PX"] })] }), _jsx("p", { children: selectedSimpleCatalogEntry.detalle || selectedSimpleCatalogEntry.resumen })] })) : (_jsx("p", { className: "section-help", children: "Selecciona una entrada para consultar sus reglas." })) })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setSimpleCatalogModal(null), children: "Cancelar" }), _jsx("button", { type: "button", disabled: !selectedSimpleCatalogEntry || getSimpleEntryCost(simpleCatalogModal.section) > effectiveAvailable, title: selectedSimpleCatalogEntry && getSimpleEntryCost(simpleCatalogModal.section) > effectiveAvailable ? "No hay PX suficientes" : undefined, onClick: () => void addSelectedSimpleCatalogEntry(), children: simpleCatalogModal.section === "bendiciones" ? "Comprar por 5 PX" : getSimpleAddLabel(simpleCatalogModal.section) })] })] }) })) : null, acquisitionModal ? (_jsx("section", { className: "modal-backdrop", onClick: () => setAcquisitionModal(null), children: _jsxs("div", { className: "panel modal-panel character-builder-acquisition-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: getAcquireButtonLabel(acquisitionModal.section) }), _jsxs("span", { className: "meta-text", children: ["PX disponibles: ", effectiveAvailable] })] }), _jsxs("div", { className: "character-builder-acquisition-layout", children: [_jsxs("div", { className: "character-builder-acquisition-search", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Buscar" }), _jsx("input", { value: acquisitionModal.query, placeholder: "Escribe para buscar...", onChange: (event) => setAcquisitionModal((current) => current ? ({ ...current, query: event.target.value, selectedId: current.selectedId }) : null) })] }), _jsxs("div", { className: "character-builder-acquisition-results", children: [filteredAcquisitionEntries.map((entry) => (_jsxs("button", { type: "button", className: `character-builder-acquisition-result${selectedAcquisitionEntry?.id === entry.id ? " is-active" : ""}`, onClick: () => setAcquisitionModal((current) => current ? ({ ...current, selectedId: entry.id }) : null), children: [_jsx("strong", { children: entry.nombre }), _jsxs("span", { children: [entry.libro, entry.pagina ? ` p. ${entry.pagina}` : ""] }), getBenefitProfessionIds(entry.nombre).length > 0 && !getBenefitProfessionIds(entry.nombre).some((id) => activeProfessionIds.has(id)) ? (_jsx("span", { className: "profession-lock-label", children: "Requiere profesi\u00F3n activa" })) : null] }, entry.id))), filteredAcquisitionEntries.length === 0 ? _jsx("p", { className: "section-help", children: "No hay resultados disponibles." }) : null] })] }), _jsx("div", { className: "character-builder-acquisition-preview", children: selectedAcquisitionEntry ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "character-builder-acquisition-header", children: [_jsx("strong", { children: selectedAcquisitionEntry.nombre }), _jsxs("span", { className: "meta-text", children: [selectedAcquisitionEntry.libro, selectedAcquisitionEntry.pagina ? ` p. ${selectedAcquisitionEntry.pagina}` : "", " \u00B7 10 PX"] })] }), acquisitionPreviewTiers.length > 0 ? (_jsx("div", { className: "character-builder-tier-preview-list", children: acquisitionPreviewTiers.map((tier) => (_jsxs("section", { className: "character-builder-tier-preview", children: [_jsx("h4", { children: tier.label }), _jsx("p", { children: tier.content })] }, `${selectedAcquisitionEntry.id}-${tier.label}`))) })) : (_jsx("p", { className: "section-help", children: selectedAcquisitionEntry.efectoResumen })), !selectedBenefitUnlocked ? _jsx("p", { className: "error-text", children: "Bloqueada: requiere una de sus profesiones asociadas activa y no suspendida." }) : null, !selectedHigherRitualBaseMet ? _jsxs("p", { className: "error-text", children: ["Requiere poseer antes el ritual ", selectedHigherRitualBase, "."] }) : null] })) : (_jsx("p", { className: "section-help", children: "Selecciona una entrada para ver su detalle." })) })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: () => setAcquisitionModal(null), children: "Cancelar" }), _jsx("button", { type: "button", onClick: openAcquisitionConfirmation, disabled: !selectedAcquisitionEntry || effectiveAvailable < 10 || !selectedBenefitUnlocked || !selectedHigherRitualBaseMet, children: "Revisar compra" })] })] }) })) : null, capabilityConfirmationModal ? (_jsx("section", { className: "modal-backdrop", onClick: closeCapabilityConfirmationModal, children: _jsxs("div", { className: "panel modal-panel character-builder-confirmation-modal", onClick: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: capabilityConfirmationModal.mode === "acquire"
                                        ? "Confirmar compra"
                                        : capabilityConfirmationModal.mode === "downgrade"
                                            ? "Confirmar bajada"
                                            : "Confirmar mejora" }), _jsxs("span", { className: "meta-text", children: ["Nivel objetivo: ", getLevelLabel(capabilityConfirmationModal.section, capabilityConfirmationModal.targetLevel)] })] }), _jsxs("div", { className: "character-builder-confirmation-copy", children: [_jsx("strong", { children: capabilityConfirmationModal.name }), _jsxs("span", { className: "meta-text", children: [capabilityConfirmationModal.sourceLabel
                                            ? `${capabilityConfirmationModal.sourceLabel} · `
                                            : "", capabilityConfirmationModal.xpLabel] })] }), capabilityConfirmationModal.targetTier ? (_jsxs("section", { className: "character-builder-confirmation-tier", children: [_jsx("h4", { children: capabilityConfirmationModal.targetTier.label }), _jsx("p", { children: capabilityConfirmationModal.targetTier.content })] })) : (_jsx("p", { className: "section-help", children: capabilityConfirmationModal.previewSummary })), _jsxs("div", { className: "toolbar", children: [_jsx("button", { type: "button", className: "subtle-button", onClick: closeCapabilityConfirmationModal, children: "Cancelar" }), _jsx("button", { type: "button", onClick: capabilityConfirmationModal.onConfirm, children: capabilityConfirmationModal.confirmLabel })] })] }) })) : null] }));
}
