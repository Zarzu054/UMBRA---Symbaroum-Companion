import type { Character, CreateCharacterInput } from "@umbra/shared";
import { prisma } from "../config/prisma.js";

export class CharacterModel {
  async listByOwner(ownerId: string): Promise<Character[]> {
    const rows = await prisma.character.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      archetype: row.archetype,
      race: row.race,
      level: row.level,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async create(ownerId: string, payload: CreateCharacterInput): Promise<Character> {
    const row = await prisma.character.create({
      data: {
        ownerId,
        name: payload.name,
        archetype: payload.archetype,
        race: payload.race,
        level: payload.level
      }
    });

    return {
      id: row.id,
      name: row.name,
      archetype: row.archetype,
      race: row.race,
      level: row.level,
      createdAt: row.createdAt.toISOString()
    };
  }
}