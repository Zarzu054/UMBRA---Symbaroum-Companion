import { z } from "zod";
import {
  actorCapabilitySelectionSchema,
  averageDiceFormula,
  getActorChallengeFromXp,
  getActorSpentXp,
  type ActorCapabilitySelection,
  type ActorCapabilityKind
} from "./actorCreation.js";
import {
  BASIC_BOOK_MONSTER_TACTICS,
  CODEX_MONSTER_PROFILE_DATA,
  type CanonicalMonsterProfileData
} from "./monsterCodexCatalog.generated.js";

export const monsterAttributeKeySchema = z.enum([
  "accurate",
  "cunning",
  "discreet",
  "persuasive",
  "quick",
  "resolute",
  "strong",
  "vigilant"
]);

export const monsterCategorySchema = z.enum([
  "Abominación",
  "Bestia",
  "Fenómeno",
  "Flora",
  "Muerto viviente",
  "Ser civilizado"
]);

export const monsterThreatSchema = z.enum(["Sencillo", "Normal", "Complicado", "Difícil", "Mortal", "Legendario"]);

export type MonsterAttributeKey = z.infer<typeof monsterAttributeKeySchema>;
export type MonsterCategory = z.infer<typeof monsterCategorySchema>;
export type MonsterThreat = z.infer<typeof monsterThreatSchema>;

const LEGACY_MONSTER_THREAT_MAP: Record<string, MonsterThreat> = {
  "D\u00c3\u00a9bil": "Sencillo",
  "Débil": "Sencillo",
  Moderado: "Normal",
  Peligroso: "Complicado",
  "Dif?cil": "Difícil"
};

export function normalizeMonsterThreat(threat: string | null | undefined): MonsterThreat {
  if (!threat) {
    return "Normal";
  }

  if (monsterThreatSchema.options.includes(threat as MonsterThreat)) {
    return threat as MonsterThreat;
  }

  return LEGACY_MONSTER_THREAT_MAP[threat] ?? "Normal";
}

export const MONSTER_ATTRIBUTE_LABELS: Record<MonsterAttributeKey, string> = {
  accurate: "Diestro",
  cunning: "Inteligente",
  discreet: "Discreto",
  persuasive: "Persuasivo",
  quick: "Ágil",
  resolute: "Tenaz",
  strong: "Fuerte",
  vigilant: "Atento"
};

export const MONSTER_ATTRIBUTE_KEYS: MonsterAttributeKey[] = [
  "quick",
  "vigilant",
  "accurate",
  "discreet",
  "strong",
  "cunning",
  "persuasive",
  "resolute"
];
export const MONSTER_CATEGORIES = monsterCategorySchema.options;
export const MONSTER_THREATS = monsterThreatSchema.options;
export const MONSTER_CODEX_FAMILIES = [
  "Araks",
  "Bestiaal",
  "Centella",
  "Colosseo",
  "Destello",
  "Devorador de río",
  "Dragón",
  "Espino viviente",
  "Fusco",
  "Gwann",
  "Maltrasgo",
  "Managaal",
  "Mariposas enjambreras nocturnas",
  "Marlo",
  "Naturaleza corrupta",
  "Nefarani",
  "Pesadilla",
  "Príncipe de la muerte",
  "Roecráneos",
  "Saña",
  "Sapo real",
  "Sauce voraz",
  "Serpiente madre",
  "Socarrón",
  "Sombra troll",
  "Termita purulenta",
  "Terreno vengativo"
] as const;

export const monsterAttributesSchema = z.object({
  accurate: z.number().int().min(1).max(20),
  cunning: z.number().int().min(1).max(20),
  discreet: z.number().int().min(1).max(20),
  persuasive: z.number().int().min(1).max(20),
  quick: z.number().int().min(1).max(20),
  resolute: z.number().int().min(1).max(20),
  strong: z.number().int().min(1).max(20),
  vigilant: z.number().int().min(1).max(20)
});

export const monsterSourceReferenceSchema = z.object({
  source: z.string().min(1).max(160),
  page: z.number().int().min(1).max(2000),
  pdfPage: z.number().int().min(1).max(2000)
});

export const monsterWeaponProfileSchema = z.object({
  attribute: z.string().max(80).default(""),
  name: z.string().min(1).max(500),
  damage: z.string().max(120).default(""),
  damageFormula: z.string().max(120).default(""),
  fixedValue: z.number().nullable().default(null),
  qualities: z.string().max(600).default(""),
  details: z.string().max(1600).default("")
});

export const monsterSheetSchema = z.object({
  attack: z.string().min(1).max(160),
  damage: z.string().min(1).max(500),
  defense: z.string().min(1).max(240),
  armor: z.string().min(1).max(1600),
  toughness: z.string().min(1).max(120),
  painThreshold: z.string().min(1).max(120),
  movement: z.string().min(1).max(160),
  attributes: monsterAttributesSchema,
  traits: z.array(z.string().min(1).max(600)).max(30).default([]),
  actions: z.array(z.string().min(1).max(600)).max(20).default([]),
  capabilities: z.array(actorCapabilitySelectionSchema).max(300).default([]),
  equipment: z.array(z.object({
    catalogId: z.string().min(1).max(180),
    name: z.string().min(1).max(180),
    category: z.enum(["weapon", "armor", "gear", "consumable", "artifact", "treasure", "other"]).default("other"),
    damageFormula: z.string().max(80).default(""),
    protectionFormula: z.string().max(80).default(""),
    fixedValue: z.number().nullable().default(null),
    value: z.string().max(80).default(""),
    qualities: z.string().max(240).default(""),
    notes: z.string().max(1200).default("")
  })).max(200).optional(),
  fixedValues: z.object({
    damage: z.number().nullable().default(null),
    armor: z.number().nullable().default(null)
  }).default({ damage: null, armor: null }),
  family: z.string().max(180).default(""),
  variant: z.string().max(180).default(""),
  race: z.string().max(240).default(""),
  description: z.string().max(5000).default(""),
  conduct: z.string().max(800).default(""),
  shadow: z.string().max(1600).default(""),
  corruption: z.number().int().min(0).nullable().default(null),
  publishedThreat: z.string().max(80).default(""),
  blessingsBurdens: z.string().max(2400).default(""),
  sourceReferences: z.array(monsterSourceReferenceSchema).max(12).default([]),
  weapons: z.array(monsterWeaponProfileSchema).max(30).default([]),
  armorDetails: z.string().max(1600).default(""),
  publishedText: z.string().max(12000).default(""),
  profileFormat: z.enum(["legacy", "extended", "compact", "custom"]).default("custom"),
  appearanceOrder: z.number().int().min(0).default(0),
  tactics: z.string().max(1200).default(""),
  weakness: z.string().max(1200).default(""),
  loot: z.string().max(1200).default("")
});

export type MonsterSheet = z.infer<typeof monsterSheetSchema>;
export type MonsterSourceReference = z.infer<typeof monsterSourceReferenceSchema>;
export type MonsterWeaponProfile = z.infer<typeof monsterWeaponProfileSchema>;

export const createMonsterSchema = z.object({
  name: z.string().min(2).max(120),
  category: monsterCategorySchema,
  threat: monsterThreatSchema,
  source: z.string().max(120).default("Mis monstruos"),
  summary: z.string().min(4).max(500),
  sheet: monsterSheetSchema
});

export const updateMonsterSchema = createMonsterSchema.partial().extend({
  sheet: monsterSheetSchema.optional()
});

export type CreateMonsterInput = z.infer<typeof createMonsterSchema>;
export type UpdateMonsterInput = z.infer<typeof updateMonsterSchema>;

