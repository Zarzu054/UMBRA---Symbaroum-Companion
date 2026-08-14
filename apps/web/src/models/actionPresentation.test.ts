import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet, deriveCharacterActions, synchronizeCharacterSheet, type CharacterActionDefinition } from "@umbra/shared";
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
  it("derives overlapping source, cost and attack categories", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.habilidades = [{
      nombre: "Ataque de prueba",
      tipo: "Habilidad",
      efecto: "",
      nivel: "principiante",
      fuente: "Prueba",
      notas: "",
      acciones: [{
        id: "attack-test",
        label: "Usar ataque de prueba",
        cost: "combat",
        categories: ["attack"],
        rollAttribute: "diestro",
        damageFormula: "1d6",
        effectSummary: "Ataque de prueba."
      }]
    }];
    sheet.poderesMisticos = [{
      nombre: "Rayo de prueba",
      tipo: "Poder",
      efecto: "",
      nivel: "principiante",
      fuente: "Prueba",
      notas: "",
      acciones: [{
        id: "ray-test",
        label: "Lanzar rayo de prueba",
        cost: "combat",
        categories: ["attack"],
        rollAttribute: "tenaz",
        damageFormula: "1d8",
        effectSummary: "Ataque místico de prueba."
      }]
    }];

    const actions = deriveCharacterActions(synchronizeCharacterSheet(sheet));
    const abilityAttack = actions.find((action) => action.sourceName === "Ataque de prueba");
    const powerAttack = actions.find((action) => action.sourceName === "Rayo de prueba");

    expect(abilityAttack?.categories).toEqual(expect.arrayContaining(["attack", "combat"]));
    expect(powerAttack?.categories).toEqual(expect.arrayContaining(["attack", "combat", "powers"]));
  });

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

  it("separates Parcabrasa's melee attack from its ranged throw", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems = [{
      id: "managed-artifact:parcabrasa",
      name: "Parcabrasa",
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "Hacha arrojadiza habitada por espíritus de fuego.",
      weight: "",
      value: "",
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1D6+1D4",
      protectionFormula: "",
      qualities: "Arrojadiza, Regreso, Místico",
      notes: "",
      managedArtifactId: "parcabrasa",
      artifactBound: true,
      artifactBindingCostLabel: "1 PX",
      artifactResources: [],
      grantedActions: [{
        id: "legacy-parcabrasa",
        label: "Parcabrasa",
        cost: "combat",
        rollAttribute: "diestro",
        damageFormula: "1D6+1D4",
        effectSummary: "Acción de lanzamiento antigua."
      }],
      modifiers: []
    }];
    sheet.habilidades = [{
      nombre: "Sexto sentido",
      tipo: "Habilidad",
      efecto: "",
      nivel: "principiante",
      fuente: "Libro Básico",
      pagina: 116,
      notas: "",
      acciones: []
    }, {
      nombre: "Viento de acero",
      tipo: "Habilidad",
      efecto: "",
      nivel: "principiante",
      fuente: "Libro Básico",
      pagina: 28,
      notas: "",
      acciones: []
    }];

    const actions = deriveCharacterActions(synchronizeCharacterSheet(sheet));
    const meleeAttack = actions.find((entry) => entry.label === "Atacar con Parcabrasa");
    const thrownAttack = actions.find((entry) => entry.label === "Lanzar a Parcabrasa");

    expect(actions.filter((entry) => entry.sourceName === "Parcabrasa").map((entry) => entry.label))
      .toEqual(["Atacar con Parcabrasa", "Lanzar a Parcabrasa"]);
    expect(meleeAttack).toMatchObject({ rollAttribute: "diestro", damageFormula: "1d6+1d4" });
    expect(meleeAttack?.effectSummary).not.toContain("Sexto sentido");
    expect(meleeAttack?.effectSummary).not.toContain("Viento de acero");
    expect(thrownAttack).toMatchObject({ rollAttribute: "atento", damageFormula: "1d8+1d4" });
    expect(thrownAttack?.effectSummary).toContain("Sexto sentido");
    expect(thrownAttack?.effectSummary).toContain("Viento de acero");
    expect(getCharacterActionRollPresentation(meleeAttack!, sheet).attackFormula).toContain("Diestro");
    expect(getCharacterActionRollPresentation(thrownAttack!, sheet).attackFormula).toContain("Atento");
  });
});
