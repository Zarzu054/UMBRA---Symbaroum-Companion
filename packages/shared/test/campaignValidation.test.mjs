import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacterActions,
  assignCampaignSessionExperienceSchema,
  createEmptyCharacterSheet,
  createCampaignReferenceSchema,
  createCampaignSessionSchema,
  executeCharacterAction,
  grantCampaignExperienceSchema
} from "../dist/index.js";

test("createCampaignSessionSchema acepta una sesion valida", () => {
  const parsed = createCampaignSessionSchema.parse({
    title: "Sesion 12",
    scheduledFor: "2026-03-15T19:00:00.000Z",
    location: "Discord",
    summary: "Exploracion de Davokar",
    publicNotes: "Repasar botin pendiente",
    dmNotes: "Emboscada de abominacion",
    status: "planned"
  });

  assert.equal(parsed.title, "Sesion 12");
  assert.equal(parsed.status, "planned");
});

test("grantCampaignExperienceSchema rechaza PX menores que 1", () => {
  assert.throws(() => {
    grantCampaignExperienceSchema.parse({
      characterId: "11111111-1111-1111-1111-111111111111",
      amount: 0,
      reason: "Fin de sesion"
    });
  });
});

test("assignCampaignSessionExperienceSchema acepta awards batch con ceros y positivos", () => {
  const parsed = assignCampaignSessionExperienceSchema.parse({
    awards: [
      { characterId: "11111111-1111-1111-1111-111111111111", amount: 0 },
      { characterId: "22222222-2222-2222-2222-222222222222", amount: 5 }
    ]
  });

  assert.equal(parsed.awards.length, 2);
  assert.equal(parsed.awards[0].amount, 0);
  assert.equal(parsed.awards[1].amount, 5);
});

test("assignCampaignSessionExperienceSchema rechaza cantidades negativas", () => {
  assert.throws(() => {
    assignCampaignSessionExperienceSchema.parse({
      awards: [{ characterId: "11111111-1111-1111-1111-111111111111", amount: -1 }]
    });
  });
});

test("createCampaignReferenceSchema acepta referencias publicas con alias", () => {
  const parsed = createCampaignReferenceSchema.parse({
    name: "Yndaros",
    label: "Ciudad",
    aliases: ["La Capital", "Ciudad de la Reina"],
    summary: "Centro de poder de Ambria",
    content: "Los personajes oyen rumores sobre Yndaros en casi toda la campaña.",
    isPublic: true
  });

  assert.equal(parsed.name, "Yndaros");
  assert.equal(parsed.aliases.length, 2);
  assert.equal(parsed.isPublic, true);
});

test("deriveCharacterActions genera accion de arma y executeCharacterAction la resuelve", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.combate.armaPrincipal = "Espada larga";
  sheet.combate.armaPrincipalAtributo = "fuerte";
  sheet.combate.danioPrincipal = "1d8";
  sheet.atributos.fuerte = 13;

  const actions = deriveCharacterActions(sheet);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].label, "Atacar con Espada larga");

  const executed = executeCharacterAction(sheet, actions[0].id);
  assert.equal(executed.rolls.length, 2);
  assert.equal(executed.rolls[0].formula, "1d20");
  assert.equal(executed.rolls[1].formula, "1d8");
});
