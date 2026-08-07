import { z } from "zod";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "./symbaroumCompendium.js";
import { getCharacterMonsterTraitEffects } from "./monsterTraitRules.js";
import { STARTER_MONSTER_CODEX, createDefaultMonsterSheet, monsterSheetSchema, type MonsterSheet } from "./monsterCodex.js";
export * from "./symbaroumCompendium.js";
export * from "./campaignActionEngine.js";
export * from "./monsterCodex.js";
export * from "./monsterTraitRules.js";
export * from "./weaponCatalog.js";

export const userRoleSchema = z.enum(["player", "gm", "superadmin"]);
export const registerRoleSchema = z.enum(["player", "gm"]);
export const accountStatusSchema = z.enum(["pending", "active", "deactivated"]);
export const adminDeactivationReasonSchema = z.enum([
  "access_no_longer_required",
  "policy_violation",
  "security_concern",
  "duplicate_or_error",
  "other"
]);
export const adminNotificationStatusSchema = z.enum(["not_required", "pending", "sent", "failed"]);
export const adminAccountActionSchema = z.enum([
  "created",
  "deactivated",
  "reactivated",
  "sessions_revoked",
  "credentials_resent"
]);
export const skillLevelSchema = z.enum(["novato", "adepto", "maestro"]);
export const actionCostSchema = z.enum(["free", "movement", "combat", "reaction"]);
export const campaignChatVisibilitySchema = z.enum(["all", "gm_only"]);
export const campaignChatMessageTypeSchema = z.enum(["text", "action"]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type RegisterRole = z.infer<typeof registerRoleSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AdminDeactivationReason = z.infer<typeof adminDeactivationReasonSchema>;
export type AdminNotificationStatus = z.infer<typeof adminNotificationStatusSchema>;
export type AdminAccountAction = z.infer<typeof adminAccountActionSchema>;
export type SkillLevel = z.infer<typeof skillLevelSchema>;
export type ActionCost = z.infer<typeof actionCostSchema>;
export type CampaignChatVisibility = z.infer<typeof campaignChatVisibilitySchema>;
export type CampaignChatMessageType = z.infer<typeof campaignChatMessageTypeSchema>;

export const SYMBAROUM_RACES = [
  "Humano",
  "Trocalengo",
  "Trasgo",
  "Ogro",
  "Elfo",
  "Enano",
  "Troll",
  "Humano tomado",
  "Muerto viviente"
] as const;

export const SYMBAROUM_CULTURES = [
  "Ambriano",
  "B\u00e1rbaro",
  "Clan goblin",
  "Pueblo libre",
  "Ordo M\u00e1gica",
  "Templo de Prios"
] as const;

export const SYMBAROUM_ARCHETYPES = [
  "Guerrero",
  "Cazador",
  "M\u00edstico",
  "Maleante"
] as const;

export const ATTRIBUTE_KEYS = [
  "agil",
  "atento",
  "diestro",
  "discreto",
  "fuerte",
  "inteligente",
  "persuasivo",
  "tenaz"
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  agil: "Agil",
  atento: "Atento",
  discreto: "Discreto",
  diestro: "Diestro",
  fuerte: "Fuerte",
  inteligente: "Inteligente",
  persuasivo: "Persuasivo",
  tenaz: "Tenaz"
};

const STARTING_ABILITY_PATTERNS = new Set(["5novato", "2novato_1adepto"]);
const MYSTIC_ABILITY_NAMES = ["Poder místico", "Magia", "Teúrgia", "Brujería", "Hechicería"];
const SHEET_HIDDEN_ABILITY_NAMES = ["Poder mÃ­stico"];
const NORMALIZED_MYSTIC_ABILITY_NAMES = MYSTIC_ABILITY_NAMES.map(normalizeName);
const NORMALIZED_SHEET_HIDDEN_ABILITY_NAMES = SHEET_HIDDEN_ABILITY_NAMES.map(normalizeName);
const MONSTER_TRAIT_NAME_SET = buildMonsterTraitNameSet();

function nullableDefaultString(maxLength: number, fallback = "") {
  return z.preprocess((value) => value == null ? fallback : value, z.string().max(maxLength).default(fallback));
}

const attributeBlockSchema = z.object({
  agil: z.number().int().min(5).max(15),
  atento: z.number().int().min(5).max(15),
  discreto: z.number().int().min(5).max(15),
  diestro: z.number().int().min(5).max(15),
  fuerte: z.number().int().min(5).max(15),
  inteligente: z.number().int().min(5).max(15),
  persuasivo: z.number().int().min(5).max(15),
  tenaz: z.number().int().min(5).max(15)
});

const actionMetadataSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  cost: actionCostSchema.default("combat"),
  requiredLevel: skillLevelSchema.optional(),
  rollAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
  fixedTarget: z.number().int().min(1).max(20).optional(),
  damageFormula: z.preprocess((value) => value == null ? undefined : value, z.string().max(80).optional()),
  effectSummary: nullableDefaultString(400, "")
});

const ratedEntrySchema = z.object({
  nombre: z.string().min(1).max(120),
  tipo: nullableDefaultString(120, ""),
  efecto: nullableDefaultString(1200, ""),
  nivel: skillLevelSchema,
  fuente: nullableDefaultString(120, ""),
  pagina: z.number().int().min(1).max(2000).optional(),
  notas: nullableDefaultString(800, ""),
  acciones: z.array(actionMetadataSchema).max(12).default([])
});

const sourceRefSchema = z.object({
  libro: z.string().min(1).max(160),
  pagina: z.number().int().min(1).max(2000),
  nota: z.string().max(400).default("")
});

const resourceBlockSchema = z.object({
  dinero: z.string().max(120).default(""),
  otros: z.string().max(240).default("")
});

const groupBlockSchema = z.object({
  nombre: z.string().max(120).default(""),
  objetivo: z.string().max(400).default("")
});

const contactCardSchema = z.object({
  nombre: z.string().max(120).default(""),
  raza: z.string().max(80).default(""),
  ocupacion: z.string().max(120).default(""),
  jugador: z.string().max(120).default("")
});

const artifactCardSchema = z.object({
  nombre: z.string().max(120).default(""),
  poderes: z.string().max(400).default(""),
  corrupcion: z.string().max(120).default("")
});

const canonicalActionEntrySchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  sourceType: z.enum(["weapon", "ability", "power", "ritual", "utility"]).default("ability"),
  sourceName: z.string().min(1).max(160),
  cost: actionCostSchema.default("combat"),
  requiredLevel: skillLevelSchema.optional(),
  rollAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
  fixedTarget: z.number().int().min(1).max(20).optional(),
  damageFormula: z.string().max(80).optional(),
  effectSummary: z.string().max(800).default(""),
  category: z.string().max(80).default("general"),
  notes: z.string().max(800).default(""),
  linkedItemId: z.string().max(120).default("")
});

const itemModifierSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  modifierType: z.enum(["attack", "damage", "armor", "defense", "initiative", "painThreshold", "corruptionThreshold", "custom"]).default("custom"),
  value: z.string().max(80).default(""),
  notes: z.string().max(240).default("")
});

const inventoryItemSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  category: z.enum(["weapon", "armor", "gear", "consumable", "artifact", "treasure", "other"]).default("other"),
  quantity: z.number().int().min(0).max(999).default(1),
  stackable: z.boolean().default(false),
  isCustom: z.boolean().default(false),
  description: z.string().max(1200).default(""),
  weight: z.string().max(40).default(""),
  value: z.string().max(80).default(""),
  equipped: z.boolean().default(false),
  slot: z.enum(["mainHand", "offHand", "ranged", "armor", "artifact", "worn", "none"]).default("none"),
  attackAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
  damageFormula: z.string().max(80).default(""),
  protectionFormula: z.string().max(80).default(""),
  qualities: z.string().max(240).default(""),
  notes: z.string().max(800).default(""),
  grantedActions: z.array(actionMetadataSchema).max(20).default([]),
  modifiers: z.array(itemModifierSchema).max(20).default([])
});

const equipmentSlotsSchema = z.object({
  mainHand: z.string().max(120).default(""),
  offHand: z.string().max(120).default(""),
  ranged: z.string().max(120).default(""),
  armor: z.string().max(120).default(""),
  artifact: z.string().max(120).default(""),
  worn: z.string().max(120).default("")
});

const conditionSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  category: z.enum(["state", "injury", "corruption", "custom"]).default("custom"),
  active: z.boolean().default(true),
  severity: z.enum(["minor", "moderate", "major"]).default("minor"),
  summary: z.string().max(400).default(""),
  notes: z.string().max(800).default("")
});

const noteSectionsSchema = z.object({
  general: z.string().max(8000).default(""),
  background: z.string().max(4000).default(""),
  traits: z.string().max(2000).default(""),
  campaign: z.string().max(4000).default("")
});

const structuredNoteEntrySchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  content: z.string().max(12000).default(""),
  createdAt: z.string().max(80).default(""),
  updatedAt: z.string().max(80).default("")
});

const characterNoteEntrySchema = structuredNoteEntrySchema.extend({
  category: z.enum(["general", "campaign"]).default("general")
});

const campaignSharedNoteEntrySchema = structuredNoteEntrySchema.extend({
  authorId: z.string().max(80).default(""),
  authorEmail: z.string().max(160).default("")
});

const STRUCTURED_SHARED_NOTES_PREFIX = "__UMBRA_SHARED_NOTES_V1__:";

