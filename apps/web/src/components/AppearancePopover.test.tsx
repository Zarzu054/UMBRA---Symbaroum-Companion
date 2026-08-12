import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppearancePopover } from "./AppearancePopover";

describe("AppearancePopover", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.palette;
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePreference;
    delete document.documentElement.dataset.characterSheetBackground;
    document.documentElement.style.removeProperty("--character-sheet-background-image");
    document.documentElement.style.removeProperty("--character-sheet-background-position");
  });

  it("changes both preferences live and restores focus when closed with Escape", async () => {
    render(<AppearancePopover />);
    const trigger = screen.getByRole("button", { name: "Personalización" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Personalización" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Corrupción/ }));
    fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
    fireEvent.click(screen.getByRole("button", { name: "Ruinas del bosque" }));
    expect(document.documentElement).toHaveAttribute("data-palette", "corruption");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-character-sheet-background", "forest-ruins");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Personalización" })).not.toBeInTheDocument();
  });
});
