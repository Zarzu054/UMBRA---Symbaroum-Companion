import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  WEAPON_QUALITY_OPTIONS,
  SYMBAROUM_ABILITIES,
  buildRollRequest,
  deriveCharacterActions,
  executeCharacterAction,
  findWeaponQualityOption,
  formatWeaponQualities,
  parseWeaponQualities,
  synchronizeCharacterSheet,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RITUALS,
  type ActionRollResult,
  type CharacterActionDefinition,
  type CharacterActionPhase,
  type CharacterSheet,
  type RollDestination,
  type RollRequest
} from "@umbra/shared";
import { computeDerivedStats } from "../models/rulesEngine";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { createCustomInventoryItem, createInventoryItemFromTemplate, ITEM_CATALOG, type ItemTemplate } from "../models/itemCatalog";
import { ALL_ENTRIES, getCompendiumSourcePdfUrl, getCompendiumSummaryLink } from "../models/compendiumEntries";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import {
  dispatchRoll20Request,
  setRollDestination as persistRollDestination,
  type Roll20Visibility
} from "../services/rollTransport";

type TabId = "actions" | "inventory" | "abilities" | "background" | "notes";
type ActionTabId = "all" | "favorites" | "attacks" | "powers" | "actions" | "free" | "reactions" | "other";
type CapabilityTabId = "traits" | "blessings" | "burdens" | "abilities" | "powers" | "rituals";
type InventoryTabId = "money" | "weapons" | "armors" | "items";
type RatedEntry = CharacterSheet["habilidades"][number];
type SimpleSheetListSection = "bendiciones" | "cargas" | "rasgos";

type Props = {
  title: string;
  subtitle: string;
  sheet: CharacterSheet;
  editable: boolean;
  busy?: boolean;
  onSave?: (sheet: CharacterSheet) => Promise<void>;
  onBack?: () => void;
  onOpenCompendiumCapability?: (tipo: "habilidad" | "poder_mistico" | "ritual", nombre: string) => void;
};

type PendingRollConfirmation = {
  request?: RollRequest;
  action?: CharacterActionDefinition;
  phase?: CharacterActionPhase;
  title: string;
  visibility: Roll20Visibility;
  selectedAttackModifierIds: string[];
  selectedDamageModifierIds: string[];
  defenseAlternativeIds?: string[];
  selectedDefenseAlternativeId?: string;
};

type FormulaBreakdownEntry = {
  label: string;
  formula?: string;
  detail?: string;
};

type ActionDetailModal = {
  title: string;
  sourceLabel: string;
  detail: string;
  tiers?: CapabilityTier[];
  notes?: string[];
  references?: Array<{ label: string; url: string }>;
  capabilityTipo?: "habilidad" | "poder_mistico" | "ritual";
  capabilityNombre?: string;
  removeInventoryIndex?: number;
  editInventoryIndex?: number;
  inventoryMeta?: {
    attack?: string;
    damage?: string;
    protection?: string;
    value?: string;
    notes?: string[];
    qualities?: Array<{ id: string; label: string; summary: string; details: string }>;
  };
};

type InventoryCatalogModalTab = "weapons" | "armors" | "items";

type CapabilityTier = {
  label: "Novato" | "Adepto" | "Maestro";
  content: string;
};

type WeaponCatalogFilterId = "all" | "one-handed" | "short" | "long" | "heavy" | "ranged" | "thrown";

type MoneyCounters = {
  taleros: number;
  chelines: number;
  ortegs: number;
};

type WeaponEditorModal = {
  mode: "create" | "edit";
  item: CharacterSheet["inventoryItems"][number];
  index?: number;
};

type AttackRollModifier = {
  id: string;
  label: string;
  bonus: number;
};

type RollModalAttackModifier = AttackRollModifier & {
  source: "trait" | "ability";
};

const WEAPON_CATALOG_FILTER_OPTIONS: Array<{ id: WeaponCatalogFilterId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "one-handed", label: "Una mano" },
  { id: "short", label: "Cortas" },
  { id: "long", label: "Largas" },
  { id: "heavy", label: "Pesadas" },
  { id: "ranged", label: "A distancia" },
  { id: "thrown", label: "Arrojadizas" }
];

