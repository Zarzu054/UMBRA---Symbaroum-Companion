import { describe, expect, it, vi } from "vitest";
import { CompendiumService } from "./CompendiumService.js";

function createModel() {
  return {
    getLibrary: vi.fn().mockResolvedValue({ favoriteEntryIds: [], recentEntryIds: [] }),
    setFavorite: vi.fn().mockResolvedValue(undefined),
    recordView: vi.fn().mockResolvedValue(undefined)
  };
}

describe("CompendiumService", () => {
  it("validates, trims and scopes favorite mutations", async () => {
    const model = createModel();
    await new CompendiumService(model as never).setFavorite("user-a", "  habilidad-acrobata  ", { favorite: true });
    expect(model.setFavorite).toHaveBeenCalledWith("user-a", "habilidad-acrobata", true);
  });

  it("rejects empty and oversized entry identifiers", async () => {
    const model = createModel();
    const service = new CompendiumService(model as never);
    await expect(service.recordView("user-a", "   ")).rejects.toBeDefined();
    await expect(service.setFavorite("user-a", "x".repeat(201), { favorite: true })).rejects.toBeDefined();
    expect(model.recordView).not.toHaveBeenCalled();
    expect(model.setFavorite).not.toHaveBeenCalled();
  });

  it("returns only the library supplied for the authenticated user", async () => {
    const model = createModel();
    model.getLibrary.mockResolvedValue({ favoriteEntryIds: ["one"], recentEntryIds: ["two"] });
    await expect(new CompendiumService(model as never).getLibrary("user-c")).resolves.toEqual({
      favoriteEntryIds: ["one"],
      recentEntryIds: ["two"]
    });
    expect(model.getLibrary).toHaveBeenCalledWith("user-c");
  });
});
