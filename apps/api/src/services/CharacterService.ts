import {
  createCharacterSchema,
  createEmptyCharacterSheet,
  importCharacterSchema,
  parseCharacterSheet,
  stripManagedMysticArtifactsFromSheet,
  preserveLegacyMysticArtifacts,
  updateCharacterSchema,
  type Character,
  type CreateCharacterInput,
  type ImportCharacterInput,
  type UpdateCharacterInput,
  type UserRole
} from "@umbra/shared";
import { AppError } from "../utils/AppError.js";
import { CharacterModel } from "../models/CharacterModel.js";
import { protectGrantedCharacterExperience } from "./characterExperiencePolicy.js";
import { CampaignItemModel } from "../models/CampaignItemModel.js";
import { protectCampaignItemInventory } from "./campaignItemInventoryPolicy.js";
import { CharacterAuditModel, type CharacterAuditActor } from "../models/CharacterAuditModel.js";
import { translateProfessionError } from "./ProfessionService.js";

export class CharacterService {
  constructor(private readonly model: CharacterModel, private readonly auditModel = new CharacterAuditModel()) {}

  async listCharacters(ownerId: string): Promise<Character[]> {
    return this.model.listByOwner(ownerId);
  }

  async createCharacter(ownerId: string, input: CreateCharacterInput): Promise<Character> {
    const normalizedSheet = {
      ...(input.sheet ?? createEmptyCharacterSheet()),
      progreso: {
        ...(input.sheet?.progreso ?? createEmptyCharacterSheet().progreso),
        nivel: 1 as const
      }
    };

    const normalized = {
      ...input,
      name: input.name?.trim() || input.sheet?.identidad?.nombrePersonaje?.trim() || "Personaje sin nombre",
      archetype: input.archetype?.trim() || input.sheet?.identidad?.arquetipo || "Guerrero",
      race: input.race?.trim() || input.sheet?.identidad?.raza || "Humano",
      culture: input.culture?.trim() || input.sheet?.identidad?.cultura || "Ambriano",
      profession: input.profession?.trim() || input.sheet?.identidad?.profesion || "",
      level: 1 as const,
      sheet: {
        ...normalizedSheet,
        identidad: {
          ...normalizedSheet.identidad,
          nombrePersonaje: input.name?.trim() || normalizedSheet.identidad?.nombrePersonaje || "Personaje sin nombre"
        }
      }
    };

    const payload = createCharacterSchema.parse(normalized);
    return this.model.create(ownerId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });
  }

  async importCharacter(ownerId: string, input: ImportCharacterInput): Promise<Character> {
    const parsedImportedSheet = parseCharacterSheet(input.sheet ?? createEmptyCharacterSheet());
    const normalizedSheet = {
      ...parsedImportedSheet,
      progreso: {
        ...parsedImportedSheet.progreso,
        nivel: 1 as const
      }
    };

    const normalized = {
      ...input,
      name: input.name?.trim() || input.sheet?.identidad?.nombrePersonaje?.trim() || "Personaje importado",
      archetype: input.archetype?.trim() || input.sheet?.identidad?.arquetipo || "Guerrero",
      race: input.race?.trim() || input.sheet?.identidad?.raza || "Humano",
      culture: input.culture?.trim() || input.sheet?.identidad?.cultura || "Ambriano",
      profession: input.profession?.trim() || input.sheet?.identidad?.profesion || "",
      level: 1 as const,
      sheet: {
        ...normalizedSheet,
        identidad: {
          ...normalizedSheet.identidad,
          nombrePersonaje: input.name?.trim() || normalizedSheet.identidad?.nombrePersonaje || "Personaje importado"
        }
      }
    };

    const payload = importCharacterSchema.parse(normalized);
    return this.model.create(ownerId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });
  }

  async updateCharacter(ownerId: string, characterId: string, input: UpdateCharacterInput, actor?: CharacterAuditActor): Promise<Character> {
    const current = await this.model.findById(ownerId, characterId);
    if (!current) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }
    const currentSheet = parseCharacterSheet(current.sheet);
    const normalizedInput = {
      ...input,
      level: input.level === undefined ? undefined : (1 as const),
      sheet:
        input.sheet === undefined
          ? undefined
          : {
              ...input.sheet,
              progreso: {
                ...input.sheet.progreso,
                experienciaTotal: currentSheet.progreso.experienciaTotal,
                nivel: 1 as const
              },
              identidad: {
                ...input.sheet.identidad,
                nombrePersonaje: input.name?.trim() || input.sheet.identidad.nombrePersonaje || ""
              }
            }
    };

    const payload = updateCharacterSchema.parse(normalizedInput);
    let requestedSheet = preserveLegacyMysticArtifacts(
      currentSheet,
      stripManagedMysticArtifactsFromSheet(parseCharacterSheet(payload.sheet ?? currentSheet))
    );
    if (current.campaignContext) {
      const campaignItems = await new CampaignItemModel().listCampaign(current.campaignContext.campaignId, true);
      requestedSheet = protectCampaignItemInventory(currentSheet, requestedSheet, campaignItems, current.campaignContext.characterLinkId);
    } else if (payload.sheet) {
      requestedSheet = protectCampaignItemInventory(currentSheet, requestedSheet, [], characterId);
    }
    let updated: Character | null;
    try {
      updated = await this.model.update(ownerId, characterId, {
        ...payload,
        sheet: protectGrantedCharacterExperience(currentSheet, requestedSheet)
      }, actor, payload.editSource ?? "sheet");
    } catch (error) {
      translateProfessionError(error);
    }

    if (!updated) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    return updated;
  }

  async getChangeLog(userId: string, userRole: UserRole, characterId: string, cursor?: string, limit?: number) {
    if (cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor)) {
      throw new AppError("CHARACTER_CHANGE_LOG_CURSOR_INVALID", "El cursor del historial no es válido", 400);
    }
    const safeLimit = limit !== undefined && Number.isFinite(limit) ? limit : undefined;
    const page = await this.auditModel.list(userId, userRole, characterId, cursor, safeLimit);
    if (!page) throw new AppError("CHARACTER_CHANGE_LOG_FORBIDDEN", "No puedes consultar el historial de este personaje", 403);
    return page;
  }

  async markChangeLogRead(userId: string, userRole: UserRole, characterId: string): Promise<void> {
    if (!(await this.auditModel.markRead(userId, userRole, characterId))) {
      throw new AppError("CHARACTER_CHANGE_LOG_FORBIDDEN", "No puedes consultar el historial de este personaje", 403);
    }
  }

  async duplicateCharacter(ownerId: string, characterId: string): Promise<Character> {
    const source = await this.model.findById(ownerId, characterId);
    if (!source) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    const duplicatedName = source.name.trim() ? `${source.name} (Copia)` : "Personaje sin nombre (Copia)";
    const sourceSheet = parseCharacterSheet(source.sheet);
    const inventoryItems = sourceSheet.inventoryItems.filter((item) => !item.campaignItemId);
    const inventoryIds = new Set(inventoryItems.map((item) => item.id));

    return this.model.create(ownerId, {
      name: duplicatedName,
      archetype: source.archetype,
      race: source.race,
      culture: source.culture,
      profession: source.profession,
      level: 1,
      sheet: {
        ...sourceSheet,
        inventoryItems,
        equipmentSlots: Object.fromEntries(Object.entries(sourceSheet.equipmentSlots).map(([slot, itemId]) => [
          slot,
          itemId && inventoryIds.has(itemId) ? itemId : ""
        ])) as typeof sourceSheet.equipmentSlots,
        identidad: {
          ...sourceSheet.identidad,
          nombrePersonaje: duplicatedName
        }
      }
    });
  }

  async deleteCharacter(ownerId: string, characterId: string): Promise<void> {
    if (await this.model.ownsCampaignMysticArtifacts(ownerId, characterId)) {
      throw new AppError("ARTIFACT_OWNER_IN_USE", "El personaje posee artefactos de campaña; pide al DJ que los retire antes", 409);
    }
    const deleted = await this.model.delete(ownerId, characterId);
    if (!deleted) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }
  }
}
