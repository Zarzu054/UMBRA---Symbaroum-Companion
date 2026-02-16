import { createCharacterSchema, type Character, type CreateCharacterInput } from "@umbra/shared";
import { CharacterModel } from "../models/CharacterModel.js";

export class CharacterService {
  constructor(private readonly model: CharacterModel) {}

  async listCharacters(ownerId: string): Promise<Character[]> {
    return this.model.listByOwner(ownerId);
  }

  async createCharacter(ownerId: string, input: CreateCharacterInput): Promise<Character> {
    const payload = createCharacterSchema.parse(input);
    return this.model.create(ownerId, payload);
  }
}