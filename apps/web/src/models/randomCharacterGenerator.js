import { ATTRIBUTE_KEYS, SYMBAROUM_ABILITIES, SYMBAROUM_ARCHETYPES, SYMBAROUM_CULTURES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RACES, createCharacterSchema, createEmptyCharacterSheet } from "@umbra/shared";
const TOTAL_ATTRIBUTE_POINTS = 80;
const ATTRIBUTE_MIN = 5;
const ATTRIBUTE_MAX = 15;
const SECONDARY_ATTRIBUTE_MAX = 14;
const MAX_GENERATION_ATTEMPTS = 32;
const NAMES = [
    "Arisca",
    "Orlan",
    "Lysindra",
    "Brom",
    "Saela",
    "Yorik",
    "Nimra",
    "Valdar",
    "Edrik",
    "Kael"
];
const MYSTIC_ARCHETYPE = "Místico";
const MYSTIC_BASE_ABILITIES = ["Poder místico", "Magia", "Teúrgia", "Brujería", "Hechicería", "Ojo místico"];
const PROFESSIONS_BY_ARCHETYPE = {
    Guerrero: ["Caballero", "Capitán", "Espada de alquiler", "Duelista"],
    Cazador: ["Cazatesoros", "Explorador", "Arquero", "Rastreador"],
    Místico: ["Teurgo", "Bruja", "Hechicero", "Aspirante de la Ordo"],
    Maleante: ["Ladrón", "Charlatán", "Espía", "Contrabandista"]
};
const ABILITY_POOL_BY_ARCHETYPE = {
    Guerrero: ["Armas a dos manos", "Golpe de hierro", "Combate con escudo", "Combate con armadura", "Guardaespaldas", "Berserker"],
    Cazador: ["Tirador", "Sexto sentido", "Viento de acero", "Mano veloz", "Jinete", "Versado en criaturas"],
    Místico: ["Poder místico", "Rituales", "Brujería", "Teúrgia", "Magia", "Ojo místico", "Talento místico superior"],
    Maleante: ["Ataque traicionero", "Finta", "Estrangulador", "Acróbata", "Dominación", "Venenos"]
};
const POWER_POOL_BY_ARCHETYPE = {
    Guerrero: ["Escudo bendito", "Martillo de monstruos", "Imposición de manos"],
    Cazador: ["Tormenta de flechas", "Cacería salvaje", "Refugio terrestre"],
    Místico: [
        "Aliento negro",
        "Confusión",
        "Escudo bendito",
        "Imposición de manos",
        "Rayo negro",
        "Someter voluntad",
        "Empuje mental",
        "Enredadera veloz",
        "Anatema",
        "Cascada de azufre"
    ],
    Maleante: ["Imperceptible", "Imagen especular", "Maldición", "Golpe espectral"]
};
export function generateRandomCharacter() {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const candidate = buildRandomCharacter();
        if (createCharacterSchema.safeParse(candidate).success) {
            return candidate;
        }
    }
    throw new Error("No fue posible generar un personaje aleatorio válido.");
}
function buildRandomCharacter() {
    const race = pickRandom(SYMBAROUM_RACES);
    const culture = pickRandom(SYMBAROUM_CULTURES);
    const archetype = pickRandom(SYMBAROUM_ARCHETYPES);
    const profession = pickRandom(PROFESSIONS_BY_ARCHETYPE[archetype]);
    const name = pickRandom(NAMES);
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.nombrePersonaje = name;
    sheet.identidad.raza = race;
    sheet.identidad.cultura = culture;
    sheet.identidad.arquetipo = archetype;
    sheet.identidad.profesion = profession;
    sheet.identidad.apariencia = "Generado automáticamente";
    sheet.identidad.trasfondo = "Personaje generado para pruebas de juego y balance.";
    sheet.atributos = generateAttributeBlock();
    sheet.progreso.nivel = 1;
    sheet.progreso.experienciaTotal = 10;
    sheet.progreso.experienciaGastada = 0;
    const startingPattern = Math.random() < 0.5 ? "2novato_1adepto" : "5novato";
    const generatedCapabilities = generateStartingCapabilities(archetype, startingPattern);
    sheet.habilidades = generatedCapabilities.habilidades;
    sheet.poderesMisticos = generatedCapabilities.poderesMisticos;
    sheet.equipo = ["Mochila", "Raciones (3 días)", "Antorcha", "Cuchillo"];
    sheet.contactos = ["Contacto inicial del grupo"];
    sheet.notas = `Patrón inicial: ${startingPattern}`;
    return {
        name,
        archetype,
        race,
        culture,
        profession,
        level: 1,
        sheet
    };
}
function generateAttributeBlock() {
    const attributes = {
        agil: ATTRIBUTE_MIN,
        atento: ATTRIBUTE_MIN,
        discreto: ATTRIBUTE_MIN,
        diestro: ATTRIBUTE_MIN,
        fuerte: ATTRIBUTE_MIN,
        inteligente: ATTRIBUTE_MIN,
        persuasivo: ATTRIBUTE_MIN,
        tenaz: ATTRIBUTE_MIN
    };
    let remaining = TOTAL_ATTRIBUTE_POINTS - ATTRIBUTE_KEYS.length * ATTRIBUTE_MIN;
    const keys = [...ATTRIBUTE_KEYS];
    const primaryFifteenKey = Math.random() < 0.75 ? pickRandom(keys) : null;
    if (primaryFifteenKey !== null) {
        attributes[primaryFifteenKey] = ATTRIBUTE_MAX;
        remaining -= ATTRIBUTE_MAX - ATTRIBUTE_MIN;
    }
    while (remaining > 0) {
        const candidates = keys.filter((key) => {
            const keyCap = key === primaryFifteenKey ? ATTRIBUTE_MAX : SECONDARY_ATTRIBUTE_MAX;
            return attributes[key] < keyCap;
        });
        if (candidates.length === 0) {
            throw new Error("No fue posible distribuir atributos cumpliendo las restricciones de creación.");
        }
        const key = pickRandom(candidates);
        attributes[key] += 1;
        remaining -= 1;
    }
    return attributes;
}
function generateStartingCapabilities(archetype, pattern) {
    const slotCount = pattern === "2novato_1adepto" ? 3 : 5;
    const noviceCount = pattern === "2novato_1adepto" ? 2 : 5;
    const adeptCount = pattern === "2novato_1adepto" ? 1 : 0;
    const abilityCatalog = new Map(SYMBAROUM_ABILITIES.map((entry) => [entry.nombre, entry]));
    const powerCatalog = new Map(SYMBAROUM_MYSTIC_POWERS.map((entry) => [entry.nombre, entry]));
    const selectedAbilities = pickUnique(ABILITY_POOL_BY_ARCHETYPE[archetype], Math.min(slotCount, ABILITY_POOL_BY_ARCHETYPE[archetype].length));
    const maxPowerCount = archetype === MYSTIC_ARCHETYPE ? Math.min(3, slotCount - 1) : Math.min(2, slotCount - 1);
    const requestedPowerCount = archetype === MYSTIC_ARCHETYPE ? randomInt(1, maxPowerCount) : randomInt(0, maxPowerCount);
    const selectedPowers = requestedPowerCount > 0 ? pickUnique(POWER_POOL_BY_ARCHETYPE[archetype], requestedPowerCount) : [];
    const levels = buildLevels(noviceCount, adeptCount);
    const habilidades = [];
    const poderesMisticos = [];
    if (selectedPowers.length > 0) {
        const baseAbilityName = selectMysticBaseAbility(archetype, selectedAbilities);
        if (!selectedAbilities.includes(baseAbilityName)) {
            selectedAbilities.unshift(baseAbilityName);
        }
    }
    const orderedEntries = [...selectedAbilities.map((name) => ({ type: "ability", name })), ...selectedPowers.map((name) => ({ type: "power", name }))].slice(0, slotCount);
    orderedEntries.forEach((entry, index) => {
        const level = levels[index] ?? "novato";
        if (entry.type === "ability") {
            const fromCatalog = abilityCatalog.get(entry.name);
            habilidades.push(buildRatedEntry(entry.name, level, "Habilidad", fromCatalog));
            return;
        }
        const fromCatalog = powerCatalog.get(entry.name);
        poderesMisticos.push(buildRatedEntry(entry.name, level, "Poder místico", fromCatalog));
    });
    return { habilidades, poderesMisticos };
}
function buildLevels(noviceCount, adeptCount) {
    const levels = [];
    for (let index = 0; index < adeptCount; index += 1) {
        levels.push("adepto");
    }
    for (let index = 0; index < noviceCount; index += 1) {
        levels.push("novato");
    }
    return shuffle(levels);
}
function buildRatedEntry(name, level, tipo, fromCatalog) {
    return {
        nombre: name,
        tipo,
        efecto: fromCatalog?.efectoResumen ?? "",
        nivel: level,
        fuente: fromCatalog?.libro ?? "",
        pagina: fromCatalog?.pagina,
        notas: fromCatalog?.efectoResumen ?? "",
        acciones: fromCatalog?.acciones ?? []
    };
}
function selectMysticBaseAbility(archetype, selectedAbilities) {
    const existingBase = selectedAbilities.find((entry) => MYSTIC_BASE_ABILITIES.includes(entry));
    if (existingBase) {
        return existingBase;
    }
    const preferredPool = ABILITY_POOL_BY_ARCHETYPE[archetype].filter((entry) => MYSTIC_BASE_ABILITIES.includes(entry));
    if (preferredPool.length > 0) {
        return pickRandom(preferredPool);
    }
    return pickRandom(MYSTIC_BASE_ABILITIES);
}
function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}
function pickUnique(items, count) {
    const copy = [...items];
    const result = [];
    while (copy.length > 0 && result.length < count) {
        const idx = Math.floor(Math.random() * copy.length);
        result.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return result;
}
function randomInt(min, max) {
    if (max <= min) {
        return min;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        const current = copy[index];
        copy[index] = copy[target];
        copy[target] = current;
    }
    return copy;
}
