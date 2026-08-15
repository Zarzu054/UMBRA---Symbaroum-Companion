import "@testing-library/jest-dom/vitest";
import type { AuthUser } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialogProvider } from "../components/ConfirmationDialogProvider";
import { MONSTER_CATALOG_SPLIT_STORAGE_KEY, MonsterDashboardView } from "./MonsterDashboardView";

const monsterServiceMocks = vi.hoisted(() => ({
  createMonster: vi.fn(),
  deleteMonster: vi.fn(),
  fetchCustomMonsters: vi.fn().mockResolvedValue([]),
  fetchMonsterCodex: vi.fn().mockResolvedValue([]),
  updateMonster: vi.fn()
}));

vi.mock("../services/monsterService", () => monsterServiceMocks);

const gm: AuthUser = {
  id: "gm-a",
  email: "gm@example.com",
  role: "gm",
  status: "active",
  mustChangePassword: false
};

function dispatchPointer(target: EventTarget, type: "pointerdown" | "pointermove" | "pointerup", clientX: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: clientX });
  fireEvent(target, event);
}

describe("MonsterDashboardView adjustable layout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "(max-width: 1023px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
  });

  afterEach(cleanup);

  it("resizes by dragging, clamps the split and persists keyboard adjustments", async () => {
    render(
      <ConfirmationDialogProvider>
        <MonsterDashboardView user={gm} ensureAccessToken={vi.fn().mockResolvedValue("token-a")} />
      </ConfirmationDialogProvider>
    );

    const splitter = screen.getByRole("separator", { name: "Ajustar ancho del catálogo y la ficha" });
    const workspace = splitter.closest(".monster-catalog-workspace") as HTMLElement;
    vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 700,
      left: 100,
      right: 1100,
      width: 1000,
      height: 700,
      x: 100,
      y: 0,
      toJSON: () => ({})
    } as DOMRect);

    expect(splitter).toHaveAttribute("aria-valuenow", "50");
    dispatchPointer(splitter, "pointerdown", 600);
    await waitFor(() => expect(document.body).toHaveClass("is-resizing-monster-catalog"));
    dispatchPointer(window, "pointermove", 1000);
    expect(splitter).toHaveAttribute("aria-valuenow", "75");
    expect(workspace).toHaveStyle({ gridTemplateColumns: "75fr 10px 25fr" });
    dispatchPointer(window, "pointerup", 1000);
    await waitFor(() => expect(document.body).not.toHaveClass("is-resizing-monster-catalog"));
    expect(window.localStorage.getItem(MONSTER_CATALOG_SPLIT_STORAGE_KEY)).toBe("75");

    fireEvent.keyDown(splitter, { key: "Home" });
    expect(splitter).toHaveAttribute("aria-valuenow", "25");
    expect(workspace).toHaveStyle({ gridTemplateColumns: "25fr 10px 75fr" });
    expect(window.localStorage.getItem(MONSTER_CATALOG_SPLIT_STORAGE_KEY)).toBe("25");
  });
});
