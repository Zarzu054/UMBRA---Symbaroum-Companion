import {
  createCharacterSchema,
  createEmptyCharacterSheet,
  parseCharacterSheet,
  updateCharacterSchema,
  type Character,
  type CreateCharacterInput,
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
    const normalized = {
      ...input,
      name: input.name?.trim() || "Personaje sin nombre",
      archetype: input.archetype?.trim() || input.sheet?.identidad?.arquetipo || "Guerrero",
      race: input.race?.trim() || input.sheet?.identidad?.raza || "Humano",
      culture: input.culture?.trim() || input.sheet?.identidad?.cultura || "Ambriano",
      profession: input.profession?.trim() || input.sheet?.identidad?.profesion || "",
      level: input.level || input.sheet?.progreso?.nivel || 1
    };

    const payload = createCharacterSchema.parse(normalized);
    return this.model.create(ownerId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });
  }

  async updateCharacter(ownerId: string, characterId: string, input: UpdateCharacterInput): Promise<Character> {
    const payload = updateCharacterSchema.parse(input);
    const updated = await this.model.update(ownerId, characterId, {
      ...payload,
      sheet: parseCharacterSheet(payload.sheet ?? createEmptyCharacterSheet())
    });

    if (!updated) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    return updated;
  }
}
