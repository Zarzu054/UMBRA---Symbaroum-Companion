import type { Prisma } from "@prisma/client";
import {
  createDefaultMonsterSheet,
  createNpcSheetSeed,
  monsterSheetSchema,
  parseCharacterSheet,
  type CreateNpcInput,
  type Npc,
  type UpdateNpcInput
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";

const npcClient = prisma as typeof prisma & {
  npc: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<{ count: number }>;
  };
};

function normalizeLabels(raw: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => String(entry ?? "").trim()).filter(Boolean).slice(0, 20);
}

function normalizeStatBlock(raw: Prisma.JsonValue | null | undefined) {
  if (!raw) {
    return null;
  }
  try {
    return monsterSheetSchema.parse(raw);
  } catch {
    return createDefaultMonsterSheet();
  }
}

function normalizeSheet(raw: Prisma.JsonValue | null | undefined, fallback: { name: string; race: string; archetype: string; occupation: string; summary: string; notes: string; }) {
  if (!raw) {
    return null;
  }
  try {
    return parseCharacterSheet(raw);
  } catch {
    return createNpcSheetSeed(fallback);
  }
}

function mapRow(row: {
  id: string;
  name: string;
  depth: string;
  race: string;
  archetype: string;
  occupation: string;
  faction: string;
  labels: Prisma.JsonValue;
  summary: string;
  notes: string;
  statBlock: Prisma.JsonValue | null;
  sheet: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): Npc {
  const seed = {
    name: row.name,
    race: row.race,
    archetype: row.archetype,
    occupation: row.occupation,
    summary: row.summary,
    notes: row.notes
  };

  return {
    id: row.id,
    name: row.name,
    depth: row.depth as Npc["depth"],
    race: row.race,
    archetype: row.archetype,
    occupation: row.occupation,
    faction: row.faction,
    labels: normalizeLabels(row.labels),
    summary: row.summary,
    notes: row.notes,
    statBlock: normalizeStatBlock(row.statBlock),
    sheet: normalizeSheet(row.sheet, seed),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class NpcModel {
  async listByOwner(ownerId: string): Promise<Npc[]> {
    const rows = await npcClient.npc.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" }
    });

    return rows.map(mapRow);
  }

  async create(ownerId: string, payload: CreateNpcInput): Promise<Npc> {
    const row = await npcClient.npc.create({
      data: {
        ownerId,
        name: payload.name,
        depth: payload.depth,
        race: payload.race,
        archetype: payload.archetype,
        occupation: payload.occupation,
        faction: payload.faction,
        labels: payload.labels,
        summary: payload.summary,
        notes: payload.notes,
        statBlock: payload.statBlock,
        sheet: payload.sheet
      }
    });

    return mapRow(row);
  }

  async findById(ownerId: string, npcId: string): Promise<Npc | null> {
    const row = await npcClient.npc.findFirst({
      where: { id: npcId, ownerId }
    });

    return row ? mapRow(row) : null;
  }

  async update(ownerId: string, npcId: string, payload: UpdateNpcInput): Promise<Npc | null> {
    const current = await npcClient.npc.findFirst({
      where: { id: npcId, ownerId }
    });

    if (!current) {
      return null;
    }

    const row = await npcClient.npc.update({
      where: { id: npcId },
      data: {
        name: payload.name ?? current.name,
        depth: payload.depth ?? current.depth,
        race: payload.race ?? current.race,
        archetype: payload.archetype ?? current.archetype,
        occupation: payload.occupation ?? current.occupation,
        faction: payload.faction ?? current.faction,
        labels: payload.labels ?? current.labels,
        summary: payload.summary ?? current.summary,
        notes: payload.notes ?? current.notes,
        statBlock: payload.statBlock === undefined ? current.statBlock : payload.statBlock,
        sheet: payload.sheet === undefined ? current.sheet : payload.sheet
      }
    });

    return mapRow(row);
  }

  async delete(ownerId: string, npcId: string): Promise<boolean> {
    const deleted = await npcClient.npc.deleteMany({
      where: { id: npcId, ownerId }
    });
    return deleted.count > 0;
  }
}
