import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";

const controller = vi.hoisted(() => ({
  characters: [],
  selectedCharacterId: null,
  isEditing: false,
  isFormModalOpen: false,
  isSaving: false,
  isLoading: false,
  error: null,
  validationErrors: [],
  openCreateModal: vi.fn(),
  closeFormModal: vi.fn(),
  createRandomCharacter: vi.fn(),
  importFromPdf: vi.fn(),
  upsertCharacterRecord: vi.fn()
}));

vi.mock("../controllers/characterController", () => ({
  getRoleLabel: () => "Jugador",
  useCharacterController: () => controller
}));

vi.mock("../hooks/useBodyScrollLock", () => ({ useBodyScrollLock: vi.fn() }));
vi.mock("../components/UnifiedCharacterSheet", () => ({ UnifiedCharacterSheet: () => <div>Hoja de personaje</div> }));
vi.mock("./CampaignDashboardView", () => ({ CampaignDashboardView: () => <div>Vista de campañas</div> }));
vi.mock("./CompendiumView", () => ({ CompendiumView: () => <div>Vista de compendio</div> }));
vi.mock("./MonsterDashboardView", () => ({ MonsterDashboardView: () => <div>Vista de monstruos</div> }));
vi.mock("./NpcDashboardView", () => ({ NpcDashboardView: () => <div>Vista de PNJ</div> }));

import { CharacterDashboardView } from "./CharacterDashboardView";

function installMobileMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 900px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

describe("CharacterDashboardView mobile navigation", () => {
  beforeEach(() => {
    installMobileMatchMedia();
    controller.characters = [];
    window.location.hash = "characters";
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
    vi.clearAllMocks();
  });

  it("opens the drawer, restores focus on Escape, and closes after navigation", async () => {
    render(
      <CharacterDashboardView
        user={{ id: "player", email: "player@umbra.local", role: "player", mustChangePassword: false } as never}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const menuButton = screen.getByRole("button", { name: "Abrir navegación" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Cerrar navegación" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    fireEvent.click(screen.getByRole("button", { name: "Campañas" }));

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(await screen.findByText("Vista de campañas")).toBeInTheDocument();
  });

  it("closes the drawer when its backdrop is pressed", () => {
    render(
      <CharacterDashboardView
        user={{ id: "player", email: "player@umbra.local", role: "player", mustChangePassword: false } as never}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const menuButton = screen.getByRole("button", { name: "Abrir navegación" });
    fireEvent.click(menuButton);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar navegación" }));

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("offers contextual navigation back to the character directory", async () => {
    controller.characters = [{
      id: "char-1",
      name: "Arold",
      culture: "Ambriano",
      archetype: "Guerrero",
      race: "Humano",
      sheet: createEmptyCharacterSheet()
    }] as never[];
    window.location.hash = "characters?sheetId=char-1&view=sheet";

    render(
      <CharacterDashboardView
        user={{ id: "player", email: "player@umbra.local", role: "player", mustChangePassword: false } as never}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Hoja de personaje")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByRole("heading", { name: "Archivo de personajes" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#characters");
  });

  it("excludes game fields from Bitwarden autofill overlays", () => {
    render(
      <CharacterDashboardView
        user={{ id: "player", email: "player@umbra.local", role: "player", mustChangePassword: false } as never}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const fields = document.querySelectorAll("main input, main select, main textarea");
    expect(fields.length).toBeGreaterThan(0);
    fields.forEach((field) => expect(field).toHaveAttribute("data-bwignore", "true"));
  });

  it("separa la cabecera de controles y el listado sin una tarjeta exterior", () => {
    render(
      <CharacterDashboardView
        user={{ id: "player", email: "player@umbra.local", role: "player", mustChangePassword: false } as never}
        ensureAccessToken={vi.fn().mockResolvedValue("token")}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const page = screen.getByRole("heading", { name: "Archivo de personajes" }).closest(".character-directory-page");
    const header = page?.querySelector(":scope > .character-directory-header-band");
    const stage = page?.querySelector(":scope > .character-directory-stage");
    expect(page).not.toBeNull();
    expect(header).not.toBeNull();
    expect(stage).not.toBeNull();
    expect(page?.querySelector(":scope > .character-directory-shell")).toBeNull();
    expect(stage?.querySelector(":scope > .character-directory-panel")).not.toBeNull();
  });
});