function buildLegacyCharacterNoteEntries(
  input: { noteSections?: Partial<z.infer<typeof noteSectionsSchema>>; notas?: string }
): z.infer<typeof characterNoteEntrySchema>[] {
  const entries: z.infer<typeof characterNoteEntrySchema>[] = [];
  const generalContent = input.noteSections?.general ?? input.notas ?? "";
  const campaignContent = input.noteSections?.campaign ?? "";
  if (generalContent.trim()) {
    entries.push({
      id: "legacy-note-general",
      title: "Notas generales",
      content: generalContent.trim(),
      category: "general",
      createdAt: "",
      updatedAt: ""
    });
  }
  if (campaignContent.trim()) {
    entries.push({
      id: "legacy-note-campaign",
      title: "Notas de campana",
      content: campaignContent.trim(),
      category: "campaign",
      createdAt: "",
      updatedAt: ""
    });
  }
  return entries;
}

function normalizeCharacterNoteEntries(entries: unknown): z.infer<typeof characterNoteEntrySchema>[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => characterNoteEntrySchema.safeParse(entry))
    .filter((result): result is { success: true; data: z.infer<typeof characterNoteEntrySchema> } => result.success)
    .map((result) => ({
      ...result.data,
      title: result.data.title.trim(),
      content: result.data.content.trim()
    }))
    .filter((entry) => entry.title.length > 0 || entry.content.length > 0)
    .slice(0, 200);
}

function normalizeCampaignSharedNoteEntries(entries: unknown): z.infer<typeof campaignSharedNoteEntrySchema>[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => campaignSharedNoteEntrySchema.safeParse(entry))
    .filter((result): result is { success: true; data: z.infer<typeof campaignSharedNoteEntrySchema> } => result.success)
    .map((result) => ({
      ...result.data,
      title: result.data.title.trim(),
      content: result.data.content.trim(),
      authorEmail: result.data.authorEmail.trim()
    }))
    .filter((entry) => entry.title.length > 0 || entry.content.length > 0)
    .slice(0, 200);
}

export function encodeCampaignSharedNotes(entries: Array<z.infer<typeof campaignSharedNoteEntrySchema>>): string {
  const normalized = normalizeCampaignSharedNoteEntries(entries);
  if (normalized.length === 0) {
    return "";
  }
  return `${STRUCTURED_SHARED_NOTES_PREFIX}${JSON.stringify(normalized)}`;
}

export function decodeCampaignSharedNotes(raw: string): {
  legacyText: string;
  entries: Array<z.infer<typeof campaignSharedNoteEntrySchema>>;
} {
  const normalizedRaw = String(raw ?? "");
  if (!normalizedRaw.startsWith(STRUCTURED_SHARED_NOTES_PREFIX)) {
    const legacyText = normalizedRaw.trim();
    return {
      legacyText,
      entries: legacyText
        ? [{
            id: "legacy-shared-note",
            title: "Notas compartidas",
            content: legacyText,
            authorId: "",
            authorEmail: "",
            createdAt: "",
            updatedAt: ""
          }]
        : []
    };
  }

  try {
    const parsed = JSON.parse(normalizedRaw.slice(STRUCTURED_SHARED_NOTES_PREFIX.length));
    return {
      legacyText: "",
      entries: normalizeCampaignSharedNoteEntries(parsed)
    };
  } catch {
    return {
      legacyText: "",
      entries: []
    };
  }
}

const characterSheetObjectSchema = z.object({
  identidad: z.object({
    nombrePersonaje: z.string().max(120).default(""),
    nombreJugador: z.string().max(120).default(""),
    esFamiliar: z.boolean().default(false),
    raza: z.enum(SYMBAROUM_RACES).or(z.string().min(1).max(80)),
    cultura: z.enum(SYMBAROUM_CULTURES).or(z.string().min(1).max(80)).default("Ambriano"),
    arquetipo: z.enum(SYMBAROUM_ARCHETYPES).or(z.string().min(1).max(80)).default("Guerrero"),
    profesion: z.string().max(120).default(""),
    sombra: z.string().max(240).default(""),
    cita: z.string().max(240).default(""),
    edad: z.string().max(40).default(""),
    altura: z.string().max(40).default(""),
    peso: z.string().max(40).default(""),
    apariencia: z.string().max(240).default(""),
    objetivoPersonal: z.string().max(400).default(""),
    trasfondo: z.string().max(4000).default("")
  }),
  atributos: attributeBlockSchema,
  progreso: z.object({
    nivel: z.literal(1).default(1),
    experienciaTotal: z.number().int().min(0).max(100000).default(0),
    experienciaGastada: z.number().int().min(0).max(100000).default(0)
  }),
  combate: z.object({
    robustezMax: z.number().int().min(1).max(999).default(10),
    robustezActual: z.number().int().min(0).max(999).default(10),
    umbralDolor: z.number().int().min(0).max(999).default(5),
    defensaMod: z.number().int().min(-20).max(20).default(0),
    defensaBase: z.string().max(40).default(""),
    iniciativaMod: z.number().int().min(-20).max(20).default(0),
    armadura: z.string().max(160).default(""),
    armaduraProteccion: z.string().max(80).default(""),
    armaduraCualidad: z.string().max(120).default(""),
    armaduraSecundaria: z.string().max(160).default(""),
    armaduraSecundariaProteccion: z.string().max(80).default(""),
    armaPrincipal: z.string().max(160).default(""),
    armaPrincipalCualidad: z.string().max(120).default(""),
    armaPrincipalAtributo: z.string().max(80).default(""),
    armaSecundaria: z.string().max(160).default(""),
    armaSecundariaAtributo: z.string().max(80).default(""),
    armaTerciaria: z.string().max(160).default(""),
    armaTerciariaCualidad: z.string().max(120).default(""),
    armaTerciariaAtributo: z.string().max(80).default(""),
    armaCuaternaria: z.string().max(160).default(""),
    armaCuaternariaCualidad: z.string().max(120).default(""),
    armaCuaternariaAtributo: z.string().max(80).default(""),
    danioPrincipal: z.string().max(80).default(""),
    danioSecundaria: z.string().max(80).default(""),
    danioTerciaria: z.string().max(80).default(""),
    danioCuaternaria: z.string().max(80).default("")
  }),
  corrupcion: z.object({
    temporal: z.number().int().min(0).max(999).default(0),
    permanente: z.number().int().min(0).max(999).default(0),
    umbral: z.number().int().min(0).max(999).default(5),
    notas: z.string().max(1000).default("")
  }),
  bendiciones: z.array(z.string().min(1).max(120)).max(40).default([]),
  cargas: z.array(z.string().min(1).max(120)).max(40).default([]),
  rasgos: z.array(z.string().min(1).max(120)).max(40).default([]),
  habilidades: z.array(ratedEntrySchema).max(120).default([]),
  poderesMisticos: z.array(ratedEntrySchema).max(120).default([]),
  rituales: z.array(ratedEntrySchema).max(120).default([]),
  equipo: z.array(z.string().min(1).max(180)).max(200).default([]),
  contactos: z.array(z.string().min(1).max(180)).max(80).default([]),
  recursos: resourceBlockSchema.default({
    dinero: "",
    otros: ""
  }),
  grupo: groupBlockSchema.default({
    nombre: "",
    objetivo: ""
  }),
  contactosHoja: z.array(contactCardSchema).length(5).default([
    { nombre: "", raza: "", ocupacion: "", jugador: "" },
    { nombre: "", raza: "", ocupacion: "", jugador: "" },
    { nombre: "", raza: "", ocupacion: "", jugador: "" },
    { nombre: "", raza: "", ocupacion: "", jugador: "" },
    { nombre: "", raza: "", ocupacion: "", jugador: "" }
  ]),
  artefactos: z.array(artifactCardSchema).length(4).default([
    { nombre: "", poderes: "", corrupcion: "" },
    { nombre: "", poderes: "", corrupcion: "" },
    { nombre: "", poderes: "", corrupcion: "" },
    { nombre: "", poderes: "", corrupcion: "" }
  ]),
  actionFavorites: z.array(z.string().min(1).max(160)).max(80).default([]),
  actions: z.array(canonicalActionEntrySchema).max(200).default([]),
  inventoryItems: z.array(inventoryItemSchema).max(400).default([]),
  equipmentSlots: equipmentSlotsSchema.default({
    mainHand: "",
    offHand: "",
    ranged: "",
    armor: "",
    artifact: "",
    worn: ""
  }),
  conditions: z.array(conditionSchema).max(120).default([]),
  personalNotes: z.array(characterNoteEntrySchema).max(200).default([]),
  noteSections: noteSectionsSchema.default({
    general: "",
    background: "",
    traits: "",
    campaign: ""
  }),
  referencias: z.array(sourceRefSchema).max(300).default([]),
  notas: z.string().max(8000).default("")
});

