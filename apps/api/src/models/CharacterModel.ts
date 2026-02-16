import type { Character, CreateCharacterInput } from "@umbra/shared";
import { db } from "../config/db.js";

type CharacterRow = {
  id: string;
  name: string;
  archetype: string;
  race: string;
  level: number;
  created_at: Date;
};

function mapRow(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    race: row.race,
    level: row.level,
    createdAt: row.created_at.toISOString()
  };
}

export class CharacterModel {
  async listByOwner(ownerId: string): Promise<Character[]> {
    const result = await db.query<CharacterRow>(
      `SELECT id, name, archetype, race, level, created_at
       FROM characters
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId]
    );

    return result.rows.map(mapRow);
  }

  async create(ownerId: string, payload: CreateCharacterInput): Promise<Character> {
    const result = await db.query<CharacterRow>(
      `INSERT INTO characters (owner_id, name, archetype, race, level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, archetype, race, level, created_at`,
      [ownerId, payload.name, payload.archetype, payload.race, payload.level]
    );

    return mapRow(result.rows[0]);
  }
}