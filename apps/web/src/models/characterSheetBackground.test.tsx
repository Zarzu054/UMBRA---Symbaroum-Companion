import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CharacterSheetBackgroundPicker } from "../components/CharacterSheetBackgroundPicker";
import {
  CHARACTER_SHEET_BACKGROUNDS,
  CHARACTER_SHEET_BACKGROUND_STORAGE_KEY,
  CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX,
  DEFAULT_CHARACTER_SHEET_BACKGROUND,
  initializeCharacterSheetBackground,
  readCharacterSheetBackground
} from "./characterSheetBackground";

describe("character sheet background preference", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.characterSheetBackground;
    document.documentElement.style.removeProperty("--character-sheet-background-image");
    document.documentElement.style.removeProperty("--character-sheet-background-position");
  });

  it("falls back safely and exposes ten book illustrations", () => {
    expect(CHARACTER_SHEET_BACKGROUNDS).toHaveLength(10);
    expect(readCharacterSheetBackground()).toBe(DEFAULT_CHARACTER_SHEET_BACKGROUND);
    window.localStorage.setItem(`${CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX}user-a`, "obsolete");
    expect(readCharacterSheetBackground("user-a")).toBe(DEFAULT_CHARACTER_SHEET_BACKGROUND);
  });

  it("applies immediately, persists globally and restores focus on Escape", async () => {
    render(<CharacterSheetBackgroundPicker preferenceScope="user-a" />);
    const trigger = screen.getByRole("button", { name: "Fondo" });

    expect(document.documentElement).toHaveAttribute("data-character-sheet-background", DEFAULT_CHARACTER_SHEET_BACKGROUND);
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Elige una ilustración" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement).toHaveClass("character-sheet-background-backdrop");
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getAllByRole("button", { name: /p\.\d+/ })).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: /Ruinas del bosque/ }));
    expect(document.documentElement).toHaveAttribute("data-character-sheet-background", "forest-ruins");
    expect(window.localStorage.getItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY)).toBe("forest-ruins");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Elige una ilustración" })).not.toBeInTheDocument();

    expect(readCharacterSheetBackground("user-b")).toBe("forest-ruins");
    expect(readCharacterSheetBackground("user-a")).toBe("forest-ruins");
  });

  it("can return to the unillustrated atmosphere background", () => {
    render(<CharacterSheetBackgroundPicker preferenceScope="user-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Fondo" }));
    fireEvent.click(screen.getByRole("button", { name: /Sin ilustración/ }));

    expect(document.documentElement).not.toHaveAttribute("data-character-sheet-background");
    expect(window.localStorage.getItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY)).toBe("none");
  });

  it("migrates a valid scoped preference to the shared setting", () => {
    window.localStorage.setItem(`${CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX}user-a`, "winter-warrior");
    initializeCharacterSheetBackground();

    expect(readCharacterSheetBackground()).toBe("winter-warrior");
    expect(window.localStorage.getItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY)).toBe("winter-warrior");
    expect(document.documentElement).toHaveAttribute("data-character-sheet-background", "winter-warrior");
  });
});
