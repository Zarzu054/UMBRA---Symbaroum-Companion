import { useEffect, useMemo, useState } from "react";
import {
  SYMBAROUM_ABILITIES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RITUALS,
  parseCharacterSheet,
  synchronizeCharacterSheet,
  type Character,
  type CharacterSheet,
  type MysticArtifactPaymentType,
  type SkillLevel,
  type SymbaroumCapability
} from "@umbra/shared";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ALL_ENTRIES, SYMBAROUM_BLESSINGS, SYMBAROUM_BURDENS, type CompendiumEntry } from "../models/compendiumEntries";

type RatedSection = "habilidades" | "rasgosMonstruosos" | "poderesMisticos" | "rituales";
type StoredRatedSection = "habilidades" | "poderesMisticos" | "rituales";
type SimpleSection = "bendiciones" | "cargas" | "rasgos";
type BuilderTabId = "resumen" | "identidad" | "compras" | "artefactos" | "rasgos";
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
  previewSummary: string;
  targetTier: CapabilityTier | null;
  confirmLabel: string;
  onConfirm: () => void;
};

type Props = {
  character: Character;
  busy?: boolean;
  onBackToCharacters: () => void;
  onOpenSheet: () => void;
  onSave: (sheet: CharacterSheet) => Promise<void>;
  backLabel?: string;
  sheetLabel?: string;
  saveLabel?: string;
  onBindMysticArtifact?: (artifactId: string, paymentType: MysticArtifactPaymentType) => Promise<void>;
};

type CatalogSelections = {
  habilidades: string;
  rasgosMonstruosos: string;
  poderesMisticos: string;
  rituales: string;
  bendiciones: string;
  cargas: string;
};

type SimpleInputs = Record<SimpleSection, string>;
type CapabilityTier = {
  label: string;
  content: string;
};

const BUILDER_ABILITIES = SYMBAROUM_ABILITIES.filter((entry) => normalizeName(entry.nombre) !== "rituales");
const BUILDER_MONSTER_TRAITS: SymbaroumCapability[] = ALL_ENTRIES
  .filter((entry): entry is CompendiumEntry => entry.tipo === "rasgo")
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
  novato: "I",
  adepto: "II",
  maestro: "III"
};

const LEVEL_OPTIONS: Array<{ value: SkillLevel; label: string }> = [
  { value: "novato", label: "Novato" },
  { value: "adepto", label: "Adepto" },
  { value: "maestro", label: "Maestro" }
];

const INITIAL_CATALOG_SELECTIONS: CatalogSelections = {
  habilidades: BUILDER_ABILITIES[0]?.id ?? "",
  rasgosMonstruosos: BUILDER_MONSTER_TRAITS[0]?.id ?? "",
  poderesMisticos: SYMBAROUM_MYSTIC_POWERS[0]?.id ?? "",
  rituales: SYMBAROUM_RITUALS[0]?.id ?? "",
  bendiciones: SYMBAROUM_BLESSINGS[0]?.id ?? "",
  cargas: SYMBAROUM_BURDENS[0]?.id ?? ""
};

const SIMPLE_SECTION_LABELS: Record<SimpleSection, string> = {
  bendiciones: "Bendiciones",
  cargas: "Cargas",
  rasgos: "Rasgos"
};

const BUILDER_TABS: Array<{ id: BuilderTabId; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "identidad", label: "Identidad" },
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
    case "novato":
    default:
      return 10;
  }
}

function getSimpleEntryDelta(section: SimpleSection): number {
  if (section === "bendiciones") return -5;
  return 0;
}

function isMonsterTraitCapability(name: string): boolean {
  return BUILDER_MONSTER_TRAIT_NAME_SET.has(normalizeName(name));
}

function getStoredRatedSection(section: RatedSection): StoredRatedSection {
  return section === "rasgosMonstruosos" ? "habilidades" : section;
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
    nivel: "novato",
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
  if (level === "novato") return "adepto";
  if (level === "adepto") return "maestro";
  return null;
}

