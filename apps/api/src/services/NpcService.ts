import {
  createDefaultMonsterSheet,
  createNpcSchema,
  createNpcSheetSeed,
  updateNpcSchema,
  type CreateNpcInput,
  type Npc,
  type UpdateNpcInput,
  type UserRole
} from "@umbra/shared";
import { NpcModel } from "../models/NpcModel.js";
import { AppError } from "../utils/AppError.js";

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") {
    throw new AppError("FORBIDDEN", "Solo el Director de Juego puede gestionar PNJ", 403);
  }
}

function normalizeLabels(labels: string[] | undefined): string[] | undefined {
  if (!labels) {
    return undefined;
  }
  return labels.map((entry) => entry.trim()).filter(Boolean).slice(0, 20);
}

function applyDepthDefaults(input: CreateNpcInput | UpdateNpcInput, current?: Npc | null): CreateNpcInput | UpdateNpcInput {
  const depth = input.depth ?? current?.depth ?? "notes";
  const seed = {
    name: input.name ?? current?.name ?? "",
    race: input.race ?? current?.race ?? "",
    archetype: input.archetype ?? current?.archetype ?? "",
    occupation: input.occupation ?? current?.occupation ?? "",
    summary: input.summary ?? current?.summary ?? "",
    notes: input.notes ?? current?.notes ?? ""
  };

  return {
    ...input,
    depth,
    labels: normalizeLabels(input.labels),
    statBlock:
      depth === "notes"
        ? null
        : input.statBlock === undefined
          ? current?.statBlock ?? createDefaultMonsterSheet()
          : input.statBlock,
    sheet:
      depth === "full_sheet"
        ? input.sheet === undefined
          ? current?.sheet ?? createNpcSheetSeed(seed)
          : input.sheet
        : null
  };
}

export class NpcService {
  constructor(private readonly model: NpcModel) {}

  async listNpcs(ownerId: string, role: UserRole): Promise<Npc[]> {
    requireDirectorRole(role);
    return this.model.listByOwner(ownerId);
  }

  async createNpc(ownerId: string, role: UserRole, input: CreateNpcInput): Promise<Npc> {
    requireDirectorRole(role);
    const payload = createNpcSchema.parse(
      applyDepthDefaults({
        ...input,
        name: input.name.trim(),
        race: input.race.trim(),
        archetype: input.archetype.trim(),
        occupation: input.occupation.trim(),
        faction: input.faction.trim(),
        summary: input.summary.trim(),
        notes: input.notes.trim()
      })
    );
    return this.model.create(ownerId, payload);
  }

  async updateNpc(ownerId: string, role: UserRole, npcId: string, input: UpdateNpcInput): Promise<Npc> {
    requireDirectorRole(role);
    const current = await this.model.findById(ownerId, npcId);
    if (!current) {
      throw new AppError("NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }

    const payload = updateNpcSchema.parse(
      applyDepthDefaults(
        {
          ...input,
          name: input.name?.trim(),
          race: input.race?.trim(),
          archetype: input.archetype?.trim(),
          occupation: input.occupation?.trim(),
          faction: input.faction?.trim(),
          summary: input.summary?.trim(),
          notes: input.notes?.trim()
        },
        current
      )
    );
    const updated = await this.model.update(ownerId, npcId, payload);
    if (!updated) {
      throw new AppError("NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }
    return updated;
  }

  async deleteNpc(ownerId: string, role: UserRole, npcId: string): Promise<void> {
    requireDirectorRole(role);
    const deleted = await this.model.delete(ownerId, npcId);
    if (!deleted) {
      throw new AppError("NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }
  }
}
