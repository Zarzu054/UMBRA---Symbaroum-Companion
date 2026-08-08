import {
  compendiumEntryIdSchema,
  setCompendiumFavoriteSchema,
  type CompendiumLibraryState,
  type SetCompendiumFavoriteInput
} from "@umbra/shared";
import { CompendiumModel } from "../models/CompendiumModel.js";

export class CompendiumService {
  constructor(private readonly model: CompendiumModel) {}

  async getLibrary(userId: string): Promise<CompendiumLibraryState> {
    return this.model.getLibrary(userId);
  }

  async setFavorite(userId: string, rawEntryId: string, input: SetCompendiumFavoriteInput): Promise<void> {
    const entryId = compendiumEntryIdSchema.parse(rawEntryId);
    const payload = setCompendiumFavoriteSchema.parse(input);
    await this.model.setFavorite(userId, entryId, payload.favorite);
  }

  async recordView(userId: string, rawEntryId: string): Promise<void> {
    const entryId = compendiumEntryIdSchema.parse(rawEntryId);
    await this.model.recordView(userId, entryId);
  }
}
