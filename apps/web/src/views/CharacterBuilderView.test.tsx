import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type Character, type OwnedMysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterBuilderView } from "./CharacterBuilderView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeArtifact(): OwnedMysticArtifact {
  return {
    id: "artifact-a", scope: "campaign", campaignId: "campaign-a", campaignName: "Davokar", presetSourceId: null,
    name: "Piedra Solar", description: "", kind: "object", sourceTitle: "", bindingCosts: [
      { paymentType: "xp", amount: 1 }, { paymentType: "permanent_corruption", amount: 1 }
    ], ownerType: "character", ownerId: "link-a", ownerName: "Alda", ownerEmail: "alda@example.com",
    isBound: false, boundAt: null, bindingPaymentType: null, bindingPaymentAmount: null,
    abilities: [], resources: [], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
}

it("lets the player choose a configured artifact binding payment", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 5;
  const character: Character = {
    id: "character-a", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, mysticArtifacts: [makeArtifact()], artifactBindingXpSpent: 0,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onBind = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onBindMysticArtifact={onBind} />);
  fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
  expect(screen.getByText("Piedra Solar")).toBeInTheDocument();
  expect(screen.getByText(/capacidades se revelaran/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Vincular por 1 PX" }));

  await waitFor(() => expect(onBind).toHaveBeenCalledWith("artifact-a", "xp"));
});