export type Monster = {
  id: string;
  name: string;
  category: MonsterCategory;
  threat: MonsterThreat;
  source: string;
  summary: string;
  sheet: MonsterSheet;
  family?: string;
  variant?: string;
  references?: MonsterSourceReference[];
  appearanceOrder?: number;
  publishedThreat?: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_ATTRIBUTE_TEMPLATE: Record<MonsterAttributeKey, number> = {
  accurate: 10,
  cunning: 9,
  discreet: 10,
  persuasive: 7,
  quick: 11,
  resolute: 10,
  strong: 13,
  vigilant: 10
};

export function createDefaultMonsterSheet(): MonsterSheet {
  return {
    attack: "+1",
    damage: "1d8",
    defense: "-1",
    armor: "1d4",
    toughness: "13",
    painThreshold: "6",
    movement: "10 m",
    attributes: { ...DEFAULT_ATTRIBUTE_TEMPLATE },
    traits: [],
    actions: [],
    capabilities: [],
    equipment: [],
    fixedValues: {
      damage: averageDiceFormula("1d8"),
      armor: averageDiceFormula("1d4")
    },
    family: "",
    variant: "",
    race: "",
    description: "",
    conduct: "",
    shadow: "",
    corruption: null,
    publishedThreat: "",
    blessingsBurdens: "",
    sourceReferences: [],
    weapons: [],
    armorDetails: "",
    publishedText: "",
    profileFormat: "custom",
    appearanceOrder: 0,
    tactics: "",
    weakness: "",
    loot: ""
  };
}

export function createEmptyMonsterInput(): CreateMonsterInput {
  return {
    name: "",
    category: "Bestia",
    threat: "Normal",
    source: "Mis monstruos",
    summary: "",
    sheet: createDefaultMonsterSheet()
  };
}

export function getMonsterAttributeTotal(sheet: MonsterSheet): number {
  return MONSTER_ATTRIBUTE_KEYS.reduce((total, key) => total + Number(sheet.attributes[key] || 0), 0);
}

export function synchronizeMonsterCreationValues(sheet: MonsterSheet): MonsterSheet {
  const capabilities = sheet.capabilities.length > 0
    ? sheet.capabilities
    : sheet.traits.map((trait, index) => {
        const normalized = trait.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const level = /(?:iii|3)\)?\s*$/.test(normalized) ? "maestro" as const
          : /(?:ii|2)\)?\s*$/.test(normalized) ? "adepto" as const
            : "principiante" as const;
        return {
          catalogId: `legacy-monster-trait-${index}-${normalized.replace(/[^a-z0-9]+/g, "-")}`,
          name: trait.replace(/\s*\(?(?:i{1,3}|[1-3])\)?\s*$/i, "").trim() || trait,
          kind: "rasgo_monstruoso" as const,
          level,
          origin: "legado" as const,
          source: "Ficha anterior",
          legacyData: trait
        };
      });
  return {
    ...sheet,
    capabilities,
    equipment: sheet.equipment ?? [],
    traits: capabilities
      .filter((entry) => entry.kind === "rasgo_monstruoso")
      .map((entry) => `${entry.name}${entry.level ? ` (${entry.level === "maestro" ? "III" : entry.level === "adepto" ? "II" : "I"})` : ""}`),
    fixedValues: {
      damage: averageDiceFormula(sheet.damage),
      armor: averageDiceFormula(sheet.armor)
    }
  };
}

export function getMonsterCreationXp(sheet: MonsterSheet): number {
  return getActorSpentXp(sheet.capabilities ?? []);
}

export function getMonsterCreationChallenge(sheet: MonsterSheet): MonsterThreat {
  return getActorChallengeFromXp(getMonsterCreationXp(sheet));
}

const FREE_PUBLISHED_TRAITS = new Set(["longevo", "poco longevo", "montes", "vinculo terrenal"]);