export const characterSheetSchema = characterSheetObjectSchema.superRefine((sheet, ctx) => {
    if (sheet.progreso.experienciaGastada > getEffectiveExperienceTotal(sheet)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["progreso", "experienciaGastada"],
        message: "La experiencia gastada no puede ser mayor que la experiencia total ajustada por cargas"
      });
    }

    const robustezMax = getEffectiveCharacterRobustezMax(sheet);
    if (sheet.combate.robustezActual > robustezMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["combate", "robustezActual"],
        message: "La robustez actual no puede superar la robustez máxima"
      });
    }

    const attributeValues = Object.values(sheet.atributos);
    const totalAttributes = attributeValues.reduce((sum, value) => sum + value, 0);
    if (totalAttributes !== 80) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["atributos"],
        message: "La suma total de atributos debe ser 80 en creación de personaje"
      });
    }

    const countFifteen = attributeValues.filter((value) => value === 15).length;
    if (countFifteen > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["atributos"],
        message: "Solo un atributo puede tener valor 15"
      });
    }

    const novice = sheet.habilidades.filter((entry) => entry.nivel === "novato").length;
    const adept = sheet.habilidades.filter((entry) => entry.nivel === "adepto").length;
    const master = sheet.habilidades.filter((entry) => entry.nivel === "maestro").length;
    const patternKey = `${novice}novato_${adept}adepto`;
    const normalizedPattern = novice === 5 && adept === 0 ? "5novato" : patternKey;

    if (!STARTING_ABILITY_PATTERNS.has(normalizedPattern)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["habilidades"],
        message: "Las habilidades iniciales deben ser 5 novato o 2 novato + 1 adepto"
      });
    }

    if (master > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["habilidades"],
        message: "No se permiten habilidades en nivel maestro durante creación"
      });
    }
  });

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildMonsterTraitNameSet(): Set<string> {
  const names = new Set<string>();

  for (const monster of STARTER_MONSTER_CODEX) {
    for (const trait of monster.sheet?.traits ?? []) {
      const baseName = extractMonsterTraitBaseName(trait);
      if (baseName) {
        names.add(baseName);
      }
    }
  }

  return names;
}

function extractMonsterTraitBaseName(value: string): string {
  return normalizeName(value)
    .replace(/\((?:i{1,3}|[1-3])\)/g, "")
    .replace(/\b(?:i{1,3}|[1-3])\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMonsterTraitLevel(value: string): "novato" | "adepto" | "maestro" {
  const normalized = normalizeName(value);
  if (/\bmaestro\b|\biii\b|\b3\b/.test(normalized)) return "maestro";
  if (/\badepto\b|\bii\b|\b2\b/.test(normalized)) return "adepto";
  return "novato";
}

function isCharacterMonsterTrait(value: string): boolean {
  return MONSTER_TRAIT_NAME_SET.has(extractMonsterTraitBaseName(value));
}

function buildMonsterTraitAbilityEntries(
  rasgos: string[] | undefined,
  existingAbilities: z.infer<typeof ratedEntrySchema>[] | undefined
): z.infer<typeof ratedEntrySchema>[] {
  const existingNames = new Set((existingAbilities ?? []).map((entry) => normalizeName(entry.nombre)));
  const migrated: z.infer<typeof ratedEntrySchema>[] = [];

  for (const rasgo of rasgos ?? []) {
    const baseName = extractMonsterTraitBaseName(rasgo);
    if (!baseName || !isCharacterMonsterTrait(rasgo) || existingNames.has(baseName)) {
      continue;
    }

    const canonical = SYMBAROUM_ABILITIES.find((entry) => normalizeName(entry.nombre) === baseName);
    migrated.push({
      nombre: canonical?.nombre ?? String(rasgo).trim(),
      tipo: canonical?.tipo ?? "Rasgo monstruoso",
      efecto: canonical?.efectoResumen ?? "",
      nivel: parseMonsterTraitLevel(rasgo),
      fuente: canonical?.libro ?? "",
      pagina: canonical?.pagina,
      notas: "",
      acciones: canonical?.acciones.map((action) => ({ ...action })) ?? []
    });
    existingNames.add(baseName);
  }

  return migrated;
}

function filterCharacterNonMonsterTraits(rasgos: string[] | undefined): string[] {
  return (rasgos ?? []).filter((rasgo) => !isCharacterMonsterTrait(rasgo));
}

function getEffectiveExperienceTotal(sheet: {
  progreso?: { experienciaTotal?: number };
  cargas?: string[];
}): number {
  return Number(sheet.progreso?.experienciaTotal ?? 0) + (Array.isArray(sheet.cargas) ? sheet.cargas.length * 5 : 0);
}

export function getEffectiveCharacterRobustezMax(
  sheet: Pick<z.infer<typeof characterSheetObjectSchema>, "combate" | "atributos" | "rasgos" | "noteSections">
): number {
  const automaticMax = getCharacterMonsterTraitEffects(sheet as z.infer<typeof characterSheetObjectSchema>).robustezMaxima;
  const explicitMax = Number(sheet.combate?.robustezMax ?? 0);
  return automaticMax > 0 ? automaticMax : explicitMax;
}

function slugify(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}

function coerceAttribute(value: string): AttributeKey | undefined {
  const normalized = normalizeName(value);
  if ((ATTRIBUTE_KEYS as readonly string[]).includes(normalized)) {
    return normalized as AttributeKey;
  }

  switch (normalized) {
    case "rapido":
      return "agil";
    case "vigilante":
      return "atento";
    case "preciso":
      return "diestro";
    case "astuto":
      return "inteligente";
    case "resolutivo":
      return "tenaz";
    default:
      return undefined;
  }
}

function inferInventoryCategory(name: string): "weapon" | "armor" | "gear" | "consumable" | "artifact" | "treasure" | "other" {
  const normalized = normalizeName(name);
  if (/(espada|arco|lanza|daga|arma|martillo|hacha|ballesta)/.test(normalized)) return "weapon";
  if (/(armadura|escudo|yelmo|casco|coraza|malla)/.test(normalized)) return "armor";
  if (/(pocion|elixir|vial|brebaje|racion|antorcha)/.test(normalized)) return "consumable";
  if (/(artefacto|reliquia|amuleto)/.test(normalized)) return "artifact";
  if (/(moneda|thaler|dinero|tesoro)/.test(normalized)) return "treasure";
  return "gear";
}

function isNaturalArmorPlaceholderName(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized === "natural" || normalized === "armadura natural";
}

function hasCharacterTraitBasedNaturalArmor(sheet: Pick<z.infer<typeof characterSheetObjectSchema>, "habilidades" | "rasgos" | "noteSections" | "atributos">): boolean {
  return Boolean(getCharacterMonsterTraitEffects(sheet as CharacterSheet).armorFormula);
}

function stripNaturalArmorPlaceholderItems(
  items: z.infer<typeof inventoryItemSchema>[],
  sheet: Pick<z.infer<typeof characterSheetObjectSchema>, "habilidades" | "rasgos" | "noteSections" | "atributos">
): z.infer<typeof inventoryItemSchema>[] {
  if (!hasCharacterTraitBasedNaturalArmor(sheet)) {
    return items;
  }

  return items.filter((item) => !(item.category === "armor" && isNaturalArmorPlaceholderName(item.name)));
}

function buildLegacyInventoryItems(sheet: z.infer<typeof characterSheetObjectSchema>): z.infer<typeof inventoryItemSchema>[] {
  const items: z.infer<typeof inventoryItemSchema>[] = [];
  const pushItem = (item: z.infer<typeof inventoryItemSchema>): void => {
    if (!items.some((entry) => entry.id === item.id)) {
      items.push(item);
    }
  };

  const addWeapon = (
    id: string,
    name: string | undefined,
    slot: "mainHand" | "offHand" | "ranged",
    damageFormula: string | undefined,
    attribute: string | undefined,
    qualities: string | undefined
  ) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return;
    const normalizedName = normalizeName(trimmed);
    if (normalizedName === "natural" || normalizedName === "arma natural" || normalizedName === "armas naturales") return;
    pushItem({
      id,
      name: trimmed,
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot,
      attackAttribute: coerceAttribute(attribute ?? ""),
      damageFormula: (damageFormula ?? "").trim(),
      protectionFormula: "",
      qualities: (qualities ?? "").trim(),
      notes: "",
      grantedActions: [],
      modifiers: []
    });
  };

  addWeapon("legacy-weapon-primary", sheet.combate.armaPrincipal, "mainHand", sheet.combate.danioPrincipal, sheet.combate.armaPrincipalAtributo, sheet.combate.armaPrincipalCualidad);
  addWeapon("legacy-weapon-secondary", sheet.combate.armaSecundaria, "offHand", sheet.combate.danioSecundaria, sheet.combate.armaSecundariaAtributo, "");
  addWeapon("legacy-weapon-tertiary", sheet.combate.armaTerciaria, "ranged", sheet.combate.danioTerciaria, sheet.combate.armaTerciariaAtributo, sheet.combate.armaTerciariaCualidad);
  addWeapon("legacy-weapon-quaternary", sheet.combate.armaCuaternaria, "ranged", sheet.combate.danioCuaternaria, sheet.combate.armaCuaternariaAtributo, sheet.combate.armaCuaternariaCualidad);

  if ((sheet.combate.armadura ?? "").trim() && !isNaturalArmorPlaceholderName(sheet.combate.armadura ?? "")) {
    pushItem({
      id: "legacy-armor-primary",
      name: (sheet.combate.armadura ?? "").trim(),
      category: "armor",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "armor",
      protectionFormula: (sheet.combate.armaduraProteccion ?? "").trim(),
      damageFormula: "",
      qualities: (sheet.combate.armaduraCualidad ?? "").trim(),
      notes: "",
      grantedActions: [],
      modifiers: [],
      attackAttribute: undefined
    });
  }

  for (const [index, entry] of (sheet.equipo ?? []).entries()) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    pushItem({
      id: `legacy-equipment-${index + 1}-${slugify(trimmed)}`,
      name: trimmed,
      category: inferInventoryCategory(trimmed),
      quantity: 1,
      stackable: /(racion|antorcha|flecha|virote|vial|pocion|elixir|moneda|thaler)/.test(normalizeName(trimmed)),
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: false,
      slot: "none",
      attackAttribute: undefined,
      damageFormula: "",
      protectionFormula: "",
      qualities: "",
      notes: "",
      grantedActions: [],
      modifiers: []
    });
  }

  for (const [index, artifact] of (sheet.artefactos ?? []).entries()) {
    if (!artifact.nombre.trim()) continue;
    pushItem({
      id: `legacy-artifact-${index + 1}-${slugify(artifact.nombre)}`,
      name: artifact.nombre.trim(),
      category: "artifact",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: artifact.poderes.trim(),
      weight: "",
      value: "",
      equipped: index === 0,
      slot: index === 0 ? "artifact" : "none",
      attackAttribute: undefined,
      damageFormula: "",
      protectionFormula: "",
      qualities: "",
      notes: artifact.corrupcion.trim(),
      grantedActions: [],
      modifiers: []
    });
  }

  return items;
}

