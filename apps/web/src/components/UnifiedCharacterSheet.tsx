import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { getCharacterActionRollPresentation } from "../models/actionPresentation";
import { getCharacterExperienceSummary } from "../models/characterExperience";
import { ARMOR_QUALITY_OPTIONS, ITEM_QUALITY_OPTIONS, createCustomInventoryItem, createInventoryItemFromTemplate, ITEM_CATALOG, type ItemTemplate } from "../models/itemCatalog";
import { ALL_ENTRIES, findCompendiumEntryByTypeAndName, getCompendiumSourcePdfUrl, getCompendiumSummaryLink } from "../models/compendiumEntries";
import { useUnifiedCharacterSheet } from "../hooks/useUnifiedCharacterSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { CharacterSheetBackgroundPicker } from "./CharacterSheetBackgroundPicker";
import {
  dispatchRoll20Request,
  setRollDestination as persistRollDestination,
  type Roll20Visibility
} from "../services/rollTransport";

type TabId = "actions" | "inventory" | "abilities" | "background" | "notes";
type MobileSheetTabId = "attributes" | TabId;
type MechanicalTabId = Extract<TabId, "actions" | "inventory" | "abilities">;
type NarrativeTabId = Extract<TabId, "background" | "notes">;
type ActionTabId = "all" | "favorites" | "attacks" | "powers" | "artifacts" | "actions" | "free" | "reactions" | "other" | "special";
type CapabilityTabId = "traits" | "blessings" | "burdens" | "abilities" | "powers" | "rituals";
type InventoryTabId = "money" | "weapons" | "armors" | "artifacts" | "items";
type RatedEntry = CharacterSheet["habilidades"][number];
type SimpleSheetListSection = "bendiciones" | "cargas" | "rasgos";
type CharacterPersonalNoteEntry = CharacterSheet["personalNotes"][number];
type CharacterConditionEntry = CharacterSheet["conditions"][number];
type ConditionTone = "danger" | "warning" | "info" | "poison" | "critical" | "corruption";

type CharacterConditionDefinition = {
  id: string;
  name: string;
  category: CharacterConditionEntry["category"];
  tone: ConditionTone;
};

