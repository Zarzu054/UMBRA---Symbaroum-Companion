import {
  ATTRIBUTE_KEYS,
  SYMBAROUM_ABILITIES,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_CULTURES,
  SYMBAROUM_RACES,
  createEmptyCharacterSheet,
  type CreateCharacterInput,
  type SkillLevel
} from "@umbra/shared";

const TOTAL_ATTRIBUTE_POINTS = 80;
const ATTRIBUTE_MIN = 5;
const ATTRIBUTE_MAX = 15;
const SECONDARY_ATTRIBUTE_MAX = 14;

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

const PROFESSIONS_BY_ARCHETYPE: Record<(typeof SYMBAROUM_ARCHETYPES)[number], string[]> = {
  Guerrero: ["Caballero", "Capitan", "Espada de alquiler", "Duelista"],
  Cazador: ["Cazatesoros", "Explorador", "Arquero", "Rastreador"],
  "Místico": ["Teurgo", "Bruja", "Hechicero", "Aspirante de la Ordo"],
  Maleante: ["Ladron", "Charlatan", "Espia", "Contrabandista"]
};

const ABILITIES_BY_ARCHETYPE: Record<(typeof SYMBAROUM_ARCHETYPES)[number], string[]> = {
  Guerrero: ["Armas a dos manos", "Golpe de hierro", "Combate con escudo", "Combate con armadura", "Guardaespaldas", "Berserker"],
  Cazador: ["Tirador", "Sexto sentido", "Viento de acero", "Mano veloz", "Jinete", "Versado en criaturas"],
  "Místico": ["Poder místico", "Rituales", "Brujería", "Teúrgia", "Magia", "Ojo místico"],
  Maleante: ["Ataque traicionero", "Finta", "Estrangulador", "Acrobata", "Dominacion", "Venenos"]
};

export function generateRandomCharacter(): CreateCharacterInput {
  const race = pickRandom(SYMBAROUM_RACES);
  const culture = pickRandom(SYMBAROUM_CULTURES);
  const archetype = pickRandom(SYMBAROUM_ARCHETYPES);
  const profession = pickRandom(PROFESSIONS_BY_ARCHETYPE[archetype]);
  const name = `${pickRandom(NAMES)} ${Math.floor(Math.random() * 90 + 10)}`;

  const sheet = createEmptyCharacterSheet();
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
  sheet.habilidades = generateStartingAbilities(archetype, startingPattern);

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

function generateAttributeBlock(): Record<(typeof ATTRIBUTE_KEYS)[number], number> {
  const attributes: Record<(typeof ATTRIBUTE_KEYS)[number], number> = {
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
  const keys = [...ATTRIBUTE_KEYS] as Array<(typeof ATTRIBUTE_KEYS)[number]>;
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
      throw new Error("No fue posible distribuir atributos cumpliendo las restricciones de creacion.");
    }

    const key = pickRandom(candidates);
    attributes[key] += 1;
    remaining -= 1;
  }

  return attributes;
}

function generateStartingAbilities(archetype: (typeof SYMBAROUM_ARCHETYPES)[number], pattern: "2novato_1adepto" | "5novato") {
  const pool = ABILITIES_BY_ARCHETYPE[archetype];
  const picked = pickUnique(pool, pattern === "2novato_1adepto" ? 3 : 5);
  const catalogByName = new Map(SYMBAROUM_ABILITIES.map((entry) => [entry.nombre, entry]));

  return picked.map((name, index) => {
    const level: SkillLevel = pattern === "2novato_1adepto" && index === 0 ? "adepto" : "novato";
    const fromCatalog = catalogByName.get(name);
    return {
      nombre: name,
      tipo: "Habilidad",
      efecto: fromCatalog?.efectoResumen ?? "",
      nivel: level,
      fuente: fromCatalog?.libro ?? "",
      pagina: fromCatalog?.pagina,
      notas: fromCatalog?.efectoResumen ?? ""
    };
  });
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickUnique<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  const result: T[] = [];
  while (copy.length > 0 && result.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}
