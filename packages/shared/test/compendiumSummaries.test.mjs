import test from "node:test";
import assert from "node:assert/strict";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS } from "../dist/symbaroumCompendium.js";

test("las habilidades usan resumen mecanico generado con referencia", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre === "Ataque traicionero");

  assert.ok(ability);
  assert.match(ability.efectoResumen, /\+1D4/i);
  assert.match(ability.efectoResumen, /Ref: Libro B.*sico, p\.114\./);
});

test("los poderes misticos usan resumen mecanico generado con referencia", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre === "Escudo bendito");

  assert.ok(power);
  assert.match(power.efectoResumen, /1D4 puntos de armadura/i);
  assert.match(power.efectoResumen, /Ref: Gu.*a Avanzada del Jugador, p\.81\./);
});

test("las referencias de compendio apuntan a paginas de detalle para entradas conocidas", () => {
  const alchemist = SYMBAROUM_ABILITIES.find((entry) => entry.nombre === "Alquimista");
  const blackBreath = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre === "Aliento negro");
  const raiseUndead = SYMBAROUM_RITUALS.find((entry) => entry.nombre === "Alzar muertos vivientes");

  assert.equal(alchemist?.pagina, 113);
  assert.equal(blackBreath?.pagina, 80);
  assert.equal(raiseUndead?.pagina, 90);
});