type Props = {
  title: string;
  subtitle: string;
  sheet: CharacterSheet;
  editable: boolean;
  busy?: boolean;
  onSave?: (sheet: CharacterSheet) => Promise<void>;
  onBack?: () => void;
  onOpenBuilder?: () => void;
  backgroundPreferenceScope?: string;
  onOpenCompendiumCapability?: (tipo: "habilidad" | "poder_mistico" | "ritual" | "bendicion" | "carga", nombre: string) => void;
  onUseArtifactAbility?: (artifactId: string, abilityId: string) => Promise<void>;
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
  capabilityTipo?: "habilidad" | "poder_mistico" | "ritual" | "bendicion" | "carga";
  capabilityNombre?: string;
  removeInventoryIndex?: number;
  editInventoryIndex?: number;
  inventoryMeta?: {
    kind?: "weapon" | "armor" | "item";
    attack?: string;
    damage?: string;
    protection?: string;
    primaryLabel?: string;
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

type WeaponCatalogFilterId = "all" | "one-handed" | "short" | "long" | "heavy" | "ranged" | "thrown" | "shield";
type ArmorCatalogFilterId = "all" | "light" | "medium" | "heavy";
type ItemCatalogFilterId = "all" | "elixir" | "minor-artifact" | "trap" | "tool" | "equipment" | "container" | "travel" | "ammunition" | "material" | "ritual" | "valuable";

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

type ArmorEditorModal = {
  mode: "create" | "edit";
  item: CharacterSheet["inventoryItems"][number];
  index?: number;
};

type ItemEditorModal = {
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

type RollModalCheckModifier = AttackRollModifier & {
  source: "trait" | "ability" | "boon";
};

type PersistedSheetTabs = {
  activeTab?: TabId;
  activeMechanicalTab?: MechanicalTabId;
  activeNarrativeTab?: NarrativeTabId;
  activeActionTab?: ActionTabId;
  activeCapabilityTab?: CapabilityTabId;
  activeInventoryTab?: InventoryTabId;
};

type SheetTabState = {
  activeTab: TabId;
  activeMechanicalTab: MechanicalTabId;
  activeNarrativeTab: NarrativeTabId;
  activeActionTab: ActionTabId;
  activeCapabilityTab: CapabilityTabId;
  activeInventoryTab: InventoryTabId;
};

const TAB_IDS: TabId[] = ["actions", "inventory", "abilities", "background", "notes"];
const MECHANICAL_TAB_IDS: MechanicalTabId[] = ["actions", "inventory", "abilities"];
const NARRATIVE_TAB_IDS: NarrativeTabId[] = ["background", "notes"];
const ACTION_TAB_IDS: ActionTabId[] = ["all", "favorites", "attacks", "powers", "artifacts", "actions", "free", "reactions", "other", "special"];
const CAPABILITY_TAB_IDS: CapabilityTabId[] = ["traits", "blessings", "burdens", "abilities", "powers", "rituals"];
const INVENTORY_TAB_IDS: InventoryTabId[] = ["money", "weapons", "armors", "artifacts", "items"];

const CHARACTER_CONDITION_DEFINITIONS: CharacterConditionDefinition[] = [
  { id: "condition-burning", name: "Ardiendo", category: "injury", tone: "danger" },
  { id: "condition-stunned", name: "Aturdido", category: "state", tone: "warning" },
  { id: "condition-blinded", name: "Cegado", category: "state", tone: "warning" },
  { id: "condition-prone", name: "Derribado", category: "state", tone: "info" },
  { id: "condition-poisoned", name: "Envenenado", category: "injury", tone: "poison" },
  { id: "condition-immobilized", name: "Inmovilizado", category: "state", tone: "info" },
  { id: "condition-paralyzed", name: "Paralizado", category: "state", tone: "critical" },
  { id: "condition-bleeding", name: "Sangrando", category: "injury", tone: "danger" }
];

function normalizeConditionName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function matchesConditionDefinition(condition: CharacterConditionEntry, definition: CharacterConditionDefinition): boolean {
  return condition.id === definition.id || normalizeConditionName(condition.name) === normalizeConditionName(definition.name);
}

function getStoredConditionTone(condition: CharacterConditionEntry): ConditionTone {
  if (condition.category === "injury") return "danger";
  if (condition.category === "corruption") return "critical";
  if (condition.category === "state") return "info";
  return "warning";
}

const WEAPON_CATALOG_FILTER_OPTIONS: Array<{ id: WeaponCatalogFilterId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "one-handed", label: "Una mano" },
  { id: "short", label: "Cortas" },
  { id: "long", label: "Largas" },
  { id: "heavy", label: "Pesadas" },
  { id: "ranged", label: "A distancia" },
  { id: "thrown", label: "Arrojadizas" },
  { id: "shield", label: "Escudos" }
];

const ARMOR_CATALOG_FILTER_OPTIONS: Array<{ id: ArmorCatalogFilterId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "light", label: "Ligeras" },
  { id: "medium", label: "Medias" },
  { id: "heavy", label: "Pesadas" }
];

const ITEM_CATALOG_FILTER_OPTIONS: Array<{ id: ItemCatalogFilterId; label: string }> = [
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
const DEFAULT_SHEET_TAB_STATE: SheetTabState = {
  activeTab: "actions",
  activeMechanicalTab: "actions",
  activeNarrativeTab: "background",
  activeActionTab: "all",
  activeCapabilityTab: "abilities",
  activeInventoryTab: "weapons"
};

const SPECIAL_ACTION_RULE_NAMES = [
  "Apuntar con cuidado",
  "Embestir",
  "Retrasar la iniciativa",
  "Desarmar",
  "Defensa completa",
  "Ofensiva total",
  "Presa",
  "Dejar inconsciente",
  "Veneno en las armas",
  "Hacer retroceder",
  "Placaje",
  "Tomar la iniciativa",
  "Luchar a ciegas",
  "Destrabarse del combate",
  "Usar/aplicar un elixir",
  "Primeros auxilios",
  "Levantarse"
] as const;

function buildSheetNoteId(): string {
  return `sheet-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortCharacterPersonalNotes(entries: CharacterPersonalNoteEntry[]): CharacterPersonalNoteEntry[] {
  return [...entries].sort((left, right) => {
    const leftDate = left.updatedAt || left.createdAt || "";
    const rightDate = right.updatedAt || right.createdAt || "";
    return rightDate.localeCompare(leftDate);
  });
}

function summarizeCharacterNote(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "Sin contenido.";
  }
  return collapsed.length > 160 ? `${collapsed.slice(0, 157)}...` : collapsed;
}

function renderSimpleMarkdownInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [fullMatch, , linkLabel, linkUrl, inlineCode, boldText, italicText] = match;
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (linkLabel && linkUrl) {
      nodes.push(<a key={`${keyPrefix}-link-${match.index}`} href={linkUrl} target="_blank" rel="noreferrer">{linkLabel}</a>);
    } else if (inlineCode) {
      nodes.push(<code key={`${keyPrefix}-code-${match.index}`}>{inlineCode}</code>);
    } else if (boldText) {
      nodes.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{renderSimpleMarkdownInline(boldText, `${keyPrefix}-bold-${match.index}`)}</strong>);
    } else if (italicText) {
      nodes.push(<em key={`${keyPrefix}-italic-${match.index}`}>{renderSimpleMarkdownInline(italicText, `${keyPrefix}-italic-${match.index}`)}</em>);
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderSimpleMarkdownBlocks(text: string): ReactNode {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeBlock: string[] = [];
  let inCodeBlock = false;

  function flushParagraph(): void {
    if (paragraphBuffer.length === 0) return;
    const textContent = paragraphBuffer.join(" ").trim();
    if (textContent) {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{renderSimpleMarkdownInline(textContent, `paragraph-${blocks.length}`)}</p>);
    }
    paragraphBuffer = [];
  }

  function flushList(): void {
    if (listItems.length === 0 || !listType) return;
    const Tag = listType;
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={`list-${blocks.length}-${index}`}>{renderSimpleMarkdownInline(item, `list-${blocks.length}-${index}`)}</li>)}
      </Tag>
    );
    listItems = [];
    listType = null;
  }

  function flushCodeBlock(): void {
    if (codeBlock.length === 0) return;
    blocks.push(<pre key={`code-${blocks.length}`} className="campaign-markdown-code-block"><code>{codeBlock.join("\n")}</code></pre>);
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
      } else {
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
        blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      } else if (level === 4) {
        blocks.push(<h4 key={`heading-${index}`}>{content}</h4>);
      } else if (level === 5) {
        blocks.push(<h5 key={`heading-${index}`}>{content}</h5>);
      } else {
        blocks.push(<h6 key={`heading-${index}`}>{content}</h6>);
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
      blocks.push(
        <blockquote key={`blockquote-${index}`}>
          {renderSimpleMarkdownInline(blockquoteMatch[1], `blockquote-${index}`)}
        </blockquote>
      );
      return;
    }

    flushList();
    paragraphBuffer.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushCodeBlock();

  return blocks.length > 0 ? blocks : <p>Sin contenido.</p>;
}

function matchesWeaponCatalogFilter(item: ItemTemplate, filterId: WeaponCatalogFilterId): boolean {
  if (item.category !== "weapon") return false;
  if (filterId === "all") return true;
  const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
  if (filterId === "shield") return qualities.includes("escudo");
  if (filterId === "ranged") return qualities.includes("a distancia") || item.slot === "ranged";
  if (filterId === "thrown") return qualities.includes("arrojadiza") || item.slot === "none";
  if (filterId === "heavy") return qualities.includes("pesada") || item.name.toLowerCase().includes("pesada");
  if (filterId === "long") return qualities.includes("larga");
  if (filterId === "short") return qualities.includes("corta") || (item.slot === "offHand" && !qualities.includes("escudo"));
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

function WeaponCatalogTypeIcon({ type }: { type: WeaponCatalogFilterId }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (type === "all") {
    return <svg {...commonProps}><path d="M4 20 20 4M13 4h7v7M4 4l5 5M4 4v5h5M15 15l5 5M15 20h5v-5" /></svg>;
  }
  if (type === "one-handed") {
    return <svg {...commonProps}><path d="m5 19 12-12M14 4l6 6M4 20l4-1-3-3-1 4ZM11 10l3 3" /></svg>;
  }
  if (type === "short") {
    return <svg {...commonProps}><path d="m6 18 9-9M13 6l5 5M5 19l3-1-2-2-1 3ZM10 11l3 3" /></svg>;
  }
  if (type === "long") {
    return <svg {...commonProps}><path d="M4 20 18 6M15 4l5 5M3 21l5-1-4-4-1 5ZM11 10l3 3" /></svg>;
  }
  if (type === "heavy") {
    return <svg {...commonProps}><path d="M5 20 16 9M13 4l7 7-4 4-7-7 4-4ZM4 21l4-1-3-3-1 4" /></svg>;
  }
  if (type === "ranged") {
    return <svg {...commonProps}><path d="M6 3c5 4 5 14 0 18M6 3c9 3 9 15 0 18M5 12h15M17 9l3 3-3 3" /></svg>;
  }
  if (type === "shield") {
    return <svg {...commonProps}><path d="M12 3 5 6v5c0 4.4 2.4 7.7 7 10 4.6-2.3 7-5.6 7-10V6l-7-3Z" /><path d="M12 6v11M8 10h8" /></svg>;
  }
  return <svg {...commonProps}><path d="M4 20 17 7M14 4l6 6M3 21l5-1-4-4-1 5M11 13l-3-3M8 10l3-1-1 3" /></svg>;
}

function ArmorCatalogTypeIcon({ type }: { type: ArmorCatalogFilterId }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (type === "all") {
    return <svg {...commonProps}><path d="M7 3 4 6v5c0 4.6 2.8 8.2 8 10 5.2-1.8 8-5.4 8-10V6l-3-3-5 2-5-2Z" /><path d="M8 10h8M12 6v11" /></svg>;
  }
  if (type === "light") {
    return <svg {...commonProps}><path d="m8 4-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3-2 2h-4L8 4Z" /><path d="M9 14h6" /></svg>;
  }
  if (type === "medium") {
    return <svg {...commonProps}><path d="m8 3-4 4 3 3v10h10V10l3-3-4-4-2 3h-4L8 3Z" /><path d="M7 11h10M10 6v14M14 6v14" /></svg>;
  }
  return <svg {...commonProps}><path d="m8 3-4 4 3 4v9h10v-9l3-4-4-4-2 3h-4L8 3Z" /><path d="M7 11h10M9 15h6M10 6v14M14 6v14" /><path d="M4 7h4M16 7h4" /></svg>;
}

function matchesArmorCatalogFilter(item: ItemTemplate, filterId: ArmorCatalogFilterId): boolean {
  if (item.category !== "armor") return false;
  if (filterId === "all") return true;
  const weight = normalizeInventoryItemText(item.weight);
  if (filterId === "light") return weight === "ligera";
  if (filterId === "medium") return weight === "media";
  if (filterId === "heavy") return weight === "pesada";
  return true;
}

function matchesItemCatalogFilter(item: ItemTemplate, filterId: ItemCatalogFilterId): boolean {
  if (item.category === "weapon" || item.category === "armor") return false;
  if (filterId === "all") return true;
  const qualities = parseWeaponQualities(item.qualities).map((entry) => entry.toLowerCase());
  if (filterId === "elixir") return item.catalogGroup === "elixir";
  if (filterId === "minor-artifact") return item.catalogGroup === "minor-artifact";
  if (filterId === "trap") return item.catalogGroup === "trap";
  if (filterId === "equipment") return item.catalogGroup === "equipment";
  if (filterId === "container") return qualities.includes("contenedor");
  if (filterId === "travel") return qualities.includes("viaje");
  if (filterId === "ammunition") return qualities.includes("municion");
  if (filterId === "tool") return item.catalogGroup === "tool" || qualities.includes("herramienta");
  if (filterId === "material") return qualities.includes("material");
  if (filterId === "ritual") return qualities.includes("ritual");
  if (filterId === "valuable") return item.category === "treasure" || qualities.includes("valioso");
  return true;
}

function getAmmoInfoForWeapon(
  weapon: CharacterSheet["inventoryItems"][number],
  inventoryItems: CharacterSheet["inventoryItems"]
): { label: string; quantity: number } | null {
  if (weapon.category !== "weapon") {
    return null;
  }
  const normalizedName = normalizeCapabilityText(weapon.name);
  const qualities = parseWeaponQualities(weapon.qualities).map((entry) => normalizeCapabilityText(entry));
  const matchedAmmoNames =
    normalizedName.includes("ballesta") ? ["Virotes"] :
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

function removeRepeatedWeaponDescription(effectSummary: string, description: string): string {
  const normalizedSummary = effectSummary.trim();
  const normalizedDescription = description.trim();
  if (!normalizedDescription || !normalizedSummary.startsWith(normalizedDescription)) {
    return normalizedSummary;
  }

  return normalizedSummary.slice(normalizedDescription.length).trim();
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

const BOON_CHECK_MODIFIER_DEFINITIONS: Array<{
  id: string;
  names: string[];
  label: string;
  bonus: number;
  maxStacks?: number;
}> = [
  { id: "boon:augur", names: ["Augur"], label: "Augur", bonus: 1, maxStacks: 3 },
  { id: "boon:pulgar-verde", names: ["Pulgar verde", "Sintonia con las plantas", "Sintonia con las plantas"], label: "Sintonia con las plantas", bonus: 1, maxStacks: 3 },
  { id: "boon:forjado-por-el-fuego", names: ["Forjado por el fuego"], label: "Forjado por el fuego", bonus: 1 },
  { id: "boon:imitador", names: ["Imitador"], label: "Imitador", bonus: 1, maxStacks: 3 },
  { id: "boon:manipulador", names: ["Manipulador"], label: "Manipulador", bonus: 1, maxStacks: 3 },
  { id: "boon:nacido-de-las-sombras", names: ["Nacido de las sombras"], label: "Nacido de las sombras", bonus: 1, maxStacks: 3 },
  { id: "boon:correveidile", names: ["Correveidile"], label: "Correveidile", bonus: 1, maxStacks: 3 }
];

function getBoonCheckModifiers(sheet: CharacterSheet): RollModalCheckModifier[] {
  const blessingCounts = new Map<string, number>();
  sheet.bendiciones.forEach((entry) => {
    const normalized = normalizeCapabilityText(entry);
    blessingCounts.set(normalized, (blessingCounts.get(normalized) ?? 0) + 1);
  });

  return BOON_CHECK_MODIFIER_DEFINITIONS.flatMap((definition) => {
    const totalMatches = definition.names.reduce(
      (sum, name) => sum + (blessingCounts.get(normalizeCapabilityText(name)) ?? 0),
      0
    );
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

function getCheckRollModifiers(
  action: CharacterActionDefinition | undefined,
  request: RollRequest | undefined,
  sheet: CharacterSheet
): RollModalCheckModifier[] {
  const hasTargetRoll = Boolean((action && action.rollAttribute) || (request && typeof request.target === "number"));
  if (!hasTargetRoll) {
    return [];
  }

  const modifiers: RollModalCheckModifier[] = [...getBoonCheckModifiers(sheet)];
  if (action) {
    modifiers.push(...getAttackRollModifiers(action, sheet));
  }
  return modifiers;
}

function getPendingAttackTarget(
  request: RollRequest | null,
  selectedAttackModifierIds: string[],
  modifiers: RollModalCheckModifier[]
): number | null {
  if (!request || typeof request.target !== "number") {
    return null;
  }

  const selectedBonus = modifiers
    .filter((modifier) => selectedAttackModifierIds.includes(modifier.id))
    .reduce((sum, modifier) => sum + modifier.bonus, 0);

  return request.target + selectedBonus;
}

function getActionSourceLabel(action: CharacterActionDefinition): string {
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
  return parseWeaponQualities(item.qualities)
    .map((quality) => findWeaponQualityOption(quality)?.label)
    .filter((quality): quality is string => Boolean(quality))
    .filter((quality, index, qualities) => qualities.indexOf(quality) === index);
}

function getCustomWeaponQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  return parseWeaponQualities(item.qualities)
    .filter((quality) => !findWeaponQualityOption(quality));
}

function getKnownArmorQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(ARMOR_QUALITY_OPTIONS.map((entry) => entry.id));
  return parseWeaponQualities(item.qualities)
    .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}

function getCustomArmorQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(ARMOR_QUALITY_OPTIONS.map((entry) => entry.id));
  return parseWeaponQualities(item.qualities)
    .filter((quality) => !knownIds.has(normalizeWeaponQualityKey(quality)));
}

function getArmorDefensePenaltyDetail(item: CharacterSheet["inventoryItems"][number]): string {
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
  } else if (qualityIds.has("media") || armorWeight === "media") {
    basePenalty = -3;
    label = "Media";
  } else if (qualityIds.has("pesada") || armorWeight === "pesada") {
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

function getKnownItemQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(ITEM_QUALITY_OPTIONS.map((entry) => entry.id));
  return parseWeaponQualities(item.qualities)
    .filter((quality) => knownIds.has(normalizeWeaponQualityKey(quality)));
}

function getCustomItemQualities(item: CharacterSheet["inventoryItems"][number]): string[] {
  const knownIds = new Set(ITEM_QUALITY_OPTIONS.map((entry) => entry.id));
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
  onOpenBuilder,
  onUseArtifactAbility,
  backgroundPreferenceScope,
  onOpenCompendiumCapability
}: Props) {
  const { draft, isSavingLocal, setDraft, updateField, save } = useUnifiedCharacterSheet({
    sheet,
    editable,
    onSave
  });
  const isReadOnly = !editable;
  const canEditNotes = editable;
  const canEditInventory = editable;
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>(ITEM_CATALOG[0]?.templateId ?? "");
  const [inventoryCatalogModalTab, setInventoryCatalogModalTab] = useState<InventoryCatalogModalTab | null>(null);
  const [selectedWeaponCatalogFilter, setSelectedWeaponCatalogFilter] = useState<WeaponCatalogFilterId>("all");
  const [weaponCatalogSearch, setWeaponCatalogSearch] = useState("");
  const [selectedArmorCatalogFilter, setSelectedArmorCatalogFilter] = useState<ArmorCatalogFilterId>("all");
  const [armorCatalogSearch, setArmorCatalogSearch] = useState("");
  const [selectedItemCatalogFilter, setSelectedItemCatalogFilter] = useState<ItemCatalogFilterId>("all");
  const [itemCatalogSearch, setItemCatalogSearch] = useState("");
  const [history, setHistory] = useState<Array<{ title: string; detail?: string; rolls: ActionRollResult[] }>>([]);
  const rollDestination: RollDestination = "roll20";
  const [pendingRollConfirmation, setPendingRollConfirmation] = useState<PendingRollConfirmation | null>(null);
  const [showPendingRollBreakdown, setShowPendingRollBreakdown] = useState(false);
  const [actionDetailModal, setActionDetailModal] = useState<ActionDetailModal | null>(null);
  const [selectedPersonalNoteId, setSelectedPersonalNoteId] = useState<string | null>(null);
  const [personalNoteEditor, setPersonalNoteEditor] = useState<{ mode: "create" | "edit"; note: CharacterPersonalNoteEntry } | null>(null);
  const [personalNoteError, setPersonalNoteError] = useState<string | null>(null);
  const [isEditingBackground, setIsEditingBackground] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isExperienceRerollConfirmationOpen, setIsExperienceRerollConfirmationOpen] = useState(false);
  const [artifactUseError, setArtifactUseError] = useState<string | null>(null);
  const pendingArtifactDamageRef = useRef<Set<string>>(new Set());
  const [weaponEditorModal, setWeaponEditorModal] = useState<WeaponEditorModal | null>(null);
  const [armorEditorModal, setArmorEditorModal] = useState<ArmorEditorModal | null>(null);
  const [itemEditorModal, setItemEditorModal] = useState<ItemEditorModal | null>(null);
  const [activeWeaponQualityInfoId, setActiveWeaponQualityInfoId] = useState<string>("");
  const isSheetModalOpen = Boolean(
    inventoryCatalogModalTab
    || pendingRollConfirmation
    || actionDetailModal
    || selectedPersonalNoteId
    || personalNoteEditor
    || isExperienceRerollConfirmationOpen
    || weaponEditorModal
    || armorEditorModal
    || itemEditorModal
  );
  useBodyScrollLock(isSheetModalOpen);

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
  const displayName = normalizedSheet.identidad.nombrePersonaje || title;
  const sheetTabStorageKey = useMemo(
    () => `${SHEET_TAB_STORAGE_PREFIX}${normalizeCapabilityText(displayName || "default").replace(/[^a-z0-9]+/g, "-")}`,
    [displayName]
  );
  const [sheetTabState, setSheetTabState] = useState<SheetTabState>(DEFAULT_SHEET_TAB_STATE);
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileSheetTabId>("attributes");
  const mobileTabsRef = useRef<HTMLElement | null>(null);
  const [hasHydratedSheetTabs, setHasHydratedSheetTabs] = useState(false);
  const activeTab = sheetTabState.activeTab;
  const activeMechanicalTab = sheetTabState.activeMechanicalTab;
  const activeNarrativeTab = sheetTabState.activeNarrativeTab;
  const activeActionTab = sheetTabState.activeActionTab;
  const activeCapabilityTab = sheetTabState.activeCapabilityTab;
  const activeInventoryTab = sheetTabState.activeInventoryTab;
  const setActiveTab = (nextTab: TabId) => setSheetTabState((current) => ({ ...current, activeTab: nextTab }));
  const setActiveMechanicalTab = (nextTab: MechanicalTabId) => setSheetTabState((current) => ({ ...current, activeMechanicalTab: nextTab }));
  const setActiveNarrativeTab = (nextTab: NarrativeTabId) => setSheetTabState((current) => ({ ...current, activeNarrativeTab: nextTab }));
  const setActiveActionTab = (nextTab: ActionTabId) => setSheetTabState((current) => ({ ...current, activeActionTab: nextTab }));
  const setActiveCapabilityTab = (nextTab: CapabilityTabId) => setSheetTabState((current) => ({ ...current, activeCapabilityTab: nextTab }));
  const setActiveInventoryTab = (nextTab: InventoryTabId) => setSheetTabState((current) => ({ ...current, activeInventoryTab: nextTab }));
  const setActiveMobileTab = (nextTab: MobileSheetTabId): void => {
    setMobileActiveTab(nextTab);
    if (nextTab !== "attributes") {
      setActiveTab(nextTab);
      if (MECHANICAL_TAB_IDS.includes(nextTab as MechanicalTabId)) {
        setActiveMechanicalTab(nextTab as MechanicalTabId);
      } else {
        setActiveNarrativeTab(nextTab as NarrativeTabId);
      }
    }
  };
  const handleMobileTabChange = (nextTab: MobileSheetTabId, button: HTMLButtonElement): void => {
    setActiveMobileTab(nextTab);
    mobileTabsRef.current?.scrollIntoView?.({ block: "start" });

    const tabs = mobileTabsRef.current;
    tabs?.scrollTo?.({
      left: Math.max(0, button.offsetLeft - (tabs.clientWidth - button.offsetWidth) / 2),
      behavior: "smooth"
    });
  };
  const personalNotes = useMemo(() => sortCharacterPersonalNotes(normalizedSheet.personalNotes ?? []), [normalizedSheet.personalNotes]);
  const automaticConditions = useMemo(
    () => normalizedSheet.conditions.filter((condition) => ["legacy-corruption", "legacy-dying"].includes(condition.id) && condition.active),
    [normalizedSheet.conditions]
  );
  const additionalConditions = useMemo(
    () => normalizedSheet.conditions.filter((condition) => (
      !["legacy-corruption", "legacy-dying", "condition-dying"].includes(condition.id)
      && !CHARACTER_CONDITION_DEFINITIONS.some((definition) => matchesConditionDefinition(condition, definition))
    )),
    [normalizedSheet.conditions]
  );
  const selectedPersonalNote = useMemo(
    () => personalNotes.find((entry) => entry.id === selectedPersonalNoteId) ?? null,
    [personalNotes, selectedPersonalNoteId]
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
      case "artifacts":
        return visibleActions.filter((action) => action.sourceType === "artifact");
      case "other":
        return visibleActions.filter((action) => isOtherAction(action));
      case "free":
        return visibleActions.filter((action) => action.cost === "free" && !isOtherAction(action));
      case "reactions":
        return visibleActions.filter((action) => action.cost === "reaction" && !isOtherAction(action));
      case "special":
        return [];
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
  const specialActionEntries = useMemo(() => {
    const order = new Map(SPECIAL_ACTION_RULE_NAMES.map((name, index) => [normalizeCapabilityText(name), index]));
    return ALL_ENTRIES
      .filter((entry) => entry.tipo === "regla" && order.has(normalizeCapabilityText(entry.nombre)))
      .sort((a, b) =>
        (order.get(normalizeCapabilityText(a.nombre)) ?? 999) - (order.get(normalizeCapabilityText(b.nombre)) ?? 999)
      );
  }, []);
  const pendingAttackModifiers = useMemo(
    () => (
      pendingRollConfirmation
        ? getCheckRollModifiers(pendingRollConfirmation.action, pendingRollConfirmation.request, normalizedSheet)
        : []
    ),
    [pendingRollConfirmation, normalizedSheet]
  );
  const experience = useMemo(() => getCharacterExperienceSummary(normalizedSheet), [normalizedSheet]);
  const displayedSpentExperience = Math.max(normalizedSheet.progreso.experienciaGastada, experience.computedSpent);
  const activeArmor = useMemo(
    () => {
      const equippedArmorId = normalizedSheet.equipmentSlots.armor;
      if (equippedArmorId) {
        return normalizedSheet.inventoryItems.find((item) => item.id === equippedArmorId && item.category === "armor" && item.quantity > 0) ?? null;
      }
      return normalizedSheet.inventoryItems.find((item) => item.category === "armor" && item.equipped && item.quantity > 0) ?? null;
    },
    [normalizedSheet.equipmentSlots.armor, normalizedSheet.inventoryItems]
  );
  const moneyCounters = useMemo(() => parseMoneyCounters(normalizedSheet.recursos.dinero), [normalizedSheet.recursos.dinero]);
  const inventorySections = useMemo(
    () => ({
      weapons: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "weapon" && !item.managedArtifactId),
      armors: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => item.category === "armor" && !item.managedArtifactId),
      artifacts: normalizedSheet.inventoryItems.map((item, index) => ({ item, index })).filter(({ item }) => Boolean(item.managedArtifactId)),
      items: normalizedSheet.inventoryItems
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.category !== "weapon" && item.category !== "armor" && !item.managedArtifactId)
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
      ? modalCatalogItems.filter((item) => {
          if (!matchesWeaponCatalogFilter(item, selectedWeaponCatalogFilter)) return false;
          const search = normalizeInventoryItemText(weaponCatalogSearch);
          return !search || normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description}`).includes(search);
        })
      : inventoryCatalogModalTab === "armors"
        ? modalCatalogItems.filter((item) => {
            if (!matchesArmorCatalogFilter(item, selectedArmorCatalogFilter)) return false;
            const search = normalizeInventoryItemText(armorCatalogSearch);
            return !search || normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description}`).includes(search);
          })
        : inventoryCatalogModalTab === "items"
          ? modalCatalogItems.filter((item) => {
              if (!matchesItemCatalogFilter(item, selectedItemCatalogFilter)) return false;
              const searchTokens = normalizeInventoryItemText(itemCatalogSearch).split(/\s+/).filter(Boolean);
              const searchableText = normalizeInventoryItemText(`${item.name} ${item.qualities} ${item.description} ${item.value}`);
              return searchTokens.every((token) => searchableText.includes(token));
            })
        : modalCatalogItems,
    [inventoryCatalogModalTab, modalCatalogItems, selectedWeaponCatalogFilter, selectedArmorCatalogFilter, selectedItemCatalogFilter, weaponCatalogSearch, armorCatalogSearch, itemCatalogSearch]
  );

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
        const persistedTabs = JSON.parse(rawTabs) as PersistedSheetTabs;
        const persistedActiveTab = persistedTabs.activeTab && TAB_IDS.includes(persistedTabs.activeTab)
          ? persistedTabs.activeTab
          : DEFAULT_SHEET_TAB_STATE.activeTab;
        nextState = {
          activeTab: persistedActiveTab,
          activeMechanicalTab: persistedTabs.activeMechanicalTab && MECHANICAL_TAB_IDS.includes(persistedTabs.activeMechanicalTab)
            ? persistedTabs.activeMechanicalTab
            : MECHANICAL_TAB_IDS.includes(persistedActiveTab as MechanicalTabId)
              ? persistedActiveTab as MechanicalTabId
              : DEFAULT_SHEET_TAB_STATE.activeMechanicalTab,
          activeNarrativeTab: persistedTabs.activeNarrativeTab && NARRATIVE_TAB_IDS.includes(persistedTabs.activeNarrativeTab)
            ? persistedTabs.activeNarrativeTab
            : NARRATIVE_TAB_IDS.includes(persistedActiveTab as NarrativeTabId)
              ? persistedActiveTab as NarrativeTabId
              : DEFAULT_SHEET_TAB_STATE.activeNarrativeTab,
          activeActionTab: persistedTabs.activeActionTab && ACTION_TAB_IDS.includes(persistedTabs.activeActionTab) ? persistedTabs.activeActionTab : DEFAULT_SHEET_TAB_STATE.activeActionTab,
          activeCapabilityTab: persistedTabs.activeCapabilityTab && CAPABILITY_TAB_IDS.includes(persistedTabs.activeCapabilityTab) ? persistedTabs.activeCapabilityTab : DEFAULT_SHEET_TAB_STATE.activeCapabilityTab,
          activeInventoryTab: persistedTabs.activeInventoryTab && INVENTORY_TAB_IDS.includes(persistedTabs.activeInventoryTab) ? persistedTabs.activeInventoryTab : DEFAULT_SHEET_TAB_STATE.activeInventoryTab
        };
      }
    } catch {
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
    const persistedTabs: PersistedSheetTabs = {
      activeTab,
      activeMechanicalTab,
      activeNarrativeTab,
      activeActionTab,
      activeCapabilityTab,
      activeInventoryTab
    };
    window.localStorage.setItem(sheetTabStorageKey, JSON.stringify(persistedTabs));
  }, [activeActionTab, activeCapabilityTab, activeInventoryTab, activeMechanicalTab, activeNarrativeTab, activeTab, hasHydratedSheetTabs, sheetTabStorageKey]);

  function pushHistory(titleText: string, rolls: ActionRollResult[], detail?: string): void {
    setHistory((current) => [{ title: titleText, detail, rolls }, ...current].slice(0, 12));
  }

  function openActionDetail(action: CharacterActionDefinition): void {
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
      removeInventoryIndex: canEditInventory && !item.managedArtifactId ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined
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
      removeInventoryIndex: canEditInventory && !item.managedArtifactId ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
      editInventoryIndex: canEditInventory && item.isCustom ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
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

  function openInventoryArmorDetail(item: CharacterSheet["inventoryItems"][number]): void {
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
      removeInventoryIndex: canEditInventory && !item.managedArtifactId ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
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

  function openManagedInventoryItemDetail(item: CharacterSheet["inventoryItems"][number]): void {
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
      removeInventoryIndex: canEditInventory && !item.managedArtifactId ? normalizedSheet.inventoryItems.findIndex((entry) => entry.id === item.id) : undefined,
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

  function openSimpleCompendiumDetail(
    tipo: "bendicion" | "carga",
    categoryLabel: string,
    entryName: string
  ): void {
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
      .filter((url): url is string => Boolean(url))
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

  function openRuleCompendiumDetail(entry: typeof ALL_ENTRIES[number]): void {
    const summaryLink = getCompendiumSummaryLink(entry);
    const references = [
      getCompendiumSourcePdfUrl(entry.fuente, entry.pagina, entry.nombre),
      summaryLink?.url
    ]
      .filter((url): url is string => Boolean(url))
      .map((url) => ({
        url,
        label: url === summaryLink?.url ? `${summaryLink.documentLabel} - ${summaryLink.sectionLabel}` : `${entry.fuente}${entry.pagina ? ` p. ${entry.pagina}` : ""}`
      }));

    setActionDetailModal({
      title: entry.nombre,
      sourceLabel: `Accion especial · ${entry.fuente}${entry.pagina ? ` p. ${entry.pagina}` : ""}`,
      detail: entry.detalle,
      references
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

  function buildPendingConfirmationRequest(pending: PendingRollConfirmation): RollRequest | null {
    const selectedDefenseAction = pending.selectedDefenseAlternativeId
      ? defenseAlternativeActions.find((action) => action.id === pending.selectedDefenseAlternativeId)
      : null;

    if (selectedDefenseAction) {
      return buildRollRequest(
        normalizedSheet,
        displayName,
        selectedDefenseAction.id,
        "attack",
        rollDestination
      );
    }

    if (pending.request) {
      return { ...pending.request };
    }

    if (pending.action && pending.phase) {
      return buildRollRequest(
        normalizedSheet,
        displayName,
        pending.action.id,
        pending.phase,
        rollDestination,
        "",
        pending.selectedDamageModifierIds
      );
    }

    return null;
  }

  function runAction(action: CharacterActionDefinition, phase: CharacterActionPhase, damageVariantId?: string): void {
      if (rollDestination !== "umbra") {
      queueRoll20Request(action, phase, `${action.label} - ${phase === "damage" ? "Daño" : "Tirada"}`);
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

  async function activateArtifactAction(action: CharacterActionDefinition, phase?: CharacterActionPhase): Promise<boolean> {
    if (action.sourceType !== "artifact" || !action.artifactAbilityId || !onUseArtifactAbility) return true;
    if (phase === "damage" && pendingArtifactDamageRef.current.has(action.artifactAbilityId)) {
      pendingArtifactDamageRef.current.delete(action.artifactAbilityId);
      return true;
    }
    const item = normalizedSheet.inventoryItems.find((entry) => entry.id === action.id.split(":").slice(1, -1).join(":"))
      ?? normalizedSheet.inventoryItems.find((entry) => entry.grantedActions.some((candidate) => candidate.artifactAbilityId === action.artifactAbilityId));
    if (!item?.managedArtifactId) return true;
    try {
      setArtifactUseError(null);
      await onUseArtifactAbility(item.managedArtifactId, action.artifactAbilityId);
      if (phase === "attack" && action.damageFormula) {
        pendingArtifactDamageRef.current.add(action.artifactAbilityId);
      }
      return true;
    } catch (error) {
      setArtifactUseError(error instanceof Error ? error.message : "No se pudo activar el artefacto");
      return false;
    }
  }

  async function runAttackAction(action: CharacterActionDefinition): Promise<void> {
    if (rollDestination !== "umbra") {
      queueRoll20Request(action, "attack", `${action.label} · Tirada`);
      return;
    }
    if (!(await activateArtifactAction(action, "attack"))) return;

    const result = executeCharacterAction(normalizedSheet, action.id, "attack");
    pushHistory(result.action.label, result.rolls, result.action.effectSummary);
  }

  async function runDamageAction(action: CharacterActionDefinition): Promise<void> {
    if (rollDestination !== "umbra") {
      queueRoll20Request(action, "damage", `${action.label} · Daño`);
      return;
    }
    if (!(await activateArtifactAction(action, "damage"))) return;

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
        if (pendingRollConfirmation.action && pendingRollConfirmation.phase
          && !(await activateArtifactAction(pendingRollConfirmation.action, pendingRollConfirmation.phase))) {
          return;
        }
        const request = buildPendingConfirmationRequest(pendingRollConfirmation);
        if (!request) {
          throw new Error("No se pudo preparar la tirada");
        }
        if (typeof request.target === "number") {
          const selectedAttackModifiers = getCheckRollModifiers(
            pendingRollConfirmation.action,
            request,
            normalizedSheet
          )
            .filter((modifier) => pendingRollConfirmation.selectedAttackModifierIds.includes(modifier.id));
          const totalAttackBonus = selectedAttackModifiers.reduce((sum, modifier) => sum + modifier.bonus, 0);
          if (totalAttackBonus !== 0) {
            request.target += totalAttackBonus;
            const modifierNote = `Modificadores de tirada: ${selectedAttackModifiers.map((modifier) => modifier.label).join(", ")}`;
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

  function buildPersonalNoteDraft(entry?: CharacterPersonalNoteEntry): CharacterPersonalNoteEntry {
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

  function replacePersonalNotes(nextEntries: CharacterPersonalNoteEntry[]): void {
    setDraft({
      ...draft,
      personalNotes: sortCharacterPersonalNotes(nextEntries)
    });
  }

  function savePersonalNote(): void {
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

  function deletePersonalNote(noteId: string): void {
    replacePersonalNotes(personalNotes.filter((entry) => entry.id !== noteId));
    if (selectedPersonalNoteId === noteId) {
      setSelectedPersonalNoteId(null);
    }
    setPersonalNoteEditor(null);
    setPersonalNoteError(null);
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

  function addCustomArmor(): void {
    setArmorEditorModal({
      mode: "create",
      item: createCustomInventoryItem("armor")
    });
    setActiveInventoryTab("armors");
  }

  function addCustomItemModal(): void {
    setItemEditorModal({
      mode: "create",
      item: createCustomInventoryItem()
    });
    setActiveInventoryTab("items");
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

  function updateArmorEditorItem(field: keyof CharacterSheet["inventoryItems"][number], value: string | number | boolean | undefined): void {
    setArmorEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
  }

  function toggleArmorEditorQuality(qualityLabel: string): void {
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

  function updateArmorEditorCustomQualities(rawValue: string): void {
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

  function saveArmorEditorModal(): void {
    if (!armorEditorModal) return;
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

  function updateItemEditorItem(field: keyof CharacterSheet["inventoryItems"][number], value: string | number | boolean | undefined): void {
    setItemEditorModal((current) => current ? { ...current, item: { ...current.item, [field]: value } } : current);
  }

  function toggleItemEditorQuality(qualityLabel: string): void {
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

  function updateItemEditorCustomQualities(rawValue: string): void {
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

  function saveItemEditorModal(): void {
    if (!itemEditorModal) return;
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
    setWeaponCatalogSearch("");
    setSelectedArmorCatalogFilter("all");
    setArmorCatalogSearch("");
    setSelectedItemCatalogFilter("all");
    setItemCatalogSearch("");
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

  function setEquippedArmor(index: number): void {
    const armor = draft.inventoryItems[index];
    if (!armor || armor.category !== "armor") return;
    const nextArmorId = draft.equipmentSlots.armor === armor.id ? "" : armor.id;
    setDraft({
      ...draft,
      equipmentSlots: {
        ...draft.equipmentSlots,
        armor: nextArmorId
      }
    });
  }

  function toggleFavoriteAction(actionId: string): void {
    if (!editable) {
      return;
    }
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
    const isInventoryCombatItem = item.category === "weapon" || item.category === "armor";
    const isManagedInventoryItem = !isInventoryCombatItem;
    const ammoInfo = item.category === "weapon" ? getAmmoInfoForWeapon(item, normalizedSheet.inventoryItems) : null;
    const isEquippedArmor = item.category === "armor" && normalizedSheet.equipmentSlots.armor === item.id;

    return (
        <article
          key={item.id}
          className={`campaign-structured-card${appCardCategoryClass(item.category)}${(isInventoryCombatItem || isManagedInventoryItem) ? " is-clickable-card" : ""}`}
        onClick={item.category === "weapon" ? () => openInventoryWeaponDetail(item) : item.category === "armor" ? () => openInventoryArmorDetail(item) : () => openManagedInventoryItemDetail(item)}
        onKeyDown={(isInventoryCombatItem || isManagedInventoryItem) ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (item.category === "weapon") {
              openInventoryWeaponDetail(item);
            } else if (item.category === "armor") {
              openInventoryArmorDetail(item);
            } else {
              openManagedInventoryItemDetail(item);
            }
          }
        } : undefined}
        role={(isInventoryCombatItem || isManagedInventoryItem) ? "button" : undefined}
        tabIndex={(isInventoryCombatItem || isManagedInventoryItem) ? 0 : undefined}
        >
          <div className="row-actions">
            <div>
              <h3>{item.name || "Objeto sin nombre"}</h3>
              {(isInventoryCombatItem || item.qualities) ? (
                <div className="unified-sheet-weapon-list-summary">
                  <p className="meta-text">{item.qualities || (item.category === "artifact" ? "Mistico" : item.category === "consumable" ? "Consumible" : item.category === "treasure" ? "Valioso" : "Equipo")}</p>
                  {ammoInfo ? <p className="meta-text">{ammoInfo.label}: {ammoInfo.quantity}</p> : null}
                  {isEquippedArmor ? <p className="meta-text">Equipada</p> : null}
                </div>
              ) : (
                <p className="meta-text">
                  {item.category === "armor" ? "Armadura" : "Objeto"}
                  {item.equipped ? " · equipado" : ""}
                  {item.slot !== "none" ? ` · ${slotLabel(item.slot)}` : ""}
                </p>
              )}
            </div>
          <div className={`unified-sheet-quantity-controls${(isInventoryCombatItem || isManagedInventoryItem) ? " is-weapon-summary" : ""}`}>
            {item.category === "weapon" && item.damageFormula ? <span className="unified-sheet-weapon-list-damage">{item.damageFormula}</span> : null}
            {item.category === "armor" && item.protectionFormula ? <span className="unified-sheet-weapon-list-damage">{item.protectionFormula}</span> : null}
            {isManagedInventoryItem && !stackable && item.value ? <span className="unified-sheet-weapon-list-damage">{item.value}</span> : null}
            {stackable ? <span className="info-chip">x{item.quantity}</span> : null}
            {canEditInventory && item.category === "armor" ? (
              <button
                type="button"
                className={`subtle-button${isEquippedArmor ? " is-active" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setEquippedArmor(index);
                }}
              >
                {isEquippedArmor ? "Equipada" : "Equipar"}
              </button>
            ) : null}
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
          </div>
        </div>
        <div className="unified-sheet-item-readonly-grid">
          {(item.attackAttribute || item.damageFormula || item.protectionFormula) && !isInventoryCombatItem && !isManagedInventoryItem ? (
            <div className="info-box">
              {item.attackAttribute ? <span>Ataque: {ATTRIBUTE_LABELS[item.attackAttribute]}</span> : null}
              {item.damageFormula ? <span>Daño: {item.damageFormula}</span> : null}
              {item.protectionFormula ? <span>Proteccion: {item.protectionFormula}</span> : null}
            </div>
          ) : null}
          {(item.weight || item.value) && !isInventoryCombatItem && !isManagedInventoryItem ? (
            <div className="info-box">
              {item.weight ? <span>Peso: {item.weight}</span> : null}
              {item.value ? <span>Valor: {item.value}</span> : null}
            </div>
          ) : null}
          {item.qualities && !isInventoryCombatItem && !isManagedInventoryItem ? <div className="info-box"><span>Cualidades: {item.qualities}</span></div> : null}
          {item.modifiers.length > 0 ? (
            <div className="info-box">
              <span>Modificadores: {item.modifiers.map((modifier) => modifier.label || `${modifier.modifierType} ${modifier.value}`.trim()).join(" · ")}</span>
            </div>
          ) : null}
          {item.managedArtifactId ? (
            <div className="info-box">
              <span>{item.artifactBound ? "Vinculado" : `Sin vincular${item.artifactBindingCostLabel ? ` · ${item.artifactBindingCostLabel}` : ""}`}</span>
              {(item.artifactResources ?? []).map((resource) => <span key={resource.id}>{resource.name}: {resource.current}/{resource.maximum}</span>)}
            </div>
          ) : null}
        </div>
        {item.description && !isInventoryCombatItem && !isManagedInventoryItem ? <p className="unified-sheet-rich-text">{item.description}</p> : null}
        {item.notes && !isInventoryCombatItem && !isManagedInventoryItem ? <p className="unified-sheet-capability-notes">{item.notes}</p> : null}
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

  function toggleDefinedCondition(definition: CharacterConditionDefinition): void {
    if (!editable || busy || isSavingLocal) {
      return;
    }

    const conditionIndex = draft.conditions.findIndex((condition) => matchesConditionDefinition(condition, definition));
    if (conditionIndex >= 0) {
      setDraft({
        ...draft,
        conditions: draft.conditions.map((condition, index) => (
          index === conditionIndex ? { ...condition, active: !condition.active } : condition
        ))
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

  function toggleStoredCondition(conditionId: string): void {
    if (!editable || busy || isSavingLocal) {
      return;
    }
    setDraft({
      ...draft,
      conditions: draft.conditions.map((condition) => (
        condition.id === conditionId ? { ...condition, active: !condition.active } : condition
      ))
    });
  }

  function adjustNumber(path: string, delta: number, min = 0): void {
    if (!editable) {
      return;
    }
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

  function spendExperienceForReroll(): void {
    if (!editable || experience.effectiveAvailable < 1) {
      setIsExperienceRerollConfirmationOpen(false);
      return;
    }
    updateField("progreso.experienciaGastada", displayedSpentExperience + 1);
    setIsExperienceRerollConfirmationOpen(false);
  }

  function renderActionRollControls(action: CharacterActionDefinition, allowRoll = true): ReactNode {
    const presentation = getCharacterActionRollPresentation(action, normalizedSheet);
    const hasOptionalModifiers = presentation.hasDamageModifiers
      || getCheckRollModifiers(action, undefined, normalizedSheet).length > 0;

    return (
      <div className="campaign-action-rolls">
        {presentation.attackFormula ? (
          allowRoll ? (
            <button type="button" className="campaign-action-roll-button" onClick={() => runAttackAction(action)}>
              <span>{getActionRollLabel(action)}</span>
              <strong>{presentation.attackFormula}</strong>
            </button>
          ) : (
            <span className="campaign-action-roll-readonly">
              <span>{getActionRollLabel(action)}</span>
              <strong>{presentation.attackFormula}</strong>
            </span>
          )
        ) : null}
        {presentation.damageFormula ? (
          allowRoll ? (
            <button type="button" className="campaign-action-roll-button is-damage" onClick={() => runDamageAction(action)}>
              <span>Daño</span>
              <strong>{presentation.damageFormula}</strong>
            </button>
          ) : (
            <span className="campaign-action-roll-readonly is-damage">
              <span>Daño</span>
              <strong>{presentation.damageFormula}</strong>
            </span>
          )
        ) : null}
        {!presentation.hasRoll ? (
          allowRoll && action.sourceType === "artifact" ? (
            <button type="button" className="campaign-action-roll-button" onClick={() => void activateArtifactAction(action)}>
              <span>Activar</span>
              <strong>Sin tirada</strong>
            </button>
          ) : <span className="campaign-action-no-roll">Sin tirada</span>
        ) : null}
        {hasOptionalModifiers ? <span className="campaign-action-modifier-notice">Modificadores disponibles</span> : null}
      </div>
    );
  }

  function renderTabStage(
    tabs: Array<[TabId, string]>,
    stageActiveTab: TabId,
    onTabChange: (tab: TabId) => void,
    navigationLabel: string,
    className = "unified-sheet-stage campaign-sheet-card"
  ): ReactNode {
    const hasStageSubtabs = stageActiveTab === "actions" || stageActiveTab === "inventory" || stageActiveTab === "abilities";

    return (
      <section className={`${className}${hasStageSubtabs ? " has-stage-subtabs" : ""}`}>
        <nav className="unified-sheet-tabs" aria-label={navigationLabel}>
          {tabs.map(([tab, label]) => (
            <button key={tab} type="button" className={stageActiveTab === tab ? "is-active" : ""} onClick={() => onTabChange(tab)}>{label}</button>
          ))}
        </nav>

        {stageActiveTab === "actions" ? (
          <nav className="unified-sheet-subtabs unified-sheet-action-subtabs unified-sheet-stage-subtabs is-actions" aria-label="Filtros de acciones">
            {([
              ["all", "Todas"],
              ["favorites", "Favoritas"],
              ["attacks", "Ataques"],
              ["powers", "Poderes y rituales"],
              ["artifacts", "Artefactos"],
              ["special", "Acciones especiales"],
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
        ) : null}

        {stageActiveTab === "inventory" ? (
          <nav className="unified-sheet-subtabs unified-sheet-stage-subtabs is-inventory" aria-label="Secciones del inventario">
            {([
              ["money", "Dinero"],
              ["weapons", "Armas"],
              ["armors", "Armaduras"],
              ["artifacts", "Artefactos"],
              ["items", "Objetos"]
            ] as Array<[InventoryTabId, string]>).map(([tab, label]) => (
              <button key={tab} type="button" className={activeInventoryTab === tab ? "is-active" : ""} onClick={() => setActiveInventoryTab(tab)}>
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        {stageActiveTab === "abilities" ? (
          <nav className="unified-sheet-subtabs unified-sheet-stage-subtabs is-abilities" aria-label="Tipos de capacidades">
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
        ) : null}

        <div className="unified-sheet-tab-content">
          {stageActiveTab === "actions" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Acciones disponibles</h3>
                </div>
                {artifactUseError ? <p className="error-text">{artifactUseError}</p> : null}
                <div className="campaign-sheet-actions">
                  {activeActionTab === "special" ? (
                    <>
                      {specialActionEntries.map((entry) => (
                        <div key={entry.id} className="campaign-action-button campaign-action-button--row">
                          <div className="campaign-action-main">
                            <div className="campaign-action-title-row">
                              <button type="button" className="campaign-action-name-button" onClick={() => openRuleCompendiumDetail(entry)}>
                                {entry.nombre}
                              </button>
                            </div>
                            <span className="campaign-action-source-note">{entry.fuente}{entry.pagina ? ` p. ${entry.pagina}` : ""}</span>
                          </div>
                          <div className="campaign-action-slot">
                            <span className="compendium-chip">Regla</span>
                          </div>
                          <div className="campaign-action-slot is-damage">
                            <span aria-hidden="true" className="campaign-action-slot-placeholder" />
                          </div>
                        </div>
                      ))}
                      {specialActionEntries.length === 0 ? <p className="section-help">Sin acciones especiales registradas.</p> : null}
                    </>
                  ) : null}
                  {activeActionTab !== "special" ? (
                    <>
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
                      {renderActionRollControls(action)}
                    </div>
                  ))}
                  {filteredActions.length === 0 ? <p className="section-help">Sin acciones registradas en esta categoria.</p> : null}
                    </>
                  ) : null}
                </div>
              </article>
            </section>
          ) : null}

          {stageActiveTab === "inventory" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <h3>Inventario y equipo</h3>
                </div>
                {activeInventoryTab === "money" ? (
                  <div className="unified-sheet-money-grid">
                    {([
                      ["taleros", "Taleros"],
                      ["chelines", "Chelines"],
                      ["ortegs", "Ortegs"]
                    ] as Array<[keyof MoneyCounters, string]>).map(([key, label]) => (
                      <article key={key} className="campaign-structured-card unified-sheet-money-card">
                        <strong>{label}</strong>
                        <div className="unified-sheet-money-control-row">
                          {canEditInventory ? (
                            <button type="button" className="subtle-button unified-sheet-money-button" aria-label={`Restar ${label}`} onClick={() => changeMoneyCounter(key, -1)}>−</button>
                          ) : null}
                          <div className={`unified-sheet-money-coin is-${key}`} aria-hidden="true">
                            <span>{key === "taleros" ? "T" : key === "chelines" ? "C" : "O"}</span>
                          </div>
                          {canEditInventory ? (
                            <button type="button" className="subtle-button unified-sheet-money-button" aria-label={`Sumar ${label}`} onClick={() => changeMoneyCounter(key, 1)}>+</button>
                          ) : null}
                        </div>
                        <span className="unified-sheet-money-amount">x{moneyCounters[key]}</span>
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
                      {canEditInventory ? (
                        <div className="toolbar">
                          <button type="button" className="subtle-button" onClick={addCustomArmor}>Armadura personalizada</button>
                          <button type="button" onClick={() => openInventoryCatalogModal("armors")}>Agregar armadura</button>
                        </div>
                      ) : null}
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
                      {canEditInventory ? (
                        <div className="toolbar">
                          <button type="button" className="subtle-button" onClick={addCustomItemModal}>Objeto personalizado</button>
                          <button type="button" onClick={() => openInventoryCatalogModal("items")}>Agregar objeto</button>
                        </div>
                      ) : null}
                    </div>
                    <div className="unified-sheet-list">
                      {inventorySections.items.length > 0
                        ? inventorySections.items.map(({ item, index }) => renderInventoryItemEditor(item, index))
                        : <p className="section-help">Sin otros objetos registrados.</p>}
                    </div>
                  </>
                ) : null}

                {activeInventoryTab === "artifacts" ? (
                  <>
                    <div className="row-actions"><h3>Artefactos misticos</h3></div>
                    <div className="unified-sheet-list">
                      {inventorySections.artifacts.length > 0
                        ? inventorySections.artifacts.map(({ item, index }) => renderInventoryItemEditor(item, index))
                        : <p className="section-help">El DJ todavia no ha entregado artefactos a este personaje.</p>}
                    </div>
                  </>
                ) : null}

              </article>
            </section>
          ) : null}

          {stageActiveTab === "abilities" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                {activeCapabilityTab === "traits" ? (
                  <SimpleStringList title="Rasgos" entries={normalizedSheet.rasgos} emptyText="Sin rasgos registrados." categoryKey="rasgo" />
                ) : null}

                {activeCapabilityTab === "blessings" ? (
                  <SimpleStringList
                    title="Bendiciones"
                    entries={normalizedSheet.bendiciones}
                    emptyText="Sin bendiciones registradas."
                    categoryKey="bendicion"
                    onOpenDetail={(entry) => openSimpleCompendiumDetail("bendicion", "Bendicion", entry)}
                  />
                ) : null}

                {activeCapabilityTab === "burdens" ? (
                  <SimpleStringList
                    title="Cargas"
                    entries={normalizedSheet.cargas}
                    emptyText="Sin cargas registradas."
                    categoryKey="carga"
                    onOpenDetail={(entry) => openSimpleCompendiumDetail("carga", "Carga", entry)}
                  />
                ) : null}

                {activeCapabilityTab === "abilities" ? (
                  <CapabilityTextList
                    title="Habilidades"
                    entries={normalizedSheet.habilidades}
                    categoryKey="habilidad"
                    onOpenDetail={(entry) => openCapabilityDetail("habilidad", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("habilidad", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "powers" ? (
                  <CapabilityTextList
                    title="Poderes misticos"
                    entries={normalizedSheet.poderesMisticos}
                    categoryKey="poder_mistico"
                    onOpenDetail={(entry) => openCapabilityDetail("poder_mistico", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("poder_mistico", name) : undefined}
                  />
                ) : null}

                {activeCapabilityTab === "rituals" ? (
                  <CapabilityTextList
                    title="Rituales"
                    entries={normalizedSheet.rituales}
                    categoryKey="ritual"
                    onOpenDetail={(entry) => openCapabilityDetail("ritual", entry)}
                    onOpenCompendium={onOpenCompendiumCapability ? (name) => onOpenCompendiumCapability("ritual", name) : undefined}
                  />
                ) : null}
              </article>
            </section>
          ) : null}

          {stageActiveTab === "background" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions unified-sheet-section-heading">
                  <h3>Trasfondo</h3>
                  {editable ? (
                    isEditingBackground ? (
                      <button type="button" disabled={isSavingLocal} onClick={() => void save().finally(() => setIsEditingBackground(false))}>
                        {isSavingLocal ? "Guardando..." : "Guardar"}
                      </button>
                    ) : <button type="button" aria-label="Editar trasfondo" onClick={() => setIsEditingBackground(true)}>Editar</button>
                  ) : null}
                </div>
                {isEditingBackground ? (
                  <div className="unified-sheet-section-editor">
                    <div className="form-grid unified-sheet-background-meta-grid">
                      <Field label="Sombra"><input value={normalizedSheet.identidad.sombra} onChange={(event) => updateField("identidad.sombra", event.target.value)} /></Field>
                      <Field label="Cita"><input value={normalizedSheet.identidad.cita} onChange={(event) => updateField("identidad.cita", event.target.value)} /></Field>
                      <Field label="Edad"><input value={normalizedSheet.identidad.edad} onChange={(event) => updateField("identidad.edad", event.target.value)} /></Field>
                      <Field label="Altura"><input value={normalizedSheet.identidad.altura} onChange={(event) => updateField("identidad.altura", event.target.value)} /></Field>
                      <Field label="Peso"><input value={normalizedSheet.identidad.peso} onChange={(event) => updateField("identidad.peso", event.target.value)} /></Field>
                    </div>
                    <Field label="Apariencia"><textarea rows={2} value={normalizedSheet.identidad.apariencia} onChange={(event) => updateField("identidad.apariencia", event.target.value)} /></Field>
                    <Field label="Objetivo personal"><textarea rows={2} value={normalizedSheet.identidad.objetivoPersonal} onChange={(event) => updateField("identidad.objetivoPersonal", event.target.value)} /></Field>
                    <Field label="Historia (Markdown)"><textarea rows={12} value={normalizedSheet.noteSections.background} onChange={(event) => updateField("noteSections.background", event.target.value)} /></Field>
                  </div>
                ) : (
                  <div className="unified-sheet-read-view">
                    <dl className="unified-sheet-read-meta unified-sheet-background-meta-grid">
                      {([["Sombra", normalizedSheet.identidad.sombra], ["Cita", normalizedSheet.identidad.cita], ["Edad", normalizedSheet.identidad.edad], ["Altura", normalizedSheet.identidad.altura], ["Peso", normalizedSheet.identidad.peso]] as Array<[string, string]>).map(([label, value]) => (
                        <div key={label}><dt>{label}</dt><dd>{value || "Sin especificar"}</dd></div>
                      ))}
                    </dl>
                    <section className="unified-sheet-read-section"><h4>Apariencia</h4><p>{normalizedSheet.identidad.apariencia || "Sin apariencia registrada."}</p></section>
                    <section className="unified-sheet-read-section"><h4>Objetivo personal</h4><p>{normalizedSheet.identidad.objetivoPersonal || "Sin objetivo personal registrado."}</p></section>
                    <section className="unified-sheet-read-section">
                      <h4>Historia</h4>
                      <div className="campaign-markdown unified-sheet-history-markdown">{renderSimpleMarkdownBlocks(normalizedSheet.noteSections.background || "Sin historia registrada.")}</div>
                    </section>
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {stageActiveTab === "notes" ? (
            <section className="unified-sheet-panel">
              <article className="campaign-sheet-card">
                <div className="row-actions">
                  <div>
                    <h3>Notas personales</h3>
                    <p className="section-help">Entradas ordenadas en Markdown para diario, pistas, recuerdos y apuntes de campaña del personaje.</p>
                  </div>
                  {editable ? (
                    <div className="toolbar">
                      {isEditingNotes ? (
                        <>
                          <button type="button" className="subtle-button" onClick={() => {
                            setPersonalNoteError(null);
                            setPersonalNoteEditor({ mode: "create", note: buildPersonalNoteDraft() });
                          }}>Nueva nota</button>
                          <button type="button" disabled={isSavingLocal} onClick={() => void save().finally(() => setIsEditingNotes(false))}>
                            {isSavingLocal ? "Guardando..." : "Guardar"}
                          </button>
                        </>
                      ) : <button type="button" aria-label="Editar notas del personaje" onClick={() => setIsEditingNotes(true)}>Editar</button>}
                    </div>
                  ) : null}
                </div>
                <div className="unified-sheet-list">
                  {personalNotes.map((entry) => (
                    <article key={entry.id} className="campaign-structured-card">
                      <div className="row-actions">
                        <div>
                          <strong>{entry.title}</strong>
                          <p className="section-help">{summarizeCharacterNote(entry.content)}</p>
                        </div>
                        <button type="button" className="subtle-button" onClick={() => {
                          setPersonalNoteError(null);
                          setSelectedPersonalNoteId(entry.id);
                        }}>
                          Ver nota
                        </button>
                      </div>
                    </article>
                  ))}
                  {personalNotes.length === 0 ? <p className="section-help">Sin notas personales registradas.</p> : null}
                </div>
              </article>

              <article className="campaign-sheet-card">
                <h3>Contexto</h3>
                {isEditingNotes ? (
                  <div className="form-grid">
                    <Field label="Grupo"><input value={normalizedSheet.grupo.nombre} onChange={(event) => updateField("grupo.nombre", event.target.value)} /></Field>
                    <Field label="Objetivo del grupo"><textarea rows={2} value={normalizedSheet.grupo.objetivo} onChange={(event) => updateField("grupo.objetivo", event.target.value)} /></Field>
                  </div>
                ) : (
                  <dl className="unified-sheet-read-meta is-two-columns">
                    <div><dt>Grupo</dt><dd>{normalizedSheet.grupo.nombre || "Sin grupo registrado."}</dd></div>
                    <div><dt>Objetivo del grupo</dt><dd>{normalizedSheet.grupo.objetivo || "Sin objetivo de grupo registrado."}</dd></div>
                  </dl>
                )}
              </article>

              <article className="campaign-sheet-card">
                <h3>Contactos</h3>
                {isEditingNotes ? (
                  <div className="unified-sheet-list">
                    {normalizedSheet.contactosHoja.map((contacto, index) => (
                      <article key={`contacto-${index}`} className="campaign-structured-card">
                        <div className="form-grid">
                          <Field label="Nombre"><input value={contacto.nombre} onChange={(event) => updateField(`contactosHoja.${index}.nombre`, event.target.value)} /></Field>
                          <Field label="Raza"><input value={contacto.raza} onChange={(event) => updateField(`contactosHoja.${index}.raza`, event.target.value)} /></Field>
                          <Field label="Ocupacion"><input value={contacto.ocupacion} onChange={(event) => updateField(`contactosHoja.${index}.ocupacion`, event.target.value)} /></Field>
                          <Field label="Jugador"><input value={contacto.jugador} onChange={(event) => updateField(`contactosHoja.${index}.jugador`, event.target.value)} /></Field>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="unified-sheet-contact-list">
                    {normalizedSheet.contactosHoja.some((contacto) => Object.values(contacto).some((value) => value.trim())) ? normalizedSheet.contactosHoja.map((contacto, index) => (
                      Object.values(contacto).some((value) => value.trim()) ? (
                        <article key={`contacto-${index}`} className="campaign-structured-card unified-sheet-contact-card">
                          <strong>{contacto.nombre || "Contacto sin nombre"}</strong>
                          <dl className="unified-sheet-read-meta is-contact">
                            <div><dt>Raza</dt><dd>{contacto.raza || "Sin especificar"}</dd></div>
                            <div><dt>Ocupacion</dt><dd>{contacto.ocupacion || "Sin especificar"}</dd></div>
                            <div><dt>Jugador</dt><dd>{contacto.jugador || "Sin especificar"}</dd></div>
                          </dl>
                        </article>
                      ) : null
                    )) : <p className="section-help">Sin contactos registrados.</p>}
                  </div>
                )}
              </article>
            </section>
          ) : null}

        </div>
      </section>
    );
  }

  return (
    <div className={`unified-sheet is-tab-${activeMechanicalTab} is-mobile-tab-${mobileActiveTab}`}>
      <nav ref={mobileTabsRef} className="unified-sheet-mobile-tabs" aria-label="Secciones de la ficha">
        {([
          ["attributes", "Atributos"],
          ["actions", "Acciones"],
          ["inventory", "Inventario"],
          ["abilities", "Capacidades"],
          ["background", "Trasfondo"],
          ["notes", "Notas"]
        ] as Array<[MobileSheetTabId, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={mobileActiveTab === tab ? "is-active" : ""}
            aria-current={mobileActiveTab === tab ? "page" : undefined}
            onClick={(event) => handleMobileTabChange(tab, event.currentTarget)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="unified-sheet-top-grid">
        <section className="unified-sheet-module unified-sheet-identity-module campaign-sheet-card" aria-label="Identidad del personaje">
          <div className="unified-sheet-hero-main">
            <div className="unified-sheet-identity">
              <h2 className="unified-sheet-title">{displayName}</h2>
              {subtitle ? <span className="unified-sheet-inline-subtitle">{subtitle}</span> : null}
            </div>
            {backgroundPreferenceScope ? (
              <div className="unified-sheet-identity-actions">
                <CharacterSheetBackgroundPicker preferenceScope={backgroundPreferenceScope} />
              </div>
            ) : null}
          </div>
        </section>
        <section className="unified-sheet-module unified-sheet-resources-module campaign-sheet-card" aria-labelledby="unified-sheet-resources-title">
          <h2 id="unified-sheet-resources-title" className="unified-sheet-module-title">Recursos</h2>
          <div className="unified-sheet-header-stats">
            <div className="unified-sheet-vital-card is-health">
              <div className="unified-sheet-vital-header">
                <span>Robustez</span>
                <strong>{derived.robustezActualTotal} / {derived.robustezMaximaTotal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.robustezMaximaTotal > 0 ? (derived.robustezActualTotal / derived.robustezMaximaTotal) * 100 : 0)}%` }} /></div>
              {editable ? (
                <div className="unified-sheet-vital-actions">
                  <button type="button" className="vital-action loss" onClick={() => adjustNumber("combate.robustezActual", -1)}>-1 Daño</button>
                  <button type="button" className="vital-action gain" onClick={() => adjustNumber("combate.robustezActual", 1)}>+1 Vida</button>
                </div>
              ) : null}
            </div>

            <div className="unified-sheet-vital-card is-corruption">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion temporal</span>
                <strong>{normalizedSheet.corrupcion.temporal}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.temporal / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              {editable ? (
                <div className="unified-sheet-vital-actions">
                  <button
                    type="button"
                    className="vital-action recovery"
                    aria-label="Limpiar toda la Corrupcion temporal"
                    disabled={normalizedSheet.corrupcion.temporal < 1 || busy || isSavingLocal}
                    onClick={() => updateField("corrupcion.temporal", 0)}
                  >Limpiar</button>
                  <button type="button" className="vital-action corruption" onClick={() => adjustNumber("corrupcion.temporal", 1)}>+1 Temp</button>
                </div>
              ) : null}
            </div>

            <div className="unified-sheet-vital-card is-corruption-deep">
              <div className="unified-sheet-vital-header">
                <span>Corrupcion permanente</span>
                <strong>{normalizedSheet.corrupcion.permanente}</strong>
              </div>
              <div className="unified-sheet-vital-track"><div style={{ width: `${Math.min(100, derived.umbralCorrupcionTotal > 0 ? (normalizedSheet.corrupcion.permanente / derived.umbralCorrupcionTotal) * 100 : 0)}%` }} /></div>
              {editable ? (
                <div className="unified-sheet-vital-actions">
                  <button type="button" className="vital-action recovery" onClick={() => adjustNumber("corrupcion.permanente", -1)}>-1 Perm</button>
                  <button
                    type="button"
                    className="vital-action corruption-deep"
                    aria-label="Sumar 1 de Corrupcion permanente"
                    onClick={() => adjustNumber("corrupcion.permanente", 1)}
                  >+1 Perm</button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
        <section className="unified-sheet-module unified-sheet-experience-module unified-sheet-xp-card campaign-sheet-card" aria-labelledby="unified-sheet-experience-title">
          <div className="unified-sheet-experience-heading">
            <h2 id="unified-sheet-experience-title" className="unified-sheet-module-title">Experiencia</h2>
            {editable && onOpenBuilder ? (
              <button
                type="button"
                className="unified-sheet-builder-launch unified-sheet-builder-icon"
                aria-label="Constructor"
                title="Abrir constructor"
                onClick={onOpenBuilder}
              >
                <span aria-hidden="true">⚒</span>
              </button>
            ) : null}
          </div>
          <div className="unified-sheet-xp-row">
            <span>PX total</span>
            <strong>{normalizedSheet.progreso.experienciaTotal}</strong>
          </div>
          <div className="unified-sheet-xp-row is-reroll">
            <span>PX disponible</span>
            <div className="unified-sheet-xp-controls">
              <strong>{experience.effectiveAvailable}</strong>
              {editable ? (
                <button
                  type="button"
                  className="vital-action loss unified-sheet-reroll-action"
                  aria-label="Gastar 1 PX para repetir un dado"
                  title="Gasta 1 PX disponible y repite el dado manualmente"
                  disabled={experience.effectiveAvailable < 1 || busy || isSavingLocal}
                  onClick={() => setIsExperienceRerollConfirmationOpen(true)}
                >
                  <span aria-hidden="true">{"\u21bb"}</span> -1 PX
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className="unified-sheet-status-grid">
        <section className="unified-sheet-module unified-sheet-attributes-module campaign-sheet-card" aria-labelledby="unified-sheet-attributes-title">
          <h2 id="unified-sheet-attributes-title" className="unified-sheet-module-title">Atributos</h2>
          <div className="unified-sheet-attribute-rail">
            {ATTRIBUTE_KEYS.map((key) => (
              <div key={key} className="unified-sheet-attribute-chip">
                <span>{ATTRIBUTE_LABELS[key]}</span>
                <strong>{normalizedSheet.atributos[key]}</strong>
                {isReadOnly ? null : <button type="button" className="vital-action subtle" onClick={() => runAttributeRoll(key)}>Tirar</button>}
              </div>
            ))}
          </div>
        </section>

        <section className="unified-sheet-module unified-sheet-combat-module campaign-sheet-card" aria-labelledby="unified-sheet-combat-title">
          <h2 id="unified-sheet-combat-title" className="unified-sheet-module-title">Combate</h2>
          <div className="unified-sheet-quick-row is-combat-values">
            <article className="unified-sheet-quick-card is-derived-card">
              <h3>Iniciativa</h3>
              <strong>{derived.iniciativaTotal}</strong>
            </article>

            <article className="unified-sheet-quick-card is-defense-card">
              <h3>Defensa</h3>
              <strong className="unified-sheet-combat-value">{derived.defensaTotal}</strong>
              {derived.defensaArmaduraDetalle ? <p className="section-help">{derived.defensaArmaduraDetalle}</p> : null}
              {isReadOnly ? null : (
                <div className="unified-sheet-vital-actions">
                  <button type="button" className="vital-action subtle is-defense-roll" onClick={runDefenseRoll}>Tirar Defensa</button>
                </div>
              )}
            </article>

            <article className="unified-sheet-quick-card">
              <h3>Armadura</h3>
              <strong className="unified-sheet-combat-value">{activeArmor?.protectionFormula || derived.armaduraActiva || "-"}</strong>
              <strong>{activeArmor?.name || normalizedSheet.combate.armadura || (derived.armaduraNatural ? "Armadura natural" : "Sin armadura")}</strong>
              {isReadOnly ? null : (
                <div className="unified-sheet-vital-actions">
                  <button type="button" className="vital-action subtle" onClick={runArmorRoll} disabled={!(activeArmor?.protectionFormula || derived.armaduraActiva)}>Tirar Armadura</button>
                </div>
              )}
            </article>

            <article className="unified-sheet-quick-card is-derived-card">
              <h3>Umbral de dolor</h3>
              <strong>{derived.umbralDolorTotal}</strong>
            </article>

            <article className="unified-sheet-quick-card is-derived-card">
              <h3>Umbral de corrupcion</h3>
              <strong>{derived.umbralCorrupcionTotal}</strong>
            </article>
          </div>
        </section>

        <section className="unified-sheet-module unified-sheet-conditions-module campaign-sheet-card" aria-labelledby="unified-sheet-conditions-title">
          <h2 id="unified-sheet-conditions-title" className="unified-sheet-module-title">Condiciones</h2>
          <div className="unified-sheet-quick-row is-conditions">
            <article className="unified-sheet-quick-card is-wide">
              <div className="unified-sheet-condition-grid">
                {automaticConditions.map((condition) => (
                  <span
                    key={condition.id}
                    className={`unified-sheet-condition-badge is-active ${condition.id === "legacy-corruption" ? "is-tone-corruption" : "is-tone-critical"}`}
                    title="Condición activada automáticamente"
                  >
                    {condition.name}
                  </span>
                ))}
                {CHARACTER_CONDITION_DEFINITIONS.map((definition) => {
                  const condition = normalizedSheet.conditions.find((entry) => matchesConditionDefinition(entry, definition));
                  const isActive = condition?.active === true;
                  return (
                    <button
                      key={definition.id}
                      type="button"
                      className={`unified-sheet-condition-toggle is-tone-${definition.tone}${isActive ? " is-active" : ""}`}
                      aria-pressed={isActive}
                      aria-disabled={!editable || busy || isSavingLocal}
                      title={`${isActive ? "Desactivar" : "Activar"} ${definition.name}`}
                      tabIndex={editable ? 0 : -1}
                      onClick={() => toggleDefinedCondition(definition)}
                    >
                      {definition.name}
                    </button>
                  );
                })}
                {additionalConditions.map((condition) => (
                  <button
                    key={condition.id}
                    type="button"
                    className={`unified-sheet-condition-toggle is-tone-${getStoredConditionTone(condition)}${condition.active ? " is-active" : ""}`}
                    aria-pressed={condition.active}
                    aria-disabled={!editable || busy || isSavingLocal}
                    title={`${condition.active ? "Desactivar" : "Activar"} ${condition.name}`}
                    tabIndex={editable ? 0 : -1}
                    onClick={() => toggleStoredCondition(condition.id)}
                  >
                    {condition.name}
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <div className="unified-sheet-workspace">
        {renderTabStage(
          [["background", "Trasfondo"], ["notes", "Notas"]],
          activeNarrativeTab,
          (tab) => setActiveNarrativeTab(tab as NarrativeTabId),
          "Trasfondo y notas",
          "unified-sheet-module unified-sheet-reader unified-sheet-reader-narrative unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card"
        )}
        {renderTabStage(
          [["actions", "Acciones"], ["inventory", "Inventario"], ["abilities", "Capacidades"]],
          activeMechanicalTab,
          (tab) => setActiveMechanicalTab(tab as MechanicalTabId),
          "Acciones, inventario y capacidades",
          "unified-sheet-module unified-sheet-reader unified-sheet-reader-mechanical unified-sheet-stage unified-sheet-dynamic-column campaign-sheet-card"
        )}
      </div>

      {isExperienceRerollConfirmationOpen ? (
        <div className="modal-backdrop" onClick={() => setIsExperienceRerollConfirmationOpen(false)}>
          <div className="panel modal-panel character-roll-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Gastar PX para repetir</h3>
            <p className="section-help">
              Gastaras 1 PX disponible para repetir manualmente un dado. Esta PX se añadira al gasto acumulado y no puede recuperarse.
            </p>
            <div className="row-actions character-roll-confirm-actions">
              <button
                type="button"
                className="destructive-button"
                disabled={experience.effectiveAvailable < 1 || busy || isSavingLocal}
                onClick={spendExperienceForReroll}
              >Gastar 1 PX</button>
              <button type="button" className="subtle-button" onClick={() => setIsExperienceRerollConfirmationOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
      {selectedPersonalNote ? (
        <div className="modal-backdrop" onClick={() => setSelectedPersonalNoteId(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{selectedPersonalNote.title}</h3>
            <p className="section-help">Actualizada {selectedPersonalNote.updatedAt || selectedPersonalNote.createdAt || "sin fecha"}</p>
            <div className="unified-sheet-action-detail-body">
              <div className="campaign-markdown">
                {renderSimpleMarkdownBlocks(selectedPersonalNote.content || "Sin contenido detallado.")}
              </div>
            </div>
            <div className="row-actions character-roll-confirm-actions">
              {canEditNotes ? (
                <button type="button" onClick={() => {
                  setPersonalNoteError(null);
                  setPersonalNoteEditor({ mode: "edit", note: buildPersonalNoteDraft(selectedPersonalNote) });
                }}>
                  Editar
                </button>
              ) : null}
              <button type="button" className="subtle-button" onClick={() => setSelectedPersonalNoteId(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
      {personalNoteEditor ? (
        <div className="modal-backdrop" onClick={() => setPersonalNoteEditor(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-action-detail-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{personalNoteEditor.mode === "create" ? "Nueva nota personal" : "Editar nota personal"}</h3>
            <p className="section-help">La nota acepta Markdown y se guarda dentro de la hoja del personaje.</p>
            {personalNoteError ? <p className="error-text">{personalNoteError}</p> : null}
            <div className="unified-sheet-action-detail-body">
              <div className="form-grid">
                <Field label="Titulo">
                  <input
                    value={personalNoteEditor.note.title}
                    onChange={(event) => setPersonalNoteEditor((current) => current ? {
                      ...current,
                      note: { ...current.note, title: event.target.value }
                    } : null)}
                  />
                </Field>
              </div>
              <Field label="Contenido">
                <textarea
                  rows={12}
                  value={personalNoteEditor.note.content}
                  onChange={(event) => setPersonalNoteEditor((current) => current ? {
                    ...current,
                    note: { ...current.note, content: event.target.value }
                  } : null)}
                />
              </Field>
            </div>
            <div className="row-actions character-roll-confirm-actions">
              <button type="button" onClick={savePersonalNote}>Guardar</button>
              {personalNoteEditor.mode === "edit" ? (
                <button type="button" className="destructive-button" onClick={() => deletePersonalNote(personalNoteEditor.note.id)}>
                  Quitar
                </button>
              ) : null}
              <button type="button" className="subtle-button" onClick={() => setPersonalNoteEditor(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingRollConfirmation ? (
        <div className="modal-backdrop">
            <div className="panel modal-panel character-roll-confirm-modal">
              <h3>Enviar tirada</h3>
              <p className="section-help">{pendingRollConfirmation.title}</p>
              {pendingAttackModifiers.length > 0 ? (
                <div className="character-roll-confirm-modifiers">
                  <span>Modificadores de tirada</span>
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
                      buildPendingConfirmationRequest(pendingRollConfirmation),
                      pendingRollConfirmation.selectedAttackModifierIds,
                      pendingAttackModifiers
                    ) ?? "-"}
                  </p>
                </div>
              ) : null}
              {pendingRollConfirmation.action && pendingRollConfirmation.phase === "damage" && getActionDamageVariants(pendingRollConfirmation.action).length > 0 ? (
                <div className="character-roll-confirm-modifiers">
                <span>Modificadores de daño</span>
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
                      {actionDetailModal.inventoryMeta.damage || actionDetailModal.inventoryMeta.protection ? (
                        <strong>{actionDetailModal.inventoryMeta.damage || actionDetailModal.inventoryMeta.protection}</strong>
                      ) : null}
                      <span>{actionDetailModal.inventoryMeta.primaryLabel || "Valor base"}</span>
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
                    if (item.category === "weapon") {
                      setWeaponEditorModal({
                        mode: "edit",
                        item: { ...item },
                        index: actionDetailModal.editInventoryIndex
                      });
                    } else if (item.category === "armor") {
                      setArmorEditorModal({
                        mode: "edit",
                        item: { ...item },
                        index: actionDetailModal.editInventoryIndex
                      });
                    } else {
                      setItemEditorModal({
                        mode: "edit",
                        item: { ...item },
                        index: actionDetailModal.editInventoryIndex
                      });
                    }
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
                <Field label="Daño"><input value={weaponEditorModal.item.damageFormula} onChange={(event) => updateWeaponEditorItem("damageFormula", event.target.value)} /></Field>
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
      {armorEditorModal ? (
        <div className="modal-backdrop" onClick={() => setArmorEditorModal(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{armorEditorModal.mode === "create" ? "Armadura personalizada" : "Editar armadura personalizada"}</h3>
            <p className="section-help">Configura la armadura y guardala para que aparezca en el inventario como cualquier otra armadura.</p>
            <div className="unified-sheet-action-detail-body">
              <div className="form-grid">
                <Field label="Nombre"><input value={armorEditorModal.item.name} onChange={(event) => updateArmorEditorItem("name", event.target.value)} /></Field>
                <Field label="Proteccion"><input value={armorEditorModal.item.protectionFormula} onChange={(event) => updateArmorEditorItem("protectionFormula", event.target.value)} /></Field>
                <Field label="Ranura">
                  <select value={armorEditorModal.item.slot} onChange={(event) => updateArmorEditorItem("slot", event.target.value)}>
                    <option value="armor">Armadura</option>
                    <option value="offHand">Mano secundaria</option>
                    <option value="worn">Llevada</option>
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input type="number" min={0} value={armorEditorModal.item.quantity} onChange={(event) => updateArmorEditorItem("quantity", Number(event.target.value || 0))} />
                </Field>
                <Field label="Apilable">
                  <select value={armorEditorModal.item.stackable ? "si" : "no"} onChange={(event) => updateArmorEditorItem("stackable", event.target.value === "si")}>
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </Field>
                <Field label="Valor"><input value={armorEditorModal.item.value} onChange={(event) => updateArmorEditorItem("value", event.target.value)} /></Field>
              </div>
              <div className="field">
                <span>Cualidades</span>
                <div className="unified-sheet-quality-picker">
                  {ARMOR_QUALITY_OPTIONS.map((quality) => {
                    const active = getKnownArmorQualities(armorEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                    return (
                      <button
                        key={`${armorEditorModal.item.id}-${quality.id}`}
                        type="button"
                        className={active ? "is-active" : ""}
                        onClick={() => toggleArmorEditorQuality(quality.label)}
                      >
                        {quality.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Cualidades adicionales">
                <input
                  value={getCustomArmorQualities(armorEditorModal.item).join(", ")}
                  placeholder="Separadas por comas"
                  onChange={(event) => updateArmorEditorCustomQualities(event.target.value)}
                />
              </Field>
              <Field label="Descripcion">
                <textarea rows={3} value={armorEditorModal.item.description} placeholder="Descripcion de la armadura" onChange={(event) => updateArmorEditorItem("description", event.target.value)} />
              </Field>
              <Field label="Notas">
                <textarea rows={3} value={armorEditorModal.item.notes} placeholder="Notas de uso, mantenimiento o procedencia" onChange={(event) => updateArmorEditorItem("notes", event.target.value)} />
              </Field>
            </div>
            <div className="row-actions character-roll-confirm-actions">
              <button type="button" className="subtle-button" onClick={() => setArmorEditorModal(null)}>Cancelar</button>
              <button type="button" className="accent-button" onClick={saveArmorEditorModal}>Guardar</button>
            </div>
          </div>
        </div>
      ) : null}
      {itemEditorModal ? (
        <div className="modal-backdrop" onClick={() => setItemEditorModal(null)}>
          <div className="panel modal-panel character-roll-confirm-modal unified-sheet-weapon-editor-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{itemEditorModal.mode === "create" ? "Objeto personalizado" : "Editar objeto personalizado"}</h3>
            <p className="section-help">Configura el objeto para que aparezca en el inventario con el mismo flujo de detalle que el catalogo.</p>
            <div className="unified-sheet-action-detail-body">
              <div className="form-grid">
                <Field label="Nombre"><input value={itemEditorModal.item.name} onChange={(event) => updateItemEditorItem("name", event.target.value)} /></Field>
                <Field label="Categoria">
                  <select value={itemEditorModal.item.category} onChange={(event) => updateItemEditorItem("category", event.target.value)}>
                    <option value="gear">Equipo</option>
                    <option value="consumable">Consumible</option>
                    <option value="artifact">Artefacto</option>
                    <option value="treasure">Tesoro</option>
                    <option value="other">Otro</option>
                  </select>
                </Field>
                <Field label="Cantidad">
                  <input type="number" min={0} value={itemEditorModal.item.quantity} onChange={(event) => updateItemEditorItem("quantity", Number(event.target.value || 0))} />
                </Field>
                <Field label="Apilable">
                  <select value={itemEditorModal.item.stackable ? "si" : "no"} onChange={(event) => updateItemEditorItem("stackable", event.target.value === "si")}>
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </Field>
                <Field label="Ranura">
                  <select value={itemEditorModal.item.slot} onChange={(event) => updateItemEditorItem("slot", event.target.value)}>
                    <option value="none">Ninguna</option>
                    <option value="worn">Vestido</option>
                    <option value="artifact">Artefacto</option>
                  </select>
                </Field>
                <Field label="Valor"><input value={itemEditorModal.item.value} onChange={(event) => updateItemEditorItem("value", event.target.value)} /></Field>
              </div>
              <div className="field">
                <span>Cualidades</span>
                <div className="unified-sheet-quality-picker">
                  {ITEM_QUALITY_OPTIONS.map((quality) => {
                    const active = getKnownItemQualities(itemEditorModal.item).some((entry) => normalizeWeaponQualityKey(entry) === quality.id);
                    return (
                      <button
                        key={`${itemEditorModal.item.id}-${quality.id}`}
                        type="button"
                        className={active ? "is-active" : ""}
                        onClick={() => toggleItemEditorQuality(quality.label)}
                      >
                        {quality.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Cualidades adicionales">
                <input
                  value={getCustomItemQualities(itemEditorModal.item).join(", ")}
                  placeholder="Separadas por comas"
                  onChange={(event) => updateItemEditorCustomQualities(event.target.value)}
                />
              </Field>
              <Field label="Descripcion">
                <textarea rows={3} value={itemEditorModal.item.description} placeholder="Descripcion del objeto" onChange={(event) => updateItemEditorItem("description", event.target.value)} />
              </Field>
              <Field label="Notas">
                <textarea rows={3} value={itemEditorModal.item.notes} placeholder="Notas de uso, procedencia o comercio" onChange={(event) => updateItemEditorItem("notes", event.target.value)} />
              </Field>
            </div>
            <div className="row-actions character-roll-confirm-actions">
              <button type="button" className="subtle-button" onClick={() => setItemEditorModal(null)}>Cancelar</button>
              <button type="button" className="accent-button" onClick={saveItemEditorModal}>Guardar</button>
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
                <fieldset className="unified-sheet-weapon-type-picker">
                  <legend>Tipo de arma</legend>
                  <div className="unified-sheet-weapon-type-options">
                    {WEAPON_CATALOG_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={selectedWeaponCatalogFilter === option.id ? "is-active" : ""}
                        aria-pressed={selectedWeaponCatalogFilter === option.id}
                        title={option.label}
                        onClick={() => setSelectedWeaponCatalogFilter(option.id)}
                      >
                        <WeaponCatalogTypeIcon type={option.id} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : inventoryCatalogModalTab === "armors" ? (
                <fieldset className="unified-sheet-weapon-type-picker">
                  <legend>Tipo de armadura</legend>
                  <div className="unified-sheet-weapon-type-options unified-sheet-armor-type-options">
                    {ARMOR_CATALOG_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={selectedArmorCatalogFilter === option.id ? "is-active" : ""}
                        aria-pressed={selectedArmorCatalogFilter === option.id}
                        title={option.label}
                        onClick={() => setSelectedArmorCatalogFilter(option.id)}
                      >
                        <ArmorCatalogTypeIcon type={option.id} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : inventoryCatalogModalTab === "items" ? (
                <label className="field">
                  <span>Tipo</span>
                  <select value={selectedItemCatalogFilter} onChange={(event) => setSelectedItemCatalogFilter(event.target.value as ItemCatalogFilterId)}>
                    {ITEM_CATALOG_FILTER_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {inventoryCatalogModalTab === "weapons" ? (
                <div className="unified-sheet-weapon-search-selector">
                  <label className="field">
                    <span>Arma</span>
                    <input
                      type="search"
                      role="combobox"
                      aria-label="Buscar arma"
                      aria-controls="weapon-catalog-results"
                      aria-expanded={filteredModalCatalogItems.length > 0}
                      aria-autocomplete="list"
                      placeholder="Buscar por nombre o cualidad..."
                      value={weaponCatalogSearch}
                      onChange={(event) => setWeaponCatalogSearch(event.target.value)}
                    />
                  </label>
                  <div id="weapon-catalog-results" className="unified-sheet-weapon-search-results" role="listbox" aria-label="Armas disponibles">
                    {filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (
                      <button
                        key={item.templateId}
                        type="button"
                        role="option"
                        aria-selected={item.templateId === selectedCatalogItemId}
                        className={item.templateId === selectedCatalogItemId ? "is-active" : ""}
                        onClick={() => setSelectedCatalogItemId(item.templateId)}
                      >
                        <span>{item.name}</span>
                        <small>{item.damageFormula || "Especial"}</small>
                      </button>
                    )) : <p>No hay armas que coincidan con la busqueda.</p>}
                  </div>
                </div>
              ) : inventoryCatalogModalTab === "armors" ? (
                <div className="unified-sheet-weapon-search-selector">
                  <label className="field">
                    <span>Armadura</span>
                    <input
                      type="search"
                      role="combobox"
                      aria-label="Buscar armadura"
                      aria-controls="armor-catalog-results"
                      aria-expanded={filteredModalCatalogItems.length > 0}
                      aria-autocomplete="list"
                      placeholder="Buscar por nombre o cualidad..."
                      value={armorCatalogSearch}
                      onChange={(event) => setArmorCatalogSearch(event.target.value)}
                    />
                  </label>
                  <div id="armor-catalog-results" className="unified-sheet-weapon-search-results" role="listbox" aria-label="Armaduras disponibles">
                    {filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (
                      <button
                        key={item.templateId}
                        type="button"
                        role="option"
                        aria-selected={item.templateId === selectedCatalogItemId}
                        className={item.templateId === selectedCatalogItemId ? "is-active" : ""}
                        onClick={() => setSelectedCatalogItemId(item.templateId)}
                      >
                        <span>{item.name}</span>
                        <small>{item.protectionFormula || "Especial"}</small>
                      </button>
                    )) : <p>No hay armaduras que coincidan con la busqueda.</p>}
                  </div>
                </div>
              ) : inventoryCatalogModalTab === "items" ? (
                <div className="unified-sheet-weapon-search-selector unified-sheet-object-search-selector">
                  <label className="field">
                    <span>Objeto</span>
                    <input
                      type="search"
                      role="combobox"
                      aria-label="Buscar objeto"
                      aria-controls="item-catalog-results"
                      aria-expanded={filteredModalCatalogItems.length > 0}
                      aria-autocomplete="list"
                      placeholder="Buscar por nombre, efecto o precio..."
                      value={itemCatalogSearch}
                      onChange={(event) => setItemCatalogSearch(event.target.value)}
                    />
                  </label>
                  <div id="item-catalog-results" className="unified-sheet-weapon-search-results" role="listbox" aria-label="Objetos disponibles">
                    {filteredModalCatalogItems.length > 0 ? filteredModalCatalogItems.map((item) => (
                      <button
                        key={item.templateId}
                        type="button"
                        role="option"
                        aria-selected={item.templateId === selectedCatalogItemId}
                        className={item.templateId === selectedCatalogItemId ? "is-active" : ""}
                        onClick={() => setSelectedCatalogItemId(item.templateId)}
                      >
                        <span>{item.name}</span>
                        <small>{item.value || "Sin precio"}</small>
                      </button>
                    )) : <p>No hay objetos que coincidan con la búsqueda.</p>}
                  </div>
                </div>
              ) : (
                <label className="field">
                  <span>{inventoryCatalogModalTab === "items" ? "Objeto" : "Catalogo"}</span>
                  <select value={selectedCatalogItemId} onChange={(event) => setSelectedCatalogItemId(event.target.value)}>
                    {filteredModalCatalogItems.map((item) => (
                      <option key={item.templateId} value={item.templateId}>{item.name}</option>
                    ))}
                  </select>
                </label>
              )}
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
                            <span>Daño base</span>
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
                    ) : selectedItem.category === "armor" ? (
                      <div className="unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview">
                        <div className="unified-sheet-item-catalog-preview-header">
                          <strong>{selectedItem.name}</strong>
                          <span>Armadura del catalogo</span>
                        </div>
                        <section className="unified-sheet-weapon-detail-hero">
                          <div className="unified-sheet-weapon-detail-primary">
                            {selectedItem.protectionFormula ? <strong>{selectedItem.protectionFormula}</strong> : <strong>-</strong>}
                            <span>Proteccion base</span>
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
                        {parseWeaponQualities(selectedItem.qualities).length > 0 ? (
                          <section className="unified-sheet-weapon-detail-qualities">
                            <h4>Cualidades</h4>
                            <div className="unified-sheet-item-catalog-meta">
                              {parseWeaponQualities(selectedItem.qualities).map((quality) => <span key={`${selectedItem.templateId}-${quality}`}>{quality}</span>)}
                            </div>
                          </section>
                        ) : null}
                      </div>
                    ) : (
                      <div className="unified-sheet-weapon-detail-layout unified-sheet-item-catalog-weapon-preview">
                        <div className="unified-sheet-item-catalog-preview-header">
                          <strong>{selectedItem.name}</strong>
                          <span>{selectedItem.category === "artifact" ? "Artefacto del catalogo" : "Objeto del catalogo"}</span>
                        </div>
                        <section className="unified-sheet-weapon-detail-hero">
                          <div className="unified-sheet-weapon-detail-primary">
                            <strong>x{selectedItem.defaultQuantity ?? 1}</strong>
                            <span>Cantidad base</span>
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

function appCardCategoryClass(category: string | null | undefined): string {
  return category ? ` app-card-accent app-card-accent--${category}` : "";
}

function CapabilityTextList({
  title,
  entries,
  onOpenDetail,
  categoryKey
}: {
  title: string;
  entries: RatedEntry[];
  onOpenDetail?: (entry: RatedEntry) => void;
  onOpenCompendium?: (name: string) => void;
  categoryKey?: string;
}) {
  return (
    <div className="unified-sheet-list">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <article
            key={`${title}-${index}-${entry.nombre}`}
            className={`unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}${appCardCategoryClass(categoryKey)}`}
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
  emptyText,
  onOpenDetail,
  categoryKey
}: {
  title: string;
  entries: string[];
  emptyText: string;
  onOpenDetail?: (entry: string) => void;
  categoryKey?: string;
}) {
  return (
    <div className="unified-sheet-list">
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <article
            key={`${title}-${index}-${entry}`}
            className={`unified-sheet-capability-card${onOpenDetail ? " is-clickable" : ""}${appCardCategoryClass(categoryKey)}`}
            onClick={onOpenDetail ? () => onOpenDetail(entry) : undefined}
            onKeyDown={onOpenDetail ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetail(entry);
              }
            } : undefined}
            tabIndex={onOpenDetail ? 0 : undefined}
            role={onOpenDetail ? "button" : undefined}
          >
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
  onRemove,
  categoryKey
}: {
  title: string;
  entries: string[];
  editable: boolean;
  rows: number;
  helpText?: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  categoryKey?: string;
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
            <article key={`${title}-editor-${index}-${entry}`} className={`campaign-structured-card${appCardCategoryClass(categoryKey)}`}>
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
  categoryKey?: string;
};

function CapabilityEditor({ title, entries, editable, onAdd, onRemove, onUpdate, onOpenDetail, onOpenCompendium, categoryKey }: CapabilityEditorProps) {
  return (
    <article className="campaign-sheet-card">
      <div className="row-actions">
        <h3>{title}</h3>
        {editable ? <button type="button" onClick={onAdd}>Agregar</button> : null}
      </div>
      <div className="unified-sheet-list">
        {entries.map((entry, index) => (
          <article key={`${title}-${index}-${entry.nombre}`} className={`campaign-structured-card${appCardCategoryClass(categoryKey)}`}>
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

