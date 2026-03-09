import test from "node:test";
import assert from "node:assert/strict";
import {
  assignCampaignSessionExperienceSchema,
  createCampaignSessionSchema,
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