function buildLegacyEquipmentSlots(items: z.infer<typeof inventoryItemSchema>[], sheet: z.infer<typeof characterSheetObjectSchema>): z.infer<typeof equipmentSlotsSchema> {
  const findByName = (name: string) => items.find((item) => normalizeName(item.name) === normalizeName(name))?.id ?? "";
  return {
    mainHand: findByName(sheet.combate.armaPrincipal),
    offHand: findByName(sheet.combate.armaSecundaria),
    ranged: findByName(sheet.combate.armaTerciaria) || findByName(sheet.combate.armaCuaternaria),
    armor: findByName(sheet.combate.armadura),
    artifact: items.find((item) => item.slot === "artifact")?.id ?? "",
    worn: ""
  };
}

function synchronizeInventoryEquipment(
  items: z.infer<typeof inventoryItemSchema>[],
  rawSlots: z.infer<typeof equipmentSlotsSchema>
): { inventoryItems: z.infer<typeof inventoryItemSchema>[]; equipmentSlots: z.infer<typeof equipmentSlotsSchema> } {
  type EquipmentSlotKey = Exclude<z.infer<typeof inventoryItemSchema>["slot"], "none">;
  const slotKeys: EquipmentSlotKey[] = ["mainHand", "offHand", "ranged", "armor", "artifact", "worn"];
  const itemIds = new Set(items.map((item) => item.id));
  const equipmentSlots: z.infer<typeof equipmentSlotsSchema> = {
    mainHand: itemIds.has(rawSlots.mainHand) ? rawSlots.mainHand : "",
    offHand: itemIds.has(rawSlots.offHand) ? rawSlots.offHand : "",
    ranged: itemIds.has(rawSlots.ranged) ? rawSlots.ranged : "",
    armor: itemIds.has(rawSlots.armor) ? rawSlots.armor : "",
    artifact: itemIds.has(rawSlots.artifact) ? rawSlots.artifact : "",
    worn: itemIds.has(rawSlots.worn) ? rawSlots.worn : ""
  };

  for (const item of items) {
    if (!item.equipped || item.slot === "none") continue;
    const slot: EquipmentSlotKey = item.slot;
    if (slotKeys.includes(slot) && !equipmentSlots[slot]) {
      equipmentSlots[slot] = item.id;
    }
  }

  const assignedSlots = new Map<string, EquipmentSlotKey>();
  for (const slot of slotKeys) {
    const itemId = equipmentSlots[slot];
    if (itemId) {
      assignedSlots.set(itemId, slot);
    }
  }

  const inventoryItems: z.infer<typeof inventoryItemSchema>[] = items.map((item) => {
    const assignedSlot = assignedSlots.get(item.id);
    if (assignedSlot) {
      return { ...item, equipped: true, slot: assignedSlot as z.infer<typeof inventoryItemSchema>["slot"] };
    }
    return {
      ...item,
      equipped: false,
      slot: "none" as const
    };
  });

  return { inventoryItems, equipmentSlots };
}

function getEquippedInventoryItem(
  items: z.infer<typeof inventoryItemSchema>[],
  equipmentSlots: z.infer<typeof equipmentSlotsSchema>,
  slot: keyof z.infer<typeof equipmentSlotsSchema>
): z.infer<typeof inventoryItemSchema> | null {
  const itemId = equipmentSlots[slot];
  if (!itemId) {
    return null;
  }
  return items.find((item) => item.id === itemId) ?? null;
}

function buildLegacyConditions(sheet: z.infer<typeof characterSheetObjectSchema>): z.infer<typeof conditionSchema>[] {
  const conditions: z.infer<typeof conditionSchema>[] = [];
  if (sheet.corrupcion.temporal > 0 || sheet.corrupcion.permanente > 0) {
    conditions.push({
      id: "legacy-corruption",
      name: "Corrupcion",
      category: "corruption",
      active: true,
      severity: sheet.corrupcion.permanente > 0 ? "major" : "moderate",
      summary: `Temporal ${sheet.corrupcion.temporal} / Permanente ${sheet.corrupcion.permanente}`,
      notes: sheet.corrupcion.notas
    });
  }
  return conditions;
}

function synchronizeAutomaticConditions(
  conditions: z.infer<typeof conditionSchema>[],
  sheet: Pick<z.infer<typeof characterSheetObjectSchema>, "corrupcion">
): z.infer<typeof conditionSchema>[] {
  const manualConditions = conditions.filter((condition) => condition.id !== "legacy-corruption");

  if (sheet.corrupcion.temporal <= 0 && sheet.corrupcion.permanente <= 0) {
    return manualConditions;
  }

  return [
    ...manualConditions,
    {
      id: "legacy-corruption",
      name: "Corrupcion",
      category: "corruption",
      active: true,
      severity: sheet.corrupcion.permanente > 0 ? "major" : "moderate",
      summary: `Temporal ${sheet.corrupcion.temporal} / Permanente ${sheet.corrupcion.permanente}`,
      notes: sheet.corrupcion.notas
    }
  ];
}

function buildLegacyNotesSections(sheet: z.infer<typeof characterSheetObjectSchema>): z.infer<typeof noteSectionsSchema> {
  return {
    general: sheet.notas ?? "",
    background: sheet.identidad.trasfondo ?? "",
    traits: (sheet.rasgos ?? []).join(", "),
    campaign: [sheet.grupo?.nombre ?? "", sheet.grupo?.objetivo ?? "", ...(sheet.contactos ?? [])].filter(Boolean).join("\n")
  };
}

function buildCanonicalActions(sheet: z.infer<typeof characterSheetObjectSchema>): z.infer<typeof canonicalActionEntrySchema>[] {
  const actions: z.infer<typeof canonicalActionEntrySchema>[] = [];

  for (const item of sheet.inventoryItems) {
    if (item.category !== "weapon" || item.quantity <= 0) continue;
    actions.push({
      id: `inventory:${item.id}`,
      label: `Atacar con ${item.name}`,
      sourceType: "weapon",
      sourceName: item.name,
      cost: "combat",
      rollAttribute: item.attackAttribute ?? "diestro",
      damageFormula: item.damageFormula || undefined,
      effectSummary: item.qualities || item.description || "Tirada de ataque desde el inventario.",
      category: "weapon",
      notes: item.notes,
      linkedItemId: item.id
    });
  }

  for (const item of sheet.inventoryItems) {
    const canUseItemActions = item.quantity > 0;
    if (!canUseItemActions) continue;

    for (const action of item.grantedActions ?? []) {
      actions.push({
        id: `item:${item.id}:${action.id}`,
        label: action.label,
        sourceType: item.category === "weapon" ? "weapon" : "ability",
        sourceName: item.name,
        cost: action.cost,
        requiredLevel: action.requiredLevel,
        rollAttribute: action.rollAttribute,
        fixedTarget: action.fixedTarget,
        damageFormula: action.damageFormula,
        effectSummary: action.effectSummary,
        category: item.category,
        notes: item.notes,
        linkedItemId: item.id
      });
    }
  }

  const pushRatedActions = (
    sourceType: "ability" | "power" | "ritual",
    entries: z.infer<typeof ratedEntrySchema>[] | undefined
  ): void => {
    for (const entry of entries ?? []) {
      if (sourceType === "ability" && normalizeName(entry.nombre) === "combate sin armas") {
        continue;
      }

      const entryActions = entry.acciones ?? [];
      if (entryActions.length > 0) {
        for (const action of entryActions) {
          if (!isRatedActionAvailableForEntryLevel(entry.nivel, action.requiredLevel)) {
            continue;
          }
          actions.push({
            id: `${sourceType}:${entry.nombre}:${action.id}`,
            label: action.label,
            sourceType,
            sourceName: entry.nombre,
            cost: action.cost,
            requiredLevel: action.requiredLevel ?? inferRatedActionLevel(action.id, action.label, entry.nombre),
            rollAttribute: action.rollAttribute,
            fixedTarget: action.fixedTarget,
            damageFormula: action.damageFormula,
            effectSummary: action.effectSummary,
            category: sourceType,
            notes: entry.notas,
            linkedItemId: ""
          });
        }
      } else {
        const fallbackAction = inferCanonicalFallbackAction(sourceType, entry.nombre, entry.nivel, entry.efecto || entry.notas, entry.notas);
        if (fallbackAction) {
          actions.push(fallbackAction);
        }
      }
    }
  };

  pushRatedActions("ability", sheet.habilidades);
  pushRatedActions("power", sheet.poderesMisticos);
  pushRatedActions("ritual", sheet.rituales);

  const combateSinArmas = sheet.habilidades.find((entry) => normalizeName(entry.nombre) === "combate sin armas");
  const baseUnarmedDamage = !combateSinArmas ? "1d4" : combateSinArmas.nivel === "maestro" ? "2d6" : "1d6";
  actions.push({
    id: "ability:combate-sin-armas:base",
    label: "Ataque desarmado",
    sourceType: "weapon",
    sourceName: combateSinArmas ? "Combate sin armas" : "Ataque basico",
    cost: "combat",
    requiredLevel: combateSinArmas?.nivel,
    rollAttribute: "diestro",
    damageFormula: baseUnarmedDamage,
    effectSummary: !combateSinArmas
      ? "Ataque desarmado basico disponible para cualquier personaje."
      : combateSinArmas.nivel === "adepto"
        ? "Ataque desarmado base. Combate sin armas permite resolver por separado un segundo ataque contra el mismo objetivo."
        : combateSinArmas.nivel === "maestro"
          ? "Ataque desarmado base mejorado por Combate sin armas. Los ataques desarmados infligen 2d6."
          : "Ataque desarmado base de Combate sin armas.",
    category: "ability",
    notes: combateSinArmas?.notas ?? "",
    linkedItemId: ""
  });

  const naturalWeaponLevel = getTraitLevelForCanonicalActions(sheet, "arma natural");
  if (naturalWeaponLevel > 0) {
    actions.push({
      id: `trait:arma-natural:${naturalWeaponLevel}`,
      label: "Ataque con Arma natural",
      sourceType: "weapon",
      sourceName: "Arma natural",
      cost: "combat",
      rollAttribute: "diestro",
      damageFormula: getNaturalWeaponCharacterDamage(naturalWeaponLevel),
      effectSummary: "Ataque cuerpo a cuerpo realizado con las armas naturales del personaje.",
      category: "ability",
      notes: "",
      linkedItemId: ""
    });
  }

  return actions;
}

