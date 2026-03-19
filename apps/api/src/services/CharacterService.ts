import {
  createCharacterSchema,
  createEmptyCharacterSheet,
  importCharacterSchema,
  parseCharacterSheet,
  updateCharacterSchema,
  type Character,
  type CreateCharacterInput,
  type ImportCharacterInput,
  type UpdateCharacterInput
} from "@umbra/shared";
import { AppError } from "../utils/AppError.js";
import { CharacterModel } from "../models/CharacterModel.js";

export class CharacterService {
  constructor(private readonly model: CharacterModel) {}

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
      name: input.name?.trim() || "Personaje sin nombre",
      archetype: input.archetype?.trim() || input.sheet?.identidad?.arquetipo || "Guerrero",
      race: input.race?.trim() || input.sheet?.identidad?.raza || "Humano",
      culture: input.culture?.trim() || input.sheet?.identidad?.cultura || "Ambriano",
      profession: input.profession?.trim() || input.sheet?.identidad?.profesion || "",
      level: 1 as const,
      sheet: normalizedSheet
    };

    const payload = createCharacterSchema.parse(normalized);
    return this.model.create(ownerId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });
  }

  async importCharacter(ownerId: string, input: ImportCharacterInput): Promise<Character> {
    const normalizedSheet = {
      ...(input.sheet ?? createEmptyCharacterSheet()),
      progreso: {
        ...(input.sheet?.progreso ?? createEmptyCharacterSheet().progreso),
        nivel: 1 as const
      }
    };

    const normalized = {
      ...input,
      name: input.name?.trim() || "Personaje importado",
      archetype: input.archetype?.trim() || input.sheet?.identidad?.arquetipo || "Guerrero",
      race: input.race?.trim() || input.sheet?.identidad?.raza || "Humano",
      culture: input.culture?.trim() || input.sheet?.identidad?.cultura || "Ambriano",
      profession: input.profession?.trim() || input.sheet?.identidad?.profesion || "",
      level: 1 as const,
      sheet: normalizedSheet
    };

    const payload = importCharacterSchema.parse(normalized);
    return this.model.create(ownerId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });
  }

  async updateCharacter(ownerId: string, characterId: string, input: UpdateCharacterInput): Promise<Character> {
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
                nivel: 1 as const
              }
            }
    };

    const payload = updateCharacterSchema.parse(normalizedInput);
    const updated = await this.model.update(ownerId, characterId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });

    if (!updated) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    return updated;
  }

  async duplicateCharacter(ownerId: string, characterId: string): Promise<Character> {
    const source = await this.model.findById(ownerId, characterId);
    if (!source) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    const duplicatedName = source.name.trim() ? `${source.name} (Copia)` : "Personaje sin nombre (Copia)";

    return this.model.create(ownerId, {
      name: duplicatedName,
      archetype: source.archetype,
      race: source.race,
      culture: source.culture,
      profession: source.profession,
      level: source.level,
      sheet: parseCharacterSheet(source.sheet)
    });
  }

  async deleteCharacter(ownerId: string, characterId: string): Promise<void> {
    const deleted = await this.model.delete(ownerId, characterId);
    if (!deleted) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }
  }
}
