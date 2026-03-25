import { z } from "zod";
export * from "./symbaroumCompendium.js";
export * from "./campaignActionEngine.js";

export const userRoleSchema = z.enum(["player", "gm", "superadmin"]);
export const registerRoleSchema = z.enum(["player", "gm"]);
export const skillLevelSchema = z.enum(["novato", "adepto", "maestro"]);
export const actionCostSchema = z.enum(["free", "movement", "combat", "reaction"]);
export const campaignChatVisibilitySchema = z.enum(["all", "gm_only"]);
export const campaignChatMessageTypeSchema = z.enum(["text", "action"]);

export type UserRole = z.infer<typeof userRoleSchema>;
export type RegisterRole = z.infer<typeof registerRoleSchema>;
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

const STARTING_ABILITY_PATTERNS = new Set(["5novato", "2novato_1adepto"]);
const MYSTIC_ABILITY_NAMES = ["Poder místico", "Magia", "Teúrgia", "Brujería", "Hechicería"];
const RITUAL_ABILITY_NAMES = ["Rituales"];
const NORMALIZED_MYSTIC_ABILITY_NAMES = MYSTIC_ABILITY_NAMES.map(normalizeName);
const NORMALIZED_RITUAL_ABILITY_NAMES = RITUAL_ABILITY_NAMES.map(normalizeName);

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
  damageFormula: z.string().max(80).optional(),
  effectSummary: z.string().max(400).default("")
});

const ratedEntrySchema = z.object({
  nombre: z.string().min(1).max(120),
  tipo: z.string().max(120).default(""),
  efecto: z.string().max(1200).default(""),
  nivel: skillLevelSchema,
  fuente: z.string().max(120).default(""),
  pagina: z.number().int().min(1).max(2000).optional(),
  notas: z.string().max(800).default(""),
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

const characterSheetObjectSchema = z.object({
    identidad: z.object({
    nombreJugador: z.string().max(120).default(""),
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
  referencias: z.array(sourceRefSchema).max(300).default([]),
    notas: z.string().max(8000).default("")
  });

export const characterSheetSchema = characterSheetObjectSchema.superRefine((sheet, ctx) => {
    if (sheet.progreso.experienciaGastada > sheet.progreso.experienciaTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["progreso", "experienciaGastada"],
        message: "La experiencia gastada no puede ser mayor que la experiencia total"
      });
    }

    if (sheet.combate.robustezActual > sheet.combate.robustezMax) {
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

    const canonicalAbilityNames = sheet.habilidades.map((entry) => normalizeName(entry.nombre));
    const hasMysticAbility = canonicalAbilityNames.some((name) => NORMALIZED_MYSTIC_ABILITY_NAMES.includes(name));
    const hasRitualAbility = canonicalAbilityNames.some((name) => NORMALIZED_RITUAL_ABILITY_NAMES.includes(name));

    if (sheet.poderesMisticos.length > 0 && !hasMysticAbility) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["poderesMisticos"],
        message: "Para registrar poderes misticos debes incluir una habilidad mistica base (Poder místico, Magia, Teúrgia, Brujería o Hechicería)"
      });
    }

    if (sheet.rituales.length > 0 && !hasRitualAbility) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rituales"],
        message: "Para registrar rituales debes incluir la habilidad Rituales"
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

export type CharacterSheet = z.infer<typeof characterSheetSchema>;

export const importedCharacterSheetSchema = characterSheetObjectSchema.superRefine((sheet, ctx) => {
  if (sheet.progreso.experienciaGastada > sheet.progreso.experienciaTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["progreso", "experienciaGastada"],
      message: "La experiencia gastada no puede ser mayor que la experiencia total"
    });
  }

  if (sheet.combate.robustezActual > sheet.combate.robustezMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["combate", "robustezActual"],
      message: "La robustez actual no puede superar la robustez máxima"
    });
  }

  const canonicalAbilityNames = sheet.habilidades.map((entry) => normalizeName(entry.nombre));
  const hasMysticAbility = canonicalAbilityNames.some((name) => NORMALIZED_MYSTIC_ABILITY_NAMES.includes(name));
  const hasRitualAbility = canonicalAbilityNames.some((name) => NORMALIZED_RITUAL_ABILITY_NAMES.includes(name));

  if (sheet.poderesMisticos.length > 0 && !hasMysticAbility) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["poderesMisticos"],
      message: "Para registrar poderes misticos debes incluir una habilidad mistica base (Poder místico, Magia, Teúrgia, Brujería o Hechicería)"
    });
  }

  if (sheet.rituales.length > 0 && !hasRitualAbility) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rituales"],
      message: "Para registrar rituales debes incluir la habilidad Rituales"
    });
  }
});

export function createEmptyCharacterSheet(): CharacterSheet {
  return {
    identidad: {
      nombreJugador: "",
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
    referencias: [],
    notas: ""
  };
}

export function parseCharacterSheet(input: unknown): CharacterSheet {
  return importedCharacterSheetSchema.parse(input);
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

export const campaignMemberRoleSchema = z.enum(["gm", "player"]);
export const campaignSessionStatusSchema = z.enum(["planned", "completed", "cancelled"]);

export const createCampaignSchema = z.object({
  name: z.string().min(3).max(120),
  summary: z.string().max(400).default(""),
  setting: z.string().max(200).default(""),
  notes: z.string().max(4000).default(""),
  sharedNotes: z.string().max(6000).default("")
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
  label: z.string().min(2).max(80),
  aliases: z.array(z.string().min(1).max(120)).max(20).default([]),
  summary: z.string().max(300).default(""),
  content: z.string().max(6000).default(""),
  isPublic: z.boolean().default(false)
});

export const updateCampaignReferenceSchema = createCampaignReferenceSchema.partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CampaignMemberRole = z.infer<typeof campaignMemberRoleSchema>;
export type CampaignSessionStatus = z.infer<typeof campaignSessionStatusSchema>;
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

export type SupportUser = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  activeRefreshTokens: number;
};

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
  isPublic: boolean;
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
  damageFormula?: string;
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