function normalizeActionFavorites(favorites: string[] | undefined): string[] {
  return Array.from(new Set((favorites ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean))).slice(0, 80);
}

function getTraitLevelForCanonicalActions(sheet: z.infer<typeof characterSheetObjectSchema>, traitName: string): number {
  const target = normalizeName(traitName);
  const ratedAbilityLevel = (sheet.habilidades ?? [])
    .filter((entry) => normalizeName(entry.nombre) === target || normalizeName(entry.nombre).startsWith(`${target} `) || normalizeName(entry.nombre).startsWith(`${target} (`))
    .reduce((highest, entry) => Math.max(highest, entry.nivel === "maestro" ? 3 : entry.nivel === "adepto" ? 2 : 1), 0);
  if (ratedAbilityLevel > 0) {
    return ratedAbilityLevel;
  }
  const traitSources = [
    ...(sheet.rasgos ?? []),
    ...String(sheet.noteSections?.traits ?? "")
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  ];

  for (const rawTrait of traitSources) {
    const normalized = normalizeName(rawTrait);
    if (!normalized.startsWith(target)) {
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

function getNaturalWeaponCharacterDamage(level: number): string {
  switch (level) {
    case 3:
      return "1d10";
    case 2:
      return "1d8";
    case 1:
      return "1d6";
    default:
      return "1d4";
  }
}

function convertTraitBonusToPlayerRoll(value: number): string {
  switch (value) {
    case 2:
      return "+1d4";
    case 3:
      return "+1d6";
    default:
      return value >= 0 ? `+${value}` : String(value);
  }
}

function combineCanonicalDamageFormula(base: string, bonus: string): string {
  const normalizedBase = base.trim().toLowerCase();
  const normalizedBonus = bonus.trim().toLowerCase();
  if (!normalizedBonus) {
    return normalizedBase;
  }

  return normalizedBonus.startsWith("+") || normalizedBonus.startsWith("-")
    ? `${normalizedBase}${normalizedBonus}`
    : `${normalizedBase}+${normalizedBonus}`;
}

function inferCanonicalFallbackAction(
  sourceType: "ability" | "power" | "ritual",
  sourceName: string,
  entryLevel: z.infer<typeof skillLevelSchema>,
  text: string,
  notes: string
): z.infer<typeof canonicalActionEntrySchema> | null {
  const trimmedText = String(text ?? "").trim();
  const normalized = normalizeName(trimmedText);
  if (!trimmedText || normalized.startsWith("pasiva.")) {
    return null;
  }

  let cost: z.infer<typeof actionCostSchema> | null = null;
  if (normalized.startsWith("reaccion.") || normalized.startsWith("reaccion ")) {
    cost = "reaction";
  } else if (normalized.startsWith("activa.") || normalized.startsWith("activa ") || normalized.includes("accion de combate") || normalized.includes("accion de combate")) {
    cost = "combat";
  } else if (normalized.includes("accion de movimiento") || normalized.includes("accion de movimiento")) {
    cost = "movement";
  }

  if (!cost) {
    return null;
  }

  return {
    id: `${sourceType}:${sourceName}:fallback`,
    label: `Usar ${sourceName}`,
    sourceType,
    sourceName,
    cost,
    requiredLevel: entryLevel,
    rollAttribute: undefined,
    damageFormula: undefined,
    effectSummary: trimmedText,
    category: sourceType,
    notes,
    linkedItemId: ""
  };
}

function isRatedActionAvailableForEntryLevel(
  entryLevel: z.infer<typeof skillLevelSchema>,
  requiredLevel?: z.infer<typeof skillLevelSchema>
): boolean {
  if (!requiredLevel) {
    return true;
  }

  return entryLevel === requiredLevel;
}

function inferRatedActionLevel(...values: string[]): z.infer<typeof skillLevelSchema> | undefined {
  const joined = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (joined.includes("maestro")) return "maestro";
  if (joined.includes("adepto")) return "adepto";
  if (joined.includes("novato")) return "novato";
  return undefined;
}

function skillLevelRank(level: z.infer<typeof skillLevelSchema>): number {
  switch (level) {
    case "maestro":
      return 2;
    case "adepto":
      return 1;
    default:
      return 0;
  }
}

const CANONICAL_RATED_ENTRIES = {
  ability: new Map(SYMBAROUM_ABILITIES.map((entry) => [normalizeName(entry.nombre), entry])),
  power: new Map(SYMBAROUM_MYSTIC_POWERS.map((entry) => [normalizeName(entry.nombre), entry])),
  ritual: new Map(SYMBAROUM_RITUALS.map((entry) => [normalizeName(entry.nombre), entry]))
} as const;

function sanitizeImportedRatedEntry(entry: unknown): z.infer<typeof ratedEntrySchema> | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const candidate = entry as Record<string, unknown>;
  const nombre = String(candidate.nombre ?? "").trim();
  const nivelRaw = String(candidate.nivel ?? "").trim().toLowerCase();
  const nivel = nivelRaw === "novato" || nivelRaw === "adepto" || nivelRaw === "maestro" ? nivelRaw : "novato";

  const acciones = Array.isArray(candidate.acciones) ? candidate.acciones.filter((action) => action && typeof action === "object") : [];

  return {
    nombre: truncateImportedString(nombre, 120),
    tipo: truncateImportedString(candidate.tipo, 120),
    efecto: truncateImportedString(candidate.efecto, 1200),
    nivel,
    fuente: truncateImportedString(candidate.fuente, 120),
    pagina: typeof candidate.pagina === "number" && Number.isInteger(candidate.pagina) ? candidate.pagina : undefined,
    notas: truncateImportedString(candidate.notas, 800),
    acciones: acciones as z.infer<typeof actionMetadataSchema>[]
  };
}

function hydrateRatedEntryActions(
  entries: z.infer<typeof ratedEntrySchema>[] | undefined,
  sourceType: "ability" | "power" | "ritual"
): z.infer<typeof ratedEntrySchema>[] {
  const canonicalEntries = CANONICAL_RATED_ENTRIES[sourceType];
  return (entries ?? [])
    .map((entry) => sanitizeImportedRatedEntry(entry))
    .filter((entry): entry is z.infer<typeof ratedEntrySchema> => entry !== null && Boolean(entry?.nombre))
    .map((entry) => {
      const canonicalEntry = canonicalEntries.get(normalizeName(entry.nombre));
      const actions = Array.isArray(entry.acciones) ? entry.acciones : [];

      return {
        ...entry,
        nombre: truncateImportedString(canonicalEntry?.nombre || entry.nombre, 120),
        tipo: truncateImportedString(canonicalEntry?.tipo || entry.tipo || "", 120),
        efecto: truncateImportedString(canonicalEntry?.efectoResumen || entry.efecto || "", 1200),
        fuente: truncateImportedString(canonicalEntry?.libro || entry.fuente || "", 120),
        pagina: canonicalEntry?.pagina ?? entry.pagina,
        notas: truncateImportedString(canonicalEntry?.efectoResumen || entry.notas || entry.efecto || "", 800),
        acciones: canonicalEntry?.acciones.map((action) => ({ ...action })) ?? (actions.length > 0 ? actions : [])
      };
    });
}

function normalizeRatedEntries(
  entries: z.infer<typeof ratedEntrySchema>[] | undefined,
  sourceType: "ability" | "power" | "ritual"
): z.infer<typeof ratedEntrySchema>[] {
  const merged = new Map<string, z.infer<typeof ratedEntrySchema>>();

  for (const entry of hydrateRatedEntryActions(entries, sourceType)) {
    const key = normalizeName(entry.nombre);
    if (sourceType === "ability" && NORMALIZED_SHEET_HIDDEN_ABILITY_NAMES.includes(key)) {
      continue;
    }
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...entry });
      continue;
    }

    const useIncoming = skillLevelRank(entry.nivel) >= skillLevelRank(existing.nivel);
    merged.set(key, {
      ...existing,
      ...entry,
      nombre: existing.nombre || entry.nombre,
      tipo: existing.tipo || entry.tipo,
      fuente: useIncoming ? (entry.fuente || existing.fuente) : (existing.fuente || entry.fuente),
      pagina: useIncoming ? (entry.pagina ?? existing.pagina) : (existing.pagina ?? entry.pagina),
      nivel: useIncoming ? entry.nivel : existing.nivel,
      efecto: useIncoming ? (entry.efecto || existing.efecto) : (existing.efecto || entry.efecto),
      notas: useIncoming ? (entry.notas || existing.notas) : (existing.notas || entry.notas),
      acciones: useIncoming
        ? (entry.acciones.length > 0 ? entry.acciones : existing.acciones)
        : (existing.acciones.length > 0 ? existing.acciones : entry.acciones)
    });
  }

  return [...merged.values()];
}