function normalizePublishedName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function splitPublishedEntries(value: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      if (current.trim()) entries.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

function publishedLevel(value: string): "principiante" | "adepto" | "maestro" {
  const normalized = normalizePublishedName(value);
  if (/\b(?:maestr[oa]|iii)\b/.test(normalized)) return "maestro";
  if (/\b(?:adept[oa]|ii)\b/.test(normalized)) return "adepto";
  return "principiante";
}

function publishedEntryName(value: string): string {
  if (/^Atributo excepcional\s*\(/i.test(value)) return "Atributo excepcional";
  return value
    .replace(/\s*\((?:principiante|adept[oa]|maestr[oa]|i{1,3})(?::[^)]*)?\)\s*$/i, "")
    .trim();
}

function createPublishedCapabilities(
  value: string,
  kind: ActorCapabilityKind,
  source: string,
  page: number
): ActorCapabilitySelection[] {
  return splitPublishedEntries(value)
    .filter((entry) => entry && normalizePublishedName(entry) !== "ninguna")
    .map((entry, index) => {
      const name = publishedEntryName(entry) || entry;
      const normalizedName = normalizePublishedName(name);
      const exceptionalAttribute = /^Atributo excepcional\s*\(([^,]+)/i.exec(entry)?.[1]?.trim();
      const attributeKey = exceptionalAttribute
        ? Object.entries(MONSTER_ATTRIBUTE_LABELS).find(([, label]) => normalizePublishedName(label) === normalizePublishedName(exceptionalAttribute))?.[0]
        : undefined;
      const resolvedKind: ActorCapabilityKind = kind === "rasgo_monstruoso" && FREE_PUBLISHED_TRAITS.has(normalizedName)
        ? "rasgo_personaje"
        : kind;
      return {
        catalogId: `publicado-${normalizePublishedName(source).replace(/[^a-z0-9]+/g, "-")}-${page}-${index}-${normalizedName.replace(/[^a-z0-9]+/g, "-")}`,
        name,
        kind: resolvedKind,
        level: resolvedKind === "rasgo_personaje" ? undefined : publishedLevel(entry),
        origin: resolvedKind === "rasgo_personaje" ? "racial" : "comprada",
        source,
        page,
        references: [{ source, page }],
        attributeKey,
        repeatable: attributeKey ? true : undefined,
        legacyData: entry
      };
    });
}

type StarterMonsterSeed = {
  id: string;
  name: string;
  category: MonsterCategory;
  threat: MonsterThreat;
  source?: string;
  summary: string;
  attack?: string;
  damage?: string;
  defense: string;
  armor: string;
  toughness: string;
  painThreshold: string;
  movement?: string;
  attributes: MonsterSheet["attributes"];
  traits: string[];
  actions: string[];
  tactics: string;
  weakness?: string;
  loot?: string;
};

const STARTER_MONSTER_TIMESTAMP = "2026-04-10T00:00:00.000Z";

function createStarterMonster(seed: StarterMonsterSeed): Monster {
  const source = seed.source ?? "Libro Básico";
  const abilityText = seed.actions
    .filter((entry) => normalizePublishedName(entry).startsWith("habilidades:"))
    .map((entry) => entry.replace(/^Habilidades:\s*/i, ""))
    .join(", ");
  const capabilities = [
    ...createPublishedCapabilities(seed.traits.join(", "), "rasgo_monstruoso", source, 201),
    ...createPublishedCapabilities(abilityText, "habilidad", source, 201)
  ];
  const sheet: MonsterSheet = {
    attack: seed.attack ?? "Ver acciones",
    damage: seed.damage ?? "Según arma o rasgo",
    defense: seed.defense,
    armor: seed.armor,
    toughness: seed.toughness,
    painThreshold: seed.painThreshold,
    movement: seed.movement ?? "-",
    attributes: seed.attributes,
    traits: seed.traits,
    actions: seed.actions,
    capabilities,
    equipment: [],
    fixedValues: {
      damage: averageDiceFormula(seed.damage),
      armor: averageDiceFormula(seed.armor)
    },
    family: seed.name,
    variant: "",
    race: seed.category,
    description: seed.summary,
    conduct: "",
    shadow: "",
    corruption: null,
    publishedThreat: seed.threat,
    blessingsBurdens: "",
    sourceReferences: [],
    weapons: [],
    armorDetails: seed.armor,
    publishedText: "",
    profileFormat: "legacy",
    appearanceOrder: 0,
    tactics: seed.tactics,
    weakness: seed.weakness ?? "",
    loot: seed.loot ?? ""
  };
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    threat: getMonsterCreationChallenge(sheet),
    source,
    summary: seed.summary,
    sheet,
    family: sheet.family,
    variant: sheet.variant,
    references: sheet.sourceReferences,
    appearanceOrder: sheet.appearanceOrder,
    publishedThreat: seed.threat,
    createdAt: STARTER_MONSTER_TIMESTAMP,
    updatedAt: STARTER_MONSTER_TIMESTAMP
  };
}

const BASIC_BOOK_MONSTERS: Monster[] = [
  createStarterMonster({
    id: "libro-basico-elfo-vernal",
    name: "Elfo vernal",
    category: "Ser civilizado",
    threat: "Sencillo",
    summary: "Arquero joven y escurridizo, eficaz para provocaciones, trampas y emboscadas en bosque.",
    defense: "-3",
    armor: "Ninguna",
    toughness: "10",
    painThreshold: "3",
    attributes: { accurate: 10, cunning: 10, discreet: 15, persuasive: 9, quick: 13, resolute: 7, strong: 5, vigilant: 11 },
    traits: ["Longevo"],
    actions: ["Armas: Daga 3 (Corta), Arco 4"],
    tactics: "Se mantiene a distancia, dispara con arco y atrae a sus víctimas hacia trampas o emboscadas.",
    loot: "Nada de valor."
  }),
  createStarterMonster({
    id: "libro-basico-elfo-estival-verde",
    name: "Elfo estival verde",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Hostigador élfico con arco y lanza, pensado para abrir combate a distancia y replegarse.",
    defense: "-3",
    armor: "Hilo de seda 2 (Flexible)",
    toughness: "10",
    painThreshold: "4",
    attributes: { accurate: 10, cunning: 10, discreet: 11, persuasive: 5, quick: 13, resolute: 9, strong: 7, vigilant: 15 },
    traits: ["Longevo"],
    actions: ["Armas: Arco 5, Lanza 4 (Larga)", "Habilidades: Acróbata (principiante), Sexto sentido (principiante), Tirador (adepto)"],
    tactics: "Confía en el arco y solo recurre a la lanza cuando el enemigo consigue cerrar distancias.",
    loot: "Hierbas curativas y una docena de flechas."
  }),
  createStarterMonster({
    id: "libro-basico-elfo-estival-maduro",
    name: "Elfo estival maduro",
    category: "Ser civilizado",
    threat: "Complicado",
    summary: "Veterano élfico disciplinado, sólido con arco y asta, adecuado para escaramuzas duras.",
    defense: "0",
    armor: "Coraza de seda lacada 4 (Flexible)",
    toughness: "10",
    painThreshold: "4",
    attributes: { accurate: 15, cunning: 10, discreet: 11, persuasive: 9, quick: 10, resolute: 13, strong: 7, vigilant: 5 },
    traits: ["Longevo"],
    actions: ["Armas: Arco 5, Lanza 5 (Larga)", "Habilidades: Armas de asta (maestro), Combate con armadura (adepto), Tirador (maestro)"],
    tactics: "Prefiere mantener la línea y castigar con disciplina antes de rematar con lanza.",
    loot: "Hierbas curativas."
  }),
  createStarterMonster({
    id: "libro-basico-elfo-otonal",
    name: "Elfo otoñal",
    category: "Ser civilizado",
    threat: "Difícil",
    summary: "Místico élfico de apoyo y control, peligroso por rituales, larvas y sometimiento.",
    defense: "+5",
    armor: "Hilo de seda 2 (Flexible)",
    toughness: "10",
    painThreshold: "4",
    attributes: { accurate: 9, cunning: 13, discreet: 10, persuasive: 11, quick: 5, resolute: 15, strong: 7, vigilant: 10 },
    traits: ["Longevo"],
    actions: ["Armas: Espada 4", "Habilidades: Estudioso (maestro), Medicus (maestro), Poder místico (Erupción de larvas, maestro), Poder místico (Someter voluntad, maestro), Rituales (maestro)"],
    tactics: "Abre con control mental o magia y evita el choque directo mientras aliados rematan.",
    loot: "10 hierbas curativas."
  }),
  createStarterMonster({
    id: "libro-basico-troll-saqueador-hambriento",
    name: "Troll saqueador hambriento",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Bruto agresivo que entra en berserk y caza objetivos aislados uno por uno.",
    defense: "+7",
    armor: "Piel de troll 4",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 13, cunning: 10, discreet: 5, persuasive: 7, quick: 11, resolute: 10, strong: 15, vigilant: 9 },
    traits: ["Longevo", "Arma natural (I)", "Robusto (I)"],
    actions: ["Armas: Zarpas 8 (Corta)", "Habilidades: Berserker (adepto)"],
    tactics: "Carga con ferocidad y persigue a sus objetivos hasta matar a todos.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-troll-saqueador-sociable",
    name: "Troll saqueador sociable",
    category: "Ser civilizado",
    threat: "Complicado",
    summary: "Troll resistente que se regenera y mantiene presión sostenida en primera línea.",
    defense: "+7",
    armor: "Piel de troll 4; regenera 4 por turno salvo fuego o ácido",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 13, cunning: 10, discreet: 5, persuasive: 7, quick: 10, resolute: 11, strong: 15, vigilant: 9 },
    traits: ["Arma natural (I)", "Longevo", "Regeneración (III)", "Robusto (I)"],
    actions: ["Armas: Zarpas 9 (Corta)", "Habilidades: Berserker (adepto), Combate sin armas (principiante)"],
    tactics: "Se apoya en la regeneración para aguantar combate prolongado y seguir avanzando.",
    weakness: "Fuego y ácido.",
    loot: "Amuleto de la suerte."
  }),
  createStarterMonster({
    id: "libro-basico-cacique-troll",
    name: "Cacique troll",
    category: "Ser civilizado",
    threat: "Difícil",
    summary: "Jefe troll demoledor con zarpas dobles, gran fuerza y regeneración pesada.",
    defense: "+1",
    armor: "Piel de troll 7; regenera 4 por turno salvo fuego o ácido",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 13, cunning: 10, discreet: 5, persuasive: 11, quick: 9, resolute: 10, strong: 18, vigilant: 7 },
    traits: ["Arma natural (I)", "Duro (I)", "Longevo", "Regeneración (III)", "Robusto (II)"],
    actions: ["Armas: Zarpas 13 (Corta), segundo ataque 10", "Habilidades: Alquimista (principiante), Atributo excepcional (Fuerte, maestro), Berserker (maestro), Combate sin armas (maestro)"],
    tactics: "Rompe líneas con pura fuerza y castiga al mismo objetivo con un segundo zarpazo.",
    weakness: "Fuego y ácido.",
    loot: "Equipo tribal del cacique."
  }),
  createStarterMonster({
    id: "libro-basico-architroll",
    name: "Architroll",
    category: "Ser civilizado",
    threat: "Mortal",
    summary: "Amenaza mayor troll: hipnosis, regeneración y pegada brutal en un solo jefe.",
    defense: "+3",
    armor: "Piel de troll 10; regenera 4 por turno salvo fuego o ácido",
    toughness: "18",
    painThreshold: "9",
    attributes: { accurate: 11, cunning: 10, discreet: 5, persuasive: 9, quick: 7, resolute: 16, strong: 18, vigilant: 10 },
    traits: ["Arma natural (III)", "Duro (III)", "Hipnótico (III)", "Longevo", "Regeneración (III)", "Robusto (III)"],
    actions: ["Armas: Zarpas 16 (Largas)", "Habilidades: Alquimista (maestro), Atributo excepcional (Fuerte, maestro), Atributo excepcional (Tenaz, maestro), Berserker (maestro), Golpe de hierro (maestro)"],
    tactics: "Domina la escena como jefe frontal: hipnotiza, soporta castigo y despieza a quien no pueda retirarse.",
    weakness: "Fuego y ácido.",
    loot: "Restos valiosos de un coloso antiguo."
  }),
  createStarterMonster({
    id: "libro-basico-cultista-seguidor",
    name: "Cultista seguidor",
    category: "Ser civilizado",
    threat: "Sencillo",
    summary: "Fanático oscuro de primera línea, peligroso solo en grupo o respaldado por su líder.",
    defense: "+1",
    armor: "Cuero 2 (Incómoda)",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 10, cunning: 7, discreet: 15, persuasive: 10, quick: 11, resolute: 5, strong: 9, vigilant: 13 },
    traits: [],
    actions: ["Armas: Arma a una mano 4"],
    tactics: "Huira si el combate se pone en contra o si su líder no está presente para obligarle a luchar.",
    loot: "Túnica, máscara y 1D10 chelines."
  }),
  createStarterMonster({
    id: "libro-basico-cultista-lider",
    name: "Cultista líder",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Cabecilla corrupto que ordena desde retaguardia y combina liderazgo con maldiciones oscuras.",
    defense: "+5",
    armor: "Hilo de seda 2 (Flexible)",
    toughness: "10",
    painThreshold: "4",
    attributes: { accurate: 9, cunning: 13, discreet: 11, persuasive: 15, quick: 5, resolute: 10, strong: 7, vigilant: 10 },
    traits: [],
    actions: ["Armas: Espada 4", "Habilidades: Líder (principiante), Poder místico (Maldición, adepto), Rituales (Posesión, principiante)"],
    tactics: "Se esconde tras sus seguidores y da órdenes desde distancia segura, salvo que su Gran Plan dependa del enfrentamiento directo.",
    loot: "Túnica bordada, máscara terrorífica y 1D10 táleros."
  }),
  createStarterMonster({
    id: "libro-basico-bandido-salteador",
    name: "Bandido salteador",
    category: "Ser civilizado",
    threat: "Sencillo",
    summary: "Saqueador oportunista de camino y bosque, eficaz en emboscadas pero poco dispuesto a morir.",
    defense: "+4",
    armor: "Armadura de cuervo 3 (Aparatosa)",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 10, cunning: 5, discreet: 13, persuasive: 9, quick: 10, resolute: 7, strong: 11, vigilant: 15 },
    traits: [],
    actions: ["Armas: Arma a una mano 4, Arma arrojadiza 3"],
    tactics: "Mide sus opciones y no ataca enemigos claramente superiores o que lo sobrepasen en número.",
    loot: "1D6 armas arrojadizas, resina de mascar y 1D10 ortegs."
  }),
  createStarterMonster({
    id: "libro-basico-bandido-jefe",
    name: "Bandido jefe",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Jefe de cuadrilla agresivo que manda desde el ejemplo y presiona con dos armas.",
    defense: "0",
    armor: "Armadura de cuervo 3 (Aparatosa)",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 5, cunning: 7, discreet: 9, persuasive: 15, quick: 13, resolute: 10, strong: 10, vigilant: 11 },
    traits: [],
    actions: ["Armas: Hacha y espada 4, dos ataques contra un mismo objetivo", "Habilidades: Acróbata (principiante), Ataque con dos armas (adepto), Dominación (principiante)"],
    tactics: "Lucha junto a sus bandidos; cualquier otra cosa no sería aceptable para mantener su autoridad.",
    loot: "Sombrero con pluma y 1D10 chelines."
  }),
  createStarterMonster({
    id: "libro-basico-explorador-reina",
    name: "Explorador de la reina",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Patrullero de Davokar entrenado para rastrear, estudiar amenazas y elegir bien cuándo combatir.",
    defense: "-4",
    armor: "Hilo de seda 2 (Flexible)",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 11, cunning: 13, discreet: 10, persuasive: 5, quick: 7, resolute: 9, strong: 10, vigilant: 15 },
    traits: [],
    actions: ["Armas: Arco 4, espada 4 y daga 3", "Habilidades: Ataque con dos armas (principiante), Estudioso o Medicus o Versado en criaturas (principiante), Táctico (adepto)"],
    tactics: "Estudia al enemigo y ataca su punto débil; si está en desventaja, sigue al objetivo hasta obtener apoyo o mejor posición.",
    loot: "Pergaminos, una docena de flechas, hierbas curativas y 1D10 chelines."
  }),
  createStarterMonster({
    id: "libro-basico-capitan-explorador",
    name: "Capitán explorador de la reina",
    category: "Ser civilizado",
    threat: "Complicado",
    summary: "Oficial curtido de exploradores, muy capaz en primera línea y excelente coordinando patrullas.",
    defense: "-4",
    armor: "Coraza de seda lacada 3 (Flexible)",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 11, cunning: 13, discreet: 10, persuasive: 5, quick: 7, resolute: 9, strong: 10, vigilant: 15 },
    traits: [],
    actions: ["Armas: Arco largo 4 (Preciso), hoja de esgrima 5 (Equilibrada) y espada 4", "Habilidades: Ataque con dos armas (maestro), Líder (adepto), Táctico (maestro)"],
    tactics: "Combate en primera línea para marcar el ejemplo y aprovechar su disciplina táctica.",
    loot: "Mapa de la zona, pan de viaje, dos dosis de hierbas curativas y 1D10 táleros."
  }),
  createStarterMonster({
    id: "libro-basico-cazamonstruos-autodidacta",
    name: "Cazamonstruos autodidacta",
    category: "Ser civilizado",
    threat: "Sencillo",
    summary: "Perseguidor de abominaciones de recursos simples: virote, hacha y una fe brutal en su misión.",
    defense: "+3 (escudo)",
    armor: "Cota de mallas 3 (Incómoda)",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 10, cunning: 10, discreet: 5, persuasive: 7, quick: 9, resolute: 15, strong: 11, vigilant: 13 },
    traits: [],
    actions: ["Armas: Ballesta 5, hacha 4"],
    tactics: "Dispara un virote y luego entra con hacha y escudo, siempre convencido de estar frente a una abominación.",
    loot: "Libro de salmos, herramientas de interrogatorio y 1D10 chelines."
  }),
  createStarterMonster({
    id: "libro-basico-cazamonstruos-manto-negro",
    name: "Cazamonstruos manto negro",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Agente fanático de los Hermanos del Crepúsculo, mejor preparado para detectar y rematar corrupción.",
    defense: "+3 (escudo)",
    armor: "Armadura de escamas 3 (Incómoda)",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 10, cunning: 10, discreet: 5, persuasive: 7, quick: 9, resolute: 15, strong: 11, vigilant: 13 },
    traits: [],
    actions: ["Armas: Ballesta 5, espada 4", "Habilidades: Inquebrantable (adepto), Rituales (Humo sagrado, principiante), Versado en criaturas (principiante)"],
    tactics: "Usa rituales para desenmascarar abominaciones; si no hay tiempo, dispara primero y remata con espada.",
    loot: "Libro de salmos, herramientas de interrogatorio, inciensos y 1D10 táleros."
  }),
  createStarterMonster({
    id: "libro-basico-cazatesoros-aventurero",
    name: "Cazatesoros aventurero",
    category: "Ser civilizado",
    threat: "Sencillo",
    summary: "Expoliador común de Davokar, resistente y pragmático, con escudo y cuchillos antes que gloria.",
    defense: "+1 (escudo)",
    armor: "Cuero tachonado 2 (Incómoda)",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 11, cunning: 10, discreet: 9, persuasive: 5, quick: 10, resolute: 7, strong: 15, vigilant: 13 },
    traits: [],
    actions: ["Armas: Garrote con pinchos 4, cuchillo arrojadizo 3"],
    tactics: "Lanza sus cuchillos mientras se cubre con el escudo y solo entra al cuerpo a cuerpo si se queda sin opciones.",
    loot: "Amuleto de buena fortuna, juego de dados y tres cuchillos arrojadizos."
  }),
  createStarterMonster({
    id: "libro-basico-cazatesoros-saqueador",
    name: "Cazatesoros saqueador",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Ogro buscabotín de choque, directo y peligroso cuando alcanza distancia de martillo.",
    defense: "+1",
    armor: "Piel gruesa y cuero 4 (Incómoda)",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 5, cunning: 10, discreet: 9, persuasive: 10, quick: 13, resolute: 11, strong: 15, vigilant: 7 },
    traits: [],
    actions: ["Armas: Martillo a dos manos 8", "Habilidades: Armas a dos manos (adepto), Golpe de hierro (principiante)"],
    tactics: "Marcha directo al combate, consumido por el ansia de botín.",
    loot: "Saco con comida putrefacta."
  }),
  createStarterMonster({
    id: "libro-basico-guerrero-barbaro-poblado",
    name: "Guerrero bárbaro de poblado",
    category: "Ser civilizado",
    threat: "Normal",
    summary: "Guerrero de clan acostumbrado a escaramuzas rápidas con lanza, hacha y retirada disciplinada.",
    defense: "-3",
    armor: "Piel de oso 2 (Incómoda)",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 15, cunning: 5, discreet: 10, persuasive: 7, quick: 13, resolute: 9, strong: 11, vigilant: 10 },
    traits: [],
    actions: ["Armas: Hacha 5, golpe de escudo 2 (derribo), lanza arrojadiza 4", "Habilidades: Acróbata (principiante), Combate con escudo (adepto), Viento de acero (principiante)"],
    tactics: "Primero arroja sus lanzas y luego entra con el hacha; si la situación empeora, cubre la retirada con las armas que le queden.",
    loot: "Trampas de caza, equipo de pesca, figurita del clan, tres lanzas arrojadizas y 1D10 ortegs."
  }),
  createStarterMonster({
    id: "libro-basico-guerrero-barbaro-guardia-clan",
    name: "Guardia del clan bárbaro",
    category: "Ser civilizado",
    threat: "Complicado",
    summary: "Escolta de élite del jefe tribal, demoledora con hacha a dos manos y muy peligrosa en choque frontal.",
    defense: "-3",
    armor: "Armadura de escamas 4 (Incómoda)",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 5, cunning: 10, discreet: 10, persuasive: 7, quick: 13, resolute: 9, strong: 15, vigilant: 11 },
    traits: [],
    actions: ["Armas: Hacha a dos manos 11 (Impacto agravado), ignora armadura", "Habilidades: Armas a dos manos (maestro), Combate con armadura (adepto), Golpe de hierro (maestro)"],
    tactics: "Lidera desde el ejemplo: entra al cuerpo a cuerpo, derriba al enemigo y lo remata con uno o dos golpes de hacha.",
    loot: "Tazón de metal o madera, figurita del clan, piedra de afilar y 1D10 chelines."
  }),
  createStarterMonster({
    id: "libro-basico-maranosa",
    name: "Marañosa",
    category: "Bestia",
    threat: "Normal",
    summary: "Enjambre de arañas venenosas que desborda por volumen y desgaste continuo.",
    defense: "-3",
    armor: "Ninguna",
    toughness: "10",
    painThreshold: "3",
    attributes: { accurate: 15, cunning: 10, discreet: 11, persuasive: 7, quick: 13, resolute: 9, strong: 5, vigilant: 10 },
    traits: ["Arma natural (I)", "Enjambre (II)", "Venenosa (I)"],
    actions: ["Armas: Picadura 3, veneno 2 durante 2 turnos"],
    tactics: "El enjambre se echa encima de la presa hasta matarla antes de dispersarse.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-arana-trampera",
    name: "Araña trampera",
    category: "Bestia",
    threat: "Normal",
    summary: "Cazadora de control que inmoviliza con telaraña antes de envenenar.",
    defense: "-5",
    armor: "Ninguna",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 13, cunning: 10, discreet: 11, persuasive: 5, quick: 15, resolute: 7, strong: 9, vigilant: 10 },
    traits: ["Arma natural (I)", "Telaraña (I)", "Venenosa (I)"],
    actions: ["Armas: Picadura 3, veneno 2 durante 2 turnos", "Habilidades: Acróbata (principiante)"],
    tactics: "Atrapa a la presa en sus redes y la desgasta sin exponerse demasiado.",
    loot: "Redes con objetos de víctimas anteriores."
  }),
  createStarterMonster({
    id: "libro-basico-baiagorno",
    name: "Baiagorno",
    category: "Bestia",
    threat: "Normal",
    summary: "Depredador robusto que pasa de la cautela al frenesí cuando se ve amenazado.",
    defense: "+7",
    armor: "Piel de oso 4",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 10, cunning: 10, discreet: 9, persuasive: 5, quick: 7, resolute: 13, strong: 15, vigilant: 11 },
    traits: ["Arma natural (I)", "Robusto (I)"],
    actions: ["Armas: Garras 8 (Cortas)", "Habilidades: Berserker (adepto)"],
    tactics: "Si está nervioso o herido entra en furia y se lanza sobre la presa más cercana.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-gato-vibora",
    name: "Gato víbora",
    category: "Bestia",
    threat: "Normal",
    summary: "Acechador venenoso que busca sorpresa, sigilo y remate rápido.",
    defense: "-3",
    armor: "Ninguna",
    toughness: "10",
    painThreshold: "4",
    attributes: { accurate: 11, cunning: 9, discreet: 15, persuasive: 5, quick: 13, resolute: 10, strong: 7, vigilant: 10 },
    traits: ["Arma natural (II)", "Venenoso (I)"],
    actions: ["Armas: Mordisco 4 (Corta), veneno 2 durante 2 turnos", "Habilidades: Acróbata (principiante)"],
    tactics: "Se aproxima sigilosamente para sorprender y retirarse si la presa resiste demasiado.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-abojali",
    name: "Abojalí",
    category: "Bestia",
    threat: "Complicado",
    summary: "Jabalí monstruoso muy duro que intimida, amaga y rompe la línea con colmillos.",
    defense: "+1",
    armor: "Piel de cerdo 7",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 10, cunning: 10, discreet: 7, persuasive: 5, quick: 13, resolute: 11, strong: 15, vigilant: 9 },
    traits: ["Arma natural (II)", "Duro (II)", "Robusto (III)"],
    actions: ["Armas: Colmillos 10 (Cortos)", "Habilidades: Golpe de hierro (adepto)"],
    tactics: "Simula atacar para espantar a la presa antes de cargar con violencia real.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-kanaran",
    name: "Kanaran",
    category: "Bestia",
    threat: "Complicado",
    summary: "Serpiente ágil y muy inteligente, especializada en constricción y control de objetivos.",
    defense: "-4",
    armor: "Piel de serpiente 4",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 5, cunning: 16, discreet: 11, persuasive: 7, quick: 14, resolute: 9, strong: 10, vigilant: 10 },
    traits: ["Duro (III)"],
    actions: ["Armas: Estrangulación y presa", "Habilidades: Acróbata (maestro), Atributo excepcional (Ágil, principiante), Atributo excepcional (Inteligente, principiante), Estrangulador (principiante)"],
    tactics: "Espera el momento justo para inmovilizar a una víctima y asfixiarla fuera del foco principal.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-lindorma",
    name: "Lindorma",
    category: "Bestia",
    threat: "Difícil",
    summary: "Reptil enorme con hipnosis y mordisco aplastante, útil como depredador de alto riesgo.",
    defense: "+4",
    armor: "Escamas 8",
    toughness: "13",
    painThreshold: "7",
    attributes: { accurate: 7, cunning: 9, discreet: 5, persuasive: 11, quick: 10, resolute: 15, strong: 13, vigilant: 10 },
    traits: ["Duro (III)", "Hipnótico (III)", "Longeva", "Robusta (III)"],
    actions: ["Armas: Mordisco 14 (Corta) o dos ataques 12 y 8", "Habilidades: Combate sin armas (maestro), Golpe de hierro (maestro)"],
    tactics: "Intenta hipnotizar al grupo antes de empezar a alimentarse sobre una presa inmovilizada.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-kranka",
    name: "Kranka",
    category: "Bestia",
    threat: "Normal",
    summary: "Bandada aérea hostigadora que satura con pico y movilidad desde múltiples ángulos.",
    defense: "-5",
    armor: "Ninguna",
    toughness: "10",
    painThreshold: "5",
    attributes: { accurate: 13, cunning: 10, discreet: 5, persuasive: 7, quick: 15, resolute: 10, strong: 9, vigilant: 11 },
    traits: ["Alado (I)", "Enjambre (I)"],
    actions: ["Armas: Pico 3, dos ataques contra el mismo objetivo", "Habilidades: Combate sin armas (adepto)"],
    tactics: "Rodea al objetivo y concentra la bandada para desgastarlo por acumulación de ataques.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-libelula-dragon",
    name: "Libélula dragón",
    category: "Bestia",
    threat: "Complicado",
    summary: "Depredador volador de pasada, pensado para golpear y salir del alcance rival.",
    defense: "-3",
    armor: "Ninguna",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 15, cunning: 5, discreet: 7, persuasive: 10, quick: 13, resolute: 10, strong: 11, vigilant: 9 },
    traits: ["Alada (III)", "Arma natural (II)"],
    actions: ["Armas: Colmillos 8, dos ataques contra el mismo objetivo", "Habilidades: Combate sin armas (adepto)"],
    tactics: "Pasa junto a su objetivo, muerde y sigue volando hasta quedar fuera de contraataque.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-humano-renacido",
    name: "Humano renacido",
    category: "Abominación",
    threat: "Normal",
    summary: "Abominación humana de choque corto con sangre ácida y garras violentas.",
    defense: "+9, sangre corrosiva 3 durante tres turnos",
    armor: "Peto de cuero 4 (Incómodo)",
    toughness: "11",
    painThreshold: "6",
    attributes: { accurate: 15, cunning: 9, discreet: 10, persuasive: 5, quick: 7, resolute: 13, strong: 11, vigilant: 10 },
    traits: ["Arma natural (I)", "Robusto (I)", "Sangre ácida (I)"],
    actions: ["Armas: Garras 9 (Cortas)", "Habilidades: Berserker (principiante), Combate sin armas (principiante)"],
    tactics: "Se aproxima a su víctima con hambre despiadada y acepta recibir golpes para devolverlos.",
    loot: "Objetos y herramientas de su antigua ocupación."
  }),
  createStarterMonster({
    id: "libro-basico-alce-renacido",
    name: "Alce renacido",
    category: "Abominación",
    threat: "Complicado",
    summary: "Bestia corrupta de embestida pesada que añade Corrupción temporal a su cornada.",
    defense: "0",
    armor: "Piel de alce 3",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 11, cunning: 7, discreet: 10, persuasive: 5, quick: 13, resolute: 9, strong: 15, vigilant: 10 },
    traits: ["Arma natural (II)", "Ataque de corrupción (I)", "Robusto (II)"],
    actions: ["Armas: Cuernos 10, +1D4 de Corrupción temporal", "Habilidades: Combate sin armas (principiante), Golpe de hierro (adepto)"],
    tactics: "Ataca en cuanto huele criaturas vivientes, impulsado por espuma y corrupción.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-abojali-renacido",
    name: "Abojalí renacido",
    category: "Abominación",
    threat: "Difícil",
    summary: "Versión corrupta del abojalí, aún más dura y con sangre y mordisco infectados.",
    defense: "+1",
    armor: "Piel de cerdo 8",
    toughness: "15",
    painThreshold: "8",
    attributes: { accurate: 7, cunning: 10, discreet: 7, persuasive: 5, quick: 13, resolute: 11, strong: 15, vigilant: 9 },
    traits: ["Arma natural (III)", "Ataque de Corrupción (II)", "Duro (III)", "Robusto (III)", "Sangre ácida (III)"],
    actions: ["Armas: Colmillos 11 (Largos), +1D6 de Corrupción temporal", "Habilidades: Golpe de hierro (adepto)"],
    tactics: "Gruñe con ansias de carne viva y nunca duda en cargar de frente.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-abominacion-primigenia",
    name: "Abominación primigenia",
    category: "Abominación",
    threat: "Mortal",
    summary: "Avatar corrupto de destrucción pura, diseñado como encuentro de jefe extremo.",
    defense: "+3",
    armor: "Piel endurecida por la Corrupción 10; regenera 4 por turno",
    toughness: "18",
    painThreshold: "9",
    attributes: { accurate: 13, cunning: 9, discreet: 5, persuasive: 7, quick: 11, resolute: 10, strong: 18, vigilant: 10 },
    traits: ["Arma natural (III)", "Ataque de Corrupción (III)", "Duro (III)", "Regeneración (III)", "Robusto (III)", "Sangre ácida (III)"],
    actions: ["Armas: Garras 20 (Largas) o dos ataques 18 y 14, +1D8 de Corrupción temporal", "Habilidades: Atributo excepcional (Fuerte, maestro), Berserker (maestro), Combate sin armas (maestro), Golpe de hierro (maestro)"],
    tactics: "No usa sutileza; solo persigue destrucción total y presión constante sobre todo lo vivo.",
    loot: "Restos corruptos de enorme valor alquímico."
  }),
  createStarterMonster({
    id: "libro-basico-dragul",
    name: "Dragul",
    category: "Muerto viviente",
    threat: "Normal",
    summary: "No muerto marcial básico, útil como línea de choque y guardián de ruinas.",
    defense: "0 (escudo)",
    armor: "Cuero tachonado 2 (Incómoda)",
    toughness: "15",
    painThreshold: "—",
    attributes: { accurate: 9, cunning: 7, discreet: 10, persuasive: 5, quick: 10, resolute: 13, strong: 15, vigilant: 11 },
    traits: ["Muerto viviente (I)"],
    actions: ["Armas: Espada oxidada 7", "Habilidades: Combate con escudo (principiante), Golpe de hierro (adepto)"],
    tactics: "Sigue la voluntad de su creador o el hambre de sangre fresca y carne caliente.",
    loot: "1D10 ortegs."
  }),
  createStarterMonster({
    id: "libro-basico-hielo-fatuo",
    name: "Hielo fatuo",
    category: "Muerto viviente",
    threat: "Sencillo",
    summary: "Espíritu débil pero molesto que drena fuerza vital ignorando armaduras físicas.",
    defense: "-3",
    armor: "Ninguna; las armas normales solo le hacen la mitad de daño",
    toughness: "10",
    painThreshold: "—",
    attributes: { accurate: 10, cunning: 9, discreet: 11, persuasive: 5, quick: 13, resolute: 15, strong: 7, vigilant: 10 },
    traits: ["Daño alternativo (I)", "Forma espiritual (I)"],
    actions: ["Armas: Toque de muerte 3, ignora armadura, daño igual a Fuerte"],
    tactics: "Se ve atraído por el calor y toca a las víctimas sin seguir táctica elaborada.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-necromago",
    name: "Necromago",
    category: "Muerto viviente",
    threat: "Complicado",
    summary: "Espíritu controlador que atrae víctimas con magia y las remata con terror y garras.",
    defense: "-3",
    armor: "Solo sufre daño por armas mágicas (mitad) y poderes místicos (completo)",
    toughness: "10",
    painThreshold: "—",
    attributes: { accurate: 10, cunning: 9, discreet: 11, persuasive: 5, quick: 13, resolute: 15, strong: 7, vigilant: 10 },
    traits: ["Daño alternativo (III)", "Forma espiritual (III)", "Terrorífico (II)"],
    actions: ["Armas: Garras espectrales 5, ignoran armadura, daño igual a Tenaz", "Habilidades: Poder místico (Someter voluntad, adepto)"],
    tactics: "Somete la voluntad de sus víctimas para acercarlas, aterrorizarlas y devorar su espíritu.",
    loot: "Ninguno."
  }),
  createStarterMonster({
    id: "libro-basico-moratumbas",
    name: "Moratumbas",
    category: "Muerto viviente",
    threat: "Difícil",
    summary: "Guardia espectral de tumbas, muy difícil de trabar y letal si paraliza primero.",
    defense: "-3 (dos armas)",
    armor: "Solo sufre daño por armas mágicas y poderes místicos, y solo la mitad",
    toughness: "15",
    painThreshold: "—",
    attributes: { accurate: 5, cunning: 10, discreet: 7, persuasive: 10, quick: 11, resolute: 13, strong: 15, vigilant: 9 },
    traits: ["Forma corpórea (III)", "Forma espiritual (III)", "Frío de ultratumba (III)"],
    actions: ["Armas: Dos espadas 7/6 (Equilibradas), dos ataques al mismo objetivo", "Habilidades: Ataque con dos armas (maestro), Golpe de hierro (maestro)"],
    tactics: "Empieza con su ataque paralizante y luego usa sus espadas para rematar a la víctima inmóvil.",
    loot: "Dos espadas espectrales."
  })
];

