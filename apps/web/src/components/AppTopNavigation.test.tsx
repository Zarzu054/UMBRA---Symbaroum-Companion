import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTopNavigation } from "./AppTopNavigation";

describe("AppTopNavigation", () => {
  beforeEach(() => {
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

  afterEach(cleanup);

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
    expect(screen.getByRole("dialog", { name: "Navegación y preferencias" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tema de la interfaz" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
