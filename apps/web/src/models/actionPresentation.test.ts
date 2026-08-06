import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet, type CharacterActionDefinition } from "@umbra/shared";
import { getCharacterActionRollPresentation } from "./actionPresentation";

function buildAction(overrides: Partial<CharacterActionDefinition> = {}): CharacterActionDefinition {
  return {
    id: "test-action",
    label: "Acción de prueba",
    sourceType: "ability",
    sourceName: "Prueba",
    cost: "combat",
    effectSummary: "",
    ...overrides
  };
}

describe("getCharacterActionRollPresentation", () => {
  it("formats an attribute roll with its current target", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.atributos.diestro = 13;

    expect(getCharacterActionRollPresentation(buildAction({ rollAttribute: "diestro" }), sheet)).toEqual({
      attackFormula: "1d20 ≤ Diestro 13",
      damageFormula: undefined,
      hasDamageModifiers: false,
      hasRoll: true
    });
  });

  it("uses a fixed target instead of the character attribute", () => {
    const sheet = createEmptyCharacterSheet();

    expect(getCharacterActionRollPresentation(buildAction({ rollAttribute: "agil", fixedTarget: 5 }), sheet).attackFormula)
      .toBe("1d20 ≤ Agil 5");
  });

  it("shows effective damage and reports optional modifiers", () => {
    const sheet = createEmptyCharacterSheet();
    const action = buildAction({
      sourceType: "weapon",
      damageFormula: "1d8+1",
      damageModifiers: [{ id: "situational", label: "Ventaja", formula: "+1d4" }]
    });

    expect(getCharacterActionRollPresentation(action, sheet)).toMatchObject({
      damageFormula: "1d8+1",
      hasDamageModifiers: true,
      hasRoll: true
    });
  });

  it("marks utility and integrated modifier actions as having no standalone roll", () => {
    const sheet = createEmptyCharacterSheet();

    expect(getCharacterActionRollPresentation(buildAction(), sheet).hasRoll).toBe(false);
    expect(getCharacterActionRollPresentation(buildAction({ damageFormula: "+1d4" }), sheet).hasRoll).toBe(false);
  });
});