const BASIC_BOOK_PAGES = [
  202, 202, 203, 203, 205, 205, 206, 206, 209, 209, 209, 209, 210, 210, 212, 212, 213, 213, 214,
  214, 217, 217, 218, 218, 219, 221, 221, 223, 223, 224, 224, 226, 226, 228, 228, 230, 231
] as const;

const BASIC_BOOK_FAMILIES = [
  "Elfos", "Elfos", "Elfos", "Elfos",
  "Trolls", "Trolls", "Trolls", "Trolls",
  ...Array.from({ length: 12 }, () => "Adversarios humanos"),
  "Arañas", "Arañas",
  "Depredadores", "Depredadores", "Depredadores",
  "Reptiles", "Reptiles",
  "Criaturas aladas", "Criaturas aladas",
  "Abominaciones", "Abominaciones", "Abominaciones", "Abominaciones",
  "Muertos vivientes", "Muertos vivientes", "Muertos vivientes", "Muertos vivientes"
] as const;

function firstPublishedNumber(value: string): number | null {
  const match = value.match(/(?<![A-Za-z])\d+(?![A-Za-z])/);
  return match ? Number(match[0]) : null;
}

const PUBLISHED_ATTACK_NAMES = [
  "Lanza de fuego como martillo de guerra",
  "Daga de fabricación maestra",
  "Bastón de madera tallada",
  "Garrote con pinchos",
  "Lanza de fuego portátil",
  "Arma a una mano",
  "Ataque de barrido",
  "Dos armas a una mano",
  "Espada a dos manos",
  "Garras apresadoras",
  "Garras espectrales",
  "Golpe de escudo",
  "Hoja de esgrima",
  "Lanza arrojadiza",
  "Mandíbulas roedoras",
  "Martillo a dos manos",
  "Ramas desolladoras",
  "Ramas espinosas",
  "Ramas firmes",
  "Ramas nudosas",
  "Daga de parada",
  "Daga ritual",
  "Espada bastarda",
  "Espada oxidada",
  "Estilete envenenado",
  "Garras de oso",
  "Hacha a dos manos",
  "Látigo largo",
  "Martillo largo",
  "Toque de muerte",
  "Arco largo",
  "Arma arrojadiza",
  "Ataque sin armas",
  "Abrazo aplastante",
  "Cuchillo arrojadizo",
  "Hebras miceliales",
  "Tajo terrorífico",
  "Uñas de hielo",
  "Alabarda",
  "Aguijón",
  "Ballesta",
  "Cabezazo",
  "Colmillos",
  "Cuchillo",
  "Cuernos",
  "Escalpelo",
  "Estilete",
  "Mangual",
  "Mordisco",
  "Pezuñas",
  "Picadura",
  "Tentáculos",
  "Espada",
  "Garras",
  "Lanza",
  "Patas",
  "Puños y botellas",
  "Puños",
  "Zarpas",
  "Arco",
  "Daga",
  "Hacha",
  "Pico",
  "Vara",
  "Ahogar"
] as const;

