import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type AuthUser, type Campaign, type CampaignCharacterLinkRequest, type CampaignCombat, type MysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  acceptCampaignInvitation: vi.fn(),
  acceptCampaignCharacterLinkRequest: vi.fn(),
  dismissCampaignCharacterLinkRequest: vi.fn(),
  dismissCampaignInvitation: vi.fn(),
  fetchCampaigns: vi.fn(),
  fetchCampaignCharacterLinkRequests: vi.fn(),
  fetchCampaignInvitations: vi.fn(),
  grantCampaignExperience: vi.fn(),
  sendCampaignInvitation: vi.fn(),
  createCampaign: vi.fn(),
  createCampaignReference: vi.fn(),
  deleteCampaignReference: vi.fn(),
  decideProfessionRequest: vi.fn(),
  requestCampaignCharacterLink: vi.fn(),
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

const originalMatchMedia = window.matchMedia;

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 900px)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

const gm: AuthUser = {
  id: "gm-a",
  email: "gm@example.com",
  role: "gm",
  status: "active",
  mustChangePassword: false
};

const player: AuthUser = {
  id: "player-a",
  email: "player@example.com",
  role: "player",
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
    serviceMocks.fetchCampaignCharacterLinkRequests.mockResolvedValue([]);
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
    expect(await screen.findByText("15 PX disponibles")).toBeInTheDocument();
  });

  it("places linking in a modal, highlights burdens and groups secondary character actions", async () => {
    const campaign = buildCampaign();
    campaign.characters[0].unreadChangeCount = 2;
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    const heading = await screen.findByRole("heading", { name: "Personajes vinculados" });
    const summaryButton = screen.getByRole("button", { name: "Ver resumen de cargas: 0 cargas registradas" });
    expect(summaryButton).toHaveClass("campaign-burden-summary-button");
    expect(summaryButton.closest(".campaign-characters-heading")).toContainElement(heading);
    const linkButton = screen.getByRole("button", { name: "Solicitar personaje" });
    expect(linkButton.closest(".campaign-character-heading-actions")).toContainElement(summaryButton);
    expect(document.querySelector(".campaign-character-link-toolbar")).not.toBeInTheDocument();
    fireEvent.click(linkButton);
    const linkDialog = screen.getByRole("dialog", { name: "Solicitar vinculación" });
    expect(within(linkDialog).getByLabelText("Personaje disponible")).toBeDisabled();
    expect(within(linkDialog).getByText("Todos los personajes disponibles ya están vinculados o tienen una solicitud pendiente.")).toBeInTheDocument();
    fireEvent.click(within(linkDialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Solicitar vinculación" })).not.toBeInTheDocument();

    const characterCard = screen.getByRole("article", { name: "Personaje Alda" });
    expect(characterCard).toHaveClass("character-record-card");
    expect(within(characterCard).getByRole("button", { name: "Abrir hoja" })).toBeInTheDocument();
    expect(within(characterCard).getByRole("button", { name: "Conceder PX" })).toBeInTheDocument();
    expect(within(characterCard).getByRole("button", { name: "Constructor" })).toBeInTheDocument();
    const moreActions = characterCard.querySelector("summary");
    expect(moreActions).toHaveTextContent("Más acciones");
    const menuAlert = within(moreActions!).getByLabelText("2 cambios sin leer");
    expect(menuAlert).toHaveTextContent("2");
    fireEvent.click(moreActions!);
    expect(moreActions?.closest("details")).toHaveAttribute("open");
    expect(within(characterCard).getByRole("button", { name: "Solicitudes de profesión de Alda: 0 pendientes" })).toBeInTheDocument();
    const historyButton = within(characterCard).getByRole("button", { name: "Historial de cambios de Alda" });
    expect(within(historyButton).getByLabelText("2 cambios sin leer")).toHaveTextContent(menuAlert.textContent ?? "");
    expect(within(characterCard).getByRole("button", { name: "Historial de PX" })).toBeInTheDocument();
    expect(within(characterCard).getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
  });

  it("requests consent from an available character owner from the header modal", async () => {
    const campaign = buildCampaign();
    campaign.availableCharacters = [{
      characterId: "00000000-0000-4000-8000-000000000009",
      name: "Karev",
      ownerId: "player-k",
      ownerEmail: "karev@example.com",
      experienceTotal: 20,
      experienceSpent: 5,
      linked: false
    }];
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    serviceMocks.requestCampaignCharacterLink.mockResolvedValue(buildCampaign());

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar personaje" }));
    const linkDialog = screen.getByRole("dialog", { name: "Solicitar vinculación" });
    expect(within(linkDialog).getByLabelText("Personaje disponible")).toHaveValue("00000000-0000-4000-8000-000000000009");
    fireEvent.click(within(linkDialog).getByRole("button", { name: "Enviar solicitud" }));

    await waitFor(() => expect(serviceMocks.requestCampaignCharacterLink).toHaveBeenCalledWith(
      "campaign-a",
      "00000000-0000-4000-8000-000000000009",
      "token-a"
    ));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Solicitar vinculación" })).not.toBeInTheDocument());
  });

  it("lets the owner accept a character link request opened from the email", async () => {
    const request: CampaignCharacterLinkRequest = {
      id: "10000000-0000-4000-8000-000000000009",
      campaignId: "campaign-a",
      campaignName: "Davokar",
      characterId: "00000000-0000-4000-8000-000000000001",
      characterName: "Alda",
      ownerEmail: player.email,
      gmEmail: gm.email,
      requestedByEmail: gm.email,
      createdAt: new Date(0).toISOString()
    };
    const acceptedCampaign = buildCampaign();
    acceptedCampaign.members.push({
      id: "member-player",
      userId: player.id,
      email: player.email,
      role: "player",
      joinedAt: new Date(0).toISOString()
    });
    window.history.replaceState(null, "", `#campaigns?characterRequest=${request.id}`);
    serviceMocks.fetchCampaigns.mockResolvedValue([acceptedCampaign]);
    serviceMocks.fetchCampaignCharacterLinkRequests.mockResolvedValue([request]);
    serviceMocks.acceptCampaignCharacterLinkRequest.mockResolvedValue(acceptedCampaign);

    render(<CampaignDashboardView user={player} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    const requestDialog = await screen.findByRole("dialog", { name: "Alda" });
    expect(within(requestDialog).getByText("Davokar")).toBeInTheDocument();
    expect(within(requestDialog).queryByRole("button", { name: "Decidir más tarde" })).not.toBeInTheDocument();
    fireEvent.click(within(requestDialog).getByRole("button", { name: "Aceptar vinculación" }));

    await waitFor(() => expect(serviceMocks.acceptCampaignCharacterLinkRequest).toHaveBeenCalledWith(request.id, "token-a"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Alda" })).not.toBeInTheDocument());
  });

  it("exposes the DM-only combat section and loads its current state", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    const combatHeading = await screen.findByRole("heading", { name: "Combate" });
    expect(combatHeading.closest(".campaign-main")).toHaveClass("is-combat-active");
    expect(serviceMocks.fetchCampaignCombat).toHaveBeenCalledWith("campaign-a", "token-a");
  });

  it("shows initiative as read-only information next to defense", async () => {
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
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    const moveHandle = await screen.findByRole("button", { name: "Mover Alda" });
    const combatStats = moveHandle.closest(".campaign-combat-card")?.querySelector(".campaign-combat-stats");
    const initiative = combatStats?.children[1] as HTMLElement;
    expect(initiative).toHaveClass("campaign-combat-stat-initiative");
    expect(within(initiative).getByText("Iniciativa")).toBeInTheDocument();
    expect(within(initiative).getByText("10")).toBeInTheDocument();
    expect(within(initiative).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(combatStats?.children[2]).toHaveTextContent("Defensa");
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
    expect(serviceMocks.updateCampaignCombatParticipant).not.toHaveBeenCalled();
  });

  it("marks the insertion point while the DM reorders combat participants", async () => {
    const firstParticipant: CampaignCombat["participants"][number] = {
      id: "00000000-0000-4000-8000-000000000031",
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
      temporaryCorruption: 0,
      permanentCorruption: 0,
      corruptionThreshold: 5,
      conditions: [],
      attacks: []
    };
    const secondParticipant: CampaignCombat["participants"][number] = {
      ...firstParticipant,
      id: "00000000-0000-4000-8000-000000000032",
      sourceId: "link-b",
      alias: "Beremo",
      sortOrder: 1,
      initiative: 8
    };
    const combat: CampaignCombat = {
      id: "00000000-0000-4000-8000-000000000030",
      campaignId: "campaign-a",
      round: 1,
      activeParticipantId: firstParticipant.id,
      revision: 3,
      participants: [firstParticipant, secondParticipant],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
    serviceMocks.fetchCampaignCombat.mockResolvedValue(combat);
    serviceMocks.reorderCampaignCombat.mockResolvedValue({
      ...combat,
      revision: 4,
      participants: [secondParticipant, firstParticipant]
    });

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByRole("heading", { name: "Personajes vinculados" });
    fireEvent.click(screen.getByRole("button", { name: "Combate" }));
    const firstCard = (await screen.findByRole("button", { name: "Mover Alda" })).closest(".campaign-combat-card") as HTMLElement;
    const secondCard = screen.getByRole("button", { name: "Mover Beremo" }).closest(".campaign-combat-card") as HTMLElement;
    vi.spyOn(secondCard, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 500,
      width: 500,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => ({})
    } as DOMRect);
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    let pendingFrame: FrameRequestCallback | null = null;
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pendingFrame = callback;
      return 17;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    const dispatchWindowDragOver = (clientY: number) => {
      const event = new Event("dragover", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clientY", { value: clientY });
      window.dispatchEvent(event);
    };

    fireEvent.dragStart(firstCard, { dataTransfer });
    expect(firstCard).toHaveClass("is-dragging");
    fireEvent.dragOver(secondCard, { clientY: 190, dataTransfer });
    expect(secondCard).toHaveClass("is-drop-after");
    expect(secondCard.querySelector(".campaign-combat-drop-marker.is-after")).toBeInTheDocument();
    dispatchWindowDragOver(window.innerHeight - 1);
    expect(requestFrame).toHaveBeenCalled();
    (pendingFrame as FrameRequestCallback)(0);
    expect(scrollBy.mock.calls.at(-1)?.[1]).toBeGreaterThan(0);
    dispatchWindowDragOver(1);
    (pendingFrame as FrameRequestCallback)(1);
    expect(scrollBy.mock.calls.at(-1)?.[1]).toBeLessThan(0);
    dispatchWindowDragOver(window.innerHeight - 1);
    fireEvent.drop(secondCard, { clientY: 190, dataTransfer });

    await waitFor(() => expect(serviceMocks.reorderCampaignCombat).toHaveBeenCalledWith(
      "campaign-a",
      { revision: 3, participantIds: [secondParticipant.id, firstParticipant.id] },
      "token-a"
    ));
    expect(cancelFrame).toHaveBeenCalledWith(17);
    expect(firstCard).not.toHaveClass("is-dragging");
    expect(secondCard).not.toHaveClass("is-drop-after");
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
    scrollBy.mockRestore();
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

  it("shows and approves only the profession requests for each character", async () => {
    const campaign = buildCampaign();
    const secondCharacter = {
      ...campaign.characters[0],
      id: "link-b",
      characterId: "00000000-0000-4000-8000-000000000002",
      name: "Beremo",
      ownerId: "player-b",
      ownerEmail: "beremo@example.com"
    };
    campaign.characters.push(secondCharacter);
    const aldaRequest = {
      id: "request-a", characterId: campaign.characters[0].characterId, characterName: "Alda", ownerEmail: "player@example.com",
      professionId: "juramentado-de-hierro", professionName: "Juramentado de hierro", state: "pending", effectiveState: "pending",
      campaignId: campaign.id, campaignName: campaign.name, requestedAt: new Date(0).toISOString(), reviewedAt: null, decisionNote: "",
      eligibility: { professionId: "juramentado-de-hierro", eligible: true, requirementsMet: true, masterRequirementMet: true, otherRequirementMet: true, unmetRequirements: [], requirementResults: [{ id: "estudioso", label: "Estudioso", met: true, matchedNames: ["Estudioso"], hasMaster: true }] },
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
    } as const;
    campaign.pendingProfessionRequests = [aldaRequest, {
      ...aldaRequest,
      id: "request-b",
      characterId: secondCharacter.characterId,
      characterName: secondCharacter.name,
      ownerEmail: secondCharacter.ownerEmail,
      professionId: "cazador-de-brujas",
      professionName: "Cazador de brujas",
      eligibility: {
        ...aldaRequest.eligibility,
        professionId: "cazador-de-brujas"
      }
    }];
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);
    serviceMocks.decideProfessionRequest.mockResolvedValue([]);
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    const aldaCard = await screen.findByRole("article", { name: "Personaje Alda" });
    const beremoCard = screen.getByRole("article", { name: "Personaje Beremo" });
    expect(screen.queryByRole("button", { name: "Solicitudes profesionales (2)" })).not.toBeInTheDocument();
    expect(within(aldaCard).getByRole("button", { name: "Constructor" })).toBeInTheDocument();
    fireEvent.click(aldaCard.querySelector("summary")!);
    fireEvent.click(within(aldaCard).getByRole("button", { name: "Solicitudes de profesión de Alda: 1 pendiente" }));

    const dialog = screen.getByRole("dialog", { name: "Solicitudes de profesiones de Alda" });
    expect(within(dialog).getByText("Juramentado de hierro")).toBeInTheDocument();
    expect(within(dialog).queryByText("Cazador de brujas")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(serviceMocks.decideProfessionRequest).toHaveBeenCalledWith("campaign-a", "request-a", { decision: "approve", note: "" }, "token-a"));

    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(beremoCard.querySelector("summary")!);
    fireEvent.click(within(beremoCard).getByRole("button", { name: "Solicitudes de profesión de Beremo: 1 pendiente" }));
    const beremoDialog = screen.getByRole("dialog", { name: "Solicitudes de profesiones de Beremo" });
    expect(within(beremoDialog).getByText("Cazador de brujas")).toBeInTheDocument();
    expect(within(beremoDialog).queryByText("Juramentado de hierro")).not.toBeInTheDocument();
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

    const membersHeading = await screen.findByRole("heading", { name: "Miembros" });
    expect(screen.queryByLabelText("Email del jugador")).not.toBeInTheDocument();
    const inviteButton = screen.getByRole("button", { name: "Invitar jugador" });
    expect(inviteButton.closest(".campaign-members-heading")).toContainElement(membersHeading);
    fireEvent.click(inviteButton);
    const inviteDialog = screen.getByRole("dialog", { name: "Invitar jugador" });
    fireEvent.change(within(inviteDialog).getByLabelText("Email del jugador"), { target: { value: "player@example.com" } });
    fireEvent.click(within(inviteDialog).getByRole("button", { name: "Enviar invitación" }));

    await waitFor(() => expect(serviceMocks.sendCampaignInvitation).toHaveBeenCalledWith(
      "campaign-a",
      { email: "player@example.com" },
      "token-a"
    ));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Invitar jugador" })).not.toBeInTheDocument());
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

  it.each([
    {
      label: "otro jugador",
      viewer: {
        id: "player-b",
        email: "other-player@example.com",
        role: "player",
        status: "active",
        mustChangePassword: false
      } as AuthUser
    },
    {
      label: "un DJ que no dirige la campaña",
      viewer: {
        id: "gm-b",
        email: "other-gm@example.com",
        role: "gm",
        status: "active",
        mustChangePassword: false
      } as AuthUser
    }
  ])("hides the character change log from $label", async ({ viewer }) => {
    const campaign = buildCampaign();
    campaign.members.push({
      id: `member-${viewer.id}`,
      userId: viewer.id,
      email: viewer.email,
      role: "player",
      joinedAt: new Date(0).toISOString()
    });
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={viewer} ensureAccessToken={vi.fn().mockResolvedValue("token-viewer")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    const characterCard = screen.getByRole("article", { name: "Personaje Alda" });
    expect(within(characterCard).queryByRole("button", { name: "Historial de cambios de Alda" })).not.toBeInTheDocument();
  });

  it("keeps the character change log available to its owner", async () => {
    const owner: AuthUser = {
      id: "player-a",
      email: "player@example.com",
      role: "player",
      status: "active",
      mustChangePassword: false
    };
    const campaign = buildCampaign();
    campaign.members.push({
      id: "member-player-a",
      userId: owner.id,
      email: owner.email,
      role: "player",
      joinedAt: new Date(0).toISOString()
    });
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={owner} ensureAccessToken={vi.fn().mockResolvedValue("token-owner")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    const characterCard = screen.getByRole("article", { name: "Personaje Alda" });
    expect(within(characterCard).getByRole("button", { name: "Historial de cambios de Alda" })).toBeInTheDocument();
  });

  it("simplifies player character actions on mobile according to ownership", async () => {
    installMatchMedia(true);
    const campaign = buildCampaign();
    const otherSheet = createEmptyCharacterSheet();
    otherSheet.identidad.nombrePersonaje = "Beremo";
    campaign.members.push({
      id: "member-player-a",
      userId: player.id,
      email: player.email,
      role: "player",
      joinedAt: new Date(0).toISOString()
    });
    campaign.characters.push({
      ...campaign.characters[0],
      id: "link-b",
      characterId: "00000000-0000-4000-8000-000000000002",
      name: "Beremo",
      ownerId: "player-b",
      ownerEmail: "beremo@example.com",
      sheet: otherSheet
    });
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={player} ensureAccessToken={vi.fn().mockResolvedValue("token-player")} />);

    await screen.findByRole("heading", { name: "Personajes vinculados" });
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a campañas" })).not.toBeInTheDocument();

    const ownedCard = screen.getByRole("article", { name: "Personaje Alda" });
    expect(within(ownedCard).getByRole("button", { name: "Historial de cambios de Alda" })).toBeInTheDocument();
    const ownedMoreActions = ownedCard.querySelector("summary");
    expect(ownedMoreActions).toHaveTextContent("Más acciones");
    fireEvent.click(ownedMoreActions!);
    expect(within(ownedCard).getByRole("button", { name: "Historial de PX" })).toBeInTheDocument();
    expect(within(ownedCard).getByRole("button", { name: "Desvincular" })).toBeInTheDocument();

    const otherCard = screen.getByRole("article", { name: "Personaje Beremo" });
    expect(within(otherCard).getByRole("button", { name: "Historial de PX" })).toBeInTheDocument();
    expect(otherCard.querySelector("summary")).not.toBeInTheDocument();
    expect(within(otherCard).queryByRole("button", { name: /Historial de cambios/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByRole("heading", { name: "Campañas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recargar" })).not.toBeInTheDocument();
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

  it("mantiene el listado disponible cuando una ficha vinculada no puede cargarse", async () => {
    const campaign = buildCampaign();
    campaign.characters[0] = {
      ...campaign.characters[0],
      sheet: null,
      sheetLoadError: true
    };
    campaign.characters.push({
      ...buildCampaign().characters[0],
      id: "link-b",
      characterId: "00000000-0000-4000-8000-000000000002",
      name: "Beremo"
    });
    serviceMocks.fetchCampaigns.mockResolvedValue([campaign]);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    const invalidCard = await screen.findByRole("article", { name: "Personaje Alda" });
    expect(within(invalidCard).getByText("La ficha necesita reparación, pero la campaña sigue disponible.")).toBeInTheDocument();
    expect(within(invalidCard).queryByRole("button", { name: "Abrir hoja" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Personaje Beremo" })).toBeInTheDocument();
  });

  it("keeps shared-note search, sorting and creation in the top-right header controls", async () => {
    window.history.replaceState(null, "", "#campaigns?id=campaign-a&section=sharedNotes");
    serviceMocks.fetchCampaigns.mockResolvedValue([buildCampaign()]);

    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);

    const heading = await screen.findByRole("heading", { name: "Notas compartidas" });
    const controls = screen.getByRole("group", { name: "Controles de notas compartidas" });
    expect(controls).toHaveClass("campaign-notes-controls");
    expect(controls.closest(".campaign-notes-heading")).toContainElement(heading);
    expect(within(controls).getByPlaceholderText("Nombre de la nota")).toBeInTheDocument();
    expect(within(controls).getByRole("combobox", { name: "Ordenar" })).toBeInTheDocument();
    expect(within(controls).getByRole("button", { name: "Nueva nota" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Objetos de campaña" }));
    fireEvent.click(screen.getByRole("tab", { name: "Artefactos místicos" }));
    expect(screen.getByRole("heading", { name: "Artefactos místicos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir artefacto" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar artefacto")).not.toBeInTheDocument();
  });

  it("opens a guided artifact creator instead of a raw JSON editor", async () => {
    render(<CampaignDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />);
    await screen.findByText("Davokar");
    fireEvent.click(screen.getByRole("button", { name: "Objetos de campaña" }));
    fireEvent.click(screen.getByRole("tab", { name: "Artefactos místicos" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Objetos de campaña" }));
    fireEvent.click(screen.getByRole("tab", { name: "Artefactos místicos" }));

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
