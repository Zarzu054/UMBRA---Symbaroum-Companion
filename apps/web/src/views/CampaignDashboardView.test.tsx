import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type AuthUser, type Campaign, type MysticArtifact } from "@umbra/shared";
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
const artifactServiceMocks = vi.hoisted(() => ({
  fetchMysticArtifactPresets: vi.fn().mockResolvedValue([]),
  fetchMysticArtifactSource: vi.fn(),
  assignMysticArtifactOwner: vi.fn(), bindNpcMysticArtifact: vi.fn(), createCampaignMysticArtifact: vi.fn(),
  deleteCampaignMysticArtifact: vi.fn(), unbindMysticArtifact: vi.fn(), updateCampaignMysticArtifact: vi.fn(),
  updateMysticArtifactResource: vi.fn(), useMysticArtifactAbility: vi.fn()
}));

vi.mock("../services/campaignService", () => serviceMocks);
vi.mock("../services/mysticArtifactService", () => artifactServiceMocks);

import { CampaignDashboardView } from "./CampaignDashboardView";

const gm: AuthUser = {
  id: "gm-a",
  email: "gm@example.com",
  role: "gm",
  status: "active",
  mustChangePassword: false
};

function buildArtifact(scope: "preset" | "campaign", name: string): MysticArtifact {
  return {
    id: scope === "preset" ? "10000000-0000-4000-8000-000000000001" : "20000000-0000-4000-8000-000000000001",
    scope,
    campaignId: scope === "campaign" ? "campaign-a" : null,
    presetSourceId: scope === "campaign" ? "10000000-0000-4000-8000-000000000001" : null,
    name,
    description: `${name} description`,
    kind: "object",
    sourceTitle: "Core book",
    bindingCosts: [{ paymentType: "xp", amount: 1 }],
    abilities: [],
    resources: [],
    ownerType: null,
    ownerId: null,
    ownerName: null,
    ownerEmail: null,
    isBound: false,
    boundAt: null,
    bindingPaymentType: null,
    bindingPaymentAmount: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function buildCampaign(total = 10, mysticArtifacts: MysticArtifact[] = []): Campaign {
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
    chatMessages: [],
    mysticArtifacts
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

  it("shows the GM-only artifact management section", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByText("Davokar");
    fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
    expect(screen.getByRole("heading", { name: "Artefactos místicos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir artefacto" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar artefacto")).not.toBeInTheDocument();
  });

  it("opens a guided artifact creator instead of a raw JSON editor", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByText("Davokar");
    fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir artefacto" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear personalizado" }));

    expect(screen.getByRole("heading", { name: "Crear artefacto personalizado" })).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4: Narrativa")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(screen.queryByText("Definición JSON")).not.toBeInTheDocument();
  });

  it("keeps presets out of the campaign list until the add modal is opened", async () => {
    const preset = buildArtifact("preset", "Catalog-only artifact");
    const campaignArtifact = buildArtifact("campaign", "Campaign artifact");
    artifactServiceMocks.fetchMysticArtifactPresets.mockResolvedValue([preset]);
    serviceMocks.fetchCampaigns.mockResolvedValue([buildCampaign(10, [campaignArtifact])]);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByText("Davokar");
    fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));

    expect(screen.getByText("Campaign artifact")).toBeInTheDocument();
    expect(screen.queryByText(/Catalog-only artifact/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir artefacto" }));
    expect(screen.getByLabelText("Seleccionar artefacto")).toHaveValue(preset.id);
    expect(screen.getByRole("option", { name: /Catalog-only artifact/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir predefinido" }));
    await waitFor(() => expect(artifactServiceMocks.createCampaignMysticArtifact).toHaveBeenCalledWith(
      "campaign-a",
      { mode: "preset", presetId: preset.id, resources: [] },
      "token-a"
    ));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Añadir artefacto" })).not.toBeInTheDocument());
  });
});
