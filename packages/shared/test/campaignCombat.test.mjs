import test from "node:test";
import assert from "node:assert/strict";
import {
  addCampaignCombatParticipantSchema,
  campaignCombatParticipantSchema,
  computeCharacterCombatSummary,
  createEmptyCharacterSheet,
  reorderCampaignCombatSchema
} from "../dist/index.js";

test("el combate valida participantes enlazados e instancias independientes", () => {
  const character = addCampaignCombatParticipantSchema.parse({
    kind: "character",
    campaignCharacterId: "00000000-0000-4000-8000-000000000001"
  });
  const monster = addCampaignCombatParticipantSchema.parse({
    kind: "monster",
    sourceKind: "official",
    sourceId: "troll",
    quantity: 4
  });
  assert.equal(character.kind, "character");
  assert.equal(monster.quantity, 4);
  assert.throws(() => reorderCampaignCombatSchema.parse({ revision: 0, participantIds: [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000001"
  ] }));
  assert.throws(() => campaignCombatParticipantSchema.parse({ ...character, id: "invalid" }));
});

test("el resumen de combate comparte los cálculos derivados de la hoja", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.atributos.agil = 10;
  sheet.atributos.atento = 15;
  sheet.habilidades.push({ nombre: "Sexto sentido", tipo: "Habilidad", efecto: "", nivel: "adepto", fuente: "", notas: "", acciones: [] });
  sheet.combate.robustezActual = 7;
  sheet.corrupcion.temporal = 2;
  sheet.corrupcion.permanente = 1;
  const summary = computeCharacterCombatSummary(sheet);
  assert.equal(summary.initiative, 15);
  assert.equal(summary.defense, 15);
  assert.equal(summary.robustnessCurrent, 7);
  assert.equal(summary.corruptionTotal, 3);
});