function truncateImportedString(value: unknown, maxLength: number): string {
  return String(value ?? "").slice(0, maxLength);
}

function sanitizeRawRatedEntryCollection(entries: unknown): z.infer<typeof ratedEntrySchema>[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => {
      const candidate = entry as Record<string, unknown>;
      const acciones = Array.isArray(candidate.acciones)
        ? candidate.acciones
            .filter((action) => action && typeof action === "object" && !Array.isArray(action))
            .map((action) => {
              const actionCandidate = action as Record<string, unknown>;
              return {
                ...actionCandidate,
                id: truncateImportedString(actionCandidate.id, 120),
                label: truncateImportedString(actionCandidate.label, 120),
                damageFormula: truncateImportedString(actionCandidate.damageFormula, 80),
                effectSummary: truncateImportedString(actionCandidate.effectSummary, 400)
              };
            })
        : [];

      return {
        ...candidate,
        nombre: truncateImportedString(candidate.nombre, 120),
        tipo: truncateImportedString(candidate.tipo, 120),
        efecto: truncateImportedString(candidate.efecto, 1200),
        fuente: truncateImportedString(candidate.fuente, 120),
        notas: truncateImportedString(candidate.notas, 800),
        acciones
      };
    }) as z.infer<typeof ratedEntrySchema>[];
}

function migrateCharacterSheetInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const candidate = structuredClone(input) as z.infer<typeof characterSheetObjectSchema>;
  candidate.habilidades = sanitizeRawRatedEntryCollection(candidate.habilidades);
  candidate.poderesMisticos = sanitizeRawRatedEntryCollection(candidate.poderesMisticos);
  candidate.rituales = sanitizeRawRatedEntryCollection(candidate.rituales);
  const rawInventoryItems = Array.isArray(candidate.inventoryItems) && candidate.inventoryItems.length > 0
    ? candidate.inventoryItems
    : buildLegacyInventoryItems(candidate);
  const inventoryItemsWithoutNaturalPlaceholder = stripNaturalArmorPlaceholderItems(rawInventoryItems, candidate);
  const rawEquipmentSlots = candidate.equipmentSlots
    ? {
        mainHand: candidate.equipmentSlots.mainHand ?? "",
        offHand: candidate.equipmentSlots.offHand ?? "",
        ranged: candidate.equipmentSlots.ranged ?? "",
        armor: candidate.equipmentSlots.armor ?? "",
        artifact: candidate.equipmentSlots.artifact ?? "",
        worn: candidate.equipmentSlots.worn ?? ""
      }
    : buildLegacyEquipmentSlots(inventoryItemsWithoutNaturalPlaceholder, candidate);
  const { inventoryItems, equipmentSlots } = synchronizeInventoryEquipment(inventoryItemsWithoutNaturalPlaceholder, rawEquipmentSlots);
  const noteSections = candidate.noteSections
    ? {
        general: candidate.noteSections.general ?? candidate.notas ?? "",
        background: candidate.noteSections.background ?? candidate.identidad?.trasfondo ?? "",
        traits: candidate.noteSections.traits ?? (candidate.rasgos ?? []).join(", "),
        campaign: candidate.noteSections.campaign ?? ""
      }
    : buildLegacyNotesSections(candidate);
  const personalNotes = normalizeCharacterNoteEntries(candidate.personalNotes);
  const effectivePersonalNotes = personalNotes.length > 0 ? personalNotes : buildLegacyCharacterNoteEntries({
    noteSections,
    notas: candidate.notas ?? ""
  });
  const migratedMonsterTraitAbilities = buildMonsterTraitAbilityEntries(candidate.rasgos, candidate.habilidades);
  const habilidades = normalizeRatedEntries([...(candidate.habilidades ?? []), ...migratedMonsterTraitAbilities], "ability");
  const poderesMisticos = normalizeRatedEntries(candidate.poderesMisticos, "power");
  const rituales = normalizeRatedEntries(candidate.rituales, "ritual");
  const syncedRobustezMax = getEffectiveCharacterRobustezMax(candidate);
  const previousRobustezMax = Number(candidate.combate?.robustezMax ?? syncedRobustezMax);
  const previousRobustezActual = Number(candidate.combate?.robustezActual ?? syncedRobustezMax);
  const syncedRobustezActual = previousRobustezActual === previousRobustezMax && previousRobustezMax < syncedRobustezMax
    ? syncedRobustezMax
    : Math.min(previousRobustezActual, syncedRobustezMax);

  return {
    ...candidate,
    rasgos: filterCharacterNonMonsterTraits(candidate.rasgos),
    habilidades,
    poderesMisticos,
    rituales,
    combate: {
      ...candidate.combate,
      armadura: getEquippedInventoryItem(inventoryItems, equipmentSlots, "armor")?.name
        ?? (hasCharacterTraitBasedNaturalArmor(candidate) && isNaturalArmorPlaceholderName(candidate.combate?.armadura ?? "") ? "" : candidate.combate.armadura),
      armaduraProteccion: getEquippedInventoryItem(inventoryItems, equipmentSlots, "armor")?.protectionFormula
        ?? (hasCharacterTraitBasedNaturalArmor(candidate) && isNaturalArmorPlaceholderName(candidate.combate?.armadura ?? "") ? "" : candidate.combate.armaduraProteccion),
      armaduraCualidad: getEquippedInventoryItem(inventoryItems, equipmentSlots, "armor")?.qualities ?? candidate.combate.armaduraCualidad,
      robustezMax: syncedRobustezMax,
      robustezActual: syncedRobustezActual
    },
    inventoryItems,
    equipmentSlots,
    conditions: synchronizeAutomaticConditions(
      Array.isArray(candidate.conditions) && candidate.conditions.length > 0 ? candidate.conditions : buildLegacyConditions(candidate),
      candidate
    ),
    personalNotes: effectivePersonalNotes,
    noteSections,
    actionFavorites: normalizeActionFavorites(candidate.actionFavorites),
    actions: Array.isArray(candidate.actions) && candidate.actions.length > 0 ? candidate.actions : buildCanonicalActions({
      ...candidate,
      habilidades,
      poderesMisticos,
      rituales,
      inventoryItems,
      equipmentSlots,
      conditions: synchronizeAutomaticConditions(
        Array.isArray(candidate.conditions) ? candidate.conditions : buildLegacyConditions(candidate),
        candidate
      ),
      noteSections
    } as z.infer<typeof characterSheetObjectSchema>)
  };
}

function buildSynchronizedCharacterSheet(input: CharacterSheet): CharacterSheet {
  const syncedRobustezMax = getEffectiveCharacterRobustezMax(input);
  const migratedMonsterTraitAbilities = buildMonsterTraitAbilityEntries(input.rasgos, input.habilidades);
  const habilidades = normalizeRatedEntries([...(input.habilidades ?? []), ...migratedMonsterTraitAbilities], "ability");
  const poderesMisticos = normalizeRatedEntries(input.poderesMisticos, "power");
  const rituales = normalizeRatedEntries(input.rituales, "ritual");
  const inventoryItemsWithoutNaturalPlaceholder = stripNaturalArmorPlaceholderItems(input.inventoryItems, input);
  const syncedEquipment = synchronizeInventoryEquipment(inventoryItemsWithoutNaturalPlaceholder, input.equipmentSlots);
  const personalNotes = normalizeCharacterNoteEntries(input.personalNotes);
  const effectivePersonalNotes = personalNotes.length > 0 ? personalNotes : buildLegacyCharacterNoteEntries({
    noteSections: input.noteSections,
    notas: input.notas
  });
  const serializedPersonalNotes = effectivePersonalNotes
    .map((entry) => `## ${entry.title}\n\n${entry.content}`.trim())
    .filter(Boolean)
    .join("\n\n");
  const legacyCompatible = {
    ...input,
    rasgos: filterCharacterNonMonsterTraits(input.rasgos),
    habilidades,
    poderesMisticos,
    rituales,
    combate: {
      ...input.combate,
      armadura: getEquippedInventoryItem(syncedEquipment.inventoryItems, syncedEquipment.equipmentSlots, "armor")?.name
        ?? (hasCharacterTraitBasedNaturalArmor(input) && isNaturalArmorPlaceholderName(input.combate.armadura ?? "") ? "" : input.combate.armadura),
      armaduraProteccion: getEquippedInventoryItem(syncedEquipment.inventoryItems, syncedEquipment.equipmentSlots, "armor")?.protectionFormula
        ?? (hasCharacterTraitBasedNaturalArmor(input) && isNaturalArmorPlaceholderName(input.combate.armadura ?? "") ? "" : input.combate.armaduraProteccion),
      armaduraCualidad: getEquippedInventoryItem(syncedEquipment.inventoryItems, syncedEquipment.equipmentSlots, "armor")?.qualities ?? input.combate.armaduraCualidad,
      robustezMax: syncedRobustezMax,
      robustezActual: Math.min(input.combate.robustezActual, syncedRobustezMax)
    },
    noteSections: {
      ...input.noteSections,
      general: serializedPersonalNotes || input.noteSections.general || input.notas || "",
      background: input.noteSections.background || input.identidad.trasfondo || "",
      traits: input.noteSections.traits || input.rasgos.join(", "),
      campaign: input.noteSections.campaign
    },
    notas: serializedPersonalNotes || input.notas || "",
    personalNotes: effectivePersonalNotes,
    conditions: synchronizeAutomaticConditions(input.conditions, input),
    ...syncedEquipment
  };
  const autoActions = buildCanonicalActions(legacyCompatible);
  const manualUtilityActions = input.actions.filter((action) => action.sourceType === "utility");
  return {
    ...input,
    habilidades,
    poderesMisticos,
    rituales,
    inventoryItems: syncedEquipment.inventoryItems,
    equipmentSlots: syncedEquipment.equipmentSlots,
    personalNotes: effectivePersonalNotes,
    noteSections: legacyCompatible.noteSections,
    actionFavorites: normalizeActionFavorites(input.actionFavorites),
    actions: [...manualUtilityActions, ...autoActions]
  };
}

