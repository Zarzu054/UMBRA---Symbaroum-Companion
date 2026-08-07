import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeSelector } from "../components/ThemeSelector";
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  resolveTheme
} from "./themePreference";

describe("theme preference", () => {
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
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePreference;
  });

  it("uses the system theme by default and ignores obsolete values", () => {
    expect(readThemePreference()).toBe("system");
    expect(resolveTheme("system")).toBe("dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readThemePreference()).toBe("system");
  });

  it("applies and persists a manually selected theme", () => {
    applyThemePreference("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    render(<ThemeSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Claro" }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: "Claro" })).toHaveAttribute("aria-pressed", "true");
  });
});
