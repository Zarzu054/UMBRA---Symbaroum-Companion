import { z } from "zod";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "./symbaroumCompendium.js";
import { getCharacterMonsterTraitEffects } from "./monsterTraitRules.js";
import { actorCapabilitySelectionSchema, getActorSpentXp, removeExceptionalAttributeBonuses, validateCreationAttributes, validateExceptionalAttributeSelections } from "./actorCreation.js";
import { STARTER_MONSTER_CODEX, monsterSheetSchema } from "./monsterCodex.js";
export * from "./symbaroumCompendium.js";
export * from "./campaignActionEngine.js";
export * from "./monsterCodex.js";
export * from "./monsterTraitRules.js";
export * from "./actorCreation.js";
export * from "./professionCatalog.js";
export * from "./weaponCatalog.js";
export * from "./mysticArtifacts.js";
export * from "./mysticArtifactProjection.js";
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
];
export const SYMBAROUM_CULTURES = [
    "Ambriano",
    "B\u00e1rbaro",
    "Clan goblin",
    "Pueblo libre",
    "Ordo M\u00e1gica",
    "Templo de Prios"
];
export const SYMBAROUM_ARCHETYPES = [
    "Guerrero",
    "Cazador",
    "M\u00edstico",
    "Maleante"
];
export const ATTRIBUTE_KEYS = [
    "agil",
    "atento",
    "diestro",
    "discreto",
    "fuerte",
    "inteligente",
    "persuasivo",
    "tenaz"
];
export const ATTRIBUTE_LABELS = {
    agil: "Agil",
    atento: "Atento",
    discreto: "Discreto",
    diestro: "Diestro",
    fuerte: "Fuerte",
    inteligente: "Inteligente",
    persuasivo: "Persuasivo",
    tenaz: "Tenaz"
};
const MYSTIC_ABILITY_NAMES = ["Magia", "Teúrgia", "Brujería", "Hechicería"];
const SHEET_HIDDEN_ABILITY_NAMES = ["Poder místico"];
const NORMALIZED_MYSTIC_ABILITY_NAMES = MYSTIC_ABILITY_NAMES.map(normalizeName);
const NORMALIZED_SHEET_HIDDEN_ABILITY_NAMES = SHEET_HIDDEN_ABILITY_NAMES.map(normalizeName);
const MONSTER_TRAIT_NAME_SET = buildMonsterTraitNameSet();
function nullableDefaultString(maxLength, fallback = "") {
    return z.preprocess((value) => value == null ? fallback : value, z.string().max(maxLength).default(fallback));
}
const attributeBlockSchema = z.object({
    agil: z.number().int().min(5).max(18),
    atento: z.number().int().min(5).max(18),
    discreto: z.number().int().min(5).max(18),
    diestro: z.number().int().min(5).max(18),
    fuerte: z.number().int().min(5).max(18),
    inteligente: z.number().int().min(5).max(18),
    persuasivo: z.number().int().min(5).max(18),
    tenaz: z.number().int().min(5).max(18)
});
const actionMetadataSchema = z.object({
    id: z.string().min(1).max(120),
    label: z.string().min(1).max(120),
    cost: actionCostSchema.default("combat"),
    requiredLevel: skillLevelSchema.optional(),
    rollAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
    opponentAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
    fixedTarget: z.number().int().min(1).max(20).optional(),
    damageFormula: z.preprocess((value) => value == null ? undefined : value, z.string().max(80).optional()),
    effectSummary: nullableDefaultString(400, ""),
    corruptionFormula: z.string().max(80).optional(),
    artifactAbilityId: z.string().max(120).optional(),
    disabledReason: z.string().max(400).optional(),
    rolls: z.array(z.object({
        id: z.string().min(1).max(120),
        kind: z.enum(["check", "attack", "damage", "armor", "healing", "custom"]),
        label: z.string().min(1).max(160),
        formula: z.string().max(80).default(""),
        actorAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
        opponentAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
        fixedTarget: z.number().int().min(1).max(99).optional()
    })).max(12).optional()
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
    sourceType: z.enum(["weapon", "ability", "power", "ritual", "artifact", "utility"]).default("ability"),
    sourceName: z.string().min(1).max(160),
    cost: actionCostSchema.default("combat"),
    requiredLevel: skillLevelSchema.optional(),
    rollAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
    opponentAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
    fixedTarget: z.number().int().min(1).max(20).optional(),
    damageFormula: z.string().max(80).optional(),
    effectSummary: z.string().max(800).default(""),
    category: z.string().max(80).default("general"),
    notes: z.string().max(800).default(""),
    linkedItemId: z.string().max(120).default(""),
    corruptionFormula: z.string().max(80).optional(),
    artifactAbilityId: z.string().max(120).optional(),
    disabledReason: z.string().max(400).optional(),
    rolls: z.array(z.object({
        id: z.string().min(1).max(120),
        kind: z.enum(["check", "attack", "damage", "armor", "healing", "custom"]),
        label: z.string().min(1).max(160),
        formula: z.string().max(80).default(""),
        actorAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
        opponentAttribute: z.enum(ATTRIBUTE_KEYS).optional(),
        fixedTarget: z.number().int().min(1).max(99).optional()
    })).max(12).optional()
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
    managedArtifactId: z.string().max(120).optional(),
    artifactBound: z.boolean().optional(),
    artifactBindingCostLabel: z.string().max(160).optional(),
    artifactResources: z.array(z.object({
        id: z.string().min(1).max(120),
        name: z.string().min(1).max(160),
        current: z.number().int().min(0).max(9999),
        maximum: z.number().int().min(0).max(9999)
    })).max(20).optional(),
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
const STRUCTURED_DM_NOTES_PREFIX = "__UMBRA_DM_NOTES_V1__:";
function buildLegacyCharacterNoteEntries(input) {
    const entries = [];
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
            title: "Notas de campaña",
            content: campaignContent.trim(),
            category: "campaign",
            createdAt: "",
            updatedAt: ""
        });
    }
    return entries;
}
function normalizeCharacterNoteEntries(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => characterNoteEntrySchema.safeParse(entry))
        .filter((result) => result.success)
        .map((result) => ({
        ...result.data,
        title: result.data.title.trim(),
        content: result.data.content.trim()
    }))
        .filter((entry) => entry.title.length > 0 || entry.content.length > 0)
        .slice(0, 200);
}
function normalizeCampaignSharedNoteEntries(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => campaignSharedNoteEntrySchema.safeParse(entry))
        .filter((result) => result.success)
        .map((result) => ({
        ...result.data,
        title: result.data.title.trim(),
        content: result.data.content.trim(),
        authorEmail: result.data.authorEmail.trim()
    }))
        .filter((entry) => entry.title.length > 0 || entry.content.length > 0)
        .slice(0, 200);
}
export function encodeCampaignSharedNotes(entries) {
    const normalized = normalizeCampaignSharedNoteEntries(entries);
    if (normalized.length === 0) {
        return "";
    }
    return `${STRUCTURED_SHARED_NOTES_PREFIX}${JSON.stringify(normalized)}`;
}
export function decodeCampaignSharedNotes(raw) {
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
    }
    catch {
        return {
            legacyText: "",
            entries: []
        };
    }
}
export function encodeCampaignDmNotes(entries) {
    const normalized = normalizeCampaignSharedNoteEntries(entries);
    if (normalized.length === 0) {
        return "";
    }
    return `${STRUCTURED_DM_NOTES_PREFIX}${JSON.stringify(normalized)}`;
}
export function decodeCampaignDmNotes(raw) {
    const normalizedRaw = String(raw ?? "");
    if (!normalizedRaw.startsWith(STRUCTURED_DM_NOTES_PREFIX)) {
        const legacyText = normalizedRaw.trim();
        return {
            legacyText,
            entries: legacyText
                ? [{
                        id: "legacy-dm-note",
                        title: "Notas privadas del DJ",
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
        const parsed = JSON.parse(normalizedRaw.slice(STRUCTURED_DM_NOTES_PREFIX.length));
        return {
            legacyText: "",
            entries: normalizeCampaignSharedNoteEntries(parsed)
        };
    }
    catch {
        return { legacyText: "", entries: [] };
    }
}
const characterSheetObjectSchema = z.object({
    resolutionMode: z.enum(["player_rolls", "fixed_average"]).default("player_rolls"),
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
    capabilitySelections: z.array(actorCapabilitySelectionSchema).max(300).default([]),
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
    gmBackground: z.object({
        tactics: z.string().max(2000).default(""),
        weakness: z.string().max(2000).default(""),
        loot: z.string().max(2000).default("")
    }).default({ tactics: "", weakness: "", loot: "" }),
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
    const baseAttributes = removeExceptionalAttributeBonuses(sheet.atributos, sheet.capabilitySelections);
    const attributeValidation = validateCreationAttributes(baseAttributes);
    for (const message of attributeValidation.errors) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["atributos"],
            message
        });
    }
    for (const message of validateExceptionalAttributeSelections(sheet.capabilitySelections, ATTRIBUTE_KEYS)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["capabilitySelections"], message });
    }
    if (sheet.resolutionMode === "player_rolls" && sheet.capabilitySelections.length > 0 && getActorSpentXp(sheet.capabilitySelections) > getEffectiveExperienceTotal(sheet)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["capabilitySelections"],
            message: "Las capacidades seleccionadas superan la experiencia disponible"
        });
    }
});
function normalizeName(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}
function buildMonsterTraitNameSet() {
    const names = new Set();
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
function extractMonsterTraitBaseName(value) {
    return normalizeName(value)
        .replace(/\((?:i{1,3}|[1-3])\)/g, "")
        .replace(/\b(?:i{1,3}|[1-3])\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function parseMonsterTraitLevel(value) {
    const normalized = normalizeName(value);
    if (/\bmaestro\b|\biii\b|\b3\b/.test(normalized))
        return "maestro";
    if (/\badepto\b|\bii\b|\b2\b/.test(normalized))
        return "adepto";
    return "novato";
}
function isCharacterMonsterTrait(value) {
    return MONSTER_TRAIT_NAME_SET.has(extractMonsterTraitBaseName(value));
}
function buildMonsterTraitAbilityEntries(rasgos, existingAbilities) {
    const existingNames = new Set((existingAbilities ?? []).map((entry) => normalizeName(entry.nombre)));
    const migrated = [];
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
function filterCharacterNonMonsterTraits(rasgos) {
    return (rasgos ?? []).filter((rasgo) => !isCharacterMonsterTrait(rasgo));
}
function getEffectiveExperienceTotal(sheet) {
    return Number(sheet.progreso?.experienciaTotal ?? 0) + (Array.isArray(sheet.cargas) ? sheet.cargas.length * 5 : 0);
}
export function getEffectiveCharacterRobustezMax(sheet) {
    const automaticMax = getCharacterMonsterTraitEffects(sheet).robustezMaxima;
    const explicitMax = Number(sheet.combate?.robustezMax ?? 0);
    return automaticMax > 0 ? automaticMax : explicitMax;
}
function slugify(value) {
    return normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}
function coerceAttribute(value) {
    const normalized = normalizeName(value);
    if (ATTRIBUTE_KEYS.includes(normalized)) {
        return normalized;
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
function inferInventoryCategory(name) {
    const normalized = normalizeName(name);
    if (/(espada|arco|lanza|daga|arma|martillo|hacha|ballesta)/.test(normalized))
        return "weapon";
    if (/(armadura|escudo|yelmo|casco|coraza|malla)/.test(normalized))
        return "armor";
    if (/(pocion|elixir|vial|brebaje|racion|antorcha)/.test(normalized))
        return "consumable";
    if (/(artefacto|reliquia|amuleto)/.test(normalized))
        return "artifact";
    if (/(moneda|thaler|dinero|tesoro)/.test(normalized))
        return "treasure";
    return "gear";
}
function isNaturalArmorPlaceholderName(value) {
    const normalized = normalizeName(value);
    return normalized === "natural" || normalized === "armadura natural";
}
function hasCharacterTraitBasedNaturalArmor(sheet) {
    return Boolean(getCharacterMonsterTraitEffects(sheet).armorFormula);
}
function stripNaturalArmorPlaceholderItems(items, sheet) {
    if (!hasCharacterTraitBasedNaturalArmor(sheet)) {
        return items;
    }
    return items.filter((item) => !(item.category === "armor" && isNaturalArmorPlaceholderName(item.name)));
}
function migrateShieldInventoryItems(items) {
    return items.map((item) => {
        const normalizedName = normalizeName(item.name);
        const isShield = item.category === "armor"
            && (normalizedName.includes("escudo") || normalizedName === "rodela" || normalizeName(item.qualities).includes("escudo"));
        if (!isShield)
            return item;
        const hasDefenseBonus = item.modifiers.some((modifier) => modifier.modifierType === "defense");
        return {
            ...item,
            category: "weapon",
            attackAttribute: item.attackAttribute ?? "diestro",
            damageFormula: item.damageFormula || "1d4",
            protectionFormula: "",
            slot: item.slot === "armor" ? "offHand" : item.slot,
            modifiers: hasDefenseBonus
                ? item.modifiers
                : [...item.modifiers, {
                        id: `${item.id}-shield-defense`,
                        label: "Bonificacion de escudo",
                        modifierType: "defense",
                        value: "+1",
                        notes: "Bonificacion base por llevar el escudo equipado."
                    }]
        };
    });
}
function buildLegacyInventoryItems(sheet) {
    const items = [];
    const pushItem = (item) => {
        if (!items.some((entry) => entry.id === item.id)) {
            items.push(item);
        }
    };
    const addWeapon = (id, name, slot, damageFormula, attribute, qualities) => {
        const trimmed = (name ?? "").trim();
        if (!trimmed)
            return;
        const normalizedName = normalizeName(trimmed);
        if (normalizedName === "natural" || normalizedName === "arma natural" || normalizedName === "armas naturales")
            return;
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
        if (!trimmed)
            continue;
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
        if (!artifact.nombre.trim())
            continue;
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
function buildLegacyEquipmentSlots(items, sheet) {
    const findByName = (name) => items.find((item) => normalizeName(item.name) === normalizeName(name))?.id ?? "";
    return {
        mainHand: findByName(sheet.combate.armaPrincipal),
        offHand: findByName(sheet.combate.armaSecundaria),
        ranged: findByName(sheet.combate.armaTerciaria) || findByName(sheet.combate.armaCuaternaria),
        armor: findByName(sheet.combate.armadura),
        artifact: items.find((item) => item.slot === "artifact")?.id ?? "",
        worn: ""
    };
}
function synchronizeInventoryEquipment(items, rawSlots) {
    const slotKeys = ["mainHand", "offHand", "ranged", "armor", "artifact", "worn"];
    const itemIds = new Set(items.map((item) => item.id));
    const equipmentSlots = {
        mainHand: itemIds.has(rawSlots.mainHand) ? rawSlots.mainHand : "",
        offHand: itemIds.has(rawSlots.offHand) ? rawSlots.offHand : "",
        ranged: itemIds.has(rawSlots.ranged) ? rawSlots.ranged : "",
        armor: itemIds.has(rawSlots.armor) ? rawSlots.armor : "",
        artifact: itemIds.has(rawSlots.artifact) ? rawSlots.artifact : "",
        worn: itemIds.has(rawSlots.worn) ? rawSlots.worn : ""
    };
    for (const item of items) {
        if (!item.equipped || item.slot === "none")
            continue;
        const slot = item.slot;
        if (slotKeys.includes(slot) && !equipmentSlots[slot]) {
            equipmentSlots[slot] = item.id;
        }
    }
    const assignedSlots = new Map();
    for (const slot of slotKeys) {
        const itemId = equipmentSlots[slot];
        if (itemId) {
            assignedSlots.set(itemId, slot);
        }
    }
    const inventoryItems = items.map((item) => {
        const assignedSlot = assignedSlots.get(item.id);
        if (assignedSlot) {
            return { ...item, equipped: true, slot: assignedSlot };
        }
        return {
            ...item,
            equipped: false,
            slot: "none"
        };
    });
    return { inventoryItems, equipmentSlots };
}
function getEquippedInventoryItem(items, equipmentSlots, slot) {
    const itemId = equipmentSlots[slot];
    if (!itemId) {
        return null;
    }
    return items.find((item) => item.id === itemId) ?? null;
}
function buildLegacyConditions(sheet) {
    const conditions = [];
    if (sheet.corrupcion.temporal > 0 || sheet.corrupcion.permanente > 0) {
        conditions.push({
            id: "legacy-corruption",
            name: "Corrupción",
            category: "corruption",
            active: true,
            severity: sheet.corrupcion.permanente > 0 ? "major" : "moderate",
            summary: `Temporal ${sheet.corrupcion.temporal} / Permanente ${sheet.corrupcion.permanente}`,
            notes: sheet.corrupcion.notas
        });
    }
    return conditions;
}
function synchronizeAutomaticConditions(conditions, sheet) {
    const manualConditions = conditions.filter((condition) => !["legacy-corruption", "legacy-dying", "condition-dying"].includes(condition.id));
    const automaticConditions = [];
    if (sheet.corrupcion.temporal > 0 || sheet.corrupcion.permanente > 0) {
        automaticConditions.push({
            id: "legacy-corruption",
            name: "Corrupción",
            category: "corruption",
            active: true,
            severity: sheet.corrupcion.permanente > 0 ? "major" : "moderate",
            summary: `Temporal ${sheet.corrupcion.temporal} / Permanente ${sheet.corrupcion.permanente}`,
            notes: sheet.corrupcion.notas
        });
    }
    if (sheet.combate.robustezActual <= 0) {
        automaticConditions.push({
            id: "legacy-dying",
            name: "Moribundo",
            category: "injury",
            active: true,
            severity: "major",
            summary: "La Robustez ha llegado a 0.",
            notes: ""
        });
    }
    return [...manualConditions, ...automaticConditions];
}
function buildLegacyNotesSections(sheet) {
    return {
        general: sheet.notas ?? "",
        background: sheet.identidad.trasfondo ?? "",
        traits: (sheet.rasgos ?? []).join(", "),
        campaign: [sheet.grupo?.nombre ?? "", sheet.grupo?.objetivo ?? "", ...(sheet.contactos ?? [])].filter(Boolean).join("\n")
    };
}
function buildCanonicalActions(sheet) {
    const actions = [];
    for (const item of sheet.inventoryItems) {
        if (item.category !== "weapon" || item.quantity <= 0)
            continue;
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
        if (!canUseItemActions)
            continue;
        for (const action of item.grantedActions ?? []) {
            actions.push({
                id: `item:${item.id}:${action.id}`,
                label: action.label,
                sourceType: item.managedArtifactId ? "artifact" : item.category === "weapon" ? "weapon" : "ability",
                sourceName: item.name,
                cost: action.cost,
                requiredLevel: action.requiredLevel,
                rollAttribute: action.rollAttribute,
                opponentAttribute: action.opponentAttribute,
                fixedTarget: action.fixedTarget,
                damageFormula: action.damageFormula,
                effectSummary: action.effectSummary,
                category: item.category,
                notes: item.notes,
                linkedItemId: item.id,
                corruptionFormula: action.corruptionFormula,
                artifactAbilityId: action.artifactAbilityId,
                disabledReason: action.disabledReason,
                rolls: action.rolls
            });
        }
    }
    const pushRatedActions = (sourceType, entries) => {
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
            }
            else {
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
function normalizeActionFavorites(favorites) {
    return Array.from(new Set((favorites ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean))).slice(0, 80);
}
function getTraitLevelForCanonicalActions(sheet, traitName) {
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
        if (/\bmaestro\b/.test(normalized))
            return 3;
        if (/\badepto\b/.test(normalized))
            return 2;
        if (/\bnovato\b/.test(normalized))
            return 1;
        if (/\biii\b|\b3\b/.test(normalized))
            return 3;
        if (/\bii\b|\b2\b/.test(normalized))
            return 2;
        return 1;
    }
    return 0;
}
function getNaturalWeaponCharacterDamage(level) {
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
function convertTraitBonusToPlayerRoll(value) {
    switch (value) {
        case 2:
            return "+1d4";
        case 3:
            return "+1d6";
        default:
            return value >= 0 ? `+${value}` : String(value);
    }
}
function combineCanonicalDamageFormula(base, bonus) {
    const normalizedBase = base.trim().toLowerCase();
    const normalizedBonus = bonus.trim().toLowerCase();
    if (!normalizedBonus) {
        return normalizedBase;
    }
    return normalizedBonus.startsWith("+") || normalizedBonus.startsWith("-")
        ? `${normalizedBase}${normalizedBonus}`
        : `${normalizedBase}+${normalizedBonus}`;
}
function inferCanonicalFallbackAction(sourceType, sourceName, entryLevel, text, notes) {
    const trimmedText = String(text ?? "").trim();
    const normalized = normalizeName(trimmedText);
    if (!trimmedText || normalized.startsWith("pasiva.")) {
        return null;
    }
    let cost = null;
    if (normalized.startsWith("reaccion.") || normalized.startsWith("reaccion ")) {
        cost = "reaction";
    }
    else if (normalized.startsWith("activa.") || normalized.startsWith("activa ") || normalized.includes("accion de combate") || normalized.includes("accion de combate")) {
        cost = "combat";
    }
    else if (normalized.includes("accion de movimiento") || normalized.includes("accion de movimiento")) {
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
function isRatedActionAvailableForEntryLevel(entryLevel, requiredLevel) {
    if (!requiredLevel) {
        return true;
    }
    return entryLevel === requiredLevel;
}
function inferRatedActionLevel(...values) {
    const joined = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (joined.includes("maestro"))
        return "maestro";
    if (joined.includes("adepto"))
        return "adepto";
    if (joined.includes("novato"))
        return "novato";
    return undefined;
}
function skillLevelRank(level) {
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
};
function sanitizeImportedRatedEntry(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
    }
    const candidate = entry;
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
        acciones: acciones
    };
}
function hydrateRatedEntryActions(entries, sourceType) {
    const canonicalEntries = CANONICAL_RATED_ENTRIES[sourceType];
    return (entries ?? [])
        .map((entry) => sanitizeImportedRatedEntry(entry))
        .filter((entry) => entry !== null && Boolean(entry?.nombre))
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
function normalizeRatedEntries(entries, sourceType) {
    const merged = new Map();
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
function truncateImportedString(value, maxLength) {
    return String(value ?? "").slice(0, maxLength);
}
function sanitizeRawRatedEntryCollection(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
        .map((entry) => {
        const candidate = entry;
        const acciones = Array.isArray(candidate.acciones)
            ? candidate.acciones
                .filter((action) => action && typeof action === "object" && !Array.isArray(action))
                .map((action) => {
                const actionCandidate = action;
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
    });
}
function migrateCharacterSheetInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return input;
    }
    const candidate = structuredClone(input);
    candidate.habilidades = sanitizeRawRatedEntryCollection(candidate.habilidades);
    candidate.poderesMisticos = sanitizeRawRatedEntryCollection(candidate.poderesMisticos);
    candidate.rituales = sanitizeRawRatedEntryCollection(candidate.rituales);
    const rawInventoryItems = Array.isArray(candidate.inventoryItems) && candidate.inventoryItems.length > 0
        ? candidate.inventoryItems
        : buildLegacyInventoryItems(candidate);
    const inventoryItemsWithoutNaturalPlaceholder = migrateShieldInventoryItems(stripNaturalArmorPlaceholderItems(rawInventoryItems, candidate));
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
        conditions: synchronizeAutomaticConditions(Array.isArray(candidate.conditions) && candidate.conditions.length > 0 ? candidate.conditions : buildLegacyConditions(candidate), candidate),
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
            conditions: synchronizeAutomaticConditions(Array.isArray(candidate.conditions) ? candidate.conditions : buildLegacyConditions(candidate), candidate),
            noteSections
        })
    };
}
function buildSynchronizedCharacterSheet(input) {
    const syncedRobustezMax = getEffectiveCharacterRobustezMax(input);
    const migratedMonsterTraitAbilities = buildMonsterTraitAbilityEntries(input.rasgos, input.habilidades);
    const habilidades = normalizeRatedEntries([...(input.habilidades ?? []), ...migratedMonsterTraitAbilities], "ability");
    const poderesMisticos = normalizeRatedEntries(input.poderesMisticos, "power");
    const rituales = normalizeRatedEntries(input.rituales, "ritual");
    const inventoryItemsWithoutNaturalPlaceholder = migrateShieldInventoryItems(stripNaturalArmorPlaceholderItems(input.inventoryItems, input));
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
export function createEmptyCharacterSheet() {
    return {
        resolutionMode: "player_rolls",
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
            experienciaTotal: 50,
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
        capabilitySelections: [],
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
        gmBackground: {
            tactics: "",
            weakness: "",
            loot: ""
        },
        referencias: [],
        notas: ""
    };
}
export function parseCharacterSheet(input) {
    return importedCharacterSheetSchema.parse(migrateCharacterSheetInput(input));
}
export function synchronizeCharacterSheet(input) {
    return importedCharacterSheetSchema.parse(buildSynchronizedCharacterSheet(parseCharacterSheet(input)));
}
export const npcDepthSchema = z.enum(["notes", "stat_block", "full_sheet"]);
const npcLabelSchema = z.string().min(1).max(80);
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
export function createNpcSheetSeed(input) {
    const sheet = createEmptyCharacterSheet();
    return synchronizeCharacterSheet({
        ...sheet,
        resolutionMode: "fixed_average",
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
export function createEmptyNpcInput() {
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
    sheet: importedCharacterSheetSchema,
    editSource: z.enum(["sheet", "builder"]).optional()
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
    dmNoteEntries: z.array(campaignSharedNoteEntrySchema).max(200).default([]),
    sharedNotes: z.string().max(6000).default(""),
    sharedNoteEntries: z.array(campaignSharedNoteEntrySchema).max(200).default([])
});
export const updateCampaignSchema = createCampaignSchema.partial();
export const createCampaignInvitationSchema = z.object({
    email: z.string().email()
});
export const campaignInvitationIdSchema = z.string().uuid();
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
    sheet: importedCharacterSheetSchema,
    editSource: z.enum(["sheet", "builder"]).optional()
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
        .array(z.object({
        characterId: z.string().uuid(),
        amount: z.number().int().min(0).max(1000)
    }))
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
    sharedWithUserIds: z.array(z.string().uuid()).max(50).default([]),
    isPublic: z.boolean().optional()
});
export const compendiumEntryIdSchema = z.string().trim().min(1).max(200);
export const setCompendiumFavoriteSchema = z.object({
    favorite: z.boolean()
}).strict();
export const professionIdSchema = z.string().trim().min(1).max(120);
export const professionDecisionSchema = z.object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).default("")
});
export const updateCampaignReferenceSchema = createCampaignReferenceSchema.partial();
