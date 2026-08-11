import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterChangeLogModal } from "./CharacterChangeLogModal";

const { fetchCharacterChangeLog, markCharacterChangeLogRead } = vi.hoisted(() => ({
  fetchCharacterChangeLog: vi.fn(),
  markCharacterChangeLogRead: vi.fn()
}));
vi.mock("../services/characterService", () => ({ fetchCharacterChangeLog, markCharacterChangeLogRead }));

describe("CharacterChangeLogModal", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("groups nearby changes, highlights unread entries and marks them as read", async () => {
    fetchCharacterChangeLog.mockResolvedValue({
      nextCursor: null,
      events: [
        {
          id: "event-2", characterId: "character-a", campaignId: "campaign-a", campaignName: "Bosque",
          actorId: "gm-a", actorEmail: "dj@example.com", actorRole: "gm", source: "sheet",
          summary: "Actualizó la hoja del personaje", isUnread: true, createdAt: "2026-08-11T10:04:00.000Z",
          changes: [{ path: "sheet.corrupcion.temporal", section: "Corrupción", label: "Corrupción temporal", operation: "changed", before: 0, after: 1 }]
        },
        {
          id: "event-1", characterId: "character-a", campaignId: "campaign-a", campaignName: "Bosque",
          actorId: "gm-a", actorEmail: "dj@example.com", actorRole: "gm", source: "sheet",
          summary: "Actualizó la hoja del personaje", isUnread: true, createdAt: "2026-08-11T10:00:00.000Z",
          changes: [{ path: "name", section: "Identidad", label: "Nombre", operation: "changed", before: "Alda", after: "Alda la Roja" }]
        }
      ]
    });
    markCharacterChangeLogRead.mockResolvedValue(undefined);
    const onRead = vi.fn();

    render(<CharacterChangeLogModal characterId="character-a" characterName="Alda" ensureAccessToken={vi.fn().mockResolvedValue("token")} onClose={vi.fn()} onRead={onRead} />);

    expect(await screen.findByText("Historial de Alda")).toBeInTheDocument();
    expect(await screen.findByText("Nuevo")).toBeInTheDocument();
    expect(screen.getAllByText("dj@example.com")).toHaveLength(1);
    expect(screen.getByText("Corrupción temporal")).toBeInTheDocument();
    await waitFor(() => expect(markCharacterChangeLogRead).toHaveBeenCalledWith("character-a", "token"));
    expect(onRead).toHaveBeenCalled();
  });
});
