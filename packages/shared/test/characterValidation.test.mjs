import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSchema, createEmptyCharacterSheet, importCharacterSchema, parseCharacterSheet, synchronizeCharacterSheet, updateCampaignCharacterSheetSchema } from "../dist/index.js";

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

test("acepta cualquier reparto de capacidades mientras respete la bolsa de PX", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "novato"],
    ["Combate con escudo", "novato"]
  ]);
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("valida el límite de 15 sobre los atributos base y admite varios valores finales elevados", () => {
  const payload = buildPayload();
  payload.sheet.atributos = {
    agil: 16,
    atento: 15,
    discreto: 10,
    diestro: 10,
    fuerte: 10,
    inteligente: 10,
    persuasivo: 6,
    tenaz: 5
  };
  payload.sheet.capabilitySelections = [
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "novato", origin: "comprada", source: "Libro Básico", attributeKey: "agil" },
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "novato", origin: "comprada", source: "Libro Básico", attributeKey: "atento" }
  ];

  assert.equal(createCharacterSchema.safeParse(payload).success, true);
});

test("rechaza dos adquisiciones de Atributo excepcional para el mismo atributo", () => {
  const payload = buildPayload();
  payload.sheet.capabilitySelections = [
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "novato", origin: "comprada", source: "Libro Básico", attributeKey: "agil" },
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "adepto", origin: "comprada", source: "Libro Básico", attributeKey: "agil" }
  ];
  payload.sheet.atributos.agil = 13;

  expectIssue(payload, "una vez para cada atributo");
});

test("acepta capacidades de maestro cuando caben en la bolsa de PX", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Acróbata", "novato"],
    ["Alquimista", "novato"],
    ["Armas a dos manos", "maestro"]
  ]);
  payload.sheet.progreso.experienciaTotal = 60;
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
});

test("rechaza capacidades estructuradas que superan la bolsa efectiva de PX", () => {
  const payload = buildPayload();
  payload.sheet.capabilitySelections = [{
    catalogId: "habilidad-berserker",
    name: "Berserker",
    kind: "habilidad",
    level: "maestro",
    origin: "comprada",
    source: "Libro Básico"
  }];
  expectIssue(payload, "experiencia disponible");
});

test("las cargas amplían realmente la bolsa efectiva de PX", () => {
  const payload = buildPayload();
  payload.sheet.cargas = ["Paria", "Bestial"];
  payload.sheet.capabilitySelections = [
    { catalogId: "carga-paria", name: "Paria", kind: "carga", origin: "racial", source: "Libro Básico" },
    { catalogId: "carga-bestial", name: "Bestial", kind: "carga", origin: "trasfondo", source: "Guía Avanzada del Jugador" },
    { catalogId: "habilidad-berserker", name: "Berserker", kind: "habilidad", level: "maestro", origin: "comprada", source: "Libro Básico" }
  ];
  const parsed = createCharacterSchema.safeParse(payload);
  assert.equal(parsed.success, true);
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

test("synchronizeCharacterSheet reemplaza el texto importado por el canon interno cuando la habilidad existe por nombre", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    {
      nombre: "Berserker",
      tipo: "Texto importado",
      efecto: "DESCRIPCION PDF ERRONEA",
      nivel: "novato",
      fuente: "PDF",
      pagina: 999,
      notas: "NOTA ERRONEA",
      acciones: [{ id: "fake", label: "Fake", cost: "combat", effectSummary: "Fake" }]
    }
  ];

  const normalized = synchronizeCharacterSheet(sheet);
  assert.equal(normalized.habilidades[0].tipo, "habilidad");
  assert.doesNotMatch(normalized.habilidades[0].efecto, /ERRONEA|PDF/i);
  assert.notEqual(normalized.habilidades[0].pagina, 999);
  assert.notEqual(normalized.habilidades[0].acciones[0]?.label, "Fake");
});

test("synchronizeCharacterSheet migra rasgos monstruosos del PDF a habilidades canonicas por nombre", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.rasgos = ["Arma natural I", "Duro II", "Contactos"];

  const normalized = synchronizeCharacterSheet(sheet);
  assert.deepEqual(normalized.rasgos, ["Contactos"]);
  assert.equal(normalized.habilidades.some((entry) => entry.nombre === "Arma natural" && entry.nivel === "novato"), true);
  assert.equal(normalized.habilidades.some((entry) => entry.nombre === "Duro" && entry.nivel === "adepto"), true);
  assert.match(normalized.habilidades.find((entry) => entry.nombre === "Arma natural")?.efecto ?? "", /1D6/i);
  assert.match(normalized.habilidades.find((entry) => entry.nombre === "Duro")?.efecto ?? "", /1D6/i);
});

test("acepta rituales sin habilidad Rituales", () => {
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
  const result = createCharacterSchema.safeParse(payload);
  assert.equal(result.success, true);
});

test("rechaza experiencia gastada superior a experiencia total", () => {
  const payload = buildPayload();
  payload.sheet.progreso.experienciaTotal = 10;
  payload.sheet.progreso.experienciaGastada = 15;
  expectIssue(payload, "experiencia gastada");
});

test("la actualizacion de campana acepta compras posteriores a la creacion", () => {
  const sheet = buildPayload().sheet;
  sheet.habilidades.push(...makeAbilities([["Sexta habilidad", "novato"]]));
  sheet.progreso.experienciaTotal = 60;
  sheet.progreso.experienciaGastada = 60;

  const result = updateCampaignCharacterSheetSchema.safeParse({ sheet });
  assert.equal(result.success, true);
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
