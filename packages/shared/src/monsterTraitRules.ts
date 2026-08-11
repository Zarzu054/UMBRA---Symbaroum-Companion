import type { CharacterSheet } from "./index.js";
import type { MonsterSheet } from "./monsterCodex.js";

const TRAIT_LEVEL_REGEX = /(?:\(|\b)(i{1,3}|1|2|3)(?:\)|\b)/i;

function normalizeTraitName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractTraitLevel(value: string): number {
  const normalizedValue = normalizeTraitName(value);
  if (/\bmaestro\b/.test(normalizedValue)) return 3;
  if (/\badepto\b/.test(normalizedValue)) return 2;
  if (/\b(?:principiante|novato)\b/.test(normalizedValue)) return 1;

  const match = String(value ?? "").match(TRAIT_LEVEL_REGEX);
  const raw = normalizeTraitName(match?.[1] ?? "");
  if (raw === "iii" || raw === "3") return 3;
  if (raw === "ii" || raw === "2") return 2;
  if (raw === "i" || raw === "1") return 1;
  return 1;
}

function getTraitAliasMatches(normalized: string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => normalized.startsWith(alias));
}

export function getMonsterTraitLevel(traits: readonly string[], aliases: readonly string[]): number {
  let highest = 0;

  for (const trait of traits) {
    const normalized = normalizeTraitName(trait);
    if (!getTraitAliasMatches(normalized, aliases)) continue;
    highest = Math.max(highest, extractTraitLevel(trait));
  }

  return highest;
}

function getCharacterTraitSources(sheet: CharacterSheet): string[] {
  return [
    ...(sheet.habilidades ?? []).map((entry) => `${entry.nombre} ${entry.nivel ?? ""}`.trim()),
    ...(sheet.rasgos ?? []),
    ...String(sheet.noteSections?.traits ?? "")
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  ];
}

function getRecioMultiplier(level: number): number {
  switch (level) {
    case 3:
      return 3;
    case 2:
      return 2;
    case 1:
      return 1.5;
    default:
      return 1;
  }
}

function getDuroCharacterArmor(level: number): string {
  switch (level) {
    case 3:
      return "1d8";
    case 2:
      return "1d6";
    case 1:
      return "1d4";
    default:
      return "";
  }
}

function getRobustoCharacterArmor(level: number): string {
  switch (level) {
    case 3:
      return "1d8";
    case 2:
      return "1d6";
    case 1:
      return "1d4";
    default:
      return "";
  }
}

function combineArmorFormulas(...formulas: string[]): string {
  return formulas.map((formula) => String(formula ?? "").trim()).filter(Boolean).join("+");
}

function getDuroMonsterArmor(level: number): string {
  switch (level) {
    case 3:
      return "4";
    case 2:
      return "3";
    case 1:
      return "2";
    default:
      return "";
  }
}

function getRobustoDefensePenalty(level: number): number {
  switch (level) {
    case 3:
      return 4;
    case 2:
      return 3;
    case 1:
      return 2;
    default:
      return 0;
  }
}

function formatSignedNumber(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function parseSignedNumber(value: string): number | null {
  const normalized = String(value ?? "").trim().replace(/[−–—]/g, "-");
  if (!/^[+-]?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export type CharacterMonsterTraitEffects = {
  recioLevel: number;
  duroLevel: number;
  robustoLevel: number;
  robustezBase: number;
  robustezMaxima: number;
  armorFormula: string;
  defenseModifier: number;
};

export function getCharacterMonsterTraitEffects(sheet: CharacterSheet): CharacterMonsterTraitEffects {
  const traits = getCharacterTraitSources(sheet);
  const recioLevel = getMonsterTraitLevel(traits, ["recio"]);
  const duroLevel = getMonsterTraitLevel(traits, ["duro"]);
  const robustoLevel = getMonsterTraitLevel(traits, ["robusto", "robusta"]);
  const robustezBase = Number(sheet.atributos?.fuerte ?? 0);
  const robustezMaxima = Math.max(10, Math.floor(robustezBase * getRecioMultiplier(recioLevel)));

  return {
    recioLevel,
    duroLevel,
    robustoLevel,
    robustezBase,
    robustezMaxima,
    armorFormula: combineArmorFormulas(getDuroCharacterArmor(duroLevel), getRobustoCharacterArmor(robustoLevel)),
    defenseModifier: getRobustoDefensePenalty(robustoLevel)
  };
}

export type DerivedMonsterSheetStats = {
  toughness: string;
  painThreshold: string;
  armor: string;
  defense: string;
};

export function getDerivedMonsterSheetStats(sheet: MonsterSheet): DerivedMonsterSheetStats {
  const recioLevel = getMonsterTraitLevel(sheet.traits ?? [], ["recio"]);
  const duroLevel = getMonsterTraitLevel(sheet.traits ?? [], ["duro"]);
  const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
  const strong = Number(sheet.attributes?.strong ?? 0);
  const quick = Number(sheet.attributes?.quick ?? 0);

  const explicitToughness = parseSignedNumber(sheet.toughness);
  const explicitArmor = parseSignedNumber(sheet.armor);

  const derivedToughness = Math.max(0, Math.floor(strong * getRecioMultiplier(recioLevel) || strong));
  const derivedArmor = duroLevel > 0 ? getDuroMonsterArmor(duroLevel) : sheet.armor;
  const derivedDefense = formatSignedNumber(10 - quick + getRobustoDefensePenalty(robustoLevel));

  return {
    toughness: recioLevel > 0 ? String(derivedToughness) : (explicitToughness == null && !String(sheet.toughness ?? "").trim() ? String(strong) : sheet.toughness),
    painThreshold: sheet.painThreshold,
    armor: duroLevel > 0 ? derivedArmor : (explicitArmor == null && !String(sheet.armor ?? "").trim() ? "0" : sheet.armor),
    defense: robustoLevel > 0 ? derivedDefense : (!String(sheet.defense ?? "").trim() ? formatSignedNumber(10 - quick) : sheet.defense)
  };
}
