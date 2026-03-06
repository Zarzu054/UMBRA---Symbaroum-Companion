import test from "node:test";
import assert from "node:assert/strict";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS } from "../dist/symbaroumCompendium.js";

test("las habilidades usan resumen mecanico generado con referencia", () => {
  const ability = SYMBAROUM_ABILITIES.find((entry) => entry.nombre === "Ataque traicionero");

  assert.ok(ability);
  assert.match(ability.efectoResumen, /\+1D4/i);
  assert.match(ability.efectoResumen, /Ref: Libro Básico, p\.116\./);
});

test("los poderes misticos usan resumen mecanico generado con referencia", () => {
  const power = SYMBAROUM_MYSTIC_POWERS.find((entry) => entry.nombre === "Escudo bendito");

  assert.ok(power);
  assert.match(power.efectoResumen, /1D4 puntos de armadura/i);
  assert.match(power.efectoResumen, /Ref: Guía Avanzada del Jugador, p\.81\./);
});