const PUBLISHED_ATTACK_PATTERN = new RegExp(
  `(?<![\\p{L}])(${PUBLISHED_ATTACK_NAMES
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\s+(\\d+(?:\\/\\d+)?)`,
  "giu"
);

/**
 * Turns a published `Armas` cell into one profile per actual weapon. Rules that
 * contain other numbers (poison, corruption, bonuses or extra attacks) remain
 * attached to the preceding weapon instead of becoming bogus weapon cards.
 */
export function parsePublishedWeaponProfiles(value: string): MonsterWeaponProfile[] {
  let raw = value.trim();
  if (!raw || ["ninguna", "ninguno"].includes(normalizePublishedName(raw))) {
    return [];
  }

  // These two Basic Book profiles describe physically separate weapons while
  // publishing a shared damage expression.
  raw = raw
    .replace(/\bHacha y espada\s+(\d+(?:\/\d+)?)/iu, (_match, damage: string) => `Hacha ${damage}, espada ${damage}`)
    .replace(/\bDos espadas\s+(\d+)\/(\d+)/iu, (_match, first: string, second: string) => `Espada ${first}, espada ${second}`);

  const matches = [...raw.matchAll(PUBLISHED_ATTACK_PATTERN)];
  if (!matches.length) {
    const damage = firstPublishedNumber(raw);
    return [{
      attribute: "",
      name: raw.split(/\d/)[0]?.trim().replace(/[,.]+$/, "") || raw,
      damage: damage === null ? "" : String(damage),
      damageFormula: "",
      fixedValue: damage,
      qualities: raw.match(/\(([^)]+)\)/)?.[1] ?? "",
      details: raw
    }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? raw.length;
    const details = raw.slice(start, end).trim().replace(/^[,.;\s]+|[,.;\s]+$/g, "");
    const damage = match[2] ?? "";
    return {
      attribute: "",
      name: match[1]?.trim() || details,
      damage,
      damageFormula: "",
      fixedValue: firstPublishedNumber(damage),
      qualities: details.match(/\(([^)]+)\)/)?.[1] ?? "",
      details
    };
  });
}

