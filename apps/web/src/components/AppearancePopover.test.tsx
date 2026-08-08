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
  });

  it("changes both preferences live and restores focus when closed with Escape", async () => {
    render(<AppearancePopover />);
    const trigger = screen.getByRole("button", { name: "Apariencia" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Apariencia" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Corrupción/ }));
    fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
    expect(document.documentElement).toHaveAttribute("data-palette", "corruption");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Apariencia" })).not.toBeInTheDocument();
  });
});
