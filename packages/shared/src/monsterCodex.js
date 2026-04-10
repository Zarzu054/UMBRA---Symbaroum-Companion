import { z } from "zod";
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
export const monsterThreatSchema = z.enum(["Débil", "Moderado", "Peligroso", "Legendario"]);
export const MONSTER_ATTRIBUTE_LABELS = {
    accurate: "Preciso",
    cunning: "Astuto",
    discreet: "Discreto",
    persuasive: "Persuasivo",
    quick: "Ágil",
    resolute: "Tenaz",
    strong: "Fuerte",
    vigilant: "Atento"
};
export const MONSTER_ATTRIBUTE_KEYS = Object.keys(MONSTER_ATTRIBUTE_LABELS);
export const MONSTER_CATEGORIES = monsterCategorySchema.options;
export const MONSTER_THREATS = monsterThreatSchema.options;
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
export const monsterSheetSchema = z.object({
    attack: z.string().min(1).max(40),
    damage: z.string().min(1).max(40),
    defense: z.string().min(1).max(40),
    armor: z.string().min(1).max(40),
    toughness: z.string().min(1).max(40),
    painThreshold: z.string().min(1).max(40),
    movement: z.string().min(1).max(80),
    attributes: monsterAttributesSchema,
    traits: z.array(z.string().min(1).max(160)).max(30).default([]),
    actions: z.array(z.string().min(1).max(160)).max(20).default([]),
    tactics: z.string().max(1200).default(""),
    weakness: z.string().max(1200).default(""),
    loot: z.string().max(1200).default("")
});
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
const DEFAULT_ATTRIBUTE_TEMPLATE = {
    accurate: 10,
    cunning: 9,
    discreet: 10,
    persuasive: 7,
    quick: 11,
    resolute: 10,
    strong: 13,
    vigilant: 10
};
export function createDefaultMonsterSheet() {
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
        tactics: "",
        weakness: "",
        loot: ""
    };
}
export function createEmptyMonsterInput() {
    return {
        name: "",
        category: "Bestia",
        threat: "Moderado",
        source: "Mis monstruos",
        summary: "",
        sheet: createDefaultMonsterSheet()
    };
}
export function getMonsterAttributeTotal(sheet) {
    return MONSTER_ATTRIBUTE_KEYS.reduce((total, key) => total + Number(sheet.attributes[key] || 0), 0);
}
export const STARTER_MONSTER_CODEX = [
    {
        id: "codex-abominacion-devoradora",
        name: "Abominación devoradora",
        category: "Abominación",
        threat: "Peligroso",
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
        threat: "Moderado",
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
        threat: "Peligroso",
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
        threat: "Moderado",
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
        threat: "Peligroso",
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
            traits: ["Intangible por pulsos I", "Oscuridad viva I", "Desorientar I"],
            actions: ["Latigazo umbrío", "Estallido de sombras"],
            tactics: "Aparece, golpea sobre el más frágil mentalmente y desaparece antes de quedar fijada.",
            weakness: "Luz intensa, zonas consagradas y ataques coordinados.",
            loot: "Residuos umbríos, cristal ennegrecido y vestigios arcanos."
        },
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z"
    }
];
