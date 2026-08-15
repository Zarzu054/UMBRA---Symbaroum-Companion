import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTopNavigation } from "./AppTopNavigation";

describe("AppTopNavigation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.characterSheetBackground;
    document.documentElement.style.removeProperty("--character-sheet-background-image");
    document.documentElement.style.removeProperty("--character-sheet-background-position");
  });

  it("exposes the permitted modules and account preferences", async () => {
    const openCharacters = vi.fn();
    const openCampaigns = vi.fn();
    render(
      <AppTopNavigation
        currentTitle="Personajes"
        userEmail="player@umbra.local"
        roleLabel="Jugador"
        onLogout={vi.fn().mockResolvedValue(undefined)}
        items={[
          { id: "characters", label: "Personajes", active: true, onSelect: openCharacters },
          { id: "campaigns", label: "Campañas", active: false, onSelect: openCampaigns }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "Personajes" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Campañas" }));
    expect(openCampaigns).toHaveBeenCalledOnce();

    const menuButton = screen.getByRole("button", { name: "Abrir navegación" });
    fireEvent.click(menuButton);
    const navigationDialog = screen.getByRole("dialog", { name: "Navegación y preferencias" });
    expect(navigationDialog).toBeInTheDocument();
    expect(within(navigationDialog).queryByRole("group", { name: "Tema de la interfaz" })).not.toBeInTheDocument();
    fireEvent.click(within(navigationDialog).getByRole("button", { name: "Personalización" }));
    expect(within(navigationDialog).getByRole("group", { name: "Tema de la interfaz" })).toBeInTheDocument();
    const backgroundTrigger = within(navigationDialog).getByRole("button", { name: /Elegir fondo de pantalla/ });
    fireEvent.click(backgroundTrigger);
    const backgroundDialog = screen.getByRole("dialog", { name: /Elige una ilustraci/ });
    const backgroundOption = within(backgroundDialog).getByRole("button", { name: /Ruinas del bosque/ });
    fireEvent.pointerDown(backgroundOption);
    fireEvent.click(backgroundOption);
    expect(navigationDialog).toBeInTheDocument();
    expect(backgroundDialog).toBeInTheDocument();
    expect(backgroundOption).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("umbra:background")).toBe("forest-ruins");
    fireEvent.click(within(backgroundDialog).getByRole("button", { name: "Aplicar y cerrar" }));
    expect(screen.queryByRole("dialog", { name: /Elige una ilustraci/ })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("moves appearance into its own compact control on mobile", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 900px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    render(
      <AppTopNavigation
        currentTitle="Campañas"
        userEmail="player@umbra.local"
        roleLabel="Jugador"
        onLogout={vi.fn().mockResolvedValue(undefined)}
        items={[{ id: "campaigns", label: "Campañas", active: true, onSelect: vi.fn() }]}
      />
    );

    const appearanceButton = screen.getByRole("button", { name: "Abrir personalización" });
    expect(appearanceButton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(appearanceButton);
    expect(screen.getByRole("dialog", { name: "Personalización" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tema de la interfaz" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(appearanceButton).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
    const navigationDialog = screen.getByRole("dialog", { name: "Navegación y preferencias" });
    expect(navigationDialog).toBeInTheDocument();
    expect(navigationDialog.querySelector('[role="group"][aria-label="Tema de la interfaz"]')).toBeNull();
    fireEvent.click(within(navigationDialog).getByRole("button", { name: "Personalización" }));
    expect(within(navigationDialog).getByRole("group", { name: "Tema de la interfaz" })).toBeInTheDocument();
    expect(within(navigationDialog).getByRole("button", { name: /Elegir fondo de pantalla/ })).toBeInTheDocument();
  });
});
