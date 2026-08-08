import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    compendiumUserEntry: {
      findMany: vi.fn(),
      upsert: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("../config/prisma.js", () => ({ prisma: prismaMock }));

import { CompendiumModel } from "./CompendiumModel.js";

describe("CompendiumModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    prismaMock.compendiumUserEntry.upsert.mockResolvedValue({});
  });

  it("lists only the current user's favorites and eight most recent entries", async () => {
    prismaMock.compendiumUserEntry.findMany
      .mockResolvedValueOnce([{ entryId: "habilidad-acrobata" }, { entryId: "ritual-familiar" }])
      .mockResolvedValueOnce([{ entryId: "regla-combate" }, { entryId: "poder-aura" }]);

    const result = await new CompendiumModel().getLibrary("user-a");

    expect(result).toEqual({
      favoriteEntryIds: ["habilidad-acrobata", "ritual-familiar"],
      recentEntryIds: ["regla-combate", "poder-aura"]
    });
    expect(prismaMock.compendiumUserEntry.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { userId: "user-a", isFavorite: true }
    }));
    expect(prismaMock.compendiumUserEntry.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { userId: "user-a", lastViewedAt: { not: null } },
      orderBy: { lastViewedAt: "desc" },
      take: 8
    }));
  });

  it("updates a favorite without deleting its recent-history row", async () => {
    await new CompendiumModel().setFavorite("user-a", "ritual-familiar", false);

    expect(prismaMock.compendiumUserEntry.upsert).toHaveBeenCalledWith({
      where: { userId_entryId: { userId: "user-a", entryId: "ritual-familiar" } },
      create: { userId: "user-a", entryId: "ritual-familiar", isFavorite: false },
      update: { isFavorite: false }
    });
  });

  it("records a view with an owner-scoped upsert", async () => {
    await new CompendiumModel().recordView("user-b", "regla-combate");

    expect(prismaMock.compendiumUserEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_entryId: { userId: "user-b", entryId: "regla-combate" } },
      create: expect.objectContaining({ userId: "user-b", entryId: "regla-combate", lastViewedAt: expect.any(Date) }),
      update: { lastViewedAt: expect.any(Date) }
    }));
  });
});