function matchesWeaponCatalogFilter(item: ItemTemplate, filterId: WeaponCatalogFilterId): boolean {
  if (item.category !== "weapon") return false;
  if (filterId === "all") return true;
  const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
  if (filterId === "ranged") return qualities.includes("a distancia") || item.slot === "ranged";
  if (filterId === "thrown") return qualities.includes("arrojadiza") || item.slot === "none";
  if (filterId === "heavy") return qualities.includes("pesada") || item.name.toLowerCase().includes("pesada");
  if (filterId === "long") return qualities.includes("larga");
  if (filterId === "short") return qualities.includes("corta") || item.slot === "offHand";
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

function parseMoneyCounters(rawValue: string): MoneyCounters {
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

function formatMoneyCounters(counters: MoneyCounters): string {
  return `${Math.max(0, counters.taleros)} Taleros · ${Math.max(0, counters.chelines)} Chelines · ${Math.max(0, counters.ortegs)} Ortegs`;
}

function formatActionDisplayLabel(label: string): string {
  return String(label ?? "")
    .replace(/^(Usar|Lanzar)\s+/i, "")
    .replace(/\s+\((Novato|Adepto|Maestro)\)\s*$/i, "")
    .trim();
}

function getActionRollLabel(action: CharacterActionDefinition): string {
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

function getActionDamageVariants(action: CharacterActionDefinition): Array<{ id: string; label: string; formula: string }> {
  if (action.damageModifiers && action.damageModifiers.length > 0) {
    return action.damageModifiers;
  }

  return [];
}

function getDamageRollBreakdown(
  action: CharacterActionDefinition,
  selectedDamageModifierIds: string[] = []
): FormulaBreakdownEntry[] {
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

function getRollRequestBreakdown(request: RollRequest): FormulaBreakdownEntry[] {
  if (request.formulaBreakdown && request.formulaBreakdown.length > 0) {
    return request.formulaBreakdown;
  }

  if (request.phase === "damage" && request.formula) {
    return [{ label: request.sourceName || request.actionLabel, formula: request.formula }];
  }

  return [];
}

function getAttackRollModifiers(action: CharacterActionDefinition, sheet: CharacterSheet): RollModalAttackModifier[] {
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

function getPendingAttackTarget(
  sheet: CharacterSheet,
  characterName: string,
  action: CharacterActionDefinition,
  destination: RollDestination,
  selectedAttackModifierIds: string[]
): number | null {
  const request = buildRollRequest(sheet, characterName, action.id, "attack", destination);
  if (typeof request.target !== "number") {
    return null;
  }

  const selectedBonus = getAttackRollModifiers(action, sheet)
    .filter((modifier) => selectedAttackModifierIds.includes(modifier.id))
    .reduce((sum, modifier) => sum + modifier.bonus, 0);

  return request.target + selectedBonus;
}

function isIntegratedDamageBonusAction(action: CharacterActionDefinition): boolean {
  return action.sourceType !== "weapon" && !action.rollAttribute && String(action.damageFormula ?? "").trim().startsWith("+");
}

function hasActionRoll(action: CharacterActionDefinition): boolean {
  if (isIntegratedDamageBonusAction(action)) {
    return false;
  }

  return Boolean(action.rollAttribute || action.damageFormula);
}

function getActionSourceLabel(action: CharacterActionDefinition): string {
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

function isDefenseAlternativeAction(action: CharacterActionDefinition): boolean {
  return Boolean(action.rollAttribute) && getActionRollLabel(action) === "Defensa";
}

function isDefenseModifierOnlyAction(action: CharacterActionDefinition): boolean {
  return isDefenseAlternativeAction(action) && Boolean(action.fixedTarget);
}

function isOtherAction(action: CharacterActionDefinition): boolean {
  if (action.sourceType === "weapon" || action.sourceType === "power" || action.sourceType === "ritual") {
    return false;
  }

  return Boolean(action.fixedTarget);
}

function parseCapabilityTiers(text: string): { tiers: CapabilityTier[]; reference: string | null; remainder: string | null } {
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

  const tiers: CapabilityTier[] = [];
  let reference: string | null = null;

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

function capabilityLevelRank(level: string): number {
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

function normalizeCapabilityText(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getSheetTraitLevel(sheet: CharacterSheet, traitName: string): number {
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
    if (/\bmaestro\b/.test(normalized)) return 3;
    if (/\badepto\b/.test(normalized)) return 2;
    if (/\bnovato\b/.test(normalized)) return 1;
    if (/\biii\b|\b3\b/.test(normalized)) return 3;
    if (/\bii\b|\b2\b/.test(normalized)) return 2;
    return 1;
  }

  return 0;
}

function isMeleeLikeAction(action: CharacterActionDefinition): boolean {
  const normalized = normalizeCapabilityText(`${action.label} ${action.sourceName} ${action.effectSummary}`);
  return !/(arco|ballesta|proyectil|disparo|a distancia|arrojadiza|jabalina|venablo)/.test(normalized);
}

function normalizeInventoryItemText(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isContainerLikeInventoryItem(item: CharacterSheet["inventoryItems"][number]): boolean {
  const combinedText = normalizeInventoryItemText([item.name, item.description, item.qualities].filter(Boolean).join(" "));
  return /(mochila|bolsa|saco|bandolera|estuche|cofre|caja|barril|contenedor|alforja|morral)/.test(combinedText);
}

function isStackableInventoryItem(item: CharacterSheet["inventoryItems"][number]): boolean {
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

function normalizeWeaponQualityKey(value: string): string {
  return normalizeCapabilityText(value).replace(/[^a-z0-9]+/g, "-");
}

function getKnownWeaponQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(WEAPON_QUALITY_OPTIONS.map((entry) => entry.id));
  return parseWeaponQualities(item.qualities)
    .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}

function getCustomWeaponQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(WEAPON_QUALITY_OPTIONS.map((entry) => entry.id));
  return parseWeaponQualities(item.qualities)
    .filter((quality) => !knownIds.has(normalizeWeaponQualityKey(quality)));
}

function capitalizeActionLevel(level: string): "Novato" | "Adepto" | "Maestro" | null {
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

function formatCapabilitySource(entry: RatedEntry): string {
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

function normalizeCapabilityTiers(tiers: CapabilityTier[]): CapabilityTier[] {
  const order: CapabilityTier["label"][] = ["Novato", "Adepto", "Maestro"];
  const unique = new Map<CapabilityTier["label"], CapabilityTier>();
  for (const tier of tiers) {
    if (!unique.has(tier.label) && tier.content.trim()) {
      unique.set(tier.label, { ...tier, content: tier.content.trim() });
    }
  }
  return order.map((label) => unique.get(label)).filter((tier): tier is CapabilityTier => Boolean(tier));
}

function shouldKeepCapabilityNote(note: string, tiers: CapabilityTier[], reference: string | null): boolean {
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

export function UnifiedCharacterSheet({
  title,
  subtitle,
  sheet,
  editable,
  busy = false,
  onSave,
  onBack,
  onOpenCompendiumCapability
}: Props) {
  const { draft, editMode, isDirty, isSavingLocal, setDraft, setEditMode, updateField, save } = useUnifiedCharacterSheet({
    sheet,
    editable,
    onSave
  });
  const canEditNotes = editMode && editable;
  const canEditInventory = editable;
  const [activeTab, setActiveTab] = useState<TabId>("actions");
  const [activeActionTab, setActiveActionTab] = useState<ActionTabId>("all");
  const [activeCapabilityTab, setActiveCapabilityTab] = useState<CapabilityTabId>("abilities");
  const [activeInventoryTab, setActiveInventoryTab] = useState<InventoryTabId>("weapons");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>(ITEM_CATALOG[0]?.templateId ?? "");
  const [inventoryCatalogModalTab, setInventoryCatalogModalTab] = useState<InventoryCatalogModalTab | null>(null);
  const [selectedWeaponCatalogFilter, setSelectedWeaponCatalogFilter] = useState<WeaponCatalogFilterId>("all");
  const [history, setHistory] = useState<Array<{ title: string; detail?: string; rolls: ActionRollResult[] }>>([]);
  const rollDestination: RollDestination = "roll20";
  const [pendingRollConfirmation, setPendingRollConfirmation] = useState<PendingRollConfirmation | null>(null);
  const [showPendingRollBreakdown, setShowPendingRollBreakdown] = useState(false);
  const [actionDetailModal, setActionDetailModal] = useState<ActionDetailModal | null>(null);
  const [weaponEditorModal, setWeaponEditorModal] = useState<WeaponEditorModal | null>(null);
  const [activeWeaponQualityInfoId, setActiveWeaponQualityInfoId] = useState<string>("");

  const normalizedSheet = useMemo(() => synchronizeCharacterSheet(draft), [draft]);
  const derived = useMemo(() => computeDerivedStats(normalizedSheet), [normalizedSheet]);
  const actions = useMemo(() => deriveCharacterActions(normalizedSheet), [normalizedSheet]);
  const defenseAlternativeActions = useMemo(
    () => actions.filter((action) => isDefenseModifierOnlyAction(action)),
    [actions]
  );
  const visibleActions = useMemo(
    () => actions.filter((action) => !isDefenseModifierOnlyAction(action)),
    [actions]
  );
  const favoriteActionIds = useMemo(
    () => new Set(normalizedSheet.actionFavorites ?? []),
    [normalizedSheet.actionFavorites]
  );
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
        return visibleActions.filter((action) =>
          action.sourceType !== "weapon" &&
          action.sourceType !== "power" &&
          action.sourceType !== "ritual" &&
          !isOtherAction(action) &&
          action.cost !== "free" &&
          action.cost !== "reaction"
        );
    }
  }, [visibleActions, activeActionTab, favoriteActionIds]);
  const pendingAttackModifiers = useMemo(
    () => (
      pendingRollConfirmation?.action && pendingRollConfirmation.phase === "attack"
        ? getAttackRollModifiers(pendingRollConfirmation.action, normalizedSheet)
        : []
    ),
    [pendingRollConfirmation, normalizedSheet]
  );
  const displayName = normalizedSheet.identidad.nombrePersonaje || title;
  const experience = useMemo(() => getCharacterExperienceSummary(normalizedSheet), [normalizedSheet]);
  const displayedSpentExperience = Math.max(normalizedSheet.progreso.experienciaGastada, experience.computedSpent);
  const activeArmor = useMemo(
    () => normalizedSheet.inventoryItems.find((item) => item.category === "armor" && item.quantity > 0) ?? null,
    [normalizedSheet.inventoryItems]
  );
  const moneyCounters = useMemo(() => parseMoneyCounters(normalizedSheet.recursos.dinero), [normalizedSheet.recursos.dinero]);
  const inventorySections = useMemo(
    () => ({
      weapons: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "weapon"),
      armors: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "armor"),
      items: normalizedSheet.inventoryItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category !== "weapon" && item.category !== "armor")
    }),
    [normalizedSheet.inventoryItems]
  );
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
  const filteredModalCatalogItems = useMemo(
    () => inventoryCatalogModalTab === "weapons"
      ? modalCatalogItems.filter((item) => matchesWeaponCatalogFilter(item, selectedWeaponCatalogFilter))
      : modalCatalogItems,
    [inventoryCatalogModalTab, modalCatalogItems, selectedWeaponCatalogFilter]
  );

  useEffect(() => {
    persistRollDestination("roll20");
  }, []);

  function pushHistory(titleText: string, rolls: ActionRollResult[], detail?: string): void {
    setHistory((current) => [{ title: titleText, detail, rolls }, ...current].slice(0, 12));
  }

  function openActionDetail(action: CharacterActionDefinition): void {
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
    const canonicalEntry = (
      action.sourceType === "power"
        ? SYMBAROUM_MYSTIC_POWERS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName))
        : action.sourceType === "ritual"
          ? SYMBAROUM_RITUALS.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName))
          : SYMBAROUM_ABILITIES.find((candidate) => normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName))
    );
    const rawDetail =
      canonicalEntry?.efectoResumen?.trim() ||
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
    const compendiumEntry = ALL_ENTRIES.find((candidate) =>
      candidate.tipo === capabilityType &&
      normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(action.sourceName)
    );
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
    ].filter((reference): reference is { label: string; url: string } => Boolean(reference?.url));
    setActionDetailModal({
      title: formatActionDisplayLabel(action.label),
      sourceLabel: getActionSourceLabel(action),
      detail,
      references,
      capabilityTipo: capabilityType,
      capabilityNombre: action.sourceName
    });
  }

  function openInventoryItemDetail(item: CharacterSheet["inventoryItems"][number]): void {
    const notes: string[] = [];
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

  function openInventoryWeaponDetail(item: CharacterSheet["inventoryItems"][number]): void {
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

    setActiveWeaponQualityInfoId("");
    setActionDetailModal({
      title: item.name || "Objeto sin nombre",
      sourceLabel: item.isCustom ? "Arma personalizada" : "Arma del catalogo",
      detail: item.description.trim() || "Sin descripcion adicional.",
      notes,
      removeInventoryIndex: canEditInventory ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
      editInventoryIndex: canEditInventory && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
      inventoryMeta: {
        damage: item.damageFormula || undefined,
        protection: item.protectionFormula || undefined,
        value: item.value || undefined,
        notes,
        qualities: qualityDefinitions
      }
    });
  }

  function openCapabilityDetail(
    tipo: "habilidad" | "poder_mistico" | "ritual",
    entry: RatedEntry
  ): void {
    const compendiumEntry = ALL_ENTRIES.find((candidate) =>
      candidate.tipo === tipo &&
      normalizeCapabilityText(candidate.nombre) === normalizeCapabilityText(entry.nombre)
    );
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
    ].filter((value): value is string => Boolean(value?.trim()));
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
    ].filter((reference): reference is { label: string; url: string } => Boolean(reference?.url));

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

  function queueRoll20Request(
    requestOrAction: RollRequest | CharacterActionDefinition,
    phaseOrTitle: CharacterActionPhase | string,
    requestTitle?: string,
    selectedAttackModifierIds: string[] = [],
    selectedDamageModifierIds: string[] = []
  ): void {
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
      phase: phaseOrTitle as CharacterActionPhase,
      title: requestTitle ?? "",
      visibility: "public",
      selectedAttackModifierIds,
      selectedDamageModifierIds,
      defenseAlternativeIds: [],
      selectedDefenseAlternativeId: ""
    });
    setShowPendingRollBreakdown(false);
  }

  function runAction(action: CharacterActionDefinition, phase: CharacterActionPhase, damageVariantId?: string): void {
      if (rollDestination !== "umbra") {
      queueRoll20Request(action, phase, `${action.label} - ${phase === "damage" ? "Danio" : "Tirada"}`);
        return;
      }

    const result = executeCharacterAction(normalizedSheet, action.id, phase, damageVariantId ? [damageVariantId] : []);
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  function runDamageVariantAction(
    action: CharacterActionDefinition,
    damageVariantId: string,
    damageLabel: string
  ): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        action,
        "damage",
        `${action.label} - ${damageLabel}`,
        [],
        [damageVariantId]
      );
      return;
    }

    const result = executeCharacterAction(normalizedSheet, action.id, "damage", [damageVariantId]);
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  function runAttackAction(action: CharacterActionDefinition): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(action, "attack", `${action.label} · Tirada`);
      return;
    }

    const result = executeCharacterAction(normalizedSheet, action.id, "attack");
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  function runDamageAction(action: CharacterActionDefinition): void {
    if (rollDestination !== "umbra") {
      queueRoll20Request(action, "damage", `${action.label} · Danio`);
      return;
    }

    const result = executeCharacterAction(normalizedSheet, action.id, "damage");
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  function runAttributeRoll(attribute: keyof CharacterSheet["atributos"]): void {
    const label = `Prueba de ${ATTRIBUTE_LABELS[attribute]}`;
    if (rollDestination !== "umbra") {
      queueRoll20Request(
        {
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
        },
        label
      );
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

  function runDefenseRoll(): void {
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

  function runArmorRoll(): void {
    const formula = activeArmor?.protectionFormula || derived.armaduraActiva;
    if (!formula) return;
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
      queueRoll20Request(
        {
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
        },
        `${label} · Proteccion`
      );
      return;
    }

    const match = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) return;
    const diceCount = Number(match[1]);
    const diceSides = Number(match[2]);
    const modifier = Number(match[3] ?? "0");
    let total = modifier;
    const dice: number[] = [];
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

  async function handleConfirmRoll20Send(visibility: Roll20Visibility): Promise<void> {
    if (!pendingRollConfirmation) return;
    try {
      const selectedDefenseAction = pendingRollConfirmation.selectedDefenseAlternativeId
        ? defenseAlternativeActions.find((action) => action.id === pendingRollConfirmation.selectedDefenseAlternativeId)
        : null;
        const request = selectedDefenseAction
          ? buildRollRequest(
              normalizedSheet,
              displayName,
              selectedDefenseAction.id,
            "attack",
            rollDestination
            )
          : pendingRollConfirmation.request ?? (
          pendingRollConfirmation.action && pendingRollConfirmation.phase
            ? buildRollRequest(
                normalizedSheet,
              displayName,
              pendingRollConfirmation.action.id,
              pendingRollConfirmation.phase,
              rollDestination,
                "",
                pendingRollConfirmation.selectedDamageModifierIds
              )
            : null
          );
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
    } catch (error) {
      void error;
    } finally {
      setPendingRollConfirmation(null);
      setShowPendingRollBreakdown(false);
    }
  }

  function updateRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales", index: number, field: "nombre" | "tipo" | "efecto" | "nivel" | "fuente" | "pagina" | "notas", value: string | number): void {
    setDraft({
      ...draft,
      [section]: draft[section].map((entry, entryIndex) => (entryIndex === index ? { ...entry, [field]: value } : entry))
    });
  }

  function addRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales"): void {
    setDraft({
      ...draft,
      [section]: [...draft[section], { nombre: "", tipo: "", efecto: "", nivel: "novato", fuente: "", pagina: undefined, notas: "", acciones: [] }]
    });
  }

  function removeRatedEntry(section: "habilidades" | "poderesMisticos" | "rituales", index: number): void {
    setDraft({ ...draft, [section]: draft[section].filter((_, entryIndex) => entryIndex !== index) });
  }

  function updateSimpleSheetList(section: SimpleSheetListSection, rawValue: string): void {
    setDraft({
      ...draft,
      [section]: rawValue
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
    });
  }

  function addSimpleSheetEntry(section: SimpleSheetListSection): void {
    setDraft({
      ...draft,
      [section]: [...draft[section], ""]
    });
  }

  function removeSimpleSheetEntry(section: SimpleSheetListSection, index: number): void {
    setDraft({
      ...draft,
      [section]: draft[section].filter((_, entryIndex) => entryIndex !== index)
    });
  }

  function updateInventoryItem(index: number, field: keyof CharacterSheet["inventoryItems"][number], value: string | number | boolean | undefined): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    });
  }

  function addInventoryItem(): void {
    setDraft({
      ...draft,
      inventoryItems: [...draft.inventoryItems, createCustomInventoryItem()]
    });
  }

  function addCustomWeapon(): void {
    setWeaponEditorModal({
      mode: "create",
      item: createCustomInventoryItem("weapon")
    });
    setActiveInventoryTab("weapons");
  }

  function updateWeaponEditorItem(field: keyof CharacterSheet["inventoryItems"][number], value: string | number | boolean | undefined): void {
    setWeaponEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
  }

  function toggleWeaponEditorQuality(qualityLabel: string): void {
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

  function updateWeaponEditorCustomQualities(rawValue: string): void {
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

  function saveWeaponEditorModal(): void {
    if (!weaponEditorModal) return;
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

  function removeInventoryItem(index: number): void {
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

  function addCatalogInventoryItem(): void {
    const template = ITEM_CATALOG.find((entry) => entry.templateId === selectedCatalogItemId);
    if (!template) return;
    setDraft({
      ...draft,
      inventoryItems: [...draft.inventoryItems, createInventoryItemFromTemplate(template)]
    });
  }

  function openInventoryCatalogModal(tab: InventoryCatalogModalTab): void {
    const filteredItems = ITEM_CATALOG.filter((item) => {
      if (tab === "weapons") return item.category === "weapon";
      if (tab === "armors") return item.category === "armor";
      return item.category !== "weapon" && item.category !== "armor";
    });
    setSelectedWeaponCatalogFilter("all");
    setSelectedCatalogItemId(filteredItems[0]?.templateId ?? "");
    setInventoryCatalogModalTab(tab);
  }

  function addSelectedCatalogItemFromModal(): void {
    addCatalogInventoryItem();
    setInventoryCatalogModalTab(null);
  }

  useEffect(() => {
    if (!filteredModalCatalogItems.some((item) => item.templateId === selectedCatalogItemId)) {
      setSelectedCatalogItemId(filteredModalCatalogItems[0]?.templateId ?? "");
    }
  }, [filteredModalCatalogItems, selectedCatalogItemId]);

  function changeInventoryQuantity(index: number, delta: number): void {
    const item = draft.inventoryItems[index];
    if (!item) return;
    const nextQuantity = Math.max(0, item.quantity + delta);
    if (nextQuantity <= 0) {
      removeInventoryItem(index);
      return;
    }
    updateInventoryItem(index, "quantity", nextQuantity);
  }

  function changeMoneyCounter(currency: keyof MoneyCounters, delta: number): void {
    const nextCounters: MoneyCounters = {
      ...moneyCounters,
      [currency]: Math.max(0, moneyCounters[currency] + delta)
    };
    updateField("recursos.dinero", formatMoneyCounters(nextCounters));
  }

  function toggleFavoriteAction(actionId: string): void {
    const currentFavorites = new Set(normalizedSheet.actionFavorites ?? []);
    if (currentFavorites.has(actionId)) {
      currentFavorites.delete(actionId);
    } else {
      currentFavorites.add(actionId);
    }
    setDraft({
      ...draft,
      actionFavorites: [...currentFavorites]
    });
  }

  function renderInventoryItemEditor(item: CharacterSheet["inventoryItems"][number], index: number): ReactNode {
    const stackable = isStackableInventoryItem(item);

    return (
        <article
          key={item.id}
          className={`campaign-structured-card${item.category === "weapon" ? " is-clickable-card" : ""}`}
        onClick={item.category === "weapon" ? () => openInventoryWeaponDetail(item) : undefined}
        onKeyDown={item.category === "weapon" ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openInventoryWeaponDetail(item);
          }
        } : undefined}
        role={item.category === "weapon" ? "button" : undefined}
        tabIndex={item.category === "weapon" ? 0 : undefined}
        >
          <div className="row-actions">
            <div>
              <h3>{item.name || "Objeto sin nombre"}</h3>
              {item.category === "weapon" ? (
                <div className="unified-sheet-weapon-list-summary">
                  <p className="meta-text">{item.qualities || ""}</p>
                </div>
              ) : (
                <p className="meta-text">
                  {item.category === "armor" ? "Armadura" : "Objeto"}
                  {item.equipped ? " · equipado" : ""}
                  {item.slot !== "none" ? ` · ${slotLabel(item.slot)}` : ""}
                </p>
              )}
            </div>
          <div className={`unified-sheet-quantity-controls${item.category === "weapon" ? " is-weapon-summary" : ""}`}>
            {item.category === "weapon" && item.damageFormula ? <span className="unified-sheet-weapon-list-damage">{item.damageFormula}</span> : null}
            {stackable ? <span className="info-chip">x{item.quantity}</span> : null}
            {canEditInventory && stackable ? (
              <div className="unified-sheet-stack-controls">
                <button type="button" className="subtle-button" onClick={(event) => {
                  event.stopPropagation();
                  changeInventoryQuantity(index, 1);
                }}>+</button>
                <button type="button" className="subtle-button" onClick={(event) => {
                  event.stopPropagation();
                  changeInventoryQuantity(index, -1);
                }}>-</button>
              </div>
            ) : null}
            {canEditInventory && item.category !== "weapon" ? <button type="button" className="subtle-button" onClick={(event) => {
              event.stopPropagation();
              removeInventoryItem(index);
            }}>Quitar</button> : null}
          </div>
        </div>
        <div className="unified-sheet-item-readonly-grid">
          {(item.attackAttribute || item.damageFormula || item.protectionFormula) && item.category !== "weapon" ? (
            <div className="info-box">
              {item.attackAttribute ? <span>Ataque: {ATTRIBUTE_LABELS[item.attackAttribute]}</span> : null}
              {item.damageFormula ? <span>Danio: {item.damageFormula}</span> : null}
              {item.protectionFormula ? <span>Proteccion: {item.protectionFormula}</span> : null}
            </div>
          ) : null}
          {(item.weight || item.value) && item.category !== "weapon" ? (
            <div className="info-box">
              {item.weight ? <span>Peso: {item.weight}</span> : null}
              {item.value ? <span>Valor: {item.value}</span> : null}
            </div>
          ) : null}
          {item.qualities && item.category !== "weapon" ? <div className="info-box"><span>Cualidades: {item.qualities}</span></div> : null}
          {item.modifiers.length > 0 ? (
            <div className="info-box">
              <span>Modificadores: {item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")}</span>
            </div>
          ) : null}
        </div>
        {item.description && item.category !== "weapon" ? <p className="unified-sheet-rich-text">{item.description}</p> : null}
        {item.notes && item.category !== "weapon" ? <p className="unified-sheet-capability-notes">{item.notes}</p> : null}
      </article>
    );
  }

  function updateInventoryAction(index: number, actionIndex: number, field: keyof CharacterSheet["inventoryItems"][number]["grantedActions"][number], value: string | undefined): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              grantedActions: item.grantedActions.map((action, currentActionIndex) => (
                currentActionIndex === actionIndex ? { ...action, [field]: value } : action
              ))
            }
          : item
      ))
    });
  }

  function addInventoryAction(index: number): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              grantedActions: [
                ...item.grantedActions,
                { id: `item-action-${Date.now()}`, label: "Nueva accion", cost: "combat", effectSummary: "" }
              ]
            }
          : item
      ))
    });
  }

  function removeInventoryAction(index: number, actionIndex: number): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, grantedActions: item.grantedActions.filter((_, currentActionIndex) => currentActionIndex !== actionIndex) }
          : item
      ))
    });
  }

  function updateInventoryModifier(index: number, modifierIndex: number, field: keyof CharacterSheet["inventoryItems"][number]["modifiers"][number], value: string): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              modifiers: item.modifiers.map((modifier, currentModifierIndex) => (
                currentModifierIndex === modifierIndex ? { ...modifier, [field]: value } : modifier
              ))
            }
          : item
      ))
    });
  }

  function addInventoryModifier(index: number): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? {
              ...item,
              modifiers: [
                ...item.modifiers,
                { id: `item-modifier-${Date.now()}`, label: "Nuevo modificador", modifierType: "custom", value: "", notes: "" }
              ]
            }
          : item
      ))
    });
  }

  function removeInventoryModifier(index: number, modifierIndex: number): void {
    setDraft({
      ...draft,
      inventoryItems: draft.inventoryItems.map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, modifiers: item.modifiers.filter((_, currentModifierIndex) => currentModifierIndex !== modifierIndex) }
          : item
      ))
    });
  }

  function updateCondition(index: number, field: keyof CharacterSheet["conditions"][number], value: string | boolean): void {
    setDraft({ ...draft, conditions: draft.conditions.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) });
  }

  function addCondition(): void {
    setDraft({ ...draft, conditions: [...draft.conditions, { id: `condition-${Date.now()}`, name: "", category: "custom", active: true, severity: "minor", summary: "", notes: "" }] });
  }

  function removeCondition(index: number): void {
    setDraft({ ...draft, conditions: draft.conditions.filter((_, itemIndex) => itemIndex !== index) });
  }

  function adjustNumber(path: string, delta: number, min = 0): void {
    const parts = path.split(".");
    let cursor: Record<string, unknown> = normalizedSheet as unknown as Record<string, unknown>;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor = cursor[parts[index]] as Record<string, unknown>;
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

  function renderTabStage(className = "unified-sheet-stage campaign-sheet-card"): ReactNode {
    return (
      <section className={className}>
        <nav className="unified-sheet-tabs">
          {([
            ["actions", "Acciones"],
            ["inventory", "Inventario"],
            ["abilities", "Capacidades"],
            ["background", "Trasfondo"],
            ["notes", "Notas"]
          ] as Array<[TabId, string]>).map(([tab, label]) => (
            <button key={tab} type="button" className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)}>{label}</button>
          ))}
        </nav>

        <div className="unified-sheet-tab-content">
          {activeTab === "actions" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Acciones disponibles</h3>
                </div>
                <nav className="unified-sheet-subtabs unified-sheet-action-subtabs" aria-label="Filtros de acciones">
                  {([
                    ["all", "Todas"],
                    ["favorites", "Favoritas"],
                    ["attacks", "Ataques"],
                    ["powers", "Poderes y rituales"],
                    ["actions", "Acciones"],
                    ["free", "Acciones gratuitas"],
                    ["reactions", "Reacciones"],
                    ["other", "Otras"]
                  ] as Array<[ActionTabId, string]>).map(([tab, label]) => (
                    <button key={tab} type="button" className={activeActionTab === tab ? "is-active" : ""} onClick={() => setActiveActionTab(tab)}>
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="campaign-sheet-actions">
                  {filteredActions.map((action) => (
                    <div key={action.id} className="campaign-action-button campaign-action-button--row">
                      <div className="campaign-action-main">
                        <div className="campaign-action-title-row">
                          <button
                            type="button"
                            className={`campaign-action-favorite-toggle${favoriteActionIds.has(action.id) ? " is-active" : ""}`}
                            onClick={() => toggleFavoriteAction(action.id)}
                            aria-label={favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas"}
                            title={favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas"}
                          >
                            ★
                          </button>
                          <button type="button" className="campaign-action-name-button" onClick={() => openActionDetail(action)}>
                            {formatActionDisplayLabel(action.label)}
                          </button>
                        </div>
                        <span className="campaign-action-source-note">{getActionSourceLabel(action)}</span>
                      </div>
                      <div className="campaign-action-slot">
                        {action.rollAttribute ? (
                          <button type="button" onClick={() => runAttackAction(action)}>{getActionRollLabel(action)}</button>
                        ) : (
                          <span aria-hidden="true" className="campaign-action-slot-placeholder" />
                        )}
                      </div>
                      <div className="campaign-action-slot is-damage">
                        {action.damageFormula && !isIntegratedDamageBonusAction(action) ? <button type="button" onClick={() => runDamageAction(action)}>Danio</button> : <span aria-hidden="true" className="campaign-action-slot-placeholder" />}
                      </div>
                    </div>
                  ))}
                  {filteredActions.length === 0 ? <p className="section-help">Sin acciones registradas en esta categoria.</p> : null}
                </div>
              </article>
            </section>
          ) : null}

          {activeTab === "inventory" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Inventario y equipo</h3>
                </div>
                <nav className="unified-sheet-subtabs" aria-label="Secciones del inventario">
                  {([
                    ["money", "Dinero"],
                    ["weapons", "Armas"],
                    ["armors", "Armaduras"],
                    ["items", "Objetos"]
                  ] as Array<[InventoryTabId, string]>).map(([tab, label]) => (
                    <button key={tab} type="button" className={activeInventoryTab === tab ? "is-active" : ""} onClick={() => setActiveInventoryTab(tab)}>
                      {label}
                    </button>
                  ))}
                </nav>

                {activeInventoryTab === "money" ? (
                  <div className="unified-sheet-money-grid">
                    {([
                      ["taleros", "Taleros"],
                      ["chelines", "Chelines"],
                      ["ortegs", "Ortegs"]
                    ] as Array<[keyof MoneyCounters, string]>).map(([key, label]) => (
                      <article key={key} className="campaign-structured-card unified-sheet-money-card">
                        <strong>{label}</strong>
                        <div className={`unified-sheet-money-coin is-${key}`} aria-hidden="true">
                          <span>{key === "taleros" ? "T" : key === "chelines" ? "C" : "O"}</span>
                        </div>
                        <span>x{moneyCounters[key]}</span>
                        {canEditInventory ? (
                          <div className="unified-sheet-stack-controls">
                            <button type="button" className="subtle-button" onClick={() => changeMoneyCounter(key, 1)}>+</button>
                            <button type="button" className="subtle-button" onClick={() => changeMoneyCounter(key, -1)}>-</button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}

                {activeInventoryTab === "weapons" ? (
                  <>
                    <div className="row-actions">
                      <h3>Armas</h3>
                      {canEditInventory ? (
                        <div className="toolbar">
                          <button type="button" className="subtle-button" onClick={addCustomWeapon}>Arma personalizada</button>
                          <button type="button" onClick={() => openInventoryCatalogModal("weapons")}>Agregar arma</button>
                        </div>
                      ) : null}
                    </div>
                    <div className="unified-sheet-list">
                      {inventorySections.weapons.length > 0
                        ? inventorySections.weapons.map(({ item, index }) => renderInventoryItemEditor(item, index))
                        : <p className="section-help">Sin armas registradas.</p>}
                    </div>
                  </>
                ) : null}

                {activeInventoryTab === "armors" ? (
                  <>
                    <div className="row-actions">
                      <h3>Armaduras</h3>
                      {canEditInventory ? <button type="button" onClick={() => openInventoryCatalogModal("armors")}>Agregar armadura</button> : null}
                    </div>
                    <div className="unified-sheet-list">
                      {inventorySections.armors.length > 0
                        ? inventorySections.armors.map(({ item, index }) => renderInventoryItemEditor(item, index))
                        : <p className="section-help">Sin armaduras registradas.</p>}
                    </div>
                  </>
                ) : null}

                {activeInventoryTab === "items" ? (
                  <>
                    <div className="row-actions">
                      <h3>Objetos</h3>
                      {canEditInventory ? <button type="button" onClick={() => openInventoryCatalogModal("items")}>Agregar objeto</button> : null}
                    </div>
                    <div className="unified-sheet-list">
                      {inventorySections.items.length > 0
                        ? inventorySections.items.map(({ item, index }) => renderInventoryItemEditor(item, index))
                        : <p className="section-help">Sin otros objetos registrados.</p>}
                    </div>
                  </>
                ) : null}

              </article>
            </section>
          ) : null}

          {activeTab === "abilities" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <nav className="unified-sheet-subtabs" aria-label="Tipos de capacidades">
                  {([
                    ["traits", "Rasgos"],
                    ["blessings", "Bendiciones"],
                    ["burdens", "Cargas"],
                    ["abilities", "Habilidades"],
                    ["powers", "Poderes"],
                    ["rituals", "Rituales"]
                  ] as Array<[CapabilityTabId, string]>).map(([tab, label]) => (
                    <button key={tab} type="button" className={activeCapabilityTab === tab ? "is-active" : ""} onClick={() => setActiveCapabilityTab(tab)}>
                      {label}
                    </button>
                  ))}
                </nav>

                {activeCapabilityTab === "traits" ? (
                  <SimpleStringList title="Rasgos" entries={normalizedSheet.rasgos} emptyText="Sin rasgos registrados." />
                ) : null}

                {activeCapabilityTab === "blessings" ? (
                  <SimpleStringList title="Bendiciones" entries={normalizedSheet.bendiciones} emptyText="Sin bendiciones registradas." />
                ) : null}

                {activeCapabilityTab === "burdens" ? (
                  <SimpleStringList title="Cargas" entries={normalizedSheet.cargas} emptyText="Sin cargas registradas." />
                ) : null}

                {activeCapabilityTab === "abilities" ? (
                  <CapabilityTextList
                    title="Habilidades"
                    entries={normalizedSheet.habilidades}
                    onOpenDetail={(entry) => openCapabilityDetail("habilidad", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "powers" ? (
                  <CapabilityTextList
                    title="Poderes misticos"
                    entries={normalizedSheet.poderesMisticos}
                    onOpenDetail={(entry) => openCapabilityDetail("poder_mistico", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "rituals" ? (
                  <CapabilityTextList
                    title="Rituales"
                    entries={normalizedSheet.rituales}
                    onOpenDetail={(entry) => openCapabilityDetail("ritual", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined}
                  />
                ) : null}
              </article>
            </section>
          ) : null}

          {activeTab === "background" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <h3>Trasfondo</h3>
                <div className="form-grid">
                  <Field label="Sombra"><input disabled value={normalizedSheet.identidad.sombra} onChange={(event) => updateField("identidad.sombra", event.target.value)} /></Field>
                  <Field label="Cita"><input disabled value={normalizedSheet.identidad.cita} onChange={(event) => updateField("identidad.cita", event.target.value)} /></Field>
                  <Field label="Edad"><input disabled value={normalizedSheet.identidad.edad} onChange={(event) => updateField("identidad.edad", event.target.value)} /></Field>
                  <Field label="Altura"><input disabled value={normalizedSheet.identidad.altura} onChange={(event) => updateField("identidad.altura", event.target.value)} /></Field>
                  <Field label="Peso"><input disabled value={normalizedSheet.identidad.peso} onChange={(event) => updateField("identidad.peso", event.target.value)} /></Field>
                </div>
                <Field label="Apariencia"><textarea disabled rows={2} value={normalizedSheet.identidad.apariencia} onChange={(event) => updateField("identidad.apariencia", event.target.value)} /></Field>
                <Field label="Objetivo personal"><textarea disabled rows={2} value={normalizedSheet.identidad.objetivoPersonal} onChange={(event) => updateField("identidad.objetivoPersonal", event.target.value)} /></Field>
                <Field label="Historia"><textarea disabled rows={8} value={normalizedSheet.noteSections.background} onChange={(event) => updateField("noteSections.background", event.target.value)} /></Field>
              </article>
            </section>
          ) : null}

          {activeTab === "notes" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <h3>Notas y contexto</h3>
                <Field label="Notas generales"><textarea disabled={!canEditNotes} rows={6} value={normalizedSheet.noteSections.general} onChange={(event) => updateField("noteSections.general", event.target.value)} /></Field>
                <Field label="Notas de campana"><textarea disabled={!canEditNotes} rows={4} value={normalizedSheet.noteSections.campaign} onChange={(event) => updateField("noteSections.campaign", event.target.value)} /></Field>
                <div className="form-grid">
                  <Field label="Grupo"><input disabled value={normalizedSheet.grupo.nombre} onChange={(event) => updateField("grupo.nombre", event.target.value)} /></Field>
                  <Field label="Objetivo del grupo"><textarea disabled rows={2} value={normalizedSheet.grupo.objetivo} onChange={(event) => updateField("grupo.objetivo", event.target.value)} /></Field>
                </div>
              </article>

              <article className="campaign-sheet-card">
                <h3>Contactos</h3>
                <div className="unified-sheet-list">
                  {normalizedSheet.contactosHoja.map((contacto, index) => (
                    <article key={`contacto-${index}`} className="campaign-structured-card">
                      <div className="form-grid">
                        <Field label="Nombre"><input disabled value={contacto.nombre} onChange={(event) => updateField(`contactosHoja.${index}.nombre`, event.target.value)} /></Field>
                        <Field label="Raza"><input disabled value={contacto.raza} onChange={(event) => updateField(`contactosHoja.${index}.raza`, event.target.value)} /></Field>
                        <Field label="Ocupacion"><input disabled value={contacto.ocupacion} onChange={(event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value)} /></Field>
                        <Field label="Jugador"><input disabled value={contacto.jugador} onChange={(event) => updateField(`contactosHoja.${index}.jugador`, event.target.value)} /></Field>
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </section>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className={`unified-sheet is-tab-${activeTab}`}>
      <section className="unified-sheet-persistent campaign-sheet-card">
        <div className="unified-sheet-header-band">
          <div className="unified-sheet-hero-main">
            <div className="unified-sheet-portrait">
              <div className="unified-sheet-portrait-ring" />
              <div className="unified-sheet-portrait-content">
                <span>{String(normalizedSheet.identidad.arquetipo).slice(0, 1)}</span>
              </div>
            </div>
            <div className="unified-sheet-identity">
              <h2 className="unified-sheet-title">{displayName}</h2>
              {subtitle ? <span className="unified-sheet-inline-subtitle">{subtitle}</span> : null}
            </div>
            <div className="unified-sheet-xp-card">
              <div className="unified-sheet-xp-row">
                <span>PX total</span>
                <div className="unified-sheet-xp-controls">
                  <button type="button" className="vital-action subtle" onClick={() => adjustNumber("progreso.experienciaTotal", -1)}>-</button>
                  <strong>{normalizedSheet.progreso.experienciaTotal}</strong>
                  <button type="button" className="vital-action gain" onClick={() => adjustNumber("progreso.experienciaTotal", 1)}>+</button>
                </div>
              </div>
              <div className="unified-sheet-xp-row is-static">
                <span>PX gastada</span>
                <strong>{displayedSpentExperience}</strong>
              </div>
            </div>
          </div>

          <section className="unified-sheet-header-stats">
            <div className="unified-sheet-vital-card is-health">
              <div className="unified-sheet-vital-header">
                <span>Robustez</span>
                <strong>{derived.robustezActualTotal} / {derived.robustezMaximaTotal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action gain" onClick={() => adjustNumber("combate.robustezActual", 1)}>+1 Vida</button>
                <button type="button" className="vital-action loss" onClick={() => adjustNumber("combate.robustezActual", -1)}>-1 Danio</button>
              </div>
            </div>

            <div className="unified-sheet-vital-card is-corruption">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion temporal</span>
                <strong>{normalizedSheet.corrupcion.temporal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action corruption" onClick={() => adjustNumber("corrupcion.temporal", 1)}>+1 Temp</button>
                <button type="button" className="vital-action subtle" onClick={() => adjustNumber("corrupcion.temporal", -1)}>-1 Temp</button>
              </div>
            </div>

            <div className="unified-sheet-vital-card is-corruption-deep">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion permanente</span>
                <strong>{normalizedSheet.corrupcion.permanente}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              <div className="unified-sheet-vital-actions">
                <button type="button" className="vital-action corruption-deep" onClick={() => adjustNumber("corrupcion.permanente", 1)}>+1 Perm</button>
                <button type="button" className="vital-action subtle-dark" onClick={() => adjustNumber("corrupcion.permanente", -1)}>-1 Perm</button>
              </div>
            </div>
          </section>
        </div>

        <div className="unified-sheet-body-grid">
          {renderTabStage("unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card")}
          <section className="unified-sheet-static-column">
            <div className="unified-sheet-attribute-rail">
              {ATTRIBUTE_KEYS.map((key) => (
                <div key={key} className="unified-sheet-attribute-chip">
                  <span>{ATTRIBUTE_LABELS[key]}</span>
                  <strong>{normalizedSheet.atributos[key]}</strong>
                  <button type="button" className="vital-action subtle" onClick={() => runAttributeRoll(key)}>Tirar</button>
                </div>
              ))}
            </div>
            <div className="unified-sheet-static-summary">
              <div className="unified-sheet-quick-row is-primary">
                <article className="unified-sheet-quick-card is-defense-card">
                  <div className="row-actions">
                    <h3>Defensa</h3>
                    <strong>{derived.defensaTotal}</strong>
                  </div>
                  <div className="unified-sheet-vital-actions">
                    <button type="button" className="vital-action subtle is-defense-roll" onClick={runDefenseRoll}>Tirar Defensa</button>
                  </div>
                </article>

                <article className="unified-sheet-quick-card">
                  <div className="row-actions">
                    <h3>Armadura</h3>
                    <strong>{activeArmor?.protectionFormula || derived.armaduraActiva || "-"}</strong>
                  </div>
                  <strong>{activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Sin armadura")}</strong>
                  <div className="unified-sheet-vital-actions">
                    <button type="button" className="vital-action subtle" onClick={runArmorRoll} disabled={!(activeArmor?.protectionFormula || derived.armaduraActiva)}>Tirar Armadura</button>
                  </div>
                </article>
              </div>

              <div className="unified-sheet-quick-row is-derived">
                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Iniciativa</h3>
                  <strong>{derived.iniciativaTotal}</strong>
                </article>

                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Umbral de corrupcion</h3>
                  <strong>{derived.umbralCorrupcionTotal}</strong>
                </article>

                <article className="unified-sheet-quick-card is-derived-card">
                  <h3>Umbral de dolor</h3>
                  <strong>{derived.umbralDolorTotal}</strong>
                </article>
              </div>

              <div className="unified-sheet-quick-row is-conditions">
                <article className="unified-sheet-quick-card is-wide">
                  <h3>Condiciones</h3>
                  <div className="unified-sheet-quick-tags">
                    {normalizedSheet.conditions.length > 0 ? normalizedSheet.conditions.slice(0, 4).map((condition) => (
                      <span key={condition.id} className={`unified-sheet-tag is-${condition.category}`}>{condition.name || "Condicion"}</span>
                    )) : <span className="unified-sheet-tag">Sin condiciones</span>}
                  </div>
                </article>
              </div>

            </div>
          </section>
        </div>
      </section>

      {activeTab === "actions" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <div className="row-actions">
              <h3>Acciones disponibles</h3>
            </div>
            <nav className="unified-sheet-subtabs unified-sheet-action-subtabs" aria-label="Filtros de acciones">
              {([
                ["all", "Todas"],
                ["favorites", "Favoritas"],
                ["attacks", "Ataques"],
                ["powers", "Poderes y rituales"],
                ["actions", "Acciones"],
                ["free", "Acciones gratuitas"],
                ["reactions", "Reacciones"],
                ["other", "Otras"]
              ] as Array<[ActionTabId, string]>).map(([tab, label]) => (
                <button key={tab} type="button" className={activeActionTab === tab ? "is-active" : ""} onClick={() => setActiveActionTab(tab)}>
                  {label}
                </button>
              ))}
            </nav>
                <div className="campaign-sheet-actions">
              {filteredActions.map((action) => (
                <div key={action.id} className="campaign-action-button campaign-action-button--row">
                  <div className="campaign-action-title-row">
                    <button
                      type="button"
                      className={`campaign-action-favorite-toggle${favoriteActionIds.has(action.id) ? " is-active" : ""}`}
                      onClick={() => toggleFavoriteAction(action.id)}
                      aria-label={favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas"}
                      title={favoriteActionIds.has(action.id) ? "Quitar de favoritas" : "Guardar en favoritas"}
                    >
                      ★
                    </button>
                    <strong>{formatActionDisplayLabel(action.label)}</strong>
                  </div>
                  <div className="campaign-action-slot">
                    {action.rollAttribute ? (
                      <button type="button" onClick={() => runAttackAction(action)}>{getActionRollLabel(action)}</button>
                    ) : (
                      <span aria-hidden="true" className="campaign-action-slot-placeholder" />
                    )}
                      </div>
                      <div className="campaign-action-slot is-damage">
                        {action.damageFormula && !isIntegratedDamageBonusAction(action) ? <button type="button" onClick={() => runDamageAction(action)}>Danio</button> : <span aria-hidden="true" className="campaign-action-slot-placeholder" />}
                      </div>
                      <div className="campaign-action-slot">
                        <button type="button" className="subtle-button" onClick={() => openActionDetail(action)}>Detalle</button>
                      </div>
                    </div>
                  ))}
              {filteredActions.length === 0 ? <p className="section-help">Sin acciones registradas en esta categoria.</p> : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "inventory" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <div className="row-actions">
              <h3>Inventario y equipo</h3>
              {editMode ? (
                <div className="toolbar">
                  <button type="button" className="subtle-button" onClick={addCustomWeapon}>Arma personalizada</button>
                  <button type="button" onClick={addInventoryItem}>Agregar objeto</button>
                </div>
              ) : null}
            </div>
            <div className="form-grid">
              <Field label="Dinero"><input disabled={!editMode} value={normalizedSheet.recursos.dinero} onChange={(event) => updateField("recursos.dinero", event.target.value)} /></Field>
              <Field label="Otros recursos"><input disabled={!editMode} value={normalizedSheet.recursos.otros} onChange={(event) => updateField("recursos.otros", event.target.value)} /></Field>
            </div>
            <div className="unified-sheet-list">
              {normalizedSheet.inventoryItems.map((item, index) => (
                <article key={item.id} className="campaign-structured-card">
                  <div className="form-grid">
                    <Field label="Nombre"><input disabled={!editMode} value={item.name} onChange={(event) => updateInventoryItem(index, "name", event.target.value)} /></Field>
                    <Field label="Categoria">
                      <select disabled={!editMode} value={item.category} onChange={(event) => updateInventoryItem(index, "category", event.target.value)}>
                        <option value="weapon">Arma</option>
                        <option value="armor">Armadura</option>
                        <option value="gear">Equipo</option>
                        <option value="consumable">Consumible</option>
                        <option value="artifact">Artefacto</option>
                        <option value="treasure">Tesoro</option>
                        <option value="other">Otro</option>
                      </select>
                    </Field>
                    <Field label="Cantidad">
                      {isStackableInventoryItem(item) ? (
                        <div className="unified-sheet-inline-quantity-editor">
                          <button type="button" className="subtle-button" disabled={!editMode} onClick={() => changeInventoryQuantity(index, -1)}>-</button>
                          <input disabled={!editMode} type="number" min={0} value={item.quantity} onChange={(event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0))} />
                          <button type="button" className="subtle-button" disabled={!editMode} onClick={() => changeInventoryQuantity(index, 1)}>+</button>
                        </div>
                      ) : (
                        <input disabled={!editMode} type="number" min={0} value={item.quantity} onChange={(event) => updateInventoryItem(index, "quantity", Number(event.target.value || 0))} />
                      )}
                    </Field>
                    <Field label="Equipada">
                      <select disabled={!editMode} value={item.equipped ? "si" : "no"} onChange={(event) => updateInventoryItem(index, "equipped", event.target.value === "si")}>
                        <option value="si">Si</option>
                        <option value="no">No</option>
                      </select>
                    </Field>
                    <Field label="Ranura">
                      <select disabled={!editMode} value={item.slot} onChange={(event) => updateInventoryItem(index, "slot", event.target.value)}>
                        <option value="none">Ninguna</option>
                        <option value="mainHand">Mano principal</option>
                        <option value="offHand">Mano secundaria</option>
                        <option value="ranged">A distancia</option>
                        <option value="armor">Armadura</option>
                        <option value="artifact">Artefacto</option>
                        <option value="worn">Vestido</option>
                      </select>
                    </Field>
                    <Field label="Danio / proteccion"><input disabled={!editMode} value={item.category === "armor" ? item.protectionFormula : item.damageFormula} onChange={(event) => updateInventoryItem(index, item.category === "armor" ? "protectionFormula" : "damageFormula", event.target.value)} /></Field>
                    {item.category === "weapon" ? (
                      <Field label="Cualidades"><input disabled={!editMode} value={item.qualities} onChange={(event) => updateInventoryItem(index, "qualities", event.target.value)} /></Field>
                    ) : null}
                  </div>
                  <textarea disabled={!editMode} rows={2} value={item.description} onChange={(event) => updateInventoryItem(index, "description", event.target.value)} />
                  {editMode ? <button type="button" className="subtle-button" onClick={() => removeInventoryItem(index)}>Quitar</button> : null}
                </article>
              ))}
            </div>
          </article>

          <article className="campaign-sheet-card">
            <h3>Ranuras equipadas</h3>
            <div className="form-grid">
              {(["mainHand", "offHand", "ranged", "armor", "artifact", "worn"] as const).map((slot) => (
                <Field key={slot} label={slotLabel(slot)}>
                  <select disabled={!editMode} value={normalizedSheet.equipmentSlots[slot]} onChange={(event) => updateField(`equipmentSlots.${slot}`, event.target.value)}>
                    <option value="">Sin asignar</option>
                    {normalizedSheet.inventoryItems.map((item) => (
                      <option key={`${slot}-${item.id}`} value={item.id}>{item.name || item.id}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "abilities" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <nav className="unified-sheet-subtabs" aria-label="Tipos de capacidades">
              {([
                ["traits", "Rasgos"],
                ["blessings", "Bendiciones"],
                ["burdens", "Cargas"],
                ["abilities", "Habilidades"],
                ["powers", "Poderes"],
                ["rituals", "Rituales"]
              ] as Array<[CapabilityTabId, string]>).map(([tab, label]) => (
                <button key={tab} type="button" className={activeCapabilityTab === tab ? "is-active" : ""} onClick={() => setActiveCapabilityTab(tab)}>
                  {label}
                </button>
              ))}
            </nav>

            {activeCapabilityTab === "traits" ? (
              <SimpleStringListEditor
                title="Rasgos"
                entries={normalizedSheet.rasgos}
                editable={editMode}
                rows={6}
                helpText="Rasgos de personaje como Contactos se guardan aqui y se exportan/importan como tipo Rasgo."
                onChange={(value) => updateSimpleSheetList("rasgos", value)}
                onAdd={() => addSimpleSheetEntry("rasgos")}
                onRemove={(index) => removeSimpleSheetEntry("rasgos", index)}
              />
            ) : null}

            {activeCapabilityTab === "blessings" ? (
              <SimpleStringListEditor
                title="Bendiciones"
                entries={normalizedSheet.bendiciones}
                editable={editMode}
                rows={6}
                helpText="Cada bendicion cuenta como 5 PX gastados."
                onChange={(value) => updateSimpleSheetList("bendiciones", value)}
                onAdd={() => addSimpleSheetEntry("bendiciones")}
                onRemove={(index) => removeSimpleSheetEntry("bendiciones", index)}
              />
            ) : null}

            {activeCapabilityTab === "burdens" ? (
              <SimpleStringListEditor
                title="Cargas"
                entries={normalizedSheet.cargas}
                editable={editMode}
                rows={6}
                helpText="Cada carga aporta 5 PX extra disponibles."
                onChange={(value) => updateSimpleSheetList("cargas", value)}
                onAdd={() => addSimpleSheetEntry("cargas")}
                onRemove={(index) => removeSimpleSheetEntry("cargas", index)}
              />
            ) : null}
          </article>
          {activeCapabilityTab === "abilities" ? (
            <CapabilityEditor title="Habilidades" entries={normalizedSheet.habilidades} editable={editMode} onAdd={() => addRatedEntry("habilidades")} onRemove={(index) => removeRatedEntry("habilidades", index)} onUpdate={(index, field, value) => updateRatedEntry("habilidades", index, field, value)} onOpenDetail={(entry) => openCapabilityDetail("habilidad", entry)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined} />
          ) : null}
          {activeCapabilityTab === "powers" ? (
            <CapabilityEditor title="Poderes misticos" entries={normalizedSheet.poderesMisticos} editable={editMode} onAdd={() => addRatedEntry("poderesMisticos")} onRemove={(index) => removeRatedEntry("poderesMisticos", index)} onUpdate={(index, field, value) => updateRatedEntry("poderesMisticos", index, field, value)} onOpenDetail={(entry) => openCapabilityDetail("poder_mistico", entry)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined} />
          ) : null}
          {activeCapabilityTab === "rituals" ? (
            <CapabilityEditor title="Rituales" entries={normalizedSheet.rituales} editable={editMode} onAdd={() => addRatedEntry("rituales")} onRemove={(index) => removeRatedEntry("rituales", index)} onUpdate={(index, field, value) => updateRatedEntry("rituales", index, field, value)} onOpenDetail={(entry) => openCapabilityDetail("ritual", entry)} onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined} />
          ) : null}
        </section>
      ) : null}

      {activeTab === "background" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <h3>Trasfondo</h3>
            <div className="form-grid">
              <Field label="Sombra"><input disabled={!editMode} value={normalizedSheet.identidad.sombra} onChange={(event) => updateField("identidad.sombra", event.target.value)} /></Field>
              <Field label="Cita"><input disabled={!editMode} value={normalizedSheet.identidad.cita} onChange={(event) => updateField("identidad.cita", event.target.value)} /></Field>
              <Field label="Edad"><input disabled={!editMode} value={normalizedSheet.identidad.edad} onChange={(event) => updateField("identidad.edad", event.target.value)} /></Field>
              <Field label="Altura"><input disabled={!editMode} value={normalizedSheet.identidad.altura} onChange={(event) => updateField("identidad.altura", event.target.value)} /></Field>
              <Field label="Peso"><input disabled={!editMode} value={normalizedSheet.identidad.peso} onChange={(event) => updateField("identidad.peso", event.target.value)} /></Field>
            </div>
            <Field label="Apariencia"><textarea disabled={!editMode} rows={2} value={normalizedSheet.identidad.apariencia} onChange={(event) => updateField("identidad.apariencia", event.target.value)} /></Field>
            <Field label="Objetivo personal"><textarea disabled={!editMode} rows={2} value={normalizedSheet.identidad.objetivoPersonal} onChange={(event) => updateField("identidad.objetivoPersonal", event.target.value)} /></Field>
            <Field label="Historia"><textarea disabled={!editMode} rows={8} value={normalizedSheet.noteSections.background} onChange={(event) => updateField("noteSections.background", event.target.value)} /></Field>
          </article>
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className="unified-sheet-panel">
          <article className="campaign-sheet-card">
            <h3>Notas y contexto</h3>
            <Field label="Notas generales"><textarea disabled={!editMode} rows={6} value={normalizedSheet.noteSections.general} onChange={(event) => updateField("noteSections.general", event.target.value)} /></Field>
            <Field label="Notas de campana"><textarea disabled={!editMode} rows={4} value={normalizedSheet.noteSections.campaign} onChange={(event) => updateField("noteSections.campaign", event.target.value)} /></Field>
            <div className="form-grid">
              <Field label="Grupo"><input disabled={!editMode} value={normalizedSheet.grupo.nombre} onChange={(event) => updateField("grupo.nombre", event.target.value)} /></Field>
              <Field label="Objetivo del grupo"><textarea disabled={!editMode} rows={2} value={normalizedSheet.grupo.objetivo} onChange={(event) => updateField("grupo.objetivo", event.target.value)} /></Field>
            </div>
          </article>

          <article className="campaign-sheet-card">
            <h3>Contactos</h3>
            <div className="unified-sheet-list">
              {normalizedSheet.contactosHoja.map((contacto, index) => (
                <article key={`contacto-${index}`} className="campaign-structured-card">
                  <div className="form-grid">
                    <Field label="Nombre"><input disabled={!editMode} value={contacto.nombre} onChange={(event) => updateField(`contactosHoja.${index}.nombre`, event.target.value)} /></Field>
                    <Field label="Raza"><input disabled={!editMode} value={contacto.raza} onChange={(event) => updateField(`contactosHoja.${index}.raza`, event.target.value)} /></Field>
                    <Field label="Ocupacion"><input disabled={!editMode} value={contacto.ocupacion} onChange={(event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value)} /></Field>
                    <Field label="Jugador"><input disabled={!editMode} value={contacto.jugador} onChange={(event) => updateField(`contactosHoja.${index}.jugador`, event.target.value)} /></Field>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      ) : null}
      {pendingRollConfirmation ? (
        <div className="modal-backdrop">
            <div className="panel modal-panel character-roll-confirm-modal">
              <h3>Enviar tirada</h3>
              <p className="section-help">{pendingRollConfirmation.title}</p>
              {pendingAttackModifiers.length > 0 ? (
                <div className="character-roll-confirm-modifiers">
                  <span>Modificadores de ataque</span>
                  {pendingAttackModifiers.map((modifier) => (
                    <label key={`${pendingRollConfirmation.action?.id}-${modifier.id}`} className="character-roll-confirm-modifier">
                      <input
                        type="checkbox"
                        checked={pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id)}
                        onChange={(event) =>
                          setPendingRollConfirmation((current) => current ? {
                            ...current,
                            selectedAttackModifierIds: event.target.checked
                              ? [...current.selectedAttackModifierIds, modifier.id]
                              : current.selectedAttackModifierIds.filter((entry) => entry !== modifier.id)
                          } : current)
                        }
                      />
                      <span>{modifier.label}</span>
                    </label>
                  ))}
                  <p className="section-help">
                    Objetivo final: {getPendingAttackTarget(
                      normalizedSheet,
                      displayName,
                      pendingRollConfirmation.action!,
                      rollDestination,
                      pendingRollConfirmation.selectedAttackModifierIds
                    ) ?? "-"}
                  </p>
                </div>
              ) : null}
              {pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage" && getActionDamageVariants(pendingRollConfirmation.action).length > 0 ? (
                <div className="character-roll-confirm-modifiers">
                <span>Modificadores de dano</span>
                {getActionDamageVariants(pendingRollConfirmation.action).map((modifier) => (
                  <label key={`${pendingRollConfirmation.action?.id}-${modifier.id}`} className="character-roll-confirm-modifier">
                    <input
                      type="checkbox"
                      checked={pendingRollConfirmation.selectedDamageModifierIds.includes(modifier.id)}
                      onChange={(event) =>
                        setPendingRollConfirmation((current) => current ? {
                          ...current,
                          selectedDamageModifierIds: event.target.checked
                            ? [...current.selectedDamageModifierIds, modifier.id]
                            : current.selectedDamageModifierIds.filter((entry) => entry !== modifier.id)
                        } : current)
                      }
                    />
                    <span>{modifier.label} ({modifier.formula})</span>
                  </label>
                ))}
              </div>
            ) : null}
            {(() => {
              const formulaBreakdown = pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage"
                ? getDamageRollBreakdown(
                    pendingRollConfirmation.action,
                    pendingRollConfirmation.selectedDamageModifierIds
                  )
                : (pendingRollConfirmation.request?.phase === "damage" ? getRollRequestBreakdown(pendingRollConfirmation.request) : []);
              const finalFormula = pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage"
                ? buildRollRequest(
                    normalizedSheet,
                    displayName,
                    pendingRollConfirmation.action.id,
                    "damage",
                    rollDestination,
                    "",
                    pendingRollConfirmation.selectedDamageModifierIds
                  ).formula
                : (pendingRollConfirmation.request?.phase === "damage" ? pendingRollConfirmation.request.formula : "");

              if (!finalFormula) {
                return null;
              }

              return (
                <div className="character-roll-confirm-formula-block">
                  <div className="character-roll-confirm-formula-row">
                    <p className="section-help">Formula final: {finalFormula}</p>
                    {formulaBreakdown.length > 0 ? (
                      <button
                        type="button"
                        className="character-roll-info-button"
                        onClick={() => setShowPendingRollBreakdown((current) => !current)}
                        aria-expanded={showPendingRollBreakdown}
                        aria-label="Mostrar origen de los dados"
                      >
                        i
                      </button>
                    ) : null}
                  </div>
                  {showPendingRollBreakdown && formulaBreakdown.length > 0 ? (
                    <div className="character-roll-breakdown-list">
                      {formulaBreakdown.map((entry, index) => (
                        <div key={`${entry.label}-${entry.formula ?? entry.detail ?? index}`} className="character-roll-breakdown-item">
                          <strong>{entry.label}</strong>
                          {entry.formula ? <span>{entry.formula}</span> : null}
                          {entry.detail ? <span>{entry.detail}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}
            {(pendingRollConfirmation.defenseAlternativeIds?.length ?? 0) > 0 ? (
              <div className="character-roll-confirm-modifiers">
                <span>Defensa</span>
                <label className="character-roll-confirm-modifier">
                  <input
                    type="radio"
                    name="defense-alternative"
                    checked={!pendingRollConfirmation.selectedDefenseAlternativeId}
                    onChange={() => setPendingRollConfirmation((current) => current ? { ...current, selectedDefenseAlternativeId: "" } : current)}
                  />
                  <span>Defensa base ({derived.defensaTotal})</span>
                </label>
                {pendingRollConfirmation.defenseAlternativeIds?.map((actionId) => {
                  const action = defenseAlternativeActions.find((entry) => entry.id === actionId);
                  if (!action) return null;
                  const label = formatActionDisplayLabel(action.label);
                  return (
                    <label key={action.id} className="character-roll-confirm-modifier">
                      <input
                        type="radio"
                        name="defense-alternative"
                        checked={pendingRollConfirmation.selectedDefenseAlternativeId === action.id}
                        onChange={() => setPendingRollConfirmation((current) => current ? { ...current, selectedDefenseAlternativeId: action.id } : current)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            <div className="row-actions character-roll-confirm-actions">
              <div className="character-roll-confirm-primary">
                <button type="button" onClick={() => void handleConfirmRoll20Send("public")}>Publico</button>
                <button type="button" onClick={() => void handleConfirmRoll20Send("gm")}>Solo DJ</button>
              </div>
              <button type="button" className="subtle-button" onClick={() => setPendingRollConfirmation(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
      {actionDetailModal ? (
        <div className="modal-backdrop" onClick={() => setActionDetailModal(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{actionDetailModal.title}</h3>
            <p className="section-help">{actionDetailModal.sourceLabel}</p>
            <div className="unified-sheet-action-detail-body">
              {actionDetailModal.inventoryMeta ? (
                <div className="unified-sheet-weapon-detail-layout">
                  <section className="unified-sheet-weapon-detail-hero">
                    <div className="unified-sheet-weapon-detail-primary">
                      {actionDetailModal.inventoryMeta.damage ? <strong>{actionDetailModal.inventoryMeta.damage}</strong> : null}
                      <span>Danio base</span>
                    </div>
                    <div className="unified-sheet-weapon-detail-stats">
                      {actionDetailModal.inventoryMeta.value ? (
                        <article className="unified-sheet-weapon-detail-stat">
                          <span>Valor</span>
                          <strong>{actionDetailModal.inventoryMeta.value}</strong>
                        </article>
                      ) : null}
                    </div>
                  </section>
                  <section className="unified-sheet-weapon-detail-copy">
                    <p className="unified-sheet-rich-text">{actionDetailModal.detail}</p>
                  </section>
                  {actionDetailModal.inventoryMeta.qualities && actionDetailModal.inventoryMeta.qualities.length > 0 ? (
                    <section className="unified-sheet-weapon-detail-qualities">
                      <h4>Cualidades</h4>
                      <div className="unified-sheet-weapon-quality-list">
                        {actionDetailModal.inventoryMeta.qualities.map((quality) => (
                          <div key={`${actionDetailModal.title}-${quality.id}`} className="unified-sheet-weapon-quality-row">
                            <span>{quality.label}</span>
                            <button
                              type="button"
                              className={`unified-sheet-weapon-quality-info${activeWeaponQualityInfoId === quality.id ? " is-active" : ""}`}
                              aria-label={`Ver detalle de ${quality.label}`}
                              onClick={() => setActiveWeaponQualityInfoId((current) => current === quality.id ? "" : quality.id)}
                            >
                              i
                            </button>
                          </div>
                        ))}
                      </div>
                      {activeWeaponQualityInfoId ? (
                        (() => {
                          const selectedQuality = actionDetailModal.inventoryMeta?.qualities?.find((quality) => quality.id === activeWeaponQualityInfoId);
                          return selectedQuality ? (
                            <div className="unified-sheet-weapon-quality-panel">
                              <strong>{selectedQuality.label}</strong>
                              <p>{selectedQuality.details}</p>
                            </div>
                          ) : null;
                        })()
                      ) : null}
                    </section>
                  ) : null}
                  {actionDetailModal.inventoryMeta.notes && actionDetailModal.inventoryMeta.notes.length > 0 ? (
                    <section className="unified-sheet-weapon-detail-notes">
                      <h4>Notas</h4>
                      {actionDetailModal.inventoryMeta.notes.map((note, index) => (
                        <p key={`${actionDetailModal.title}-inventory-note-${index}`} className="unified-sheet-capability-notes">{note}</p>
                      ))}
                    </section>
                  ) : null}
                </div>
              ) : actionDetailModal.tiers && actionDetailModal.tiers.length > 0 ? (
                <div className="unified-sheet-capability-tier-list">
                  {actionDetailModal.tiers.map((tier) => (
                    <section key={`${actionDetailModal.title}-${tier.label}`} className="unified-sheet-capability-tier">
                      <h4>{tier.label}</h4>
                      <p className="unified-sheet-rich-text">{tier.content}</p>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="unified-sheet-rich-text">{actionDetailModal.detail}</p>
              )}
              {!actionDetailModal.inventoryMeta && actionDetailModal.notes?.map((note, index) => (
                <p key={`${actionDetailModal.title}-note-${index}`} className="unified-sheet-capability-notes">{note}</p>
              ))}
              {actionDetailModal.references && actionDetailModal.references.length > 0 ? (
                <div className="unified-sheet-capability-meta">
                  {actionDetailModal.references.map((reference) => (
                    <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">
                      {reference.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="row-actions character-roll-confirm-actions">
              {typeof actionDetailModal.editInventoryIndex === "number" ? (
                <button
                  type="button"
                  className="accent-button"
                  onClick={() => {
                    const item = normalizedSheet.inventoryItems[actionDetailModal.editInventoryIndex as number];
                    if (!item) return;
                    setWeaponEditorModal({
                      mode: "edit",
                      item: { ...item },
                      index: actionDetailModal.editInventoryIndex
                    });
                    setActionDetailModal(null);
                  }}
                >
                  Editar
                </button>
              ) : null}
              {typeof actionDetailModal.removeInventoryIndex === "number" ? (
                <button
                  type="button"
                  className="destructive-button"
                  onClick={() => {
                    removeInventoryItem(actionDetailModal.removeInventoryIndex as number);
                    setActionDetailModal(null);
                  }}
                >
                  Quitar
                </button>
              ) : null}
              <button type="button" className="subtle-button" onClick={() => setActionDetailModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
      {weaponEditorModal ? (
        <div className="modal-backdrop" onClick={() => setWeaponEditorModal(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{weaponEditorModal.mode === "create" ? "Arma personalizada" : "Editar arma personalizada"}</h3>
            <p className="section-help">Configura el arma y guardala para que aparezca en el inventario como cualquier otra arma.</p>
            <div className="unified-sheet-action-detail-body">
              <div className="form-grid">
                <Field label="Nombre"><input value={weaponEditorModal.item.name} onChange={(event) => updateWeaponEditorItem("name", event.target.value)} /></Field>
                <Field label="Danio"><input value={weaponEditorModal.item.damageFormula} onChange={(event) => updateWeaponEditorItem("damageFormula", event.target.value)} /></Field>
                <Field label="Ranura">
                  <select value={weaponEditorModal.item.slot} onChange={(event) => updateWeaponEditorItem("slot", event.target.value)}>
                    <option value="none">Ninguna</option>
                    <option value="mainHand">Mano principal</option>
                    <option value="offHand">Mano secundaria</option>
                    <option value="ranged">A distancia</option>
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input type="number" min={0} value={weaponEditorModal.item.quantity} onChange={(event) => updateWeaponEditorItem("quantity", Number(event.target.value || 0))} />
                </Field>
                <Field label="Apilable">
                  <select value={weaponEditorModal.item.stackable ? "si" : "no"} onChange={(event) => updateWeaponEditorItem("stackable", event.target.value === "si")}>
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </Field>
                <Field label="Valor"><input value={weaponEditorModal.item.value} onChange={(event) => updateWeaponEditorItem("value", event.target.value)} /></Field>
              </div>
              <div className="field">
                <span>Cualidades</span>
                <div className="unified-sheet-quality-picker">
                  {WEAPON_QUALITY_OPTIONS.map((quality) => {
                    const active = getKnownWeaponQualities(weaponEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                    return (
                      <button
                        key={`${weaponEditorModal.item.id}-${quality.id}`}
                        type="button"
                        className={active ? "is-active" : ""}
                        onClick={() => toggleWeaponEditorQuality(quality.label)}
                      >
                        {quality.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Cualidades adicionales">
                <input
                  value={getCustomWeaponQualities(weaponEditorModal.item).join(", ")}
                  placeholder="Separadas por comas"
                  onChange={(event) => updateWeaponEditorCustomQualities(event.target.value)}
                />
              </Field>
              <Field label="Descripcion">
                <textarea rows={3} value={weaponEditorModal.item.description} placeholder="Descripcion del arma" onChange={(event) => updateWeaponEditorItem("description", event.target.value)} />
              </Field>
              <Field label="Notas">
                <textarea rows={3} value={weaponEditorModal.item.notes} placeholder="Notas de uso, mantenimiento o procedencia" onChange={(event) => updateWeaponEditorItem("notes", event.target.value)} />
              </Field>
            </div>
            <div className="row-actions character-roll-confirm-actions">
              <button type="button" className="subtle-button" onClick={() => setWeaponEditorModal(null)}>Cancelar</button>
              <button type="button" className="accent-button" onClick={saveWeaponEditorModal}>Guardar</button>
            </div>
          </div>
        </div>
      ) : null}
      {inventoryCatalogModalTab ? (
        <div className="modal-backdrop" onClick={() => setInventoryCatalogModalTab(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-item-catalog-modal" onClick={(event) => event.stopPropagation()}>
            <h3>
              {inventoryCatalogModalTab === "weapons"
                ? "Agregar arma"
                : inventoryCatalogModalTab === "armors"
                  ? "Agregar armadura"
                  : "Agregar objeto"}
            </h3>
            <p className="section-help">Selecciona un objeto existente del catalogo para anadirlo al inventario.</p>
            <div className="unified-sheet-item-catalog-fields">
              {inventoryCatalogModalTab === "weapons" ? (
                <label className="field">
                  <span>Tipo</span>
                  <select value={selectedWeaponCatalogFilter} onChange={(event) => setSelectedWeaponCatalogFilter(event.target.value as WeaponCatalogFilterId)}>
                    {WEAPON_CATALOG_FILTER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span>{inventoryCatalogModalTab === "weapons" ? "Arma" : "Catalogo"}</span>
                <select value={selectedCatalogItemId} onChange={(event) => setSelectedCatalogItemId(event.target.value)}>
                  {filteredModalCatalogItems.map((item) => (
                    <option key={item.templateId} value={item.templateId}>{item.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {filteredModalCatalogItems.length > 0 ? (
              <div className="unified-sheet-item-catalog-preview">
                {(() => {
                  const selectedItem = filteredModalCatalogItems.find((item) => item.templateId === selectedCatalogItemId) ?? filteredModalCatalogItems[0];
                  if (!selectedItem) return null;
                  const selectedItemQualities = parseWeaponQualities(selectedItem.qualities);
                  return (
                    selectedItem.category === "weapon" ? (
                      <div className="unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview">
                        <div className="unified-sheet-item-catalog-preview-header">
                          <strong>{selectedItem.name}</strong>
                          <span>Arma del catalogo</span>
                        </div>
                        <section className="unified-sheet-weapon-detail-hero">
                          <div className="unified-sheet-weapon-detail-primary">
                            {selectedItem.damageFormula ? <strong>{selectedItem.damageFormula}</strong> : <strong>-</strong>}
                            <span>Danio base</span>
                          </div>
                          <div className="unified-sheet-weapon-detail-stats">
                            {selectedItem.value ? (
                              <article className="unified-sheet-weapon-detail-stat">
                                <span>Valor</span>
                                <strong>{selectedItem.value}</strong>
                              </article>
                            ) : null}
                          </div>
                        </section>
                        {selectedItem.description ? (
                          <section className="unified-sheet-weapon-detail-copy">
                            <p>{selectedItem.description}</p>
                          </section>
                        ) : null}
                        {selectedItemQualities.length > 0 ? (
                          <section className="unified-sheet-weapon-detail-qualities">
                            <h4>Cualidades</h4>
                            <div className="unified-sheet-item-catalog-meta">
                              {selectedItemQualities.map((quality) => <span key={`${selectedItem.templateId}-${quality}`}>{quality}</span>)}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <strong>{selectedItem.name}</strong>
                        {selectedItem.description ? <p>{selectedItem.description}</p> : null}
                        <div className="unified-sheet-item-catalog-meta">
                          <span>{selectedItem.category === "armor" ? "Armadura" : "Objeto"}</span>
                          {selectedItem.protectionFormula ? <span>Proteccion {selectedItem.protectionFormula}</span> : null}
                          {selectedItem.value ? <span>{selectedItem.value}</span> : null}
                          {selectedItem.qualities ? <span>{selectedItem.qualities}</span> : null}
                        </div>
                      </>
                    )
                  );
                })()}
              </div>
            ) : (
              <p className="section-help">No hay elementos disponibles en esta categoria.</p>
            )}
            <div className="row-actions character-roll-confirm-actions">
              <button type="button" className="subtle-button" onClick={() => setInventoryCatalogModalTab(null)}>Cancelar</button>
              <button type="button" disabled={filteredModalCatalogItems.length === 0 || !selectedCatalogItemId} onClick={addSelectedCatalogItemFromModal}>Agregar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function slotLabel(slot: "mainHand" | "offHand" | "ranged" | "armor" | "artifact" | "worn"): string {
  switch (slot) {
    case "mainHand": return "Mano principal";
    case "offHand": return "Mano secundaria";
    case "ranged": return "A distancia";
    case "armor": return "Armadura";
    case "artifact": return "Artefacto";
    case "worn": return "Vestido";
  }
}

function CapabilityTextList({
  title,
  entries,
  onOpenDetail
}: {
  title: string;
  entries: RatedEntry[];
  onOpenDetail?: (entry: RatedEntry) => void;
  onOpenCompendium?: (name: string) => void;
}) {
  return (
    <div className="unified-sheet-list">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <article
            key={`${title}-${index}-${entry.nombre}`}
            className={`unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}`}
            onClick={onOpenDetail ? () => onOpenDetail(entry) : undefined}
            onKeyDown={onOpenDetail ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetail(entry);
              }
            } : undefined}
            role={onOpenDetail ? "button" : undefined}
            tabIndex={onOpenDetail ? 0 : undefined}
          >
            <div className="row-actions">
              <h3>{entry.nombre || title}</h3>
            </div>
            <div className="unified-sheet-capability-meta">
              {entry.tipo ? <span>{entry.tipo}</span> : null}
              {entry.nivel ? <span>{entry.nivel}</span> : null}
              {entry.fuente ? <span>{entry.fuente}{entry.pagina ? ` p. ${entry.pagina}` : ""}</span> : entry.pagina ? <span>p. {entry.pagina}</span> : null}
            </div>
          </article>
        ))
      ) : (
        <p className="unified-sheet-capability-empty">Sin entradas.</p>
      )}
    </div>
  );
}

function SimpleStringList({
  title,
  entries,
  emptyText
}: {
  title: string;
  entries: string[];
  emptyText: string;
}) {
  return (
    <div className="unified-sheet-list">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <article key={`${title}-${index}-${entry}`} className="unified-sheet-capability-card">
            <h3>{entry}</h3>
            <div className="unified-sheet-capability-meta">
              <span>{title}</span>
            </div>
          </article>
        ))
      ) : (
        <p className="unified-sheet-capability-empty">{emptyText}</p>
      )}
    </div>
  );
}

function SimpleStringListEditor({
  title,
  entries,
  editable,
  rows,
  helpText,
  onChange,
  onAdd,
  onRemove
}: {
  title: string;
  entries: string[];
  editable: boolean;
  rows: number;
  helpText?: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <article className="campaign-sheet-card">
      <div className="row-actions">
        <h3>{title}</h3>
        {editable ? <button type="button" onClick={onAdd}>Agregar linea</button> : null}
      </div>
      {helpText ? <p className="section-help">{helpText}</p> : null}
      <Field label={title}>
        <textarea
          disabled={!editable}
          rows={rows}
          value={entries.join("\n")}
          onChange={(event) => onChange(event.target.value)}
        />
      </Field>
      <div className="unified-sheet-list">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <article key={`${title}-editor-${index}-${entry}`} className="campaign-structured-card">
              <div className="row-actions">
                <strong>{entry || `${title} ${index + 1}`}</strong>
                {editable ? <button type="button" className="subtle-button" onClick={() => onRemove(index)}>Quitar</button> : null}
              </div>
            </article>
          ))
        ) : (
          <p className="section-help">Sin entradas.</p>
        )}
      </div>
    </article>
  );
}

type CapabilityEditorProps = {
  title: string;
  entries: CharacterSheet["habilidades"];
  editable: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "nombre" | "tipo" | "efecto" | "nivel" | "fuente" | "pagina" | "notas", value: string | number) => void;
  onOpenDetail?: (entry: CharacterSheet["habilidades"][number]) => void;
  onOpenCompendium?: (name: string) => void;
};

function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenDetail, onOpenCompendium }: CapabilityEditorProps) {
  return (
    <article className="campaign-sheet-card">
      <div className="row-actions">
        <h3>{title}</h3>
        {editable ? <button type="button" onClick={onAdd}>Agregar</button> : null}
      </div>
      <div className="unified-sheet-list">
        {entries.map((entry, index) => (
          <article key={`${title}-${index}-${entry.nombre}`} className="campaign-structured-card">
            <div className="form-grid">
              <Field label="Nombre"><input disabled={!editable} value={entry.nombre} onChange={(event) => onUpdate(index, "nombre", event.target.value)} /></Field>
              <Field label="Tipo"><input disabled={!editable} value={entry.tipo} onChange={(event) => onUpdate(index, "tipo", event.target.value)} /></Field>
              <Field label="Nivel"><select disabled={!editable} value={entry.nivel} onChange={(event) => onUpdate(index, "nivel", event.target.value)}><option value="novato">Novato</option><option value="adepto">Adepto</option><option value="maestro">Maestro</option></select></Field>
              <Field label="Fuente"><input disabled={!editable} value={entry.fuente} onChange={(event) => onUpdate(index, "fuente", event.target.value)} /></Field>
              <Field label="Pagina"><input disabled={!editable} type="number" min={0} value={entry.pagina ?? ""} onChange={(event) => onUpdate(index, "pagina", Number(event.target.value || 0))} /></Field>
            </div>
            <textarea disabled={!editable} rows={3} value={entry.efecto} onChange={(event) => onUpdate(index, "efecto", event.target.value)} />
            <textarea disabled={!editable} rows={2} value={entry.notas} onChange={(event) => onUpdate(index, "notas", event.target.value)} />
            <div className="card-actions">
              {onOpenDetail ? <button type="button" className="subtle-button" onClick={() => onOpenDetail(entry)}>Ver detalle</button> : null}
              {onOpenCompendium ? <button type="button" className="subtle-button" onClick={() => onOpenCompendium(entry.nombre)}>Ver en compendio</button> : null}
              {editable ? <button type="button" className="subtle-button" onClick={() => onRemove(index)}>Quitar</button> : null}
            </div>
          </article>
        ))}
        {entries.length === 0 ? <p className="section-help">Sin entradas.</p> : null}
      </div>
    </article>
  );
}

