import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type AuthUser, type Campaign } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  fetchCampaigns: vi.fn(),
  grantCampaignExperience: vi.fn(),
  addCampaignMember: vi.fn(),
  createCampaign: vi.fn(),
  createCampaignReference: vi.fn(),
  deleteCampaignReference: vi.fn(),
  linkCampaignCharacter: vi.fn(),
  removeCampaignMember: vi.fn(),
  unlinkCampaignCharacter: vi.fn(),
  updateCampaign: vi.fn(),
  updateCampaignReference: vi.fn()
}));

vi.mock("../services/campaignService", () => serviceMocks);

import { CampaignDashboardView } from "./CampaignDashboardView";

const gm: AuthUser = {
  id: "gm-a",
  email: "gm@example.com",
  role: "gm",
  status: "active",
  mustChangePassword: false
};

function buildCampaign(total = 10): Campaign {
  const sheet = createEmptyCharacterSheet();
  sheet.identidad.nombrePersonaje = "Alda";
  sheet.progreso.experienciaTotal = total;
  return {
    id: "campaign-a",
    name: "Davokar",
    summary: "",
    setting: "",
    notes: "",
    sharedNotes: "",
    sharedNoteEntries: [],
    gmId: gm.id,
    gmEmail: gm.email,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    members: [{ id: "member-gm", userId: gm.id, email: gm.email, role: "gm", joinedAt: new Date(0).toISOString() }],
    characters: [{
      id: "link-a",
      characterId: "00000000-0000-4000-8000-000000000001",
      name: "Alda",
      ownerId: "player-a",
      ownerEmail: "player@example.com",
      experienceTotal: total,
      experienceSpent: 0,
      sheet,
      updatedAt: new Date(0).toISOString()
    }],
    availableCharacters: [],
    npcs: [],
    experienceLog: [],
    sessions: [],
    references: [],
    chatMessages: []
  };
}

describe("CampaignDashboardView experience grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "#campaigns?id=campaign-a&section=characters");
    serviceMocks.fetchCampaigns.mockResolvedValue([buildCampaign()]);
    serviceMocks.grantCampaignExperience.mockResolvedValue(buildCampaign(15));
  });

  afterEach(cleanup);

  it("lets the GM grant XP to a linked character", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Conceder PX" }));
    fireEvent.change(screen.getByLabelText("Cantidad de PX"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Sesion completada" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar concesion" }));

    await waitFor(() => expect(serviceMocks.grantCampaignExperience).toHaveBeenCalledWith(
      "campaign-a",
      {
        characterId: "00000000-0000-4000-8000-000000000001",
        amount: 5,
        reason: "Sesion completada"
      },
      "token-a"
    ));
    expect(await screen.findByText(/PX total: 15/)).toBeInTheDocument();
  });
});
