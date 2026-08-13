import test from "node:test";
import assert from "node:assert/strict";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "../dist/symbaroumCompendium.js";

test("el catálogo muestra Principiante y no Novato como nivel inicial", () => {
  const entries = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS];
  const visibleText = entries
    .flatMap((entry) => [entry.efectoResumen, ...entry.acciones.flatMap((action) => [action.label, action.effectSummary])])
    .join("\n");

  assert.match(visibleText, /\bPrincipiante\b/);
  assert.doesNotMatch(visibleText, /\bNovato\b/);
});

test("las habilidades usan resumen mecanico generado con referencia", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Ataque tra"));

  assert.ok(ability);
  assert.match(ability.efectoResumen, /\+1D4/i);
  assert.match(ability.efectoResumen, /Ref: Libro B.*sico, p\.114\./);
});

test("los poderes misticos usan resumen mecanico generado con referencia", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Escudo"));

  assert.ok(power);
  assert.match(power.efectoResumen, /1D4 puntos de armadura/i);
  assert.match(power.efectoResumen, /Ref: Gu.*a Avanzada del Jugador, p\.81\./);
});

test("las habilidades de combate ambiguas usan metadata de accion explicitamente redactada", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.includes("Ataque tra"));

  assert.ok(ability);
  assert.equal(ability.acciones.length, 3);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.rollAttribute, action.damageFormula]),
    [
      ["principiante-ataque-traicionero", "reaction", "discreto", "+1d4"],
      ["adepto-ataque-traicionero", "reaction", "discreto", "+1d4"],
      ["maestro-ataque-traicionero", "reaction", "discreto", "+1d8"]
    ]
  );
});

test("los poderes de combate ambiguos usan metadata de accion explicitamente redactada", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Rayo"));

  assert.ok(power);
  assert.equal(power.acciones.length, 3);
  assert.deepEqual(
    power.acciones.map((action) => [action.id, action.cost, action.rollAttribute, action.damageFormula]),
    [
      ["principiante-rayo-negro", "combat", "tenaz", "1d6"],
      ["adepto-rayo-negro", "combat", "tenaz", "1d6"],
      ["maestro-rayo-negro", "combat", "tenaz", "1d6"]
    ]
  );
});

test("golpe espectral expone acciones separadas para encantamiento y golpe psiquico", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Golpe espectral"));

  assert.ok(power);
  assert.equal(power.acciones.length, 6);
  assert.ok(power.acciones.some((action) => action.id === "maestro-golpe-espectral" && action.damageFormula === "+1d8"));
  assert.ok(
    power.acciones.some(
      (action) =>
        action.id === "maestro-golpe-psiquico-espectral" &&
        action.cost === "reaction" &&
        action.rollAttribute === "tenaz" &&
        action.damageFormula === "1d4"
    )
  );
});

test("golpe de hierro conserva solo la accion activa real del nivel maestro", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Golpe de hierro"));

  assert.ok(ability);
  assert.equal(ability.acciones.length, 1);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.rollAttribute, action.damageFormula]),
    [["maestro-golpe-de-hierro", "combat", "fuerte", "+1d8"]]
  );
  assert.match(ability.acciones[0].effectSummary, /bonificador adicional de da.o en \+1D8/i);
});

test("ataque con dos armas expone los perfiles exactos de dano por nivel", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Ataque con dos armas"));

  assert.ok(ability);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.damageFormula]),
    [
      ["principiante-ataque-con-dos-armas", "combat", "1d8/1d6"],
      ["adepto-ataque-con-dos-armas", "combat", "1d8/1d8"],
      ["maestro-ataque-con-dos-armas", "combat", "1d10/1d8"]
    ]
  );
});

test("recuperacion usa acciones authored con curacion escalada por nivel", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Recupera"));

  assert.ok(ability);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.rollAttribute, action.damageFormula]),
    [
      ["principiante-recuperacion", "tenaz", "1d4"],
      ["adepto-recuperacion", "tenaz", "1d6"],
      ["maestro-recuperacion", "tenaz", "1d8"]
    ]
  );
});

test("medicus expone curacion authored por nivel con atributo correcto", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Medicus"));

  assert.ok(ability);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.rollAttribute, action.damageFormula]),
    [
      ["principiante-medicus", "combat", "inteligente", "1d4"],
      ["adepto-medicus", "combat", "inteligente", "1d6"],
      ["maestro-medicus", "combat", "inteligente", "1d8"]
    ]
  );
});

test("venenos expone aplicacion gratuita authored en todos sus niveles", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Venenos"));

  assert.ok(ability);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.rollAttribute]),
    [
      ["principiante-venenos", "free", "inteligente"],
      ["adepto-venenos", "free", undefined],
      ["maestro-venenos", "free", "inteligente"]
    ]
  );
});

test("cascada de azufre expone dano y atributo authored por nivel", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Cascada"));

  assert.ok(power);
  assert.deepEqual(
    power.acciones.map((action) => [action.id, action.cost, action.rollAttribute, action.damageFormula]),
    [
      ["principiante-cascada-de-azufre", "combat", "tenaz", "1d12"],
      ["adepto-cascada-de-azufre", "combat", "tenaz", "1d12"],
      ["maestro-cascada-de-azufre", "combat", "tenaz", "1d12"]
    ]
  );
});

test("teletransportacion expone acciones authored por nivel", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Teletrans"));

  assert.ok(power);
  assert.deepEqual(
    power.acciones.map((action) => [action.id, action.cost, action.rollAttribute]),
    [
      ["principiante-teletransportacion", "combat", "tenaz"],
      ["adepto-teletransportacion", "combat", "tenaz"],
      ["maestro-teletransportacion", "combat", "tenaz"]
    ]
  );
});

test("canalizacion ya no depende de inferencia residual y expone sus reacciones authored", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Canal"));

  assert.ok(ability);
  assert.deepEqual(
    ability.acciones.map((action) => [action.id, action.cost, action.rollAttribute]),
    [
      ["principiante-canalizacion", "reaction", undefined],
      ["adepto-canalizacion", "reaction", undefined],
      ["maestro-canalizacion", "reaction", "tenaz"]
    ]
  );
});

test("caceria salvaje resuelve su metadata authored con el slug correcto", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Cacer"));

  assert.ok(power);
  assert.deepEqual(
    power.acciones.map((action) => [action.id.endsWith("cacería-salvaje"), action.cost]),
    [
      [true, "combat"],
      [true, "combat"],
      [true, "combat"]
    ]
  );
});

test("golpe psiquico queda contemplado explicitamente en el compendio", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.acciones.some((action) => action.id === "general-golpe-psiquico"));

  assert.ok(power);
  assert.deepEqual(
    power.acciones.map((action) => [action.id, action.label, action.cost, action.rollAttribute]),
    [["general-golpe-psiquico", actionLabel(power.acciones[0].label), "combat", "tenaz"]]
  );
  assert.match(power.acciones[0].effectSummary, /ataque ps.*quico directo/i);
});

test("las referencias de compendio apuntan a paginas de detalle para entradas conocidas", () => {
  const alchemist = SYMBAROUM_ABILITIES.find((entry) => entry.nombre.startsWith("Alquimista"));
  const blackBreath = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre.startsWith("Aliento"));
  const raiseUndead = SYMBAROUM_RITUALS.find((entry) => entry.nombre.startsWith("Alzar"));

  assert.equal(alchemist?.pagina, 113);
  assert.equal(blackBreath?.pagina, 80);
  assert.equal(raiseUndead?.pagina, 90);
});

function actionLabel(label) {
  return label;
}
