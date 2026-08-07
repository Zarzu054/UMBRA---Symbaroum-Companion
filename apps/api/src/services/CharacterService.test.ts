import { createEmptyCharacterSheet, type Character } from "@umbra/shared";
import { describe, expect, it, vi } from "vitest";
import { CharacterService } from "./CharacterService.js";

function makeCharacter(): Character {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 20;
  return {
    id: "character-a",
    name: "Alda",
    archetype: "Guerrero",
    race: "Humano",
    culture: "Ambriano",
    profession: "",
    level: 1,
    sheet,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

describe("CharacterService experience ownership", () => {
  it("keeps the stored total when the owner submits a different value", async () => {
    const current = makeCharacter();
    const model = {
      findById: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockImplementation(async (_ownerId, _characterId, payload) => ({ ...current, ...payload }))
    };
    const requestedSheet = structuredClone(current.sheet);
    requestedSheet.progreso.experienciaTotal = 900;

    const updated = await new CharacterService(model as never).updateCharacter("owner-a", current.id, {
      sheet: requestedSheet
    });

    expect(updated.sheet.progreso.experienciaTotal).toBe(20);
    expect(model.update.mock.calls[0][2].sheet.progreso.experienciaTotal).toBe(20);
  });
});