BASIC_BOOK_MONSTERS.forEach((monster, index) => {
  const page = BASIC_BOOK_PAGES[index] ?? 201;
  const family = BASIC_BOOK_FAMILIES[index] ?? monster.name;
  const weaponDetails = monster.sheet.actions.find((entry) => normalizePublishedName(entry).startsWith("armas:"))
    ?.replace(/^Armas:\s*/i, "") ?? "";
  const weapons = parsePublishedWeaponProfiles(weaponDetails);
  const damage = weapons[0]?.fixedValue ?? null;
  const armor = firstPublishedNumber(monster.sheet.armor);
  const reference = { source: "Libro Básico", page, pdfPage: page + 1 };
  monster.sheet.family = family;
  monster.sheet.description = monster.summary;
  monster.sheet.tactics = BASIC_BOOK_MONSTER_TACTICS[index] ?? monster.sheet.tactics;
  monster.sheet.sourceReferences = [reference];
  monster.sheet.appearanceOrder = index;
  monster.sheet.weapons = weapons;
  monster.sheet.actions = [
    ...weapons.map((weapon) => `Armas: ${weapon.details}`),
    ...monster.sheet.actions.filter((entry) => !normalizePublishedName(entry).startsWith("armas:"))
  ];
  monster.sheet.fixedValues = { damage, armor };
  monster.sheet.capabilities = monster.sheet.capabilities.map((entry) => ({
    ...entry,
    page,
    references: [{ source: "Libro Básico", page }]
  }));
  monster.threat = getMonsterCreationChallenge(monster.sheet);
  monster.family = family;
  monster.references = [reference];
  monster.appearanceOrder = index;
});

