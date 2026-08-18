import { useEffect, useMemo, useRef, useState } from "react";
import {
  SYMBAROUM_ABILITIES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RITUALS,
  SYMBAROUM_PROFESSIONS,
  evaluateProfession,
  getBenefitProfessionIds,
  getHigherRitualBase,
  normalizeProfessionText,
  normalizeProfessionCapabilities,
  parseCharacterSheet,
  synchronizeCharacterSheet,
  type Character,
  type CharacterSheet,
  type MysticArtifact,
  type MysticArtifactPaymentType,
  type SkillLevel,
  type SymbaroumCapability
} from "@umbra/shared";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS, SYMBAROUM_CHARACTER_TRAITS, type CompendiumEntry } from "../models/compendiumEntries";
import { useConfirmationDialog } from "../components/ConfirmationDialogProvider";
import { MysticArtifactDetailsModal } from "../components/MysticArtifactDetailsModal";
import { useMediaQuery } from "../hooks/useMediaQuery";

type RatedSection = "habilidades" | "rasgosMonstruosos" | "poderesMisticos" | "rituales";
type StoredRatedSection = "habilidades" | "poderesMisticos" | "rituales";
type SimpleSection = "bendiciones" | "cargas" | "rasgos";
type BuilderTabId = "resumen" | "identidad" | "profesiones" | "compras" | "artefactos" | "rasgos";
type BuilderAcquisitionModal = {
  section: RatedSection;
  query: string;
  selectedId: string;
};
type BuilderCapabilityConfirmationModal = {
  mode: "acquire" | "upgrade" | "downgrade";
  section: RatedSection;
  name: string;
  sourceLabel: string;
  targetLevel: SkillLevel;
  cost: number;
  xpLabel: string;
  previewSummary: string;
  targetTier: CapabilityTier | null;
  confirmLabel: string;
  onConfirm: () => void;
};
type BuilderCapabilityDetailsSelection = {
  section: RatedSection;
  name: string;
};
type BuilderSimpleCatalogModal = {
  section: SimpleSection;
  query: string;
  selectedId: string;
};

type Props = {
  character: Character;
  busy?: boolean;
  onBackToCharacters: () => void;
  onOpenSheet: () => void;
  onSave: (sheet: CharacterSheet) => Promise<void>;
  backLabel?: string;
  hideBackActionOnMobile?: boolean;
  sheetLabel?: string;
  saveLabel?: string;
  onBindMysticArtifact?: (artifactId: string, paymentType: MysticArtifactPaymentType) => Promise<void>;
  onOpenMysticArtifactSource?: (artifact: MysticArtifact) => Promise<void>;
  onAspireProfession?: (professionId: string) => Promise<void>;
  onRemoveProfessionAspiration?: (professionId: string) => Promise<void>;
  onRequestProfession?: (professionId: string) => Promise<void>;
  onLeaveProfession?: (professionId: string) => Promise<void>;
  onOpenCompendiumCapability?: (tipo: "habilidad" | "poder_mistico" | "ritual", nombre: string) => void;
  professionRemovalLabel?: string;
};

type CatalogSelections = {
  habilidades: string;
  rasgosMonstruosos: string;
  poderesMisticos: string;
  rituales: string;
};

type CapabilityTier = {
  label: string;
  content: string;
};

const BUILDER_ARTIFACT_KIND_LABELS = { weapon: "Arma", armor: "Armadura", object: "Objeto" } as const;

function formatBuilderArtifactBindingCosts(bindingCosts: MysticArtifact["bindingCosts"]): string {
  return bindingCosts
    .map((cost) => cost.paymentType === "xp" ? `${cost.amount} PX` : `${cost.amount} Corrupción permanente`)
    .join(" o ");
}

const BUILDER_ABILITIES = SYMBAROUM_ABILITIES.filter((entry) => normalizeName(entry.nombre) !== "rituales");
const BUILDER_MONSTER_TRAITS: SymbaroumCapability[] = ALL_ENTRIES
  .filter((entry): entry is CompendiumEntry => entry.tipo === "rasgo" && !entry.tags.includes("rasgo-personaje"))
  .map((entry) => ({
    id: entry.id,
    nombre: entry.nombre,
    tipo: "habilidad" as const,
    tradiciones: [],
    libro: entry.fuente,
    pagina: entry.pagina ?? 0,
    efectoResumen: entry.detalle,
    acciones: []
  }));
const BUILDER_MONSTER_TRAIT_NAME_SET = new Set(BUILDER_MONSTER_TRAITS.map((entry) => normalizeName(entry.nombre)));
const ROMAN_LEVEL_LABELS: Record<SkillLevel, string> = {
  principiante: "I",
  adepto: "II",
  maestro: "III"
};

const LEVEL_OPTIONS: Array<{ value: SkillLevel; label: string }> = [
  { value: "principiante", label: "Principiante" },
  { value: "adepto", label: "Adepto" },
  { value: "maestro", label: "Maestro" }
];

const INITIAL_CATALOG_SELECTIONS: CatalogSelections = {
  habilidades: BUILDER_ABILITIES[0]?.id ?? "",
  rasgosMonstruosos: BUILDER_MONSTER_TRAITS[0]?.id ?? "",
  poderesMisticos: SYMBAROUM_MYSTIC_POWERS[0]?.id ?? "",
  rituales: SYMBAROUM_RITUALS[0]?.id ?? ""
};

const SIMPLE_SECTION_LABELS: Record<SimpleSection, string> = {
  bendiciones: "Bendiciones",
  cargas: "Cargas",
  rasgos: "Rasgos"
};

const BUILDER_TABS: Array<{ id: BuilderTabId; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "identidad", label: "Identidad" },
  { id: "profesiones", label: "Profesiones" },
  { id: "compras", label: "Compras PX" },
  { id: "artefactos", label: "Artefactos" },
  { id: "rasgos", label: "Rasgos y cargas" }
];

