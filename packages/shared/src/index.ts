import { z } from "zod";
export * from "./symbaroumCompendium.js";

export const userRoleSchema = z.enum(["player", "gm", "superadmin"]);
export const registerRoleSchema = z.enum(["player", "gm"]);
export const skillLevelSchema = z.enum(["novato", "adepto", "maestro"]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type RegisterRole = z.infer<typeof registerRoleSchema>;
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const SYMBAROUM_RACES = [
  "Humano",
  "Goblin",
  "Ogro",
  "Cambiante",
  "Elfo",
  "Enano",
  "Orco"
] as const;

export const SYMBAROUM_CULTURES = [
  "Ambriano",
  "Bárbaro",
  "Clan goblin",
  "Pueblo libre",
  "Ordo Magica",
  "Templo de Prios"
] as const;

export const SYMBAROUM_ARCHETYPES = [
  "Guerrero",
  "Cazador",
  "Místico",
  "Pícaro",
  "Erudito"
] as const;

export const ATTRIBUTE_KEYS = [
  "agil",
  "atento",
  "discreto",
  "diestro",
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

const ratedEntrySchema = z.object({
  nombre: z.string().min(1).max(120),
  nivel: skillLevelSchema,
  fuente: z.string().max(120).default(""),
  pagina: z.number().int().min(1).max(2000).optional(),
  notas: z.string().max(800).default("")
});

const sourceRefSchema = z.object({
  libro: z.string().min(1).max(160),
  pagina: z.number().int().min(1).max(2000),
  nota: z.string().max(400).default("")
});

export const characterSheetSchema = z.object({
  identidad: z.object({
    nombreJugador: z.string().max(120).default(""),
    raza: z.enum(SYMBAROUM_RACES).or(z.string().min(1).max(80)),
    cultura: z.enum(SYMBAROUM_CULTURES).or(z.string().min(1).max(80)).default("Ambriano"),
    arquetipo: z.enum(SYMBAROUM_ARCHETYPES).or(z.string().min(1).max(80)).default("Guerrero"),
    profesion: z.string().max(120).default(""),
    edad: z.string().max(40).default(""),
    apariencia: z.string().max(240).default(""),
    trasfondo: z.string().max(4000).default("")
  }),
  atributos: attributeBlockSchema,
  progreso: z.object({
    nivel: z.number().int().min(1).max(200).default(1),
    experienciaTotal: z.number().int().min(0).max(100000).default(0),
    experienciaGastada: z.number().int().min(0).max(100000).default(0)
  }),
  combate: z.object({
    robustezMax: z.number().int().min(1).max(999).default(10),
    robustezActual: z.number().int().min(0).max(999).default(10),
    defensaMod: z.number().int().min(-20).max(20).default(0),
    iniciativaMod: z.number().int().min(-20).max(20).default(0),
    armadura: z.string().max(160).default(""),
    armaPrincipal: z.string().max(160).default(""),
    armaSecundaria: z.string().max(160).default(""),
    danioPrincipal: z.string().max(80).default(""),
    danioSecundaria: z.string().max(80).default("")
  }),
  corrupcion: z.object({
    temporal: z.number().int().min(0).max(999).default(0),
    permanente: z.number().int().min(0).max(999).default(0),
    umbral: z.number().int().min(0).max(999).default(5),
    notas: z.string().max(1000).default("")
  }),
  rasgos: z.array(z.string().min(1).max(120)).max(40).default([]),
  habilidades: z.array(ratedEntrySchema).max(120).default([]),
  poderesMisticos: z.array(ratedEntrySchema).max(120).default([]),
  rituales: z.array(ratedEntrySchema).max(120).default([]),
  equipo: z.array(z.string().min(1).max(180)).max(200).default([]),
  contactos: z.array(z.string().min(1).max(180)).max(80).default([]),
  referencias: z.array(sourceRefSchema).max(300).default([]),
  notas: z.string().max(8000).default("")
});

export type CharacterSheet = z.infer<typeof characterSheetSchema>;

export function createEmptyCharacterSheet(): CharacterSheet {
  return {
    identidad: {
      nombreJugador: "",
      raza: "Humano",
      cultura: "Ambriano",
      arquetipo: "Guerrero",
      profesion: "",
      edad: "",
      apariencia: "",
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
      defensaMod: 0,
      iniciativaMod: 0,
      armadura: "",
      armaPrincipal: "",
      armaSecundaria: "",
      danioPrincipal: "",
      danioSecundaria: ""
    },
    corrupcion: {
      temporal: 0,
      permanente: 0,
      umbral: 5,
      notas: ""
    },
    rasgos: [],
    habilidades: [],
    poderesMisticos: [],
    rituales: [],
    equipo: [],
    contactos: [],
    referencias: [],
    notas: ""
  };
}

export function parseCharacterSheet(input: unknown): CharacterSheet {
  return characterSheetSchema.parse(input);
}

export const createCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  archetype: z.string().min(2).max(80),
  race: z.string().min(2).max(80),
  culture: z.string().max(80).default(""),
  profession: z.string().max(120).default(""),
  level: z.number().int().min(1).max(200),
  sheet: characterSheetSchema
});

export const updateCharacterSchema = createCharacterSchema.partial().extend({
  sheet: characterSheetSchema
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
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

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: registerRoleSchema.default("player")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type SupportUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  activeRefreshTokens: number;
};
