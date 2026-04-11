import {
  createMonsterSchema,
  STARTER_MONSTER_CODEX,
  updateMonsterSchema,
  type CreateMonsterInput,
  type Monster,
  type UpdateMonsterInput,
  type UserRole
} from "@umbra/shared";
import { MonsterModel } from "../models/MonsterModel.js";
import { AppError } from "../utils/AppError.js";

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") {
    throw new AppError("FORBIDDEN", "Solo el Director de Juego puede gestionar monstruos", 403);
  }
}

export class MonsterService {
  constructor(private readonly model: MonsterModel) {}

  async listCodex(role: UserRole): Promise<Monster[]> {
    requireDirectorRole(role);
    return STARTER_MONSTER_CODEX;
  }

  async listCustomMonsters(ownerId: string, role: UserRole): Promise<Monster[]> {
    requireDirectorRole(role);
    return this.model.listByOwner(ownerId);
  }

  async createMonster(ownerId: string, role: UserRole, input: CreateMonsterInput): Promise<Monster> {
    requireDirectorRole(role);
    const payload = createMonsterSchema.parse({
      ...input,
      source: input.source?.trim() || "Mis monstruos",
      name: input.name.trim(),
      summary: input.summary.trim()
    });
    return this.model.create(ownerId, payload);
  }

  async updateMonster(ownerId: string, role: UserRole, monsterId: string, input: UpdateMonsterInput): Promise<Monster> {
    requireDirectorRole(role);
    const payload = updateMonsterSchema.parse({
      ...input,
      source: input.source?.trim() || input.source,
      name: input.name?.trim() || input.name,
      summary: input.summary?.trim() || input.summary
    });
    const updated = await this.model.update(ownerId, monsterId, payload);
    if (!updated) {
      throw new AppError("MONSTER_NOT_FOUND", "Monstruo no encontrado", 404);
    }
    return updated;
  }

  async deleteMonster(ownerId: string, role: UserRole, monsterId: string): Promise<void> {
    requireDirectorRole(role);
    const deleted = await this.model.delete(ownerId, monsterId);
    if (!deleted) {
      throw new AppError("MONSTER_NOT_FOUND", "Monstruo no encontrado", 404);
    }
  }
}