function createCodexMonster(profile: CanonicalMonsterProfileData): Monster {
  const traitCapabilities = createPublishedCapabilities(profile.traitsText, "rasgo_monstruoso", profile.source, profile.page);
  const abilityCapabilities = createPublishedCapabilities(profile.abilitiesText, "habilidad", profile.source, profile.page);
  const blessingCapabilities = createPublishedCapabilities(profile.blessingsBurdensText, "bendicion", profile.source, profile.page);
  const capabilities = [...traitCapabilities, ...abilityCapabilities, ...blessingCapabilities];
  const traits = splitPublishedEntries(profile.traitsText);
  const fixedDamage = profile.weapons[0]?.damage ? firstPublishedNumber(profile.weapons[0].damage) : null;
  const fixedArmor = firstPublishedNumber(profile.armorText);
  const reference = { source: profile.source, page: profile.page, pdfPage: profile.pdfPage };
  const weapons: MonsterWeaponProfile[] = profile.weapons.map((weapon) => ({
    ...weapon,
    damageFormula: "",
    fixedValue: firstPublishedNumber(weapon.damage)
  }));
  const sheet: MonsterSheet = {
    attack: weapons[0]?.attribute || "Ver armas",
    damage: weapons[0]?.damage || "Según arma o rasgo",
    defense: profile.defense,
    armor: profile.armorText,
    toughness: profile.toughness,
    painThreshold: profile.painThreshold,
    movement: "-",
    attributes: profile.attributes,
    traits,
    actions: [
      ...weapons.map((weapon) => `Armas: ${weapon.details}`),
      ...(profile.abilitiesText && normalizePublishedName(profile.abilitiesText) !== "ninguna" ? [`Habilidades: ${profile.abilitiesText}`] : [])
    ],
    capabilities,
    equipment: profile.equipmentText
      ? [{ catalogId: `publicado-${profile.id}-equipo`, name: profile.equipmentText.slice(0, 180), category: "gear", damageFormula: "", protectionFormula: "", fixedValue: null, value: "", qualities: "", notes: profile.equipmentText }]
      : [],
    fixedValues: { damage: fixedDamage, armor: fixedArmor },
    family: profile.family,
    variant: profile.variant,
    race: profile.race,
    description: profile.description,
    conduct: profile.conduct,
    shadow: profile.shadow,
    corruption: profile.corruption,
    publishedThreat: profile.publishedThreat,
    blessingsBurdens: profile.blessingsBurdensText,
    sourceReferences: [reference],
    weapons,
    armorDetails: profile.armorText,
    publishedText: profile.publishedText,
    profileFormat: profile.profileFormat,
    appearanceOrder: 37 + profile.appearanceOrder,
    tactics: profile.tactics,
    weakness: "",
    loot: profile.equipmentText
  };
  const threat = getMonsterCreationChallenge(sheet);
  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    threat,
    source: profile.source,
    summary: profile.description.slice(0, 500),
    sheet,
    family: profile.family,
    variant: profile.variant,
    references: [reference],
    appearanceOrder: sheet.appearanceOrder,
    publishedThreat: profile.publishedThreat,
    createdAt: STARTER_MONSTER_TIMESTAMP,
    updatedAt: STARTER_MONSTER_TIMESTAMP
  };
}

