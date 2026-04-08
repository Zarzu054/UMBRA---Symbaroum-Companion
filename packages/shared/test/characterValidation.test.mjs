import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSchema, createEmptyCharacterSheet, importCharacterSchema, parseCharacterSheet, synchronizeCharacterSheet } from "../dist/index.js";

function buildPayload() {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "novato"],
    ["Combate con escudo", "novato"],
    ["Táctico", "novato"]
  ]);

  return {
    name: "Validacion Test",
    archetype: "Guerrero",
    race: "Humano",
    culture: "Ambriano",
    profession: "Mercenario",
    level: 1,
    sheet
  };
}

function makeAbilities(items) {
  return items.map(([nombre, nivel]) => ({
    nombre,
    tipo: "Habilidad",
    efecto: "",
    nivel,
    fuente: "Libro Basico",
    pagina: 116,
    notas: ""
  }));
}

function expectIssue(payload, expectedText) {
  const parsed = createCharacterSchema.safeParse(payload);
  if (parsed.success) {
    assert.fail("Se esperaba error de validacion y el schema acepto el payload");
  }
  const messages = parsed.error.issues.map((issue) => issue.message);
  assert.ok(messages.some((message) => message.includes(expectedText)));
}

test("acepta personaje nivel 1 con patron 5 novato", () => {
  const payload = buildPayload();
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("acepta una raza libre no jugable como texto plano", () => {
  const payload = buildPayload();
  payload.race = "Lobo";
  payload.sheet.identidad.raza = "Lobo";

  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("acepta personaje nivel 1 con patron 2 novato + 1 adepto", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "adepto"]
  ]);
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("rechaza patron inicial distinto de 5 novato o 2 novato + 1 adepto", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "novato"],
    ["Combate con escudo", "novato"]
  ]);
  expectIssue(payload, "habilidades iniciales");
});

test("rechaza habilidades maestro en nivel 1", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "maestro"]
  ]);
  expectIssue(payload, "nivel maestro");
});

test("acepta poderes misticos sin habilidad mistica base", () => {
  const payload = buildPayload();
  payload.sheet.poderesMisticos = [
    {
      nombre: "Confusión",
      tipo: "Poder místico",
      efecto: "",
      nivel: "novato",
      fuente: "Guía Avanzada del Jugador",
      pagina: 81,
      notas: ""
    }
  ];
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("importCharacterSchema acepta poderes misticos sin habilidad mistica base", () => {
  const payload = buildPayload();
  payload.sheet.poderesMisticos = [
    {
      nombre: "Confusión",
      tipo: "Poder místico",
      efecto: "",
      nivel: "novato",
      fuente: "Guía Avanzada del Jugador",
      pagina: 81,
      notas: ""
    }
  ];
  const parsed = importCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("importCharacterSchema acepta una raza libre no jugable como texto plano", () => {
  const payload = buildPayload();
  payload.race = "Bestiaal";
  payload.sheet.identidad.raza = "Bestiaal";

  const parsed = importCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("importCharacterSchema acepta habilidades importadas sin descripcion valida y las hidrata por nombre", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = [
    {
      nombre: "Berserker",
      tipo: "Habilidad",
      efecto: null,
      nivel: "novato",
      fuente: "",
      pagina: undefined,
      notas: null
    }
  ];
  const parsed = importCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("synchronizeCharacterSheet hidrata efecto y acciones canonicas cuando una habilidad importada llega sin descripcion", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Berserker",
      tipo: "Habilidad",
      efecto: null,
      nivel: "novato",
      fuente: "",
      pagina: undefined,
      notas: null
    }
  ];

  const normalized = synchronizeCharacterSheet(sheet);
  assert.match(normalized.habilidades[0].efecto, /frenesi|frenes/i);
  assert.ok(normalized.habilidades[0].acciones.length > 0);
  assert.equal(normalized.habilidades[0].fuente.length > 0, true);
  assert.equal(typeof normalized.habilidades[0].pagina, "number");
});

test("rechaza rituales sin habilidad Rituales", () => {
  const payload = buildPayload();
  payload.sheet.rituales = [
    {
      nombre: "Adivinación",
      tipo: "Ritual",
      efecto: "",
      nivel: "novato",
      fuente: "Guía Avanzada del Jugador",
      pagina: 91,
      notas: ""
    }
  ];
  expectIssue(payload, "habilidad Rituales");
});

test("rechaza experiencia gastada superior a experiencia total", () => {
  const payload = buildPayload();
  payload.sheet.progreso.experienciaTotal = 10;
  payload.sheet.progreso.experienciaGastada = 15;
  expectIssue(payload, "experiencia gastada");
});

test("rechaza robustez actual mayor que robustez maxima", () => {
  const payload = buildPayload();
  payload.sheet.combate.robustezMax = 10;
  payload.sheet.combate.robustezActual = 11;
  expectIssue(payload, "robustez actual");
});

test("completa con defaults los nuevos campos del PDF al parsear hojas antiguas", () => {
  const parsed = parseCharacterSheet({
    identidad: {
      raza: "Humano"
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
      iniciativaMod: 0
    },
    corrupcion: {
      temporal: 0,
      permanente: 0,
      umbral: 5
    },
    rasgos: [],
    habilidades: makeAbilities([
      ["Acróbata", "novato"],
      ["Alquimista", "novato"],
      ["Armas a dos manos", "novato"],
      ["Combate con escudo", "novato"],
      ["Táctico", "novato"]
    ]),
    poderesMisticos: [],
    rituales: [],
    equipo: [],
    contactos: [],
    referencias: [],
    notas: ""
  });

  assert.equal(parsed.identidad.altura, "");
  assert.equal(parsed.recursos.dinero, "");
  assert.equal(parsed.grupo.nombre, "");
  assert.equal(parsed.contactosHoja.length, 5);
  assert.equal(parsed.artefactos.length, 4);
  assert.equal(parsed.combate.armaTerciaria, "");
});
