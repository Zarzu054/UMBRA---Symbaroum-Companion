import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSchema, createEmptyCharacterSheet } from "../dist/index.js";

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

test("rechaza poderes misticos sin habilidad mistica base", () => {
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
  expectIssue(payload, "habilidad mistica base");
});

test("acepta poderes misticos con habilidad mistica base", () => {
  const payload = buildPayload();
  payload.sheet.habilidades = makeAbilities([
    ["Magia", "novato"],
    ["Acróbata", "novato"],
    ["Alquimista", "adepto"]
  ]);
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