function normalizeName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getRatedEntryCost(level: SkillLevel): number {
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

function getSimpleCatalogEntries(section: SimpleSection): CompendiumEntry[] {
  if (section === "bendiciones") return SYMBAROUM_BLESSINGS;
  if (section === "cargas") return SYMBAROUM_BURDENS;
  return SYMBAROUM_CHARACTER_TRAITS;
}

function getSimpleEntryCost(section: SimpleSection): number {
  return section === "bendiciones" ? 5 : 0;
}

function getSimpleAddLabel(section: SimpleSection): string {
  if (section === "bendiciones") return "Añadir bendición";
  if (section === "cargas") return "Añadir carga";
  return "Añadir rasgo";
}

function getSimpleCapabilityKind(section: SimpleSection): "bendicion" | "carga" | "rasgo_personaje" {
  if (section === "bendiciones") return "bendicion";
  if (section === "cargas") return "carga";
  return "rasgo_personaje";
}

function isMonsterTraitCapability(name: string): boolean {
  return BUILDER_MONSTER_TRAIT_NAME_SET.has(normalizeName(name));
}

function getStoredRatedSection(section: RatedSection): StoredRatedSection {
  return section === "rasgosMonstruosos" ? "habilidades" : section;
}

function getCapabilityKind(section: RatedSection): "habilidad" | "poder_mistico" | "ritual" | "rasgo_monstruoso" {
  if (section === "poderesMisticos") return "poder_mistico";
  if (section === "rituales") return "ritual";
  if (section === "rasgosMonstruosos") return "rasgo_monstruoso";
  return "habilidad";
}

function upsertCapabilitySelection(
  sheet: CharacterSheet,
  section: RatedSection,
  entry: SymbaroumCapability,
  level: SkillLevel,
  activeProfessionIds: Set<string>
): CharacterSheet["capabilitySelections"] {
  const key = normalizeName(entry.nombre);
  const current = sheet.capabilitySelections.find((selection) => normalizeName(selection.name) === key);
  const unlockingProfessionId = getBenefitProfessionIds(entry.nombre).find((id) => activeProfessionIds.has(id));
  const next = {
    catalogId: entry.id,
    name: entry.nombre,
    kind: getCapabilityKind(section),
    level,
    origin: unlockingProfessionId ? "profesion" as const : current?.origin ?? "comprada" as const,
    source: entry.libro,
    page: entry.pagina || undefined,
    unlockProfessionId: unlockingProfessionId ?? current?.unlockProfessionId
  };
  return current
    ? sheet.capabilitySelections.map((selection) => normalizeName(selection.name) === key ? { ...selection, ...next } : selection)
    : [...sheet.capabilitySelections, next];
}

function getRatedEntriesForSection(sheet: CharacterSheet, section: RatedSection): CharacterSheet["habilidades"] {
  if (section === "habilidades") {
    return sheet.habilidades.filter((entry) => !isMonsterTraitCapability(entry.nombre));
  }
  if (section === "rasgosMonstruosos") {
    return sheet.habilidades.filter((entry) => isMonsterTraitCapability(entry.nombre));
  }
  return sheet[getStoredRatedSection(section)];
}

function replaceRatedEntriesForSection(
  sheet: CharacterSheet,
  section: RatedSection,
  nextEntries: CharacterSheet["habilidades"]
): CharacterSheet {
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

function getSectionTitle(section: RatedSection): string {
  if (section === "habilidades") return "Habilidades";
  if (section === "rasgosMonstruosos") return "Rasgos monstruosos";
  if (section === "poderesMisticos") return "Poderes";
  return "Rituales";
}

function getSectionItemLabel(section: RatedSection): string {
  if (section === "habilidades") return "Habilidad";
  if (section === "rasgosMonstruosos") return "Rasgo monstruoso";
  if (section === "poderesMisticos") return "Poder místico";
  return "Ritual";
}

function getAcquireButtonLabel(section: RatedSection): string {
  if (section === "habilidades") return "Obtener nueva habilidad";
  if (section === "rasgosMonstruosos") return "Obtener nuevo rasgo";
  if (section === "poderesMisticos") return "Obtener nuevo poder";
  return "Obtener nuevo ritual";
}

function getLevelLabel(section: RatedSection, level: SkillLevel): string {
  return section === "rasgosMonstruosos"
    ? ROMAN_LEVEL_LABELS[level]
    : LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

function buildRatedEntry(entry: SymbaroumCapability, section: RatedSection): CharacterSheet["habilidades"][number] {
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

function getCatalogEntries(section: RatedSection): SymbaroumCapability[] {
  if (section === "habilidades") return [...BUILDER_ABILITIES];
  if (section === "rasgosMonstruosos") return [...BUILDER_MONSTER_TRAITS];
  if (section === "poderesMisticos") return [...SYMBAROUM_MYSTIC_POWERS];
  return [...SYMBAROUM_RITUALS];
}

function getSectionCostLabel(section: RatedSection): string {
  return section === "rituales" ? "10 PX por ritual" : "10 / 30 / 60 PX";
}

function getNextLevel(level: SkillLevel): SkillLevel | null {
  if (level === "principiante") return "adepto";
  if (level === "adepto") return "maestro";
  return null;
}

function getPreviousLevel(level: SkillLevel): SkillLevel | null {
  if (level === "maestro") return "adepto";
  if (level === "adepto") return "principiante";
  return null;
}

function getUpgradeCost(section: RatedSection, currentLevel: SkillLevel): number {
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

function parseCapabilityTiers(detail: string, section: RatedSection): CapabilityTier[] {
  const text = String(detail ?? "").trim();
  if (!text) {
    return [];
  }
  const labels = section === "rasgosMonstruosos" ? ["I", "II", "III"] : ["Principiante", "Adepto", "Maestro"];
  const labelPattern = section === "rasgosMonstruosos" ? "I|II|III" : "Principiante|Adepto|Maestro";
  const matches = [...text.matchAll(new RegExp(`(${labelPattern}):\\s*([\\s\\S]*?)(?=(?:${labelPattern}):|$)`, "gi"))];
  const mapped = new Map<string, CapabilityTier>();
  for (const match of matches) {
    const parsedLabel = String(match[1] ?? "").trim();
    const rawLabel = normalizeName(parsedLabel) === "principiante" ? "Principiante" : parsedLabel;
    const content = match[2]?.trim();
    if (!content) continue;
    const label = labels.find((entry) => normalizeName(entry) === normalizeName(rawLabel)) ?? null;
    if (!label || mapped.has(label)) continue;
    mapped.set(label, { label, content });
  }
  return labels.map((label) => mapped.get(label)).filter((tier): tier is CapabilityTier => Boolean(tier));
}

function getCapabilityTierForLevel(tiers: CapabilityTier[], level: SkillLevel, section: RatedSection): CapabilityTier | null {
  const targetLabel = getLevelLabel(section, level);
  return tiers.find((tier) => tier.label === targetLabel) ?? null;
}

export function CharacterBuilderView({
  character,
  busy = false,
  onBackToCharacters,
  onOpenSheet,
  onSave,
  backLabel = "Volver a personajes",
  hideBackActionOnMobile = false,
  sheetLabel = "Abrir hoja",
  saveLabel = "Guardar constructor",
  onBindMysticArtifact,
  onOpenMysticArtifactSource,
  onAspireProfession,
  onRemoveProfessionAspiration,
  onRequestProfession,
  onLeaveProfession,
  onOpenCompendiumCapability,
  professionRemovalLabel = "Abandonar profesión"
}: Props) {
  const confirm = useConfirmationDialog();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [draft, setDraft] = useState<CharacterSheet>(() => parseCharacterSheet(character.sheet));
  const [catalogSelections, setCatalogSelections] = useState<CatalogSelections>(INITIAL_CATALOG_SELECTIONS);
  const [historicalRerollSpent, setHistoricalRerollSpent] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BuilderTabId>("resumen");
  const [acquisitionModal, setAcquisitionModal] = useState<BuilderAcquisitionModal | null>(null);
  const [simpleCatalogModal, setSimpleCatalogModal] = useState<BuilderSimpleCatalogModal | null>(null);
  const [capabilityConfirmationModal, setCapabilityConfirmationModal] = useState<BuilderCapabilityConfirmationModal | null>(null);
  const [capabilityDetailsSelection, setCapabilityDetailsSelection] = useState<BuilderCapabilityDetailsSelection | null>(null);
  const [bindingArtifactId, setBindingArtifactId] = useState<string | null>(null);
  const [selectedMysticArtifactId, setSelectedMysticArtifactId] = useState<string | null>(null);
  const [professionBusyId, setProfessionBusyId] = useState<string | null>(null);
  const [selectedProfessionDetailsId, setSelectedProfessionDetailsId] = useState<string | null>(null);
  const [isXpDetailsOpen, setIsXpDetailsOpen] = useState(false);
  const artifactBindingXpSpent = character.artifactBindingXpSpent ?? 0;
  const loadedCharacterRef = useRef<{ id: string; artifactBindingXpSpent: number } | null>(null);

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
  const selectedMysticArtifact = useMemo(
    () => (character.mysticArtifacts ?? []).find((artifact) => artifact.id === selectedMysticArtifactId) ?? null,
    [character.mysticArtifacts, selectedMysticArtifactId]
  );
  useEffect(() => {
    if (selectedMysticArtifactId && !selectedMysticArtifact) {
      setSelectedMysticArtifactId(null);
    }
  }, [selectedMysticArtifact, selectedMysticArtifactId]);
  const artifactBindingXpExpenses = character.artifactBindingXpExpenses ?? [];
  const rerollExpenseDetails = [
    ...experience.rerollExpenses,
    ...(historicalRerollSpent > 0
      ? [{ id: "historical-rerolls", tipo: "repeticion_tirada" as const, cantidad: historicalRerollSpent, fecha: "" }]
      : [])
  ];
  const effectiveSpent = useMemo(
    () => Math.max(0, experience.computedSpent + artifactBindingXpSpent + historicalRerollSpent),
    [artifactBindingXpSpent, experience.computedSpent, historicalRerollSpent]
  );
  const effectiveAvailable = useMemo(
    () => Math.max(0, experience.effectiveTotal - effectiveSpent),
    [experience.effectiveTotal, effectiveSpent]
  );
  const professionContext = useMemo(() => ({
    race: draft.identidad.raza,
    culture: draft.identidad.cultura,
    permanentCorruption: draft.corrupcion.permanente,
    blessings: draft.bendiciones,
    capabilities: normalizeProfessionCapabilities([
      ...draft.capabilitySelections,
      ...draft.habilidades.map((entry) => ({ name: entry.nombre, kind: "habilidad" as const, level: entry.nivel })),
      ...draft.poderesMisticos.map((entry) => ({ name: entry.nombre, kind: "poder_mistico" as const, level: entry.nivel })),
      ...draft.rituales.map((entry) => ({ name: entry.nombre, kind: "ritual" as const, level: entry.nivel }))
    ])
  }), [draft]);
  const professionProgress = useMemo(() => new Map(
    SYMBAROUM_PROFESSIONS.map((profession) => [profession.id, evaluateProfession(profession, professionContext)])
  ), [professionContext]);
  const selectedProfessionDetails = useMemo(
    () => SYMBAROUM_PROFESSIONS.find((profession) => profession.id === selectedProfessionDetailsId) ?? null,
    [selectedProfessionDetailsId]
  );
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
  const activeProfessionIds = useMemo(() => new Set(
    (character.professionMemberships ?? [])
      .filter((membership) => membership.state === "active" && evaluateProfession(membership.professionId, professionContext, { includeAdmissionOnly: false }).eligible)
      .map((membership) => membership.professionId)
  ), [character.professionMemberships, professionContext]);
  const subtitle = `${draft.identidad.cultura || "Sin cultura"} · ${draft.identidad.arquetipo || "Sin arquetipo"} · ${draft.identidad.raza || "Sin raza"}`;
  const acquisitionCatalogEntries = useMemo(
    () => acquisitionModal ? getCatalogEntries(acquisitionModal.section) : [],
    [acquisitionModal]
  );
  const filteredAcquisitionEntries = useMemo(() => {
    if (!acquisitionModal) {
      return [];
    }
    const query = normalizeName(acquisitionModal.query);
    const sectionEntries = getRatedEntriesForSection(draft, acquisitionModal.section);
    const entries = acquisitionCatalogEntries.filter((entry) =>
      !sectionEntries.some((current) => normalizeName(current.nombre) === normalizeName(entry.nombre))
    );
    if (!query) {
      return entries.slice(0, 12);
    }
    return entries
      .filter((entry) =>
        normalizeName(entry.nombre).includes(query) ||
        normalizeName(entry.efectoResumen).includes(query) ||
        normalizeName(entry.libro).includes(query)
      )
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
  const acquisitionPreviewTiers = useMemo(
    () => parseCapabilityTiers(selectedAcquisitionEntry?.efectoResumen ?? "", acquisitionModal?.section ?? "habilidades"),
    [acquisitionModal?.section, selectedAcquisitionEntry]
  );
  const selectedBenefitProfessionIds = selectedAcquisitionEntry ? getBenefitProfessionIds(selectedAcquisitionEntry.nombre) : [];
  const selectedBenefitUnlocked = selectedBenefitProfessionIds.length === 0 || selectedBenefitProfessionIds.some((id) => activeProfessionIds.has(id));
  const selectedHigherRitualBase = selectedAcquisitionEntry ? getHigherRitualBase(selectedAcquisitionEntry.nombre) : undefined;
  const selectedHigherRitualBaseMet = !selectedHigherRitualBase || draft.rituales.some((entry) => normalizeProfessionText(entry.nombre) === normalizeProfessionText(selectedHigherRitualBase));
  const simpleCatalogEntries = useMemo(
    () => simpleCatalogModal ? getSimpleCatalogEntries(simpleCatalogModal.section) : [],
    [simpleCatalogModal]
  );
  const filteredSimpleCatalogEntries = useMemo(() => {
    if (!simpleCatalogModal) return [];
    const query = normalizeName(simpleCatalogModal.query);
    return simpleCatalogEntries
      .filter((entry) => !draft[simpleCatalogModal.section].some((current) => normalizeName(current) === normalizeName(entry.nombre)))
      .filter((entry) => !query
        || normalizeName(entry.nombre).includes(query)
        || normalizeName(entry.resumen).includes(query)
        || normalizeName(entry.fuente).includes(query));
  }, [draft, simpleCatalogEntries, simpleCatalogModal]);
  const selectedSimpleCatalogEntry = useMemo(() => {
    if (!simpleCatalogModal) return null;
    return filteredSimpleCatalogEntries.find((entry) => entry.id === simpleCatalogModal.selectedId)
      ?? filteredSimpleCatalogEntries[0]
      ?? null;
  }, [filteredSimpleCatalogEntries, simpleCatalogModal]);

  async function runProfessionAction(professionId: string, action: (() => Promise<void>) | undefined): Promise<void> {
    if (!action) return;
    setProfessionBusyId(professionId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la profesión.");
    } finally {
      setProfessionBusyId(null);
    }
  }

  function findCatalogEntryByName(section: RatedSection, name: string): SymbaroumCapability | null {
    return getCatalogEntries(section).find((entry) => normalizeName(entry.nombre) === normalizeName(name)) ?? null;
  }

  const capabilityDetails = (() => {
    if (!capabilityDetailsSelection) return null;
    const entries = getRatedEntriesForSection(draft, capabilityDetailsSelection.section);
    const index = entries.findIndex((entry) => normalizeName(entry.nombre) === normalizeName(capabilityDetailsSelection.name));
    const entry = entries[index];
    if (!entry) return null;
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

  function openCapabilityDetails(section: RatedSection, name: string): void {
    setCapabilityDetailsSelection({ section, name });
  }

  function closeCapabilityDetails(): void {
    setCapabilityDetailsSelection(null);
  }

  function closeCapabilityConfirmationModal(): void {
    setCapabilityConfirmationModal(null);
  }

  function updateIdentityField<K extends keyof CharacterSheet["identidad"]>(field: K, value: CharacterSheet["identidad"][K]): void {
    setDraft((current) => ({
      ...current,
      identidad: {
        ...current.identidad,
        [field]: value
      }
    }));
  }

  function applyRatedEntryLevelUp(section: RatedSection, index: number): void {
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

  function openUpgradeConfirmation(section: RatedSection, index: number): void {
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

  function levelDownRatedEntry(section: RatedSection, index: number): void {
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

  function openDowngradeConfirmation(section: RatedSection, index: number): void {
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

  function removeRatedEntry(section: RatedSection, index: number): void {
    const entry = getRatedEntriesForSection(draft, section)[index];
    if (!entry) {
      return;
    }
    setError(null);
    setDraft((current) => replaceRatedEntriesForSection(
      { ...current, capabilitySelections: current.capabilitySelections.filter((selection) => normalizeName(selection.name) !== normalizeName(entry.nombre)) },
      section,
      getRatedEntriesForSection(current, section).filter((_, entryIndex) => entryIndex !== index)
    ));
  }

  async function confirmRemoveRatedEntry(section: RatedSection, index: number): Promise<void> {
    const entry = getRatedEntriesForSection(draft, section)[index];
    if (!entry) return;
    const releasedXp = section === "rituales" ? 10 : getRatedEntryCost(entry.nivel);
    const accepted = await confirm({
      title: `Quitar ${entry.nombre}`,
      message: `Se quitará ${entry.nombre} del personaje y se liberarán ${releasedXp} PX en el constructor.`,
      confirmLabel: `Quitar y liberar ${releasedXp} PX`,
      tone: "danger"
    });
    if (!accepted) return;
    removeRatedEntry(section, index);
    setCapabilityDetailsSelection(null);
  }

  function openAcquisitionModal(section: RatedSection): void {
    const entries = getCatalogEntries(section).filter((entry) =>
      !getRatedEntriesForSection(draft, section).some((current) => normalizeName(current.nombre) === normalizeName(entry.nombre))
    );
    setAcquisitionModal({
      section,
      query: "",
      selectedId: entries[0]?.id ?? ""
    });
  }

  function applyAcquisition(): void {
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

  function openAcquisitionConfirmation(): void {
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

  function removeSimpleEntry(section: SimpleSection, index: number): void {
    const removedName = draft[section][index];
    const removedKind = getSimpleCapabilityKind(section);
    setDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
      capabilitySelections: current.capabilitySelections.filter((selection) => !(
        selection.kind === removedKind && normalizeName(selection.name) === normalizeName(removedName ?? "")
      ))
    }));
  }

  function openSimpleCatalogModal(section: SimpleSection): void {
    const availableEntries = getSimpleCatalogEntries(section).filter((entry) =>
      !draft[section].some((current) => normalizeName(current) === normalizeName(entry.nombre))
    );
    setSimpleCatalogModal({ section, query: "", selectedId: availableEntries[0]?.id ?? "" });
  }

  async function addSelectedSimpleCatalogEntry(): Promise<void> {
    if (!simpleCatalogModal || !selectedSimpleCatalogEntry) return;
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
    })) return;
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

  async function handleSave(): Promise<void> {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el constructor.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindArtifact(artifactId: string, paymentType: MysticArtifactPaymentType): Promise<void> {
    if (!onBindMysticArtifact) return;
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
    })) return;
    setBindingArtifactId(artifactId);
    setError(null);
    try {
      await onBindMysticArtifact(artifactId, paymentType);
      setActiveTab("artefactos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el vinculo.");
    } finally {
      setBindingArtifactId(null);
    }
  }

  return (
    <section className="character-builder-page unified-sheet">
      <section className="character-builder-shell campaign-sheet-card">
        <div className="character-builder-sticky-controls">
          <header className={`character-builder-header-band module-sticky-header module-sticky-header--single-row${hideBackActionOnMobile ? " is-mobile-back-hidden" : ""}`}>
            <div className="unified-sheet-portrait">
              <div className="unified-sheet-portrait-ring" />
              <div className="unified-sheet-portrait-content">
                <span>{String(draft.identidad.arquetipo || character.archetype || "C").slice(0, 1)}</span>
              </div>
            </div>
            <div className="character-builder-identity">
              <h2 className="unified-sheet-title">{draft.identidad.nombrePersonaje || character.name}</h2>
              <p className="unified-sheet-inline-subtitle">{subtitle}</p>
            </div>
            <div className={`toolbar character-builder-toolbar${hideBackActionOnMobile && isMobile ? " is-mobile-two-actions" : ""}`}>
              {!hideBackActionOnMobile || !isMobile ? (
                <button type="button" className="subtle-button character-builder-back-action" onClick={onBackToCharacters}>{backLabel}</button>
              ) : null}
              <button type="button" className="subtle-button character-builder-sheet-action" onClick={onOpenSheet}>{sheetLabel}</button>
              <button type="button" className="character-builder-save-action" onClick={() => void handleSave()} disabled={busy || isSaving || bindingArtifactId !== null}>
                {isSaving ? "Guardando..." : saveLabel}
              </button>
            </div>
          </header>

          <div className="unified-sheet-tabs character-builder-tabs">
            {BUILDER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <section className="panel error-list">
            <p>{error}</p>
          </section>
        ) : null}

        <section className="character-builder-stage">
          <section className="character-builder-layout">
            {activeTab === "resumen" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <h3>Constructor</h3>
                  <span className="meta-text">Edicion narrativa y progreso de PX</span>
                </div>
                <div className="character-builder-xp-grid">
                  <article className="character-builder-xp-card">
                    <span>PX total</span>
                    <strong>{draft.progreso.experienciaTotal}</strong>
                  </article>
                  <article className="character-builder-xp-card">
                    <div className="character-builder-xp-card-heading">
                      <span>PX gastada</span>
                      <button
                        type="button"
                        className="character-builder-xp-info-button"
                        aria-label="Ver detalle de PX gastada"
                        title="Ver detalle de gastos"
                        onClick={() => setIsXpDetailsOpen(true)}
                      >i</button>
                    </div>
                    <strong>{effectiveSpent}</strong>
                  </article>
                  <article className="character-builder-xp-card">
                    <span>PX disponible</span>
                    <strong>{effectiveAvailable}</strong>
                  </article>
                </div>

                <div className="character-builder-summary-notes">
                  <p><strong>PX concedidos:</strong> el total lo gestiona el director de juego desde la campaña. El constructor solo permite invertir los puntos disponibles.</p>
                  <p><strong>Origen del PX gastado:</strong> {experience.spentFromCapabilities} en capacidades y poderes + {experience.spentFromRituals} en rituales + {experience.spentFromBlessings} en bendiciones{artifactBindingXpSpent > 0 ? ` + ${artifactBindingXpSpent} en vínculos de artefactos` : ""}{rerollSpentTotal > 0 ? ` + ${rerollSpentTotal} en repeticiones de dados` : ""}{featSpentTotal > 0 ? ` + ${featSpentTotal} en hazañas` : ""}.</p>
                  <p><strong>Rituales y rasgos:</strong> los rituales cuestan 10 PX cada uno; los rasgos y las cargas no modifican automáticamente el total concedido.</p>
                </div>
              </section>
            ) : null}

            {activeTab === "identidad" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <h3>Identidad</h3>
                </div>
                <div className="character-builder-identity-form">
                  <section className="character-builder-identity-section" aria-labelledby="character-builder-personal-title">
                    <h4 id="character-builder-personal-title">Datos personales</h4>
                    <div className="character-builder-identity-grid is-personal">
                      <label className="field">
                        <span>Nombre del personaje</span>
                        <input value={draft.identidad.nombrePersonaje} onChange={(event) => updateIdentityField("nombrePersonaje", event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Nombre del jugador</span>
                        <input value={draft.identidad.nombreJugador} onChange={(event) => updateIdentityField("nombreJugador", event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Edad</span>
                        <input value={draft.identidad.edad} onChange={(event) => updateIdentityField("edad", event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Ocupación descriptiva</span>
                        <input value={draft.identidad.profesion} onChange={(event) => updateIdentityField("profesion", event.target.value)} />
                      </label>
                    </div>
                  </section>

                  <section className="character-builder-identity-section" aria-labelledby="character-builder-origin-title">
                    <h4 id="character-builder-origin-title">Origen</h4>
                    <div className="character-builder-identity-grid is-origin">
                      <label className="field">
                        <span>Raza</span>
                        <input value={draft.identidad.raza} onChange={(event) => updateIdentityField("raza", event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Cultura</span>
                        <input value={draft.identidad.cultura} onChange={(event) => updateIdentityField("cultura", event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Arquetipo</span>
                        <input value={draft.identidad.arquetipo} onChange={(event) => updateIdentityField("arquetipo", event.target.value)} />
                      </label>
                    </div>
                  </section>

                  <section className="character-builder-identity-section" aria-labelledby="character-builder-description-title">
                    <h4 id="character-builder-description-title">Descripción</h4>
                    <div className="character-builder-identity-grid is-description">
                      <label className="field">
                        <span>Apariencia</span>
                        <input value={draft.identidad.apariencia} onChange={(event) => updateIdentityField("apariencia", event.target.value)} />
                      </label>
                      <label className="field is-wide">
                        <span>Objetivo personal</span>
                        <input value={draft.identidad.objetivoPersonal} onChange={(event) => updateIdentityField("objetivoPersonal", event.target.value)} />
                      </label>
                      <label className="field is-full">
                        <span>Trasfondo</span>
                        <textarea rows={6} value={draft.identidad.trasfondo} onChange={(event) => updateIdentityField("trasfondo", event.target.value)} />
                      </label>
                    </div>
                  </section>
                </div>
              </section>
            ) : null}

            {activeTab === "profesiones" ? (
              <section className="character-builder-panel campaign-sheet-card profession-builder-panel">
                <div className="row-actions">
                  <div>
                    <h3>Profesiones avanzadas</h3>
                    <p className="section-help">Abre una profesión para consultar sus requisitos, marcarla como objetivo o gestionar su ingreso. Puedes aspirar a varias profesiones.</p>
                  </div>
                </div>
                <div className="profession-builder-list">
                  {SYMBAROUM_PROFESSIONS.map((profession) => {
                    const membership = (character.professionMemberships ?? []).find((entry) => entry.professionId === profession.id);
                    const state = membership?.effectiveState ?? membership?.state ?? null;
                    const stateLabel = state === "active" ? "Activa" : state === "suspended" ? "Suspendida" : state === "pending" ? "Pendiente" : state === "rejected" ? "Rechazada" : membership ? "Objetivo" : "Disponible";
                    return (
                      <button
                        key={profession.id}
                        type="button"
                        className={`profession-list-item profession-list-item--${state ?? "available"}`}
                        onClick={() => setSelectedProfessionDetailsId(profession.id)}
                        aria-label={`Ver detalles de ${profession.name}`}
                      >
                        <div className="profession-list-item-copy">
                          <h4>{profession.name}</h4>
                          <span>{profession.archetype} · Guía Avanzada p. {profession.page}</span>
                        </div>
                        <div className="profession-list-item-status">
                          <span className={`profession-state profession-state--${state ?? "available"}`}>{stateLabel}</span>
                          <span className="profession-list-item-chevron" aria-hidden="true">›</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {activeTab === "compras" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <h3>Compras de PX</h3>
                  <span className="meta-text">PX disponibles: {effectiveAvailable}</span>
                </div>
                <div className="character-builder-purchase-stack">
                  {(["habilidades", "rasgosMonstruosos", "poderesMisticos", "rituales"] as RatedSection[]).map((section) => {
                    const sectionEntries = getRatedEntriesForSection(draft, section);
                    return (
                      <article key={section} className={`character-builder-block character-builder-block--${section}`}>
                        <div className="row-actions">
                          <h4>{getSectionTitle(section)}</h4>
                          <div className="toolbar">
                            <span className="meta-text">{getSectionCostLabel(section)}</span>
                            <button type="button" onClick={() => openAcquisitionModal(section)}>
                              <span aria-hidden="true">+</span>{" "}
                              {getAcquireButtonLabel(section)}
                            </button>
                          </div>
                        </div>
                        <div className="character-builder-entry-list">
                          {sectionEntries.length > 0 ? sectionEntries.map((entry, index) => {
                            const nextLevel = section === "rituales" ? null : getNextLevel(entry.nivel);
                            const investedXp = section === "rituales" ? 10 : getRatedEntryCost(entry.nivel);
                            return (
                              <button
                                key={`${section}-${entry.nombre}-${index}`}
                                type="button"
                                className={`character-builder-entry-card character-builder-entry-card--${section} character-builder-entry-trigger`}
                                aria-label={`Ver detalles de ${entry.nombre}`}
                                onClick={() => openCapabilityDetails(section, entry.nombre)}
                              >
                                <span className="character-builder-entry-copy">
                                  <strong>{entry.nombre}</strong>
                                  <span className="character-builder-entry-level">
                                    {section === "rituales" ? "Nivel único" : `Nivel ${getLevelLabel(section, entry.nivel)}`}
                                  </span>
                                </span>
                                <span className="character-builder-entry-metric">
                                  <span>Invertidos</span>
                                  <strong>{investedXp} PX</strong>
                                </span>
                                <span className="character-builder-entry-metric is-next">
                                  <span>{section === "rituales" ? "Progresión" : nextLevel ? "Siguiente nivel" : "Progresión"}</span>
                                  <strong>
                                    {section === "rituales"
                                      ? "Sin niveles"
                                      : nextLevel
                                        ? `${getLevelLabel(section, nextLevel)} · ${getUpgradeCost(section, entry.nivel)} PX`
                                        : "Nivel máximo"}
                                  </strong>
                                </span>
                              </button>
                            );
                          }) : (
                            <p className="section-help">Sin entradas registradas.</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {activeTab === "rasgos" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <h3>Bendiciones, cargas y rasgos</h3>
                  <span className="meta-text">Listas simples para progreso y narrativa.</span>
                </div>
                <div className="character-builder-simple-sections">
                  {(["bendiciones", "cargas", "rasgos"] as SimpleSection[]).map((section) => {
                    const sectionTitleId = `character-builder-${section}-title`;
                    return (
                      <article key={section} className="character-builder-block character-builder-simple-section" aria-labelledby={sectionTitleId}>
                        <div className="row-actions">
                          <div>
                            <h4 id={sectionTitleId}>{SIMPLE_SECTION_LABELS[section]}</h4>
                            <span className="meta-text">
                              {section === "bendiciones" ? "5 PX por bendición" : section === "cargas" ? "+5 PX efectivos por carga" : "Sin coste de PX"}
                            </span>
                          </div>
                          <button type="button" onClick={() => openSimpleCatalogModal(section)}>{getSimpleAddLabel(section)}</button>
                        </div>
                        <div className="character-builder-simple-list">
                          {draft[section].length > 0 ? draft[section].map((entry, index) => {
                            const catalogEntry = getSimpleCatalogEntries(section).find((candidate) => normalizeName(candidate.nombre) === normalizeName(entry));
                            return (
                              <article key={`${section}-${entry}-${index}`} className="character-builder-simple-row">
                                <div className="character-builder-simple-row__identity">
                                  <strong>{entry}</strong>
                                  <span>{catalogEntry ? `${catalogEntry.fuente}${catalogEntry.pagina ? ` · p. ${catalogEntry.pagina}` : ""}` : "Entrada histórica fuera del catálogo actual"}</span>
                                </div>
                                <div className="character-builder-simple-row__actions">
                                  <span className={`compendium-chip${catalogEntry ? " is-active" : ""}`}>{catalogEntry ? "Catálogo oficial" : "Histórica"}</span>
                                  <button type="button" className="subtle-button" aria-label={`Quitar ${entry}`} onClick={() => removeSimpleEntry(section, index)}>Quitar</button>
                                </div>
                              </article>
                            );
                          }) : (
                            <p className="section-help">Sin entradas registradas.</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {activeTab === "artefactos" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <div>
                    <h3>Artefactos misticos</h3>
                    <p className="section-help">Solo aparecen los artefactos que el DJ ha entregado a este personaje.</p>
                  </div>
                  <span className="meta-text">PX disponibles: {effectiveAvailable}</span>
                </div>
                <div className="character-builder-artifact-list">
                  {(character.mysticArtifacts ?? []).map((artifact) => (
                    <button
                      key={artifact.id}
                      type="button"
                      className="character-builder-artifact-row"
                      aria-label={`Ver detalles de ${artifact.name}`}
                      onClick={() => setSelectedMysticArtifactId(artifact.id)}
                    >
                      <div className="character-builder-artifact-row__identity">
                        <strong>{artifact.name}</strong>
                        <span>{BUILDER_ARTIFACT_KIND_LABELS[artifact.kind]} · {artifact.campaignName}</span>
                      </div>
                      <div className="character-builder-artifact-row__status">
                        <span className={`compendium-chip${artifact.isBound ? " is-active" : ""}`}>{artifact.isBound ? "Vinculado" : "Sin vincular"}</span>
                        <span>{formatBuilderArtifactBindingCosts(artifact.bindingCosts) || "Sin coste configurado"}</span>
                      </div>
                    </button>
                  ))}
                  {(character.mysticArtifacts ?? []).length === 0 ? <p className="section-help">Este personaje no posee artefactos de campaña.</p> : null}
                </div>
              </section>
            ) : null}
          </section>
        </section>
      </section>

      {selectedMysticArtifact ? (
        <MysticArtifactDetailsModal
          artifact={selectedMysticArtifact}
          campaignName={selectedMysticArtifact.campaignName}
          availableExperience={effectiveAvailable}
          busy={busy || bindingArtifactId === selectedMysticArtifact.id}
          onClose={() => setSelectedMysticArtifactId(null)}
          onBind={onBindMysticArtifact ? handleBindArtifact : undefined}
          onOpenSource={onOpenMysticArtifactSource}
        />
      ) : null}

      {isXpDetailsOpen ? (
        <section className="modal-backdrop" onClick={() => setIsXpDetailsOpen(false)}>
          <div
            className="panel modal-panel character-builder-xp-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-builder-xp-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-actions">
              <div>
                <h3 id="character-builder-xp-details-title">Detalle de PX gastada</h3>
                <p className="section-help">{effectiveSpent} PX gastados · {effectiveAvailable} PX disponibles</p>
              </div>
              <button type="button" className="subtle-button" onClick={() => setIsXpDetailsOpen(false)}>Cerrar</button>
            </div>

            <div className="character-builder-xp-details-body">
              <section className="character-builder-xp-details-section">
                <div className="row-actions"><h4>Capacidades, poderes, rituales y bendiciones</h4><strong>{experience.computedSpent - experience.spentFromRerolls - experience.spentFromFeats} PX</strong></div>
                <div className="character-builder-xp-expense-list">
                  {experience.capabilityExpenses.map((expense, index) => (
                    <article key={`${expense.kind}-${expense.name}-${index}`} className="character-builder-xp-expense-row">
                      <div>
                        <strong>{expense.name}</strong>
                        <span>{expense.kind === "poder_mistico" ? "Poder místico" : expense.kind === "habilidad" ? "Habilidad" : expense.kind === "ritual" ? "Ritual" : expense.kind === "bendicion" ? "Bendición" : "Capacidad"}{expense.level ? ` · ${expense.level[0].toUpperCase()}${expense.level.slice(1)}` : ""}</span>
                      </div>
                      <strong>{expense.cost} PX</strong>
                    </article>
                  ))}
                  {experience.capabilityExpenses.length === 0 ? <p className="section-help">No hay capacidades con coste de PX.</p> : null}
                </div>
              </section>

              <section className="character-builder-xp-details-section">
                <div className="row-actions"><h4>Vínculos de artefactos</h4><strong>{artifactBindingXpSpent} PX</strong></div>
                <div className="character-builder-xp-expense-list">
                  {artifactBindingXpExpenses.map((expense) => (
                    <article key={expense.id} className="character-builder-xp-expense-row">
                      <div>
                        <strong>{expense.artifactName}</strong>
                        <span>Vinculado · {expense.boundAt ? new Date(expense.boundAt).toLocaleString("es-ES") : "Fecha no disponible"}</span>
                      </div>
                      <strong>{expense.amount} PX</strong>
                    </article>
                  ))}
                  {artifactBindingXpExpenses.length === 0 && artifactBindingXpSpent > 0 ? <p className="section-help">Hay {artifactBindingXpSpent} PX de vínculos históricos sin detalle nominal disponible.</p> : null}
                  {artifactBindingXpSpent === 0 ? <p className="section-help">No hay vínculos pagados con PX.</p> : null}
                </div>
              </section>

              <section className="character-builder-xp-details-section">
                <div className="row-actions"><h4>Repeticiones de dados</h4><strong>{rerollSpentTotal} PX</strong></div>
                <div className="character-builder-xp-expense-list">
                  {rerollExpenseDetails.map((expense) => (
                    <article key={expense.id} className="character-builder-xp-expense-row">
                      <div>
                        <strong>{expense.cantidad === 1 ? "Repetición de dado" : `${expense.cantidad} repeticiones de dados`}</strong>
                        <span>{expense.fecha ? new Date(expense.fecha).toLocaleString("es-ES") : "Fecha histórica no disponible"}</span>
                      </div>
                      <strong>{expense.cantidad} PX</strong>
                    </article>
                  ))}
                  {rerollExpenseDetails.length === 0 ? <p className="section-help">No se ha gastado PX en repeticiones.</p> : null}
                </div>
              </section>

              <section className="character-builder-xp-details-section">
                <div className="row-actions"><h4>Hazañas</h4><strong>{featSpentTotal} PX</strong></div>
                <div className="character-builder-xp-expense-list">
                  {experience.featExpenses.map((expense) => (
                    <article key={expense.id} className="character-builder-xp-expense-row">
                      <div>
                        <strong>{expense.motivo || "Hazaña sin motivo registrado"}</strong>
                        <span>Hazaña · {expense.fecha ? new Date(expense.fecha).toLocaleString("es-ES") : "Fecha no disponible"}</span>
                      </div>
                      <strong>{expense.cantidad} PX</strong>
                    </article>
                  ))}
                  {experience.featExpenses.length === 0 ? <p className="section-help">No se ha gastado PX en hazañas.</p> : null}
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : null}

      {selectedProfessionDetails && selectedProfessionEligibility ? (
        <section className="modal-backdrop" onClick={() => setSelectedProfessionDetailsId(null)}>
          <div
            className="modal-panel profession-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profession-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="profession-detail-header">
              <div>
                <span className="eyebrow">{selectedProfessionDetails.archetype} · Guía Avanzada p. {selectedProfessionDetails.page}</span>
                <h3 id="profession-detail-title">{selectedProfessionDetails.name}</h3>
              </div>
              <div className="profession-detail-header-actions">
                <span className={`profession-state profession-state--${selectedProfessionState ?? "available"}`}>{selectedProfessionStateLabel}</span>
                <button type="button" className="subtle-button" onClick={() => setSelectedProfessionDetailsId(null)}>Cerrar</button>
              </div>
            </header>
            <div className="profession-detail-content">
              <p>{selectedProfessionDetails.summary}</p>
              <section>
                <h4>Requisitos</h4>
                <div className="profession-requirement-list">
                  {selectedProfessionEligibility.requirementResults.map((requirement) => (
                    <div key={requirement.id} className={requirement.met ? "is-met" : "is-pending"}>
                      <span aria-hidden="true">{requirement.met ? "✓" : "○"}</span>
                      <span>{requirement.label}</span>
                      <strong>{requirement.matchedNames.length > 0 ? requirement.matchedNames.join(" / ") : "Pendiente"}{requirement.hasMaster ? " · Maestro" : ""}</strong>
                    </div>
                  ))}
                  <div className={selectedProfessionEligibility.masterRequirementMet ? "is-met" : "is-pending"}>
                    <span aria-hidden="true">{selectedProfessionEligibility.masterRequirementMet ? "✓" : "○"}</span>
                    <span>Una capacidad requerida en maestro</span>
                  </div>
                  {selectedProfessionDetails.otherRequirement ? (
                    <div className={selectedProfessionEligibility.otherRequirementMet ? "is-met" : "is-pending"}>
                      <span aria-hidden="true">{selectedProfessionEligibility.otherRequirementMet ? "✓" : "○"}</span>
                      <span>{selectedProfessionDetails.otherRequirement.label}</span>
                    </div>
                  ) : null}
                </div>
              </section>
              <section className="profession-benefit-list">
                <h4>Beneficios desbloqueables</h4>
                <div className="toolbar">
                  {selectedProfessionDetails.benefits.map((benefit) => onOpenCompendiumCapability && benefit.kind !== "rasgo_monstruoso" ? (
                    <button key={benefit.name} type="button" className="link-button" onClick={() => onOpenCompendiumCapability(benefit.kind as "habilidad" | "poder_mistico" | "ritual", benefit.name)}>{benefit.name}</button>
                  ) : <span key={benefit.name}>{benefit.name}</span>)}
                </div>
              </section>
            </div>
            <footer className="toolbar profession-actions profession-detail-actions">
              {!selectedProfessionMembership && onAspireProfession ? (
                <button type="button" disabled={professionBusyId === selectedProfessionDetails.id} onClick={() => void runProfessionAction(selectedProfessionDetails.id, () => onAspireProfession(selectedProfessionDetails.id))}>Marcar como objetivo</button>
              ) : null}
              {selectedProfessionMembership && ["aspiration", "rejected"].includes(selectedProfessionMembership.state) && onRemoveProfessionAspiration ? (
                <button type="button" className="subtle-button" disabled={professionBusyId === selectedProfessionDetails.id} onClick={() => void runProfessionAction(selectedProfessionDetails.id, () => onRemoveProfessionAspiration(selectedProfessionDetails.id))}>Retirar objetivo</button>
              ) : null}
              {selectedProfessionMembership && ["aspiration", "rejected"].includes(selectedProfessionMembership.state) && selectedProfessionEligibility.eligible && onRequestProfession ? (
                <button type="button" disabled={professionBusyId === selectedProfessionDetails.id} onClick={async () => {
                  if (!await confirm({
                    title: "Solicitar ingreso",
                    message: "Se comprobarán de nuevo todos los requisitos. Si el personaje está en campaña, la solicitud quedará pendiente de aprobación del DJ; si no lo está, el ingreso se activará directamente.",
                    confirmLabel: "Continuar"
                  })) return;
                  void runProfessionAction(selectedProfessionDetails.id, () => onRequestProfession(selectedProfessionDetails.id));
                }}>Solicitar ingreso</button>
              ) : null}
              {selectedProfessionMembership?.state === "active" && onLeaveProfession ? (
                <button type="button" className="destructive-button" disabled={professionBusyId === selectedProfessionDetails.id} onClick={async () => {
                  if (!await confirm({
                    title: "Abandonar profesión",
                    message: `¿Abandonar ${selectedProfessionDetails.name}? Las capacidades compradas no se borrarán ni reembolsarán.`,
                    confirmLabel: professionRemovalLabel,
                    tone: "danger"
                  })) return;
                  void runProfessionAction(selectedProfessionDetails.id, () => onLeaveProfession(selectedProfessionDetails.id));
                }}>{professionRemovalLabel}</button>
              ) : null}
            </footer>
          </div>
        </section>
      ) : null}

      {capabilityDetails ? (() => {
        const { section, entry, index, description, tiers, sourceLabel } = capabilityDetails;
        const isRitual = section === "rituales";
        const investedXp = isRitual ? 10 : getRatedEntryCost(entry.nivel);
        const previousLevel = isRitual ? null : getPreviousLevel(entry.nivel);
        const nextLevel = isRitual ? null : getNextLevel(entry.nivel);
        const upgradeCost = nextLevel ? getUpgradeCost(section, entry.nivel) : 0;
        const currentLevelLabel = isRitual ? "Nivel único" : getLevelLabel(section, entry.nivel);
        const hasCompleteTierBreakdown = !isRitual && tiers.length === 3;
        return (
          <section className="modal-backdrop" onClick={closeCapabilityDetails}>
            <div
              className="panel modal-panel character-builder-capability-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="character-builder-capability-detail-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="character-builder-capability-detail-header">
                <div>
                  <span className="eyebrow">{getSectionItemLabel(section)}</span>
                  <h3 id="character-builder-capability-detail-title">{entry.nombre}</h3>
                  <p className="section-help">{sourceLabel || "Fuente no registrada"}</p>
                </div>
                <button type="button" className="subtle-button" onClick={closeCapabilityDetails}>Cerrar</button>
              </header>

              <div className="character-builder-capability-detail-summary">
                <article>
                  <span>Nivel actual</span>
                  <strong>{currentLevelLabel}</strong>
                </article>
                <article>
                  <span>PX invertidos</span>
                  <strong>{investedXp} PX</strong>
                </article>
                <article>
                  <span>PX disponibles</span>
                  <strong>{effectiveAvailable}</strong>
                </article>
              </div>

              <div className="character-builder-capability-detail-body">
                {hasCompleteTierBreakdown ? (
                  <div className="character-builder-capability-tier-list" aria-label="Descripción por niveles">
                    {tiers.map((tier) => {
                      const isCurrent = tier.label === currentLevelLabel;
                      return (
                        <section key={tier.label} className={`character-builder-capability-tier${isCurrent ? " is-current" : ""}`}>
                          <div className="row-actions">
                            <h4>{tier.label}</h4>
                            {isCurrent ? <span className="character-builder-current-level-badge">Nivel actual</span> : null}
                          </div>
                          <p>{tier.content}</p>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <section className="character-builder-capability-description">
                    <h4>Descripción</h4>
                    <p>{description || "No hay una descripción detallada registrada."}</p>
                  </section>
                )}
              </div>

              <footer className="character-builder-capability-detail-actions">
                <div className="toolbar">
                  {previousLevel ? (
                    <button type="button" className="subtle-button" onClick={() => openDowngradeConfirmation(section, index)}>
                      Bajar a {getLevelLabel(section, previousLevel)} · liberar {investedXp - getRatedEntryCost(previousLevel)} PX
                    </button>
                  ) : null}
                  {nextLevel ? (
                    <button
                      type="button"
                      disabled={upgradeCost > effectiveAvailable}
                      title={upgradeCost > effectiveAvailable ? `Faltan ${upgradeCost - effectiveAvailable} PX` : undefined}
                      onClick={() => openUpgradeConfirmation(section, index)}
                    >
                      Subir a {getLevelLabel(section, nextLevel)} · {upgradeCost} PX
                    </button>
                  ) : !isRitual ? <span className="meta-text">Nivel máximo alcanzado</span> : null}
                  <button type="button" className="destructive-button" onClick={() => void confirmRemoveRatedEntry(section, index)}>
                    Quitar · liberar {investedXp} PX
                  </button>
                </div>
                <button type="button" className="subtle-button" onClick={closeCapabilityDetails}>Cerrar</button>
              </footer>
            </div>
          </section>
        );
      })() : null}

      {simpleCatalogModal ? (
        <section className="modal-backdrop" onClick={() => setSimpleCatalogModal(null)}>
          <div
            className="panel modal-panel character-builder-acquisition-modal character-builder-simple-catalog-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-builder-simple-catalog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row-actions">
              <div>
                <h3 id="character-builder-simple-catalog-title">{getSimpleAddLabel(simpleCatalogModal.section)}</h3>
                <span className="meta-text">Solo se muestran entradas del catálogo oficial que el personaje aún no posee.</span>
              </div>
              <span className="meta-text">
                {simpleCatalogModal.section === "bendiciones" ? `PX disponibles: ${effectiveAvailable}` : SIMPLE_SECTION_LABELS[simpleCatalogModal.section]}
              </span>
            </div>
            <div className="character-builder-acquisition-layout">
              <div className="character-builder-acquisition-search">
                <label className="field">
                  <span>Buscar en el catálogo</span>
                  <input
                    autoFocus
                    value={simpleCatalogModal.query}
                    placeholder={`Buscar ${SIMPLE_SECTION_LABELS[simpleCatalogModal.section].toLowerCase()}...`}
                    onChange={(event) => setSimpleCatalogModal((current) => current ? ({ ...current, query: event.target.value }) : null)}
                  />
                </label>
                <div className="character-builder-acquisition-results">
                  {filteredSimpleCatalogEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`character-builder-acquisition-result${selectedSimpleCatalogEntry?.id === entry.id ? " is-active" : ""}`}
                      onClick={() => setSimpleCatalogModal((current) => current ? ({ ...current, selectedId: entry.id }) : null)}
                    >
                      <strong>{entry.nombre}</strong>
                      <span>{entry.fuente}{entry.pagina ? ` · p. ${entry.pagina}` : ""}</span>
                    </button>
                  ))}
                  {filteredSimpleCatalogEntries.length === 0 ? <p className="section-help">No hay entradas disponibles con este filtro.</p> : null}
                </div>
              </div>
              <div className="character-builder-acquisition-preview">
                {selectedSimpleCatalogEntry ? (
                  <>
                    <div className="character-builder-acquisition-header">
                      <strong>{selectedSimpleCatalogEntry.nombre}</strong>
                      <span className="meta-text">
                        {selectedSimpleCatalogEntry.fuente}{selectedSimpleCatalogEntry.pagina ? ` · p. ${selectedSimpleCatalogEntry.pagina}` : ""}
                        {getSimpleEntryCost(simpleCatalogModal.section) > 0 ? ` · ${getSimpleEntryCost(simpleCatalogModal.section)} PX` : " · Sin coste de PX"}
                      </span>
                    </div>
                    <p>{selectedSimpleCatalogEntry.detalle || selectedSimpleCatalogEntry.resumen}</p>
                  </>
                ) : (
                  <p className="section-help">Selecciona una entrada para consultar sus reglas.</p>
                )}
              </div>
            </div>
            <div className="toolbar">
              <button type="button" className="subtle-button" onClick={() => setSimpleCatalogModal(null)}>Cancelar</button>
              <button
                type="button"
                disabled={!selectedSimpleCatalogEntry || getSimpleEntryCost(simpleCatalogModal.section) > effectiveAvailable}
                title={selectedSimpleCatalogEntry && getSimpleEntryCost(simpleCatalogModal.section) > effectiveAvailable ? "No hay PX suficientes" : undefined}
                onClick={() => void addSelectedSimpleCatalogEntry()}
              >
                {simpleCatalogModal.section === "bendiciones" ? "Comprar por 5 PX" : getSimpleAddLabel(simpleCatalogModal.section)}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {acquisitionModal ? (
        <section className="modal-backdrop" onClick={() => setAcquisitionModal(null)}>
          <div className="panel modal-panel character-builder-acquisition-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>{getAcquireButtonLabel(acquisitionModal.section)}</h3>
              <span className="meta-text">PX disponibles: {effectiveAvailable}</span>
            </div>
            <div className="character-builder-acquisition-layout">
              <div className="character-builder-acquisition-search">
                <label className="field">
                  <span>Buscar</span>
                  <input
                    value={acquisitionModal.query}
                    placeholder="Escribe para buscar..."
                    onChange={(event) => setAcquisitionModal((current) => current ? ({ ...current, query: event.target.value, selectedId: current.selectedId }) : null)}
                  />
                </label>
                <div className="character-builder-acquisition-results">
                  {filteredAcquisitionEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`character-builder-acquisition-result${selectedAcquisitionEntry?.id === entry.id ? " is-active" : ""}`}
                      onClick={() => setAcquisitionModal((current) => current ? ({ ...current, selectedId: entry.id }) : null)}
                    >
                      <strong>{entry.nombre}</strong>
                      <span>{entry.libro}{entry.pagina ? ` p. ${entry.pagina}` : ""}</span>
                      {getBenefitProfessionIds(entry.nombre).length > 0 && !getBenefitProfessionIds(entry.nombre).some((id) => activeProfessionIds.has(id)) ? (
                        <span className="profession-lock-label">Requiere profesión activa</span>
                      ) : null}
                    </button>
                  ))}
                  {filteredAcquisitionEntries.length === 0 ? <p className="section-help">No hay resultados disponibles.</p> : null}
                </div>
              </div>
              <div className="character-builder-acquisition-preview">
                {selectedAcquisitionEntry ? (
                  <>
                    <div className="character-builder-acquisition-header">
                      <strong>{selectedAcquisitionEntry.nombre}</strong>
                      <span className="meta-text">
                        {selectedAcquisitionEntry.libro}{selectedAcquisitionEntry.pagina ? ` p. ${selectedAcquisitionEntry.pagina}` : ""} · 10 PX
                      </span>
                    </div>
                    {acquisitionPreviewTiers.length > 0 ? (
                      <div className="character-builder-tier-preview-list">
                        {acquisitionPreviewTiers.map((tier) => (
                          <section key={`${selectedAcquisitionEntry.id}-${tier.label}`} className="character-builder-tier-preview">
                            <h4>{tier.label}</h4>
                            <p>{tier.content}</p>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="section-help">{selectedAcquisitionEntry.efectoResumen}</p>
                    )}
                    {!selectedBenefitUnlocked ? <p className="error-text">Bloqueada: requiere una de sus profesiones asociadas activa y no suspendida.</p> : null}
                    {!selectedHigherRitualBaseMet ? <p className="error-text">Requiere poseer antes el ritual {selectedHigherRitualBase}.</p> : null}
                  </>
                ) : (
                  <p className="section-help">Selecciona una entrada para ver su detalle.</p>
                )}
              </div>
            </div>
            <div className="toolbar">
              <button type="button" className="subtle-button" onClick={() => setAcquisitionModal(null)}>Cancelar</button>
              <button
                type="button"
                onClick={openAcquisitionConfirmation}
                disabled={!selectedAcquisitionEntry || effectiveAvailable < 10 || !selectedBenefitUnlocked || !selectedHigherRitualBaseMet}
              >
                Revisar compra
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {capabilityConfirmationModal ? (
        <section className="modal-backdrop" onClick={closeCapabilityConfirmationModal}>
          <div className="panel modal-panel character-builder-confirmation-modal" onClick={(event) => event.stopPropagation()}>
            <div className="row-actions">
              <h3>
                {capabilityConfirmationModal.mode === "acquire"
                  ? "Confirmar compra"
                  : capabilityConfirmationModal.mode === "downgrade"
                    ? "Confirmar bajada"
                    : "Confirmar mejora"}
              </h3>
              <span className="meta-text">
                Nivel objetivo: {getLevelLabel(capabilityConfirmationModal.section, capabilityConfirmationModal.targetLevel)}
              </span>
            </div>
            <div className="character-builder-confirmation-copy">
              <strong>{capabilityConfirmationModal.name}</strong>
              <span className="meta-text">
                {capabilityConfirmationModal.sourceLabel
                  ? `${capabilityConfirmationModal.sourceLabel} · `
                  : ""}
                {capabilityConfirmationModal.xpLabel}
              </span>
            </div>
            {capabilityConfirmationModal.targetTier ? (
              <section className="character-builder-confirmation-tier">
                <h4>{capabilityConfirmationModal.targetTier.label}</h4>
                <p>{capabilityConfirmationModal.targetTier.content}</p>
              </section>
            ) : (
              <p className="section-help">{capabilityConfirmationModal.previewSummary}</p>
            )}
            <div className="toolbar">
              <button type="button" className="subtle-button" onClick={closeCapabilityConfirmationModal}>Cancelar</button>
              <button type="button" onClick={capabilityConfirmationModal.onConfirm}>
                {capabilityConfirmationModal.confirmLabel}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
