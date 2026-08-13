import test from "node:test";
import assert from "node:assert/strict";
import {
  averageDiceFormula,
  applyExceptionalAttributeBonuses,
  getActorBurdenBonus,
  getActorChallengeFromXp,
  getActorSpentXp,
  removeExceptionalAttributeBonuses,
  synchronizeExceptionalAttributes,
  createDefaultMonsterSheet,
  synchronizeMonsterCreationValues,
  validateCreationAttributes
} from "../dist/index.js";

test("convierte las fórmulas de dados a los valores fijos oficiales", () => {
  assert.equal(averageDiceFormula("1D4"), 2);
  assert.equal(averageDiceFormula("1D8+1"), 5);
  assert.equal(averageDiceFormula("2D6+1D4-1"), 7);
  assert.equal(averageDiceFormula("1D8+1 (+1D4)"), 7);
  assert.equal(averageDiceFormula("texto"), null);
});

test("normaliza rasgos antiguos de monstruo y conserva fórmulas con su promedio", () => {
  const sheet = createDefaultMonsterSheet();
  sheet.damage = "1D8+1";
  sheet.armor = "1D4";
  sheet.traits = ["Regeneración (II)"];
  const normalized = synchronizeMonsterCreationValues(sheet);
  assert.equal(normalized.fixedValues.damage, 5);
  assert.equal(normalized.fixedValues.armor, 2);
  assert.equal(normalized.capabilities[0].name, "Regeneración");
  assert.equal(normalized.capabilities[0].level, "adepto");
  assert.equal(normalized.capabilities[0].origin, "legado");
  assert.deepEqual(normalized.traits, ["Regeneración (II)"]);
});

test("calcula costes acumulados, rituales, bendiciones y cargas", () => {
  const entries = [
    { catalogId: "a", name: "Habilidad", kind: "habilidad", level: "maestro", origin: "comprada", source: "Libro Básico" },
    { catalogId: "r", name: "Ritual", kind: "ritual", origin: "comprada", source: "Libro Básico" },
    { catalogId: "b", name: "Bendición", kind: "bendicion", origin: "comprada", source: "Libro Básico" },
    { catalogId: "br", name: "Bendición racial", kind: "bendicion", origin: "racial", source: "Libro Básico" },
    { catalogId: "c", name: "Carga", kind: "carga", origin: "racial", source: "Libro Básico" }
  ];
  assert.equal(getActorSpentXp(entries), 75);
  assert.equal(getActorBurdenBonus(entries), 5);
});

test("aplica todos los umbrales de desafío", () => {
  assert.deepEqual([0, 49, 50, 149, 150, 299, 300, 599, 600, 1199, 1200].map(getActorChallengeFromXp), [
    "Sencillo", "Sencillo", "Normal", "Normal", "Complicado", "Complicado", "Difícil", "Difícil", "Mortal", "Mortal", "Legendario"
  ]);
});

test("valida 80 puntos, intervalo 5-15 y un único 15", () => {
  assert.equal(validateCreationAttributes({ a: 15, b: 10, c: 10, d: 10, e: 10, f: 10, g: 10, h: 5 }).valid, true);
  assert.equal(validateCreationAttributes({ a: 15, b: 15, c: 10, d: 10, e: 10, f: 10, g: 5, h: 5 }).valid, false);
  assert.equal(validateCreationAttributes({ a: 16, b: 9, c: 10, d: 10, e: 10, f: 10, g: 10, h: 5 }).valid, false);
});

test("Atributo excepcional se aplica después del reparto base y puede repetirse para atributos distintos", () => {
  const base = { agil: 15, atento: 10, discreto: 10, diestro: 10, fuerte: 10, inteligente: 10, persuasivo: 10, tenaz: 5 };
  const selections = [
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "maestro", origin: "comprada", source: "Libro Básico", attributeKey: "agil" },
    { catalogId: "atributo-excepcional", name: "Atributo excepcional", kind: "habilidad", level: "principiante", origin: "comprada", source: "Libro Básico", attributeKey: "atento" }
  ];
  const finalValues = applyExceptionalAttributeBonuses(base, selections);
  assert.equal(finalValues.agil, 18);
  assert.equal(finalValues.atento, 11);
  assert.deepEqual(removeExceptionalAttributeBonuses(finalValues, selections), base);

  const upgraded = selections.map((entry) => entry.attributeKey === "atento" ? { ...entry, level: "adepto" } : entry);
  assert.equal(synchronizeExceptionalAttributes(finalValues, selections, upgraded).atento, 12);
  assert.equal(validateCreationAttributes(removeExceptionalAttributeBonuses(finalValues, selections)).valid, true);
});
