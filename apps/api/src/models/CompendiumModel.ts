import type { CompendiumLibraryState } from "@umbra/shared";
import { prisma } from "../config/prisma.js";

const RECENT_ENTRY_LIMIT = 8;

export class CompendiumModel {
  async getLibrary(userId: string): Promise<CompendiumLibraryState> {
    const [favorites, recent] = await prisma.$transaction([
      prisma.compendiumUserEntry.findMany({
        where: { userId, isFavorite: true },
        select: { entryId: true },
        orderBy: { entryId: "asc" }
      }),
      prisma.compendiumUserEntry.findMany({
        where: { userId, lastViewedAt: { not: null } },
        select: { entryId: true },
        orderBy: { lastViewedAt: "desc" },
        take: RECENT_ENTRY_LIMIT
      })
    ]);

    return {
      favoriteEntryIds: favorites.map((entry) => entry.entryId),
      recentEntryIds: recent.map((entry) => entry.entryId)
    };
  }

  async setFavorite(userId: string, entryId: string, favorite: boolean): Promise<void> {
    await prisma.compendiumUserEntry.upsert({
      where: { userId_entryId: { userId, entryId } },
      create: { userId, entryId, isFavorite: favorite },
      update: { isFavorite: favorite }
    });
  }

  async recordView(userId: string, entryId: string): Promise<void> {
    const lastViewedAt = new Date();
    await prisma.compendiumUserEntry.upsert({
      where: { userId_entryId: { userId, entryId } },
      create: { userId, entryId, lastViewedAt },
      update: { lastViewedAt }
    });
  }
}
