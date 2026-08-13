import assert from "node:assert/strict";
import test from "node:test";
import { increaseEffectDieFormula } from "../dist/index.js";

test("aumenta el dado principal siguiendo toda la progresion", () => {
  assert.equal(increaseEffectDieFormula("1D4"), "1d6");
  assert.equal(increaseEffectDieFormula("1D6"), "1d8");
  assert.equal(increaseEffectDieFormula("1D8"), "1d10");
  assert.equal(increaseEffectDieFormula("1D10"), "1d12");
  assert.equal(increaseEffectDieFormula("1D12"), "1d12+1");
});

test("conserva dados adicionales y acumula los excesos sobre d12", () => {
  assert.equal(increaseEffectDieFormula("1D8+1D4"), "1d10+1d4");
  assert.equal(increaseEffectDieFormula("1D12+1D4"), "1d12+1d4+1");
  assert.equal(increaseEffectDieFormula("1D12+1D4+1", 2), "1d12+1d4+3");
  assert.equal(increaseEffectDieFormula("1D10+1D4", 3), "1d12+1d4+2");
});

test("normaliza formulas validas y rechaza expresiones no soportadas", () => {
  assert.equal(increaseEffectDieFormula(" 2D6 + 3 "), "2d8+3");
  assert.equal(increaseEffectDieFormula("1d8+1d4", 0), "1d8+1d4");
  assert.equal(increaseEffectDieFormula("especial"), null);
});
