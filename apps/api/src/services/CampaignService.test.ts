import { createEmptyCharacterSheet, type CharacterSheet } from "@umbra/shared";
import { describe, expect, it, vi } from "vitest";
import { CampaignService } from "./CampaignService.js";

function addNoviceAbility(sheet: CharacterSheet, name: string): void {
  sheet.habilidades.push({
    nombre: name,
    tipo: "Habilidad",
    efecto: "",
    nivel: "novato",
    fuente: "Libro Basico",
    notas: "",
    acciones: []
  });
}

function createModel(currentSheet: CharacterSheet) {
  return {
    findCharacterLinkDetailById: vi.fn().mockResolvedValue({
      id: "link-a",
      campaignId: "campaign-a",
      characterId: "character-a",
      ownerId: "player-a"
    }),
    findCharacterById: vi.fn().mockResolvedValue({
      id: "character-a",
      ownerId: "player-a",
      name: "Alda",
      sheet: currentSheet
    }),
    updateLinkedCharacterSheet: vi.fn().mockResolvedValue(undefined),
    findAccessibleById: vi.fn().mockResolvedValue({ id: "campaign-a" })
  };
}

describe("CampaignService character experience", () => {
  it("does not allow players to read-write the GM private-note collection", async () => {
    const model = {
      findAccessibleById: vi.fn().mockResolvedValue({ id: "campaign-a" }),
      update: vi.fn()
    };

    await expect(new CampaignService(model as never).updateCampaign(
      "player-a",
      "player",
      "campaign-a",
      {
        dmNoteEntries: [{
          id: "dm-note-1",
          title: "Secreto",
          content: "No revelar",
          authorId: "player-a",
          authorEmail: "player@example.com",
          createdAt: "",
          updatedAt: ""
        }]
      }
    )).rejects.toThrow("Solo puedes editar las notas compartidas");
    expect(model.update).not.toHaveBeenCalled();
  });

  it("allows only a game master to grant XP", async () => {
    const model = { grantExperience: vi.fn() };

    await expect(new CampaignService(model as never).grantExperience(
      "player-a",
      "player",
      "campaign-a",
      { characterId: "00000000-0000-4000-8000-000000000001", amount: 5, reason: "Sesion" }
    )).rejects.toThrow("Solo un director de juego");
    expect(model.grantExperience).not.toHaveBeenCalled();
  });

  it("lets an owner spend granted XP but not replace the total", async () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 10;
    const requested = structuredClone(current);
    requested.progreso.experienciaTotal = 999;
    addNoviceAbility(requested, "Acrobacia");
    const model = createModel(current);

    await new CampaignService(model as never).updateCharacterSheet(
      "player-a",
      "player",
      "link-a",
      { sheet: requested }
    );

    const savedSheet = model.updateLinkedCharacterSheet.mock.calls[0][1];
    expect(savedSheet.progreso.experienciaTotal).toBe(10);
    expect(savedSheet.progreso.experienciaGastada).toBe(10);
  });

  it("rejects an owner purchase above the granted total", async () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 10;
    const requested = structuredClone(current);
    addNoviceAbility(requested, "Acrobacia");
    addNoviceAbility(requested, "Alquimia");
    const model = createModel(current);

    await expect(new CampaignService(model as never).updateCharacterSheet(
      "player-a",
      "player",
      "link-a",
      { sheet: requested }
    )).rejects.toThrow("solo tiene 10 PX concedidos");
    expect(model.updateLinkedCharacterSheet).not.toHaveBeenCalled();
  });
});
