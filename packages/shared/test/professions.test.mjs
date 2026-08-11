import test from "node:test";
import assert from "node:assert/strict";
import {
  SYMBAROUM_PROFESSIONS,
  evaluateProfession,
  getBenefitProfessionIds,
  getHigherRitualBase
} from "../dist/index.js";

const capability = (name, level = "novato", kind = "habilidad") => ({ name, level, kind });
const context = (capabilities, overrides = {}) => ({
  race: "Humano",
  culture: "Ambriano",
  permanentCorruption: 0,
  blessings: [],
  capabilities,
  ...overrides
});

test("cataloga exactamente las 17 profesiones con identificadores únicos", () => {
  assert.equal(SYMBAROUM_PROFESSIONS.length, 17);
  assert.equal(new Set(SYMBAROUM_PROFESSIONS.map((entry) => entry.id)).size, 17);
  for (const profession of SYMBAROUM_PROFESSIONS) {
    assert.ok(profession.requirements.length >= 3, profession.name);
    assert.ok(profession.benefits.length >= 1, profession.name);
    assert.ok(profession.page > 0, profession.name);
    assert.ok(profession.description.length >= 250, `${profession.name} necesita una descripción completa`);
    assert.doesNotMatch(profession.description, /entrada informativa|profesi[oó]n m[ií]stica listada/i);
  }
});

test("aplica las alternativas corregidas y la regla de una capacidad requerida en maestro", () => {
  const base = [capability("Estudioso", "maestro"), capability("Tirador"), capability("Versado en criaturas")];
  assert.equal(evaluateProfession("juramentado-de-hierro", context([...base, capability("Armas de asta")])).eligible, true);
  assert.equal(evaluateProfession("juramentado-de-hierro", context([...base, capability("Ataque con dos armas")])).eligible, true);
  assert.equal(evaluateProfession("juramentado-de-hierro", context(base)).eligible, false);
  assert.equal(evaluateProfession("juramentado-de-hierro", context([...base.map((entry) => ({ ...entry, level: "novato" })), capability("Armas de asta")])).masterRequirementMet, false);
});

test("un ritual o una capacidad opcional en maestro no satisfacen la regla de maestro", () => {
  const result = evaluateProfession("artesano-de-artefactos", context([
    capability("Estudioso"),
    capability("Herrero"),
    capability("Ritual de ejemplo", "maestro", "ritual"),
    capability("Poder opcional", "maestro", "poder_mistico")
  ]));
  assert.equal(result.requirementsMet, true);
  assert.equal(result.masterRequirementMet, false);
  assert.equal(result.eligible, false);
});

test("comprueba identidad, bendición y corrupción solo en el momento de ingreso", () => {
  const spyCapabilities = [capability("Ataque con dos armas", "maestro"), capability("Esgrima sagrada"), capability("Finta"), capability("Venenos")];
  assert.equal(evaluateProfession("espia-de-la-reina", context(spyCapabilities, { blessings: ["Privilegiado"] })).eligible, true);
  assert.equal(evaluateProfession("espia-de-la-reina", context(spyCapabilities)).eligible, false);

  const staffCapabilities = [capability("Armas de asta", "maestro"), capability("Combate con arma larga"), capability("Estudioso")];
  assert.equal(evaluateProfession("mago-del-baculo", context(staffCapabilities, { permanentCorruption: 4 })).eligible, false);
  assert.equal(evaluateProfession("mago-del-baculo", context(staffCapabilities, { permanentCorruption: 4 }), { includeAdmissionOnly: false }).eligible, true);
});

test("registra beneficios exclusivos y los diez rituales superiores", () => {
  assert.deepEqual(getBenefitProfessionIds("Danza de batalla"), ["juramentado-de-hierro"]);
  const expected = new Map([
    ["Adivinación nigromántica", "Nigromancia"], ["Compañero bestial", "Familiar"],
    ["Fortaleza viviente", "Crecimiento acelerado"], ["Fata morgana", "Terreno ilusorio"],
    ["Túnel místico", "Clarividencia"], ["Gemelos flamígeros", "Siervo flamígero"],
    ["Siervo demoníaco", "Invocar demonio"], ["Señor de la muerte", "Alzar muertos vivientes"],
    ["Mirada penetrante", "Humo sagrado"], ["Expiación", "Exorcismo"]
  ]);
  for (const [ritual, base] of expected) assert.equal(getHigherRitualBase(ritual), base);
});