const CANONICAL_CODEX_MONSTERS = CODEX_MONSTER_PROFILE_DATA.map(createCodexMonster);

const PROVISIONAL_MONSTER_CODEX = [
  {
    id: "codex-abominacion-devoradora",
    name: "Abominación devoradora",
    category: "Abominación",
    threat: "Complicado",
    source: "Códice de monstruos · Lote inicial",
    summary: "Depredador corrupto de asalto frontal, diseñado para castigar posiciones cerradas y sembrar terror.",
    sheet: {
      attack: "+3",
      damage: "1d10",
      defense: "-2",
      armor: "1d6",
      toughness: "18",
      painThreshold: "9",
      movement: "12 m",
      attributes: {
        accurate: 13,
        cunning: 9,
        discreet: 11,
        persuasive: 5,
        quick: 12,
        resolute: 15,
        strong: 14,
        vigilant: 11
      },
      capabilities: [],
      fixedValues: { damage: 5, armor: 3 },
      traits: ["Armadura natural I", "Ataque múltiple I", "Aura corruptora I", "Terrorífico I"],
      actions: ["Zarpazo doble", "Arremetida contaminante"],
      tactics: "Entra por el objetivo más aislado, fuerza chequeos de Resoluto y presiona hasta romper la línea.",
      weakness: "Fuego y terreno abierto; pierde presión si no puede encadenar ataques.",
      loot: "Tejidos corruptos, bilis alquímica y trofeos contaminados."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  {
    id: "codex-lobo-de-davokar",
    name: "Lobo de Davokar",
    category: "Bestia",
    threat: "Normal",
    source: "Códice de monstruos · Lote inicial",
    summary: "Cazador rápido en manada, eficaz para hostigar exploradores y rematar objetivos heridos.",
    sheet: {
      attack: "+1",
      damage: "1d6",
      defense: "+2",
      armor: "1",
      toughness: "10",
      painThreshold: "5",
      movement: "14 m",
      attributes: {
        accurate: 11,
        cunning: 9,
        discreet: 13,
        persuasive: 5,
        quick: 15,
        resolute: 10,
        strong: 10,
        vigilant: 12
      },
      capabilities: [],
      fixedValues: { damage: 3, armor: 1 },
      traits: ["Sentidos agudos I", "Ataque en manada I", "Derribo I"],
      actions: ["Mordisco", "Hostigar y retirarse"],
      tactics: "Busca flancos, fuerza persecución y gana bonificadores cuando actúa junto a otros lobos.",
      weakness: "Sufre en espacios cerrados y frente a objetivos con armadura pesada.",
      loot: "Piel, colmillos y rastros útiles para caza."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  {
    id: "codex-dragul",
    name: "Dragul",
    category: "Muerto viviente",
    threat: "Complicado",
    source: "Códice de monstruos · Lote inicial",
    summary: "No muerto brutal pensado para aguantar la primera descarga y fijar a los héroes en combate cerrado.",
    sheet: {
      attack: "+2",
      damage: "1d8",
      defense: "-1",
      armor: "1d6",
      toughness: "16",
      painThreshold: "-",
      movement: "8 m",
      attributes: {
        accurate: 12,
        cunning: 7,
        discreet: 8,
        persuasive: 6,
        quick: 9,
        resolute: 13,
        strong: 15,
        vigilant: 10
      },
      capabilities: [],
      fixedValues: { damage: 4, armor: 3 },
      traits: ["No muerto", "Aguante sobrenatural I", "Miedo I", "Garras I"],
      actions: ["Zarpazo necrótico", "Aferrar presa"],
      tactics: "Avanza sin preocuparse por daño crítico, inmoviliza y abre espacio para otros horrores.",
      weakness: "Luz sagrada, fuego y tácticas de movilidad.",
      loot: "Reliquias funerarias, armas antiguas y joyería ennegrecida."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  {
    id: "codex-reina-espora",
    name: "Reina espora",
    category: "Flora",
    threat: "Legendario",
    source: "Códice de monstruos · Lote inicial",
    summary: "Nodo vegetal monstruoso que domina una zona, controla visión y castiga con venenos y raíces.",
    sheet: {
      attack: "+1",
      damage: "1d12",
      defense: "-3",
      armor: "1d8",
      toughness: "22",
      painThreshold: "11",
      movement: "0 m",
      attributes: {
        accurate: 10,
        cunning: 12,
        discreet: 6,
        persuasive: 4,
        quick: 5,
        resolute: 15,
        strong: 16,
        vigilant: 12
      },
      capabilities: [],
      fixedValues: { damage: 6, armor: 4 },
      traits: ["Raíces prensiles II", "Nube tóxica II", "Armadura vegetal II", "Regeneración I"],
      actions: ["Látigo de raíces", "Descarga de esporas"],
      tactics: "Convierte el terreno en un embudo, bloquea retirada y desgasta por exposición prolongada.",
      weakness: "Fuego, aceites y pérdida de cobertura natural.",
      loot: "Sacos de esporas, savia rara y componentes alquímicos."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  {
    id: "codex-jinete-goblin",
    name: "Jinete goblin",
    category: "Ser civilizado",
    threat: "Normal",
    source: "Códice de monstruos · Lote inicial",
    summary: "Hostigador móvil que golpea desde alcance variable y explota cobertura, humo y terreno difícil.",
    sheet: {
      attack: "+1",
      damage: "1d6",
      defense: "+1",
      armor: "1d4",
      toughness: "11",
      painThreshold: "5",
      movement: "16 m",
      attributes: {
        accurate: 11,
        cunning: 12,
        discreet: 13,
        persuasive: 9,
        quick: 14,
        resolute: 9,
        strong: 8,
        vigilant: 10
      },
      capabilities: [],
      fixedValues: { damage: 3, armor: 2 },
      traits: ["Montura veloz I", "Escaramuza I", "Truco sucio I"],
      actions: ["Lanza corta", "Disparo rápido", "Retirada táctica"],
      tactics: "Evita quedarse trabado, castiga retaguardia y corta líneas de visión con humo o cobertura.",
      weakness: "Pierde eficacia cuando desmonta o es rodeado.",
      loot: "Jabalinas, amuletos tribales, cuero trabajado."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  {
    id: "codex-anomalia-de-sombra",
    name: "Anomalía de sombra",
    category: "Fenómeno",
    threat: "Complicado",
    source: "Códice de monstruos · Lote inicial",
    summary: "Entidad inestable que deforma percepción y castiga a personajes con baja disciplina mental.",
    sheet: {
      attack: "+2",
      damage: "1d8",
      defense: "+1",
      armor: "1d4",
      toughness: "14",
      painThreshold: "7",
      movement: "10 m flotando",
      attributes: {
        accurate: 12,
        cunning: 13,
        discreet: 12,
        persuasive: 6,
        quick: 12,
        resolute: 14,
        strong: 9,
        vigilant: 14
      },
      capabilities: [],
      fixedValues: { damage: 4, armor: 2 },
      traits: ["Intangible por pulsos I", "Oscuridad viva I", "Desorientar I"],
      actions: ["Latigazo umbrío", "Estallido de sombras"],
      tactics: "Aparece, golpea sobre el más frágil mentalmente y desaparece antes de quedar fijada.",
      weakness: "Luz intensa, zonas consagradas y ataques coordinados.",
      loot: "Residuos umbríos, cristal ennegrecido y vestigios arcanos."
    },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z"
  },
  ...BASIC_BOOK_MONSTERS
];

void PROVISIONAL_MONSTER_CODEX;

export const STARTER_MONSTER_CODEX: Monster[] = [
  ...BASIC_BOOK_MONSTERS,
  ...CANONICAL_CODEX_MONSTERS
];
