import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type AuthUser, type Campaign, type CampaignCombat, type MysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  acceptCampaignInvitation: vi.fn(),
  dismissCampaignInvitation: vi.fn(),
  fetchCampaigns: vi.fn(),
  fetchCampaignInvitations: vi.fn(),
  grantCampaignExperience: vi.fn(),
  sendCampaignInvitation: vi.fn(),
  createCampaign: vi.fn(),
  createCampaignReference: vi.fn(),
  deleteCampaignReference: vi.fn(),
  decideProfessionRequest: vi.fn(),
  linkCampaignCharacter: vi.fn(),
  removeCampaignMember: vi.fn(),
  unlinkCampaignCharacter: vi.fn(),
  updateCampaign: vi.fn(),
  updateCampaignReference: vi.fn(),
  fetchCampaignCombat: vi.fn().mockResolvedValue(null),
  startCampaignCombat: vi.fn(),
  finishCampaignCombat: vi.fn(),
  addCampaignCombatParticipant: vi.fn(),
  updateCampaignCombatParticipant: vi.fn(),
  removeCampaignCombatParticipant: vi.fn(),
  reorderCampaignCombat: vi.fn(),
  advanceCampaignCombatTurn: vi.fn(),
  updateCampaignCombatResources: vi.fn()
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
    dmNoteEntries: [],
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
    serviceMocks.fetchCampaignInvitations.mockResolvedValue([]);
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

  it("exposes the DM-only combat section and loads its current state", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    expect(await screen.findByRole("heading", { name: "Combate" })).toBeInTheDocument();
    expect(serviceMocks.fetchCampaignCombat).toHaveBeenCalledWith("campaign-a", "token-a");
  });

  it("allows editing initiative and saves only after confirming the field", async () => {
    const combat: CampaignCombat = {
      id: "00000000-0000-4000-8000-000000000010",
      campaignId: "campaign-a",
      round: 1,
      activeParticipantId: "00000000-0000-4000-8000-000000000011",
      revision: 3,
      participants: [{
        id: "00000000-0000-4000-8000-000000000011",
        kind: "character",
        sourceId: "link-a",
        alias: "Alda",
        initiativeOverride: null,
        sortOrder: 0,
        initiative: 10,
        defense: 10,
        armor: "Sin armadura",
        armorDetail: "",
        robustnessCurrent: 8,
        robustnessMaximum: 10,
        painThreshold: 5,
        temporaryCorruption: 2,
        permanentCorruption: 1,
        corruptionThreshold: 5,
        conditions: [],
        attacks: []
      }],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    serviceMocks.fetchCampaignCombat.mockResolvedValue(combat);
    serviceMocks.updateCampaignCombatParticipant.mockResolvedValue({
      ...combat,
      revision: 4,
      participants: [{ ...combat.participants[0], initiative: 17, initiativeOverride: 17 }]
    });

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    const initiative = await screen.findByRole("spinbutton", { name: "Iniciativa de Alda" });
    const robustness = screen.getByRole("progressbar", { name: "Robustez de Alda" });
    const robustnessControls = robustness.parentElement!;
    expect(robustness).toHaveAttribute("aria-valuenow", "8");
    expect(robustness).toHaveAttribute("aria-valuemax", "10");
    expect(within(robustness).getByText("8 / 10")).toBeInTheDocument();
    expect(robustness.querySelector(".campaign-combat-resource-fill")).toHaveStyle({ width: "80%" });
    expect(robustnessControls.children[0]).toBe(screen.getByRole("button", { name: "Restar Robustez a Alda" }));
    expect(robustnessControls.children[1]).toBe(robustness);
    expect(robustnessControls.children[2]).toBe(screen.getByRole("button", { name: "Sumar Robustez a Alda" }));

    const temporaryCorruption = screen.getByRole("progressbar", { name: "Corrupción temporal de Alda" });
    const permanentCorruption = screen.getByRole("progressbar", { name: "Corrupción permanente de Alda" });
    expect(temporaryCorruption.querySelector(".campaign-combat-resource-fill")).toHaveStyle({ width: "40%" });
    expect(permanentCorruption.querySelector(".campaign-combat-resource-fill")).toHaveStyle({ width: "20%" });
    expect(screen.queryByText(/^Ronda /)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar turno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turno →" })).not.toBeInTheDocument();
    fireEvent.change(initiative, { target: { value: "17" } });
    expect(serviceMocks.updateCampaignCombatParticipant).not.toHaveBeenCalled();
    fireEvent.blur(initiative);
    await waitFor(() => expect(serviceMocks.updateCampaignCombatParticipant).toHaveBeenCalledWith(
      "campaign-a",
      combat.participants[0].id,
      { revision: 3, initiativeOverride: 17 },
      "token-a"
    ));
  });

  it("permite renombrar una instancia de monstruo sin alterar su perfil", async () => {
    const combat: CampaignCombat = {
      id: "00000000-0000-4000-8000-000000000020",
      campaignId: "campaign-a",
      round: 1,
      activeParticipantId: null,
      revision: 5,
      participants: [{
        id: "00000000-0000-4000-8000-000000000021",
        kind: "monster",
        sourceId: "libro-basico-maton",
        sourceKind: "official",
        alias: "Matón",
        initiativeOverride: null,
        sortOrder: 0,
        initiative: 10,
        defense: "−3",
        armor: "2",
        armorDetail: "Cuero",
        robustnessCurrent: 10,
        robustnessMaximum: 10,
        painThreshold: 5,
        temporaryCorruption: 0,
        permanentCorruption: 0,
        corruptionThreshold: 5,
        conditions: [],
        attacks: []
      }],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    serviceMocks.fetchCampaignCombat.mockResolvedValue(combat);
    serviceMocks.updateCampaignCombatParticipant.mockResolvedValue({
      ...combat,
      revision: 6,
      participants: [{ ...combat.participants[0], alias: "Matón del puente" }]
    });

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    fireEvent.click(await screen.findByRole("button", { name: "Renombrar a Matón" }));

    const dialog = screen.getByRole("dialog", { name: "Renombrar monstruo" });
    const aliasInput = within(dialog).getByRole("textbox", { name: "Nombre del monstruo en combate" });
    fireEvent.change(aliasInput, { target: { value: "  Matón del puente  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar nombre" }));

    await waitFor(() => expect(serviceMocks.updateCampaignCombatParticipant).toHaveBeenCalledWith(
      "campaign-a",
      combat.participants[0].id,
      { revision: 5, alias: "Matón del puente" },
      "token-a"
    ));
    expect(await screen.findByText("Matón del puente")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Renombrar monstruo" })).not.toBeInTheDocument();
  });

  it("shows and approves pending profession requests", async () => {
    const campaign = buildCampaign();
    campaign.pendingProfessionRequests = [{
      id: "request-a", characterId: campaign.characters[0].characterId, characterName: "Alda", ownerEmail: "player@example.com",
      professionId: "juramentado-de-hierro", professionName: "Juramentado de hierro", state: "pending", effectiveState: "pending",
      campaignId: campaign.id, campaignName: campaign.name, requestedAt: new Date(0).toISOString(), reviewedAt: null, decisionNote: "",
      eligibility: { professionId: "juramentado-de-hierro", eligible: true, requirementsMet: true, masterRequirementMet: true, otherRequirementMet: true, unmetRequirements: [], requirementResults: [{ id: "estudioso", label: "Estudioso", met: true, matchedNames: ["Estudioso"], hasMaster: true }] },
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
    }];
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    serviceMocks.decideProfessionRequest.mockResolvedValue([]);
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Solicitudes profesionales (1)" }));
    expect(screen.getByRole("heading", { name: "Solicitudes de profesiones" })).toBeInTheDocument();
    expect(screen.getByText("Juramentado de hierro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(serviceMocks.decideProfessionRequest).toHaveBeenCalledWith("campaign-a", "request-a", { decision: "approve", note: "" }, "token-a"));
  });

  it("sends an invitation instead of adding a campaign member directly", async () => {
    const campaign = buildCampaign();
    const invitedCampaign = {
      ...campaign,
      pendingInvitations: [{
        id: "10000000-0000-4000-8000-000000000001",
        campaignId: campaign.id,
        campaignName: campaign.name,
        gmEmail: gm.email,
        invitedEmail: "player@example.com",
        createdAt: "2026-08-10T10:00:00.000Z"
      }]
    };
    window.history.replaceState(null, "", "#campaigns?id=campaign-a&section=members");
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    serviceMocks.sendCampaignInvitation.mockResolvedValue(invitedCampaign);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    await screen.findByRole("heading", { name: "Miembros" });
    fireEvent.change(screen.getByLabelText("Email del jugador"), { target: { value: "player@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));

    await waitFor(() => expect(serviceMocks.sendCampaignInvitation).toHaveBeenCalledWith(
      "campaign-a",
      { email: "player@example.com" },
      "token-a"
    ));
    expect(await screen.findByText("Pendiente de aceptación")).toBeInTheDocument();
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });

  it("requires the invited player to accept before opening the campaign", async () => {
    const player: AuthUser = {
      id: "player-a",
      email: "player@example.com",
      role: "player",
      status: "active",
      mustChangePassword: false
    };
    const invitation = {
      id: "10000000-0000-4000-8000-000000000001",
      campaignId: "campaign-a",
      campaignName: "Davokar",
      gmEmail: gm.email,
      invitedEmail: player.email,
      createdAt: "2026-08-10T10:00:00.000Z"
    };
    const acceptedCampaign = buildCampaign();
    acceptedCampaign.members.push({
      id: "member-player",
      userId: player.id,
      email: player.email,
      role: "player",
      joinedAt: "2026-08-10T10:05:00.000Z"
    });
    window.history.replaceState(null, "", `#campaigns?invitation=${invitation.id}`);
    serviceMocks.fetchCampaigns.mockResolvedValue([]);
    serviceMocks.fetchCampaignInvitations.mockResolvedValue([invitation]);
    serviceMocks.acceptCampaignInvitation.mockResolvedValue(acceptedCampaign);

    render(<CampaignDashboardView user={player} ensureAccessToken={vi.fn().mockResolvedValue("token-player")} />);

    expect(await screen.findByRole("dialog", { name: "Davokar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notas compartidas" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceptar invitación" }));

    await waitFor(() => expect(serviceMocks.acceptCampaignInvitation).toHaveBeenCalledWith(invitation.id, "token-player"));
    expect(await screen.findByRole("heading", { name: "Davokar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notas compartidas" })).toBeInTheDocument();
  });

  it("shows each character experience history in its own modal", async () => {
    const campaign = buildCampaign();
    const secondSheet = createEmptyCharacterSheet();
    secondSheet.identidad.nombrePersonaje = "Beremo";
    campaign.characters.push({
      ...campaign.characters[0],
      id: "link-b",
      characterId: "00000000-0000-4000-8000-000000000002",
      name: "Beremo",
      ownerId: "player-b",
      ownerEmail: "beremo@example.com",
      sheet: secondSheet
    });
    campaign.experienceLog = [
      {
        id: "experience-a",
        sessionId: null,
        characterId: "00000000-0000-4000-8000-000000000001",
        characterName: "Alda",
        grantedById: gm.id,
        grantedByEmail: gm.email,
        amount: 5,
        reason: "Recompensa de Alda",
        createdAt: "2026-08-09T10:00:00.000Z"
      },
      {
        id: "experience-b",
        sessionId: null,
        characterId: "00000000-0000-4000-8000-000000000002",
        characterName: "Beremo",
        grantedById: gm.id,
        grantedByEmail: gm.email,
        amount: 3,
        reason: "Recompensa de Beremo",
        createdAt: "2026-08-10T10:00:00.000Z"
      }
    ];
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    const aldaCard = screen.getByRole("article", { name: "Personaje Alda" });
    const beremoCard = screen.getByRole("article", { name: "Personaje Beremo" });

    expect(within(aldaCard).queryByText("Recompensa de Alda")).not.toBeInTheDocument();
    expect(within(beremoCard).queryByText("Recompensa de Beremo")).not.toBeInTheDocument();

    fireEvent.click(within(aldaCard).getByRole("button", { name: "Historial de PX" }));
    let modal = screen.getByRole("dialog", { name: "Historial de PX de Alda" });
    expect(within(modal).getByText("+5 PX")).toBeInTheDocument();
    expect(within(modal).getByText("Recompensa de Alda")).toBeInTheDocument();
    expect(within(modal).queryByText("Recompensa de Beremo")).not.toBeInTheDocument();
    fireEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(within(beremoCard).getByRole("button", { name: "Historial de PX" }));
    modal = screen.getByRole("dialog", { name: "Historial de PX de Beremo" });
    expect(within(modal).getByText("+3 PX")).toBeInTheDocument();
    expect(within(modal).getByText("Recompensa de Beremo")).toBeInTheDocument();
    expect(within(modal).queryByText("Recompensa de Alda")).not.toBeInTheDocument();
  });

  it("shows private GM notes as Markdown entries instead of an always-visible form", async () => {
    const campaign = buildCampaign();
    campaign.dmNoteEntries = [{
      id: "dm-note-1",
      title: "Plan secreto",
      content: "## Emboscada\n\n- Tres guardias\n- Una salida oculta",
      authorId: gm.id,
      authorEmail: gm.email,
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T10:00:00.000Z"
    }];
    window.history.replaceState(null, "", "#campaigns?id=campaign-a&section=dmNotes");
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    await screen.findByRole("heading", { name: "Notas privadas del DJ" });
    expect(screen.queryByPlaceholderText("Notas privadas para el director de juego")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Plan secreto/ }));
    expect(await screen.findByRole("heading", { name: "Emboscada" })).toBeInTheDocument();
    expect(screen.getByText("Tres guardias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("creates private GM note entries through the modal editor", async () => {
    const campaign = buildCampaign();
    window.history.replaceState(null, "", "#campaigns?id=campaign-a&section=dmNotes");
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    serviceMocks.updateCampaign.mockImplementation(async (_campaignId, input) => ({
      ...campaign,
      dmNoteEntries: input.dmNoteEntries ?? []
    }));

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Notas privadas del DJ" });
    fireEvent.click(screen.getByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Titulo"), { target: { value: "Villano oculto" } });
    fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "**No revelar** a los jugadores." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(serviceMocks.updateCampaign).toHaveBeenCalledWith(
      "campaign-a",
      expect.objectContaining({
        dmNoteEntries: [expect.objectContaining({
          title: "Villano oculto",
          content: "**No revelar** a los jugadores."
        })]
      }),
      "token-a"
    ));
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