export type CharacterSheet = z.infer<typeof characterSheetSchema>;

export const importedCharacterSheetSchema = characterSheetObjectSchema.superRefine((sheet, ctx) => {
  if (sheet.progreso.experienciaGastada > getEffectiveExperienceTotal(sheet)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["progreso", "experienciaGastada"],
      message: "La experiencia gastada no puede ser mayor que la experiencia total ajustada por cargas"
    });
  }

  const robustezMax = getEffectiveCharacterRobustezMax(sheet);
  if (sheet.combate.robustezActual > robustezMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["combate", "robustezActual"],
      message: "La robustez actual no puede superar la robustez máxima"
    });
  }

});

export function createEmptyCharacterSheet(): CharacterSheet {
  return {
    identidad: {
      nombrePersonaje: "",
      nombreJugador: "",
      esFamiliar: false,
      raza: "Humano",
      cultura: "Ambriano",
      arquetipo: "Guerrero",
      profesion: "",
      sombra: "",
      cita: "",
      edad: "",
      altura: "",
      peso: "",
      apariencia: "",
      objetivoPersonal: "",
      trasfondo: ""
    },
    atributos: {
      agil: 10,
      atento: 10,
      discreto: 10,
      diestro: 10,
      fuerte: 10,
      inteligente: 10,
      persuasivo: 10,
      tenaz: 10
    },
    progreso: {
      nivel: 1,
      experienciaTotal: 0,
      experienciaGastada: 0
    },
    combate: {
      robustezMax: 10,
      robustezActual: 10,
      umbralDolor: 5,
      defensaMod: 0,
      defensaBase: "",
      iniciativaMod: 0,
      armadura: "",
      armaduraProteccion: "",
      armaduraCualidad: "",
      armaduraSecundaria: "",
      armaduraSecundariaProteccion: "",
      armaPrincipal: "",
      armaPrincipalCualidad: "",
      armaPrincipalAtributo: "",
      armaSecundaria: "",
      armaSecundariaAtributo: "",
      armaTerciaria: "",
      armaTerciariaCualidad: "",
      armaTerciariaAtributo: "",
      armaCuaternaria: "",
      armaCuaternariaCualidad: "",
      armaCuaternariaAtributo: "",
      danioPrincipal: "",
      danioSecundaria: "",
      danioTerciaria: "",
      danioCuaternaria: ""
        },
        corrupcion: {
            temporal: 0,
            permanente: 0,
            umbral: 5,
            notas: ""
        },
        bendiciones: [],
        cargas: [],
        rasgos: [],
        habilidades: [],
        poderesMisticos: [],
    rituales: [],
    equipo: [],
    contactos: [],
    recursos: {
      dinero: "",
      otros: ""
    },
    grupo: {
      nombre: "",
      objetivo: ""
    },
    contactosHoja: Array.from({ length: 5 }, () => ({
      nombre: "",
      raza: "",
      ocupacion: "",
      jugador: ""
    })),
    artefactos: Array.from({ length: 4 }, () => ({
      nombre: "",
      poderes: "",
      corrupcion: ""
    })),
    actionFavorites: [],
    actions: [],
    inventoryItems: [],
    equipmentSlots: {
      mainHand: "",
      offHand: "",
      ranged: "",
      armor: "",
      artifact: "",
      worn: ""
    },
    conditions: [],
    personalNotes: [],
    noteSections: {
      general: "",
      background: "",
      traits: "",
      campaign: ""
    },
    referencias: [],
    notas: ""
  };
}

export function parseCharacterSheet(input: unknown): CharacterSheet {
  return importedCharacterSheetSchema.parse(migrateCharacterSheetInput(input));
}

export function synchronizeCharacterSheet(input: CharacterSheet): CharacterSheet {
  return importedCharacterSheetSchema.parse(buildSynchronizedCharacterSheet(parseCharacterSheet(input)));
}

export const npcDepthSchema = z.enum(["notes", "stat_block", "full_sheet"]);
const npcLabelSchema = z.string().min(1).max(80);

export type NpcDepth = z.infer<typeof npcDepthSchema>;

export const createNpcSchema = z.object({
  name: z.string().min(2).max(120),
  depth: npcDepthSchema.default("notes"),
  race: z.string().max(80).default(""),
  archetype: z.string().max(80).default(""),
  occupation: z.string().max(120).default(""),
  faction: z.string().max(120).default(""),
  labels: z.array(npcLabelSchema).max(20).default([]),
  summary: z.string().max(500).default(""),
  notes: z.string().max(4000).default(""),
  statBlock: monsterSheetSchema.nullable().default(null),
  sheet: importedCharacterSheetSchema.nullable().default(null)
});

export const updateNpcSchema = createNpcSchema.partial();

export type CreateNpcInput = z.infer<typeof createNpcSchema>;
export type UpdateNpcInput = z.infer<typeof updateNpcSchema>;

export type Npc = {
  id: string;
  name: string;
  depth: NpcDepth;
  race: string;
  archetype: string;
  occupation: string;
  faction: string;
  labels: string[];
  summary: string;
  notes: string;
  statBlock: MonsterSheet | null;
  sheet: CharacterSheet | null;
  createdAt: string;
  updatedAt: string;
};

export function createNpcSheetSeed(input: Pick<CreateNpcInput, "name" | "race" | "archetype" | "occupation" | "summary" | "notes">): CharacterSheet {
  const sheet = createEmptyCharacterSheet();
  return synchronizeCharacterSheet({
    ...sheet,
    identidad: {
      ...sheet.identidad,
      nombrePersonaje: input.name.trim(),
      raza: input.race.trim() || "Humano",
      arquetipo: input.archetype.trim() || "Guerrero",
      profesion: input.occupation.trim(),
      apariencia: input.summary.trim(),
      trasfondo: input.notes.trim()
    }
  });
}

export function createEmptyNpcInput(): CreateNpcInput {
  return {
    name: "",
    depth: "notes",
    race: "",
    archetype: "",
    occupation: "",
    faction: "",
    labels: [],
    summary: "",
    notes: "",
    statBlock: null,
    sheet: null
  };
}

export const createCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  archetype: z.string().min(2).max(80),
  race: z.string().min(2).max(80),
  culture: z.string().max(80).default(""),
  profession: z.string().max(120).default(""),
  level: z.literal(1),
  sheet: characterSheetSchema
});

export const importCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  archetype: z.string().min(2).max(80),
  race: z.string().min(2).max(80),
  culture: z.string().max(80).default(""),
  profession: z.string().max(120).default(""),
  level: z.literal(1),
  sheet: importedCharacterSheetSchema
});

export const updateCharacterSchema = createCharacterSchema.partial().extend({
  sheet: importedCharacterSheetSchema
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type ImportCharacterInput = z.infer<typeof importCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;

export type Character = {
  id: string;
  name: string;
  archetype: string;
  race: string;
  culture: string;
  profession: string;
  level: number;
  sheet: CharacterSheet;
  createdAt: string;
  updatedAt: string;
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128)
  })
  .superRefine((payload, ctx) => {
    if (payload.currentPassword === payload.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "La nueva contrasena debe ser distinta de la actual"
      });
    }
  });

export const requestPasswordResetSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(400),
  newPassword: z.string().min(8).max(128)
});

export const createManagedUserSchema = z.object({
  email: z.string().trim().email(),
  role: registerRoleSchema
});

export const deactivateManagedUserSchema = z.object({
  reason: adminDeactivationReasonSchema,
  explanation: z.string().trim().min(10).max(500)
});

