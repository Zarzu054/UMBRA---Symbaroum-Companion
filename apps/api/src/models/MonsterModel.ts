import type { Prisma } from "@prisma/client";
import {
  createDefaultMonsterSheet,
  monsterSheetSchema,
  type CreateMonsterInput,
  type Monster,
  type MonsterSheet,
  type UpdateMonsterInput
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";

const monsterClient = prisma as typeof prisma & {
  monster: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
    findFirst: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    deleteMany: (...args: any[]) => Promise<{ count: number }>;
  };
};

function mapRow(row: {
  id: string;
  name: string;
  category: string;
  threat: string;
  source: string;
  summary: string;
  sheet: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): Monster {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Monster["category"],
    threat: row.threat as Monster["threat"],
    source: row.source,
    summary: row.summary,
    sheet: normalizeSheet(row.sheet),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class MonsterModel {
  async listByOwner(ownerId: string): Promise<Monster[]> {
    const rows = await monsterClient.monster.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" }
    });

    return rows.map(mapRow);
  }

  async create(ownerId: string, payload: CreateMonsterInput): Promise<Monster> {
    const row = await monsterClient.monster.create({
      data: {
        ownerId,
        name: payload.name,
        category: payload.category,
        threat: payload.threat,
        source: payload.source,
        summary: payload.summary,
        sheet: payload.sheet
      }
    });

    return mapRow(row);
  }

  async findById(ownerId: string, monsterId: string): Promise<Monster | null> {
    const row = await monsterClient.monster.findFirst({
      where: { id: monsterId, ownerId }
    });

    return row ? mapRow(row) : null;
  }

  async update(ownerId: string, monsterId: string, payload: UpdateMonsterInput): Promise<Monster | null> {
    const current = await monsterClient.monster.findFirst({
      where: { id: monsterId, ownerId }
    });

    if (!current) {
      return null;
    }

    const row = await monsterClient.monster.update({
      where: { id: monsterId },
      data: {
        name: payload.name ?? current.name,
        category: payload.category ?? current.category,
        threat: payload.threat ?? current.threat,
        source: payload.source ?? current.source,
        summary: payload.summary ?? current.summary,
        sheet: payload.sheet ?? current.sheet
      }
    });

    return mapRow(row);
  }

  async delete(ownerId: string, monsterId: string): Promise<boolean> {
    const deleted = await monsterClient.monster.deleteMany({
      where: { id: monsterId, ownerId }
    });
    return deleted.count > 0;
  }
}

function normalizeSheet(raw: Prisma.JsonValue | null | undefined): MonsterSheet {
  try {
    return monsterSheetSchema.parse(raw ?? createDefaultMonsterSheet());
  } catch {
    return createDefaultMonsterSheet();
  }
}
