import { createEmptyCharacterSheet } from "@umbra/shared";
import { describe, expect, it } from "vitest";
import { parseCampaignSheetSafely } from "./CampaignModel.js";

describe("parseCampaignSheetSafely", () => {
  it("conserva una ficha válida con notas extensas", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.notas = "Contenido extenso. ".repeat(1000);
    expect(parseCampaignSheetSafely(sheet)?.notas).toBe(sheet.notas);
  });

  it("aísla una ficha irrecuperable en lugar de lanzar una excepción", () => {
    const sheet = createEmptyCharacterSheet() as unknown as { atributos: { agil: number } };
    sheet.atributos.agil = 99;
    expect(parseCampaignSheetSafely(sheet)).toBeNull();
  });
});
