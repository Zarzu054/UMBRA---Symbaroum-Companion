import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyCharacterSheet,
  mysticArtifactDefinitionInputSchema,
  concealOwnedMysticArtifact,
  preserveLegacyMysticArtifacts,
  projectMysticArtifactsIntoSheet,
  stripManagedMysticArtifactsFromSheet,
  deriveCharacterActions,
  synchronizeCharacterSheet
} from "../dist/index.js";

function makeArtifact(bound = false) {
  const definition = mysticArtifactDefinitionInputSchema.parse({
    name: "Lanza de prueba",
    description: "Descripción secreta",
    kind: "weapon",
    sourceTitle: "Libro local",
    sourcePage: 10,
    bindingCosts: [{ paymentType: "xp", amount: 1 }, { paymentType: "permanent_corruption", amount: 1 }],
    weapon: {
      attackAttribute: "diestro",
      attackFormula: "1D20",
      damageFormula: "1D8",
      tags: ["long", "thrown"],
      qualities: ["Precisa"],
      requiresBinding: true
    },
    abilities: [{
      name: "Descarga",
      description: "Golpea y causa daño.",
      activation: "active",
      actionCost: "combat",
      corruptionFormula: "1D4",
      requiresBinding: true,
      perSceneNote: "",
      rolls: [
        { kind: "check", label: "Impacto", formula: "1D20", actorAttribute: "tenaz", opponentAttribute: "tenaz" },
        { kind: "damage", label: "Daño", formula: "1D6" }
      ],
      requirements: [],
      resourceCosts: [{ resourceKey: "cargas", amount: 1 }]
    }],
    resources: [{ key: "cargas", name: "Cargas", suggestedMaxFormula: "1D4", maximum: 3, current: 3 }]
  });
  return {
    ...definition,
    id: "artifact-a",
    scope: "campaign",
    campaignId: "campaign-a",
    campaignName: "Campaña",
    presetSourceId: null,
    ownerType: "character",
    ownerId: "link-a",
    ownerName: "Alda",
    ownerEmail: "alda@example.com",
    isBound: bound,
    boundAt: bound ? new Date(0).toISOString() : null,
    bindingPaymentType: bound ? "xp" : null,
    bindingPaymentAmount: bound ? 1 : null,
    abilities: definition.abilities.map((ability, index) => ({
      ...ability,
      id: `ability-${index}`,
      locked: false,
      lockReason: "",
      rolls: ability.rolls.map((roll, rollIndex) => ({ ...roll, id: `roll-${rollIndex}` })),
      requirements: []
    })),
    resources: definition.resources.map((resource, index) => ({ ...resource, id: `resource-${index}` })),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

test("validates alternate binding costs, opposed rolls and instance resources", () => {
  const artifact = makeArtifact(true);
  assert.equal(artifact.bindingCosts.length, 2);
  assert.equal(artifact.abilities[0].rolls[0].opponentAttribute, "tenaz");
  assert.equal(artifact.resources[0].current, 3);
});

test("conceals bound-only data and reveals it after binding", () => {
  const concealed = concealOwnedMysticArtifact(makeArtifact(false));
  assert.equal(concealed.description, "");
  assert.equal(concealed.weapon, undefined);
  assert.equal(concealed.abilities.length, 0);
  assert.equal(concealOwnedMysticArtifact(makeArtifact(true)).abilities.length, 1);
});

test("projects a managed weapon and all roll metadata into artifact actions", () => {
  const sheet = synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(createEmptyCharacterSheet(), [makeArtifact(true)]));
  const item = sheet.inventoryItems.find((entry) => entry.managedArtifactId === "artifact-a");
  assert.equal(item.category, "weapon");
  assert.match(item.qualities, /Arrojadiza/);
  const action = deriveCharacterActions(sheet).find((entry) => entry.sourceType === "artifact");
  assert.equal(action.opponentAttribute, "tenaz");
  assert.equal(action.corruptionFormula, "1D4");
  assert.equal(action.rolls.length, 2);
});

test("elimina una accion antigua con el nombre del artefacto cuando duplica su ataque de arma", () => {
  const artifact = makeArtifact(true);
  artifact.name = "Parcabrasa";
  artifact.abilities.push({
    id: "legacy-base-attack",
    name: "Parcabrasa",
    description: "Accion antigua que repetia el ataque basico del arma.",
    activation: "active",
    actionCost: "combat",
    corruptionFormula: undefined,
    requiresBinding: false,
    perSceneNote: "",
    locked: false,
    lockReason: "",
    rolls: [
      { id: "legacy-attack", kind: "attack", label: "Ataque", formula: "1D20", actorAttribute: "diestro" },
      { id: "legacy-damage", kind: "damage", label: "Daño", formula: "1D8" }
    ],
    requirements: [],
    resourceCosts: []
  });
  const sheet = synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(createEmptyCharacterSheet(), [artifact]));
  const actions = deriveCharacterActions(sheet);

  assert.equal(actions.filter((action) => action.label === "Atacar con Parcabrasa").length, 1);
  assert.equal(actions.filter((action) => action.label === "Parcabrasa").length, 0);
  assert.equal(actions.filter((action) => action.label === "Descarga").length, 1);
});

test("Viento de acero mejora el dado base de cualquier artefacto arrojadizo y conserva sus dados adicionales", () => {
  for (const [publishedFormula, expectedFormula] of [
    ["1D4+1D4", "1d6+1d4"],
    ["1D6+1D4", "1d8+1d4"],
    ["1D8+1D4", "1d10+1d4"],
    ["1D10+1D4", "1d12+1d4"],
    ["1D12+1D4", "1d12+1d4+1"]
  ]) {
    const artifact = makeArtifact(true);
    artifact.name = "Artefacto arrojadizo futuro";
    artifact.weapon.damageFormula = publishedFormula;

    const baseSheet = createEmptyCharacterSheet();
    baseSheet.habilidades = [{
      nombre: "Viento de acero",
      tipo: "Habilidad",
      efecto: "",
      nivel: "principiante",
      fuente: "Libro Básico",
      pagina: 1,
      notas: "",
      acciones: []
    }];

    const sheet = synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(baseSheet, [artifact]));
    const attack = deriveCharacterActions(sheet).find((entry) => entry.label === "Atacar con Artefacto arrojadizo futuro");

    assert.ok(attack);
    assert.equal(attack.damageFormula, expectedFormula);
    assert.ok(attack.damageBreakdown.some((entry) => entry.label === "Viento de acero"));
  }
});

test("removes client copies while preserving safe slot references and legacy artifacts", () => {
  const current = createEmptyCharacterSheet();
  current.inventoryItems.push({
    id: "legacy", name: "Reliquia antigua", category: "artifact", quantity: 1, stackable: false,
    isCustom: true, description: "", weight: "", value: "", equipped: false, slot: "artifact",
    damageFormula: "", protectionFormula: "", qualities: "", notes: "", grantedActions: [], modifiers: []
  });
  const projected = projectMysticArtifactsIntoSheet(current, [makeArtifact(true)]);
  projected.equipmentSlots.mainHand = "managed-artifact:artifact-a";
  projected.inventoryItems.push({ ...current.inventoryItems[0], id: "forged" });
  const stripped = stripManagedMysticArtifactsFromSheet(projected);
  assert.equal(stripped.equipmentSlots.mainHand, "managed-artifact:artifact-a");
  const protectedSheet = preserveLegacyMysticArtifacts(current, stripped);
  assert.deepEqual(protectedSheet.inventoryItems.filter((item) => item.category === "artifact").map((item) => item.id), ["legacy"]);
});