function getPreviousLevel(level: SkillLevel): SkillLevel | null {
  if (level === "maestro") return "adepto";
  if (level === "adepto") return "novato";
  return null;
}

function getUpgradeCost(section: RatedSection, currentLevel: SkillLevel): number {
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

function parseCapabilityTiers(detail: string, section: RatedSection): CapabilityTier[] {
  const text = String(detail ?? "").trim();
  if (!text) {
    return [];
  }
  const labels = section === "rasgosMonstruosos" ? ["I", "II", "III"] : ["Novato", "Adepto", "Maestro"];
  const labelPattern = section === "rasgosMonstruosos" ? "I|II|III" : "Novato|Adepto|Maestro";
  const matches = [...text.matchAll(new RegExp(`(${labelPattern}):\\s*([\\s\\S]*?)(?=(?:${labelPattern}):|$)`, "gi"))];
  const mapped = new Map<string, CapabilityTier>();
  for (const match of matches) {
    const rawLabel = String(match[1] ?? "").trim();
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
  sheetLabel = "Abrir hoja",
  saveLabel = "Guardar constructor",
  onBindMysticArtifact
}: Props) {
  const [draft, setDraft] = useState<CharacterSheet>(() => parseCharacterSheet(character.sheet));
  const [catalogSelections, setCatalogSelections] = useState<CatalogSelections>(INITIAL_CATALOG_SELECTIONS);
  const [simpleInputs, setSimpleInputs] = useState<SimpleInputs>({
    bendiciones: "",
    cargas: "",
    rasgos: ""
  });
  const [manualSpentAdjustment, setManualSpentAdjustment] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BuilderTabId>("resumen");
  const [acquisitionModal, setAcquisitionModal] = useState<BuilderAcquisitionModal | null>(null);
  const [capabilityConfirmationModal, setCapabilityConfirmationModal] = useState<BuilderCapabilityConfirmationModal | null>(null);
  const [bindingArtifactId, setBindingArtifactId] = useState<string | null>(null);
  const artifactBindingXpSpent = character.artifactBindingXpSpent ?? 0;

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
    setManualSpentAdjustment(Math.max(0, parsedSheet.progreso.experienciaGastada - experience.computedSpent - (character.artifactBindingXpSpent ?? 0)));
    setError(null);
    setActiveTab("resumen");
    setAcquisitionModal(null);
    setCapabilityConfirmationModal(null);
  }, [character]);

  const experience = useMemo(() => getCharacterExperienceSummary(draft), [draft]);
  const manualSpentTotal = useMemo(
    () => Math.max(0, manualSpentAdjustment),
    [manualSpentAdjustment]
  );
  const effectiveSpent = useMemo(
    () => Math.max(0, experience.computedSpent + artifactBindingXpSpent + manualSpentTotal),
    [artifactBindingXpSpent, experience.computedSpent, manualSpentTotal]
  );
  const effectiveAvailable = useMemo(
    () => Math.max(0, draft.progreso.experienciaTotal - effectiveSpent),
    [draft.progreso.experienciaTotal, effectiveSpent]
  );
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

  function findCatalogEntryByName(section: RatedSection, name: string): SymbaroumCapability | null {
    return getCatalogEntries(section).find((entry) => normalizeName(entry.nombre) === normalizeName(name)) ?? null;
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
    setDraft((current) => replaceRatedEntriesForSection(
      current,
      section,
      getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) =>
        entryIndex === index ? { ...ratedEntry, nivel: nextLevel } : ratedEntry
      )
    ));
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
    setDraft((current) => replaceRatedEntriesForSection(
      current,
      section,
      getRatedEntriesForSection(current, section).map((ratedEntry, entryIndex) =>
        entryIndex === index ? { ...ratedEntry, nivel: previousLevel } : ratedEntry
      )
    ));
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

  function removeRatedEntry(section: RatedSection, index: number): void {
    const entry = getRatedEntriesForSection(draft, section)[index];
    if (!entry) {
      return;
    }
    setError(null);
    setDraft((current) => replaceRatedEntriesForSection(
      current,
      section,
      getRatedEntriesForSection(current, section).filter((_, entryIndex) => entryIndex !== index)
    ));
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
    setDraft((current) => replaceRatedEntriesForSection(
      current,
      section,
      [...getRatedEntriesForSection(current, section), buildRatedEntry(entry, section)]
    ));
    setAcquisitionModal(null);
  }

  function openAcquisitionConfirmation(): void {
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

  function updateSimpleInput(section: SimpleSection, value: string): void {
    setSimpleInputs((current) => ({
      ...current,
      [section]: value
    }));
  }

  function addSimpleEntry(section: SimpleSection): void {
    const value = simpleInputs[section].trim();
    if (!value) return;
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

  function removeSimpleEntry(section: SimpleSection, index: number): void {
    setDraft((current) => ({
      ...current,
      [section]: current[section].filter((_, entryIndex) => entryIndex !== index)
    }));
  }

  function addCatalogSimpleEntry(section: Extract<SimpleSection, "bendiciones" | "cargas">): void {
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

  async function handleSave(): Promise<void> {
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
    if (!window.confirm(`Vincular ${artifact?.name ?? "este artefacto"}: ${consequence}. Romper el vínculo no devuelve el pago. ¿Confirmar?`)) return;
    setBindingArtifactId(artifactId);
    setError(null);
    try {
      await onBindMysticArtifact(artifactId, paymentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el vinculo.");
    } finally {
      setBindingArtifactId(null);
    }
  }

  return (
    <section className="character-builder-page unified-sheet">
      <section className="character-builder-shell campaign-sheet-card">
        <div className="character-builder-header-band">
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
          <div className="toolbar character-builder-toolbar">
            <button type="button" className="subtle-button" onClick={onBackToCharacters}>{backLabel}</button>
            <button type="button" className="subtle-button" onClick={onOpenSheet}>{sheetLabel}</button>
            <button type="button" onClick={() => void handleSave()} disabled={busy || isSaving}>
              {isSaving ? "Guardando..." : saveLabel}
            </button>
          </div>
        </div>

        {error ? (
          <section className="panel error-list">
            <p>{error}</p>
          </section>
        ) : null}

        <section className="character-builder-stage">
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
                    <span>PX gastada</span>
                    <strong>{effectiveSpent}</strong>
                  </article>
                  <article className="character-builder-xp-card">
                    <span>PX disponible</span>
                    <strong>{effectiveAvailable}</strong>
                  </article>
                </div>

                <div className="character-builder-summary-notes">
                  <p><strong>PX concedidos:</strong> el total lo gestiona el director de juego desde la campaña. El constructor solo permite invertir los puntos disponibles.</p>
                  <p><strong>Origen del PX gastado:</strong> {experience.spentFromCapabilities} en capacidades y poderes + {experience.spentFromRituals} en rituales + {experience.spentFromBlessings} en bendiciones{artifactBindingXpSpent > 0 ? ` + ${artifactBindingXpSpent} en vínculos de artefactos` : ""}{manualSpentTotal > 0 ? ` + ${manualSpentTotal} de ajuste manual` : ""}.</p>
                  <p><strong>Rituales y rasgos:</strong> los rituales cuestan 10 PX cada uno; los rasgos y las cargas no modifican automáticamente el total concedido.</p>
                </div>
              </section>
            ) : null}

            {activeTab === "identidad" ? (
              <section className="character-builder-panel campaign-sheet-card">
                <div className="row-actions">
                  <h3>Identidad</h3>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Nombre del personaje</span>
                    <input value={draft.identidad.nombrePersonaje} onChange={(event) => updateIdentityField("nombrePersonaje", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Nombre del jugador</span>
                    <input value={draft.identidad.nombreJugador} onChange={(event) => updateIdentityField("nombreJugador", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Marcador especial</span>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={draft.identidad.esFamiliar}
                        onChange={(event) => updateIdentityField("esFamiliar", event.target.checked)}
                      />
                      <span>Es familiar (empieza con 20 PX)</span>
                    </label>
                  </label>
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
                  <label className="field">
                    <span>Profesion</span>
                    <input value={draft.identidad.profesion} onChange={(event) => updateIdentityField("profesion", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Edad</span>
                    <input value={draft.identidad.edad} onChange={(event) => updateIdentityField("edad", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Apariencia</span>
                    <input value={draft.identidad.apariencia} onChange={(event) => updateIdentityField("apariencia", event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Objetivo personal</span>
                    <input value={draft.identidad.objetivoPersonal} onChange={(event) => updateIdentityField("objetivoPersonal", event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Trasfondo</span>
                    <textarea rows={6} value={draft.identidad.trasfondo} onChange={(event) => updateIdentityField("trasfondo", event.target.value)} />
                  </label>
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
                          {sectionEntries.length > 0 ? sectionEntries.map((entry, index) => (
                            <article key={`${section}-${entry.nombre}-${index}`} className={`character-builder-entry-card character-builder-entry-card--${section}`}>
                              <div className="character-builder-entry-head">
                                <div className="character-builder-entry-copy">
                                  <strong>{entry.nombre}</strong>
                                  <div className="character-builder-entry-meta meta-text">
                                    {section === "rituales" ? "10 PX invertidos" : `${getRatedEntryCost(entry.nivel)} PX invertidos`}{entry.fuente ? ` · ${entry.fuente}` : ""}
                                  </div>
                                </div>
                                <div className="card-actions character-builder-entry-actions">
                                  {section !== "rituales" ? (
                                    <>
                                      <span className="meta-text">Nivel actual: {getLevelLabel(section, entry.nivel)}</span>
                                      {getPreviousLevel(entry.nivel) ? (
                                        <button
                                          type="button"
                                          className="subtle-button"
                                          onClick={() => openDowngradeConfirmation(section, index)}
                                        >
                                          <span aria-hidden="true">↓</span>{" "}
                                          Bajar a {getLevelLabel(section, getPreviousLevel(entry.nivel)!)}
                                        </button>
                                      ) : null}
                                      {getNextLevel(entry.nivel) ? (
                                        <button
                                          type="button"
                                          onClick={() => openUpgradeConfirmation(section, index)}
                                          disabled={getUpgradeCost(section, entry.nivel) > effectiveAvailable}
                                        >
                                          <span aria-hidden="true">↑</span>{" "}
                                          Subir a {getLevelLabel(section, getNextLevel(entry.nivel)!)} ({getUpgradeCost(section, entry.nivel)} PX)
                                        </button>
                                      ) : (
                                        <span className="meta-text">Nivel maximo</span>
                                      )}
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="destructive-button"
                                    onClick={() => removeRatedEntry(section, index)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </div>
                              {entry.efecto ? <p className="section-help">{entry.efecto}</p> : null}
                            </article>
                          )) : (
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
                <div className="character-builder-purchase-stack">
                  {(["bendiciones", "cargas", "rasgos"] as SimpleSection[]).map((section) => (
                    <article key={section} className="character-builder-block">
                      <div className="row-actions">
                        <h4>{SIMPLE_SECTION_LABELS[section]}</h4>
                        <span className="meta-text">
                          {getSimpleEntryDelta(section) === 0 ? "Sin coste automatico" : getSimpleEntryDelta(section) > 0 ? `+${getSimpleEntryDelta(section)} PX` : `${getSimpleEntryDelta(section)} PX`}
                        </span>
                      </div>
                      {section === "bendiciones" || section === "cargas" ? (
                        <div className="character-builder-purchase-stack">
                          <div className="character-builder-inline-form">
                            <label className="field">
                              <span>Catalogo</span>
                              <select
                                value={catalogSelections[section]}
                                onChange={(event) => setCatalogSelections((current) => ({ ...current, [section]: event.target.value }))}
                              >
                                {(section === "bendiciones" ? SYMBAROUM_BLESSINGS : SYMBAROUM_BURDENS).map((entry) => (
                                  <option key={entry.id} value={entry.id}>{entry.nombre}</option>
                                ))}
                              </select>
                            </label>
                            <button type="button" onClick={() => addCatalogSimpleEntry(section)} disabled={section === "bendiciones" && effectiveAvailable < 5}>
                              {section === "bendiciones" ? "Comprar del catalogo" : "Añadir del catalogo"}
                            </button>
                          </div>
                          <div className="character-builder-inline-form">
                            <label className="field">
                              <span>Personalizada</span>
                              <input value={simpleInputs[section]} onChange={(event) => updateSimpleInput(section, event.target.value)} />
                            </label>
                            <button type="button" onClick={() => addSimpleEntry(section)} disabled={section === "bendiciones" && effectiveAvailable < 5}>
                              {section === "bendiciones" ? "Comprar personalizada" : "Añadir personalizada"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="character-builder-inline-form">
                          <label className="field">
                            <span>Añadir</span>
                            <input value={simpleInputs[section]} onChange={(event) => updateSimpleInput(section, event.target.value)} />
                          </label>
                          <button type="button" onClick={() => addSimpleEntry(section)}>Añadir</button>
                        </div>
                      )}
                      <div className="character-builder-token-list">
                        {draft[section].length > 0 ? draft[section].map((entry, index) => (
                          <span key={`${section}-${entry}-${index}`} className="character-builder-token">
                            <span>{entry}</span>
                            <button type="button" onClick={() => removeSimpleEntry(section, index)}>x</button>
                          </span>
                        )) : (
                          <p className="section-help">Sin entradas registradas.</p>
                        )}
                      </div>
                    </article>
                  ))}
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
                <div className="character-builder-purchase-stack">
                  {(character.mysticArtifacts ?? []).map((artifact) => (
                    <article key={artifact.id} className="character-builder-block">
                      <div className="row-actions">
                        <div>
                          <h4>{artifact.name}</h4>
                          <p className="meta-text">{artifact.campaignName} · {artifact.isBound ? "Vinculado" : "Sin vincular"}</p>
                        </div>
                        {!artifact.isBound ? (
                          <div className="toolbar">
                            {artifact.bindingCosts.map((cost) => (
                              <button
                                key={cost.paymentType}
                                type="button"
                                disabled={bindingArtifactId === artifact.id || (cost.paymentType === "xp" && cost.amount > effectiveAvailable)}
                                onClick={() => void handleBindArtifact(artifact.id, cost.paymentType)}
                              >
                                {bindingArtifactId === artifact.id
                                  ? "Vinculando..."
                                  : cost.paymentType === "xp" ? `Vincular por ${cost.amount} PX` : `Vincular por ${cost.amount} Corrupcion permanente`}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {artifact.description ? <p className="section-help">{artifact.description}</p> : null}
                      {artifact.resources.map((resource) => resource.maximum !== undefined && resource.current !== undefined ? (
                        <div key={resource.id} className="info-box"><span>{resource.name}</span><strong>{resource.current}/{resource.maximum}</strong></div>
                      ) : null)}
                      {artifact.abilities.length > 0 ? (
                        <div className="character-builder-entry-list">
                          {artifact.abilities.map((ability) => (
                            <article key={ability.id} className="character-builder-entry-card">
                              <div className="character-builder-entry-head">
                                <strong>{ability.name}</strong>
                                <span className="meta-text">{ability.locked ? ability.lockReason : ability.activation === "active" ? "Disponible" : ability.activation}</span>
                              </div>
                              <p className="section-help">{ability.description}</p>
                              <p className="meta-text">Corrupcion: {ability.corruptionFormula || "Ninguna"}{ability.perSceneLimit ? ` · ${ability.perSceneLimit} vez/veces por escena` : ""}</p>
                            </article>
                          ))}
                        </div>
                      ) : !artifact.isBound ? <p className="section-help">Sus capacidades se revelaran al completar el vinculo.</p> : null}
                    </article>
                  ))}
                  {(character.mysticArtifacts ?? []).length === 0 ? <p className="section-help">Este personaje no posee artefactos de campaña.</p> : null}
                </div>
              </section>
            ) : null}
          </section>
        </section>
      </section>

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
                disabled={!selectedAcquisitionEntry || effectiveAvailable < 10}
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
                {`${capabilityConfirmationModal.cost} PX`}
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
