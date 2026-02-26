import type { Prisma } from "@prisma/client";
import { createEmptyCharacterSheet, parseCharacterSheet, type Character, type CharacterSheet, type CreateCharacterInput, type UpdateCharacterInput } from "@umbra/shared";
import { prisma } from "../config/prisma.js";

function mapRow(row: {
  id: string;
  name: string;
  archetype: string;
  race: string;
  culture: string;
  profession: string;
  level: number;
  sheet: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): Character {
  const safeSheet = normalizeSheet(row.sheet, {
    name: row.name,
    race: row.race,
    archetype: row.archetype,
    culture: row.culture,
    profession: row.profession,
    level: row.level
  });

  return {
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    race: row.race,
    culture: row.culture,
    profession: row.profession,
    level: row.level,
    sheet: safeSheet,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class CharacterModel {
  async listByOwner(ownerId: string): Promise<Character[]> {
    const rows = await prisma.character.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" }
    });

    return rows.map(mapRow);
  }

  async create(ownerId: string, payload: CreateCharacterInput): Promise<Character> {
    const row = await prisma.character.create({
      data: {
        ownerId,
        name: payload.name,
        archetype: payload.archetype,
        race: payload.race,
        culture: payload.culture,
        profession: payload.profession,
        level: payload.level,
        sheet: payload.sheet
      }
    });

    return mapRow(row);
  }

  async findById(ownerId: string, characterId: string): Promise<Character | null> {
    const row = await prisma.character.findFirst({
      where: { id: characterId, ownerId }
    });

    return row ? mapRow(row) : null;
  }

  async update(ownerId: string, characterId: string, payload: UpdateCharacterInput): Promise<Character | null> {
    const current = await prisma.character.findFirst({
      where: { id: characterId, ownerId }
    });

    if (!current) return null;

    const mergedSheet = payload.sheet ?? normalizeSheet(current.sheet, {
      name: current.name,
      race: current.race,
      archetype: current.archetype,
      culture: current.culture,
      profession: current.profession,
      level: current.level
    });

    const row = await prisma.character.update({
      where: { id: characterId },
      data: {
        name: payload.name ?? current.name,
        archetype: payload.archetype ?? current.archetype,
        race: payload.race ?? current.race,
        culture: payload.culture ?? current.culture,
        profession: payload.profession ?? current.profession,
        level: payload.level ?? current.level,
        sheet: mergedSheet
      }
    });

    return mapRow(row);
  }

  async delete(ownerId: string, characterId: string): Promise<boolean> {
    const deleted = await prisma.character.deleteMany({
      where: { id: characterId, ownerId }
    });
    return deleted.count > 0;
  }
}

function normalizeSheet(
  raw: Prisma.JsonValue | null | undefined,
  context: { name: string; race: string; archetype: string; culture: string; profession: string; level: number }
): CharacterSheet {
  const migratedRaw = migrateLegacySheet(raw);
  try {
    return parseCharacterSheet(migratedRaw ?? createEmptyCharacterSheet());
  } catch {
    const base = createEmptyCharacterSheet();
    base.identidad.raza = context.race;
    base.identidad.arquetipo = context.archetype;
    base.identidad.cultura = context.culture || base.identidad.cultura;
    base.identidad.profesion = context.profession || "";
    base.progreso.nivel = context.level;
    return base;
  }
}

function migrateLegacySheet(raw: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const candidate = structuredClone(raw) as Prisma.JsonObject;
  const attrs = candidate.atributos;
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return candidate;

  const old = attrs as Prisma.JsonObject;

  if ("agil" in old || "atento" in old || "diestro" in old || "inteligente" in old || "tenaz" in old) {
    return candidate;
  }

  const mapValue = (primary: string, fallback: number): number => {
    const value = old[primary];
    return typeof value === "number" ? value : fallback;
  };

  candidate.atributos = {
    agil: mapValue("rapido", 10),
    atento: mapValue("vigilante", 10),
    discreto: mapValue("discreto", 10),
    diestro: mapValue("preciso", 10),
    fuerte: mapValue("fuerte", 10),
    inteligente: mapValue("astuto", 10),
    persuasivo: mapValue("persuasivo", 10),
    tenaz: mapValue("resolutivo", 10)
  } as Prisma.JsonObject;

  return candidate;
}
