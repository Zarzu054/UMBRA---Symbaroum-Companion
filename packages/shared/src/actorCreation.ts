import { z } from "zod";

export const actorCapabilityKindSchema = z.enum([
  "habilidad",
  "poder_mistico",
  "ritual",
  "rasgo_personaje",
  "rasgo_nivelado",
  "rasgo_monstruoso",
  "bendicion",
  "carga"
]);

export const actorCapabilityOriginSchema = z.enum(["comprada", "racial", "trasfondo", "legado", "profesion"]);

export const actorCapabilitySelectionSchema = z.object({
  catalogId: z.string().max(180).default(""),
  name: z.string().min(1).max(180),
  kind: actorCapabilityKindSchema,
  level: z.enum(["novato", "adepto", "maestro"]).optional(),
  origin: actorCapabilityOriginSchema.default("comprada"),
  source: z.string().max(160).default(""),
  page: z.number().int().min(1).max(2000).optional(),
  references: z.array(z.object({
    source: z.string().min(1).max(160),
    page: z.number().int().min(1).max(2000).optional()
  })).max(12).optional(),
  requirements: z.object({
    races: z.array(z.string().min(1).max(80)).max(30).optional(),
    capabilityIds: z.array(z.string().min(1).max(180)).max(30).optional()
  }).optional(),
  freeGrant: z.boolean().optional(),
  repeatable: z.boolean().optional(),
  attributeKey: z.string().min(1).max(80).optional(),
  grantedEquipment: z.array(z.string().min(1).max(180)).max(20).optional(),
  unlockProfessionId: z.string().min(1).max(120).optional(),
  legacyData: z.string().max(2000).optional()
});

export const actorCapabilityCatalogEntrySchema = actorCapabilitySelectionSchema.omit({ origin: true, legacyData: true }).extend({
  summary: z.string().max(1200).default("")
});

export type ActorCapabilityKind = z.infer<typeof actorCapabilityKindSchema>;
export type ActorCapabilityOrigin = z.infer<typeof actorCapabilityOriginSchema>;
export type ActorCapabilitySelection = z.infer<typeof actorCapabilitySelectionSchema>;
export type ActorCapabilityCatalogEntry = z.infer<typeof actorCapabilityCatalogEntrySchema>;

export const CHALLENGE_XP_THRESHOLDS = [
  { minimum: 1200, label: "Legendario" },
  { minimum: 600, label: "Mortal" },
  { minimum: 300, label: "Difícil" },
  { minimum: 150, label: "Complicado" },
  { minimum: 50, label: "Normal" },
  { minimum: 0, label: "Sencillo" }
] as const;

export type ActorChallenge = (typeof CHALLENGE_XP_THRESHOLDS)[number]["label"];

export function getActorChallengeFromXp(xp: number): ActorChallenge {
  const normalized = Math.max(0, Math.floor(Number(xp) || 0));
  return CHALLENGE_XP_THRESHOLDS.find((entry) => normalized >= entry.minimum)?.label ?? "Sencillo";
}

export function getRatedCapabilityXp(level: string | undefined): number {
  if (level === "maestro") return 60;
  if (level === "adepto") return 30;
  return 10;
}

export function getActorCapabilityXpDelta(entry: ActorCapabilitySelection): number {
  if (entry.kind === "carga") return -5;
  if (entry.kind === "rasgo_personaje") return 0;
  if (entry.kind === "bendicion") return entry.origin === "racial" ? 0 : 5;
  if (entry.kind === "ritual") return 10;
  return getRatedCapabilityXp(entry.level);
}

export function getActorSpentXp(entries: ActorCapabilitySelection[]): number {
  return entries.reduce((total, entry) => total + Math.max(0, getActorCapabilityXpDelta(entry)), 0);
}

export function getActorBurdenBonus(entries: ActorCapabilitySelection[]): number {
  return entries.reduce((total, entry) => total + (entry.kind === "carga" ? 5 : 0), 0);
}

function normalizeCapabilityName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function isExceptionalAttributeSelection(entry: Pick<ActorCapabilitySelection, "name">): boolean {
  return normalizeCapabilityName(entry.name) === "atributo excepcional";
}

export function getExceptionalAttributeBonus(entry: ActorCapabilitySelection): number {
  if (!isExceptionalAttributeSelection(entry) || !entry.attributeKey) return 0;
  if (entry.level === "maestro") return 3;
  if (entry.level === "adepto") return 2;
  return 1;
}

export function getExceptionalAttributeBonuses(entries: ActorCapabilitySelection[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((bonuses, entry) => {
    const bonus = getExceptionalAttributeBonus(entry);
    if (entry.attributeKey && bonus > 0) bonuses[entry.attributeKey] = (bonuses[entry.attributeKey] ?? 0) + bonus;
    return bonuses;
  }, {});
}

export function removeExceptionalAttributeBonuses<K extends string>(
  finalValues: Record<K, number>,
  entries: ActorCapabilitySelection[]
): Record<K, number> {
  const bonuses = getExceptionalAttributeBonuses(entries);
  return Object.fromEntries(Object.entries(finalValues).map(([key, value]) => [key, Number(value) - (bonuses[key] ?? 0)])) as Record<K, number>;
}

export function applyExceptionalAttributeBonuses<K extends string>(
  baseValues: Record<K, number>,
  entries: ActorCapabilitySelection[]
): Record<K, number> {
  const bonuses = getExceptionalAttributeBonuses(entries);
  return Object.fromEntries(Object.entries(baseValues).map(([key, value]) => [key, Number(value) + (bonuses[key] ?? 0)])) as Record<K, number>;
}

export function synchronizeExceptionalAttributes<K extends string>(
  finalValues: Record<K, number>,
  previousEntries: ActorCapabilitySelection[],
  nextEntries: ActorCapabilitySelection[]
): Record<K, number> {
  return applyExceptionalAttributeBonuses(removeExceptionalAttributeBonuses(finalValues, previousEntries), nextEntries);
}

export function validateExceptionalAttributeSelections(
  entries: ActorCapabilitySelection[],
  allowedKeys: readonly string[]
): string[] {
  const exceptional = entries.filter(isExceptionalAttributeSelection);
  const errors: string[] = [];
  const selected = new Set<string>();
  for (const entry of exceptional) {
    if (!entry.attributeKey) {
      if (entry.origin !== "legado") errors.push("Cada adquisición de Atributo excepcional debe indicar un atributo.");
      continue;
    }
    if (!allowedKeys.includes(entry.attributeKey)) errors.push(`El atributo ${entry.attributeKey} no es válido para Atributo excepcional.`);
    if (selected.has(entry.attributeKey)) errors.push("Atributo excepcional solo puede adquirirse una vez para cada atributo.");
    selected.add(entry.attributeKey);
  }
  return Array.from(new Set(errors));
}

/**
 * Symbaroum uses the fixed NPC values 2/3/4/5/6 for d4/d6/d8/d10/d12.
 * Multiple dice and signed constants are supported; an unsupported formula
 * returns null instead of silently producing a misleading value.
 */
export function averageDiceFormula(formula: string | null | undefined): number | null {
  const normalized = String(formula ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
  if (!normalized) return null;
  if (/^[+-]?\d+$/.test(normalized)) return Number(normalized);
  if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(normalized)) return null;

  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  for (const rawTerm of terms) {
    const sign = rawTerm.startsWith("-") ? -1 : 1;
    const term = rawTerm.replace(/^[+-]/, "");
    const dice = /^(\d*)d(\d+)$/.exec(term);
    if (dice) {
      const count = Number(dice[1] || 1);
      const sides = Number(dice[2]);
      if (!Number.isFinite(count) || count < 1 || !Number.isFinite(sides) || sides < 2) return null;
      total += sign * count * Math.floor((sides + 1) / 2);
    } else {
      total += sign * Number(term);
    }
  }
  return Number.isFinite(total) ? total : null;
}

export type AttributeValidation = { valid: boolean; total: number; errors: string[] };

export function validateCreationAttributes(values: Record<string, number>): AttributeValidation {
  const numbers = Object.values(values).map(Number);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const errors: string[] = [];
  if (numbers.some((value) => !Number.isInteger(value) || value < 5 || value > 15)) {
    errors.push("Cada atributo debe ser un número entero entre 5 y 15.");
  }
  if (total !== 80) errors.push("La suma de atributos debe ser exactamente 80.");
  if (numbers.filter((value) => value === 15).length > 1) errors.push("Solo un atributo puede tener valor 15.");
  return { valid: errors.length === 0, total, errors };
}