export const adminUserListQuerySchema = z.object({
  query: z.string().trim().max(160).default(""),
  role: z.union([registerRoleSchema, z.literal("all")]).default("all"),
  status: z.union([accountStatusSchema, z.literal("all")]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const campaignMemberRoleSchema = z.enum(["gm", "player"]);
export const campaignSessionStatusSchema = z.enum(["planned", "completed", "cancelled"]);
export const campaignReferenceVisibilitySchema = z.enum(["gm_only", "campaign", "selected_players"]);

export const createCampaignSchema = z.object({
  name: z.string().min(3).max(120),
  summary: z.string().max(400).default(""),
  setting: z.string().max(200).default(""),
  notes: z.string().max(4000).default(""),
  sharedNotes: z.string().max(6000).default(""),
  sharedNoteEntries: z.array(campaignSharedNoteEntrySchema).max(200).default([])
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const addCampaignMemberSchema = z.object({
  email: z.string().email()
});

export const linkCampaignCharacterSchema = z.object({
  characterId: z.string().uuid()
});

export const createCampaignNpcSchema = z.object({
  name: z.string().min(2).max(120),
  race: z.string().max(80).default(""),
  archetype: z.string().max(80).default(""),
  occupation: z.string().max(120).default(""),
  threat: z.string().max(80).default(""),
  summary: z.string().max(500).default(""),
  notes: z.string().max(3000).default(""),
  statBlock: z.string().max(1200).default(""),
  isGenerated: z.boolean().default(false)
});

export const updateCampaignNpcSchema = createCampaignNpcSchema.partial();
export const updateCampaignCharacterSheetSchema = z.object({
  sheet: characterSheetSchema
});
export const updateCampaignNpcSheetSchema = z.object({
  sheet: characterSheetSchema.nullable()
});

export const grantCampaignExperienceSchema = z.object({
  characterId: z.string().uuid(),
  amount: z.number().int().min(1).max(1000),
  reason: z.string().min(2).max(300)
});

export const createCampaignSessionSchema = z.object({
  title: z.string().min(3).max(160),
  scheduledFor: z.string().datetime(),
  location: z.string().max(160).default(""),
  summary: z.string().max(500).default(""),
  publicNotes: z.string().max(4000).default(""),
  dmNotes: z.string().max(4000).default(""),
  status: campaignSessionStatusSchema.default("planned")
});

export const updateCampaignSessionSchema = createCampaignSessionSchema.partial();

export const assignCampaignSessionExperienceSchema = z.object({
  awards: z
    .array(
      z.object({
        characterId: z.string().uuid(),
        amount: z.number().int().min(0).max(1000)
      })
    )
    .min(1)
    .max(50)
});

export const executeCampaignCharacterActionSchema = z.object({
  characterId: z.string().uuid(),
  actionId: z.string().min(1).max(120),
  phase: z.enum(["attack", "damage"]).default("attack"),
  damageVariantId: z.string().min(1).max(120).optional(),
  note: z.string().max(1000).default("")
});

export const createCampaignChatMessageSchema = z
  .object({
    characterId: z.string().uuid().optional(),
    visibility: campaignChatVisibilitySchema.default("all"),
    text: z.string().max(2000).default(""),
    actionExecution: executeCampaignCharacterActionSchema.optional()
  })
  .superRefine((payload, ctx) => {
    if (!payload.text.trim() && !payload.actionExecution) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "El mensaje debe incluir texto o una accion ejecutada"
      });
    }
  });

export const createCampaignReferenceSchema = z.object({
  name: z.string().min(2).max(120),
  label: z.string().max(80).default(""),
  aliases: z.array(z.string().min(1).max(120)).max(20).default([]),
  summary: z.string().max(300).default(""),
  content: z.string().max(6000).default(""),
  visibility: campaignReferenceVisibilitySchema.default("campaign"),
  sharedWithUserIds: z.array(z.string().uuid()).max(50).default([])
});

export const compendiumEntryIdSchema = z.string().trim().min(1).max(200);

export const setCompendiumFavoriteSchema = z.object({
  favorite: z.boolean()
}).strict();

export type CompendiumLibraryState = {
  favoriteEntryIds: string[];
  recentEntryIds: string[];
};

export type SetCompendiumFavoriteInput = z.infer<typeof setCompendiumFavoriteSchema>;

export const updateCampaignReferenceSchema = createCampaignReferenceSchema.partial();

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateManagedUserInput = z.infer<typeof createManagedUserSchema>;
export type DeactivateManagedUserInput = z.infer<typeof deactivateManagedUserSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type CampaignMemberRole = z.infer<typeof campaignMemberRoleSchema>;
export type CampaignSessionStatus = z.infer<typeof campaignSessionStatusSchema>;
export type CampaignReferenceVisibility = z.infer<typeof campaignReferenceVisibilitySchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type AddCampaignMemberInput = z.infer<typeof addCampaignMemberSchema>;
export type LinkCampaignCharacterInput = z.infer<typeof linkCampaignCharacterSchema>;
export type CreateCampaignNpcInput = z.infer<typeof createCampaignNpcSchema>;
export type UpdateCampaignNpcInput = z.infer<typeof updateCampaignNpcSchema>;
export type UpdateCampaignCharacterSheetInput = z.infer<typeof updateCampaignCharacterSheetSchema>;
export type UpdateCampaignNpcSheetInput = z.infer<typeof updateCampaignNpcSheetSchema>;
export type GrantCampaignExperienceInput = z.infer<typeof grantCampaignExperienceSchema>;
export type CreateCampaignSessionInput = z.infer<typeof createCampaignSessionSchema>;
export type UpdateCampaignSessionInput = z.infer<typeof updateCampaignSessionSchema>;
export type AssignCampaignSessionExperienceInput = z.infer<typeof assignCampaignSessionExperienceSchema>;
export type CreateCampaignReferenceInput = z.infer<typeof createCampaignReferenceSchema>;
export type UpdateCampaignReferenceInput = z.infer<typeof updateCampaignReferenceSchema>;
export type ExecuteCampaignCharacterActionInput = z.infer<typeof executeCampaignCharacterActionSchema>;
export type CreateCampaignChatMessageInput = z.infer<typeof createCampaignChatMessageSchema>;

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  mustChangePassword: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  role: RegisterRole;
  status: AccountStatus;
  mustChangePassword: boolean;
  createdAt: string;
  deactivatedAt: string | null;
  activeRefreshTokens: number;
  notificationAttention: boolean;
};

export type AdminUserCounts = {
  active: number;
  pending: number;
  deactivated: number;
  notificationAttention: number;
};

export type AdminUserList = {
  items: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: AdminUserCounts;
};

export type AdminAccountEvent = {
  id: string;
  action: AdminAccountAction;
  actorEmail: string;
  targetEmail: string;
  reason: AdminDeactivationReason | null;
  explanation: string;
  notificationStatus: AdminNotificationStatus;
  notificationAttempts: number;
  notificationLastAttemptAt: string | null;
  createdAt: string;
};

export type AdminAccountMutationResult = {
  user: AdminUserSummary;
  event: AdminAccountEvent;
};

export type SupportUser = AdminUserSummary;

export type CampaignMember = {
  id: string;
  userId: string;
  email: string;
  role: CampaignMemberRole;
  joinedAt: string;
};

export type CampaignCharacter = {
  id: string;
  characterId: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  experienceTotal: number;
  experienceSpent: number;
  sheet: CharacterSheet | null;
  updatedAt: string;
};

export type CampaignAvailableCharacter = {
  characterId: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  experienceTotal: number;
  experienceSpent: number;
  linked: boolean;
};

export type CampaignNpc = {
  id: string;
  name: string;
  race: string;
  archetype: string;
  occupation: string;
  threat: string;
  summary: string;
  notes: string;
  statBlock: string;
  sheet: CharacterSheet | null;
  isGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampaignExperienceLog = {
  id: string;
  sessionId: string | null;
  characterId: string;
  characterName: string;
  grantedById: string;
  grantedByEmail: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type CampaignSession = {
  id: string;
  title: string;
  scheduledFor: string;
  location: string;
  summary: string;
  publicNotes: string;
  dmNotes: string;
  status: CampaignSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type CampaignReference = {
  id: string;
  name: string;
  label: string;
  aliases: string[];
  summary: string;
  content: string;
  authorId: string;
  authorEmail: string;
  visibility: CampaignReferenceVisibility;
  sharedWithUserIds: string[];
  sharedWithEmails: string[];
  createdAt: string;
  updatedAt: string;
};

export type CharacterActionDefinition = {
  id: string;
  label: string;
  sourceType: "weapon" | "ability" | "power" | "ritual";
  sourceName: string;
  cost: ActionCost;
  requiredLevel?: SkillLevel;
  rollAttribute?: AttributeKey;
  fixedTarget?: number;
  damageFormula?: string;
  damageModifiers?: Array<{
    id: string;
    label: string;
    formula: string;
  }>;
  damageBreakdown?: Array<{
    label: string;
    formula?: string;
    detail?: string;
  }>;
  effectSummary: string;
};

export type CharacterActionPhase = "attack" | "damage";

export type RollDestination = "umbra" | "roll20" | "both";

export type RollRequest = {
  destination: RollDestination;
  kind: "attack" | "check" | "damage";
  phase: CharacterActionPhase;
  characterName: string;
  actionId: string;
  actionLabel: string;
  sourceName: string;
  sourceType: "weapon" | "ability" | "power" | "ritual";
  formula: string;
  selectedDamageModifierIds?: string[];
  formulaBreakdown?: Array<{
    label: string;
    formula?: string;
    detail?: string;
  }>;
  rollAttribute?: AttributeKey;
  target?: number;
  note?: string;
};

export type ActionRollResult = {
  kind: "attack_check" | "attribute_check" | "damage";
  label: string;
  dice: number[];
  total: number;
  formula: string;
  target?: number;
  success?: boolean;
};

export type CampaignChatMessage = {
  id: string;
  campaignId: string;
  userId: string;
  userEmail: string;
  characterId: string | null;
  characterName: string | null;
  visibility: CampaignChatVisibility;
  messageType: CampaignChatMessageType;
  text: string;
  actionId: string | null;
  actionLabel: string | null;
  actionCost: ActionCost | null;
  actionSummary: string | null;
  rolls: ActionRollResult[];
  createdAt: string;
};

export type Campaign = {
  id: string;
  name: string;
  summary: string;
  setting: string;
  notes: string;
  sharedNotes: string;
  sharedNoteEntries: Array<z.infer<typeof campaignSharedNoteEntrySchema>>;
  gmId: string;
  gmEmail: string;
  createdAt: string;
  updatedAt: string;
  members: CampaignMember[];
  characters: CampaignCharacter[];
  availableCharacters: CampaignAvailableCharacter[];
  npcs: CampaignNpc[];
  experienceLog: CampaignExperienceLog[];
  sessions: CampaignSession[];
  references: CampaignReference[];
  chatMessages: CampaignChatMessage[];
};
