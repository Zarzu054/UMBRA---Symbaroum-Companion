import { getProfessionById, professionDecisionSchema, professionIdSchema, type ProfessionDecisionInput, type UserRole } from "@umbra/shared";
import { AppError } from "../utils/AppError.js";
import { ProfessionModel } from "../models/ProfessionModel.js";

export function translateProfessionError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("PROFESSION_INELIGIBLE:")) {
    const reasons = message.slice("PROFESSION_INELIGIBLE:".length).split("|").filter(Boolean);
    throw new AppError("PROFESSION_INELIGIBLE", `No se cumplen los requisitos: ${reasons.join(", ")}`, 409);
  }
  if (message === "PROFESSION_REQUEST_NOT_FOUND") throw new AppError("PROFESSION_REQUEST_NOT_FOUND", "Solicitud profesional no encontrada", 404);
  if (message === "CHARACTER_NOT_FOUND") throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
  if (message === "PROFESSION_STATE_CONFLICT") throw new AppError("PROFESSION_STATE_CONFLICT", "La profesión ya está activa o pendiente", 409);
  throw error;
}

export class ProfessionService {
  constructor(private readonly model = new ProfessionModel()) {}

  private validateProfessionId(value: string): string {
    const id = professionIdSchema.parse(value);
    if (!getProfessionById(id)) throw new AppError("PROFESSION_NOT_FOUND", "Profesión no encontrada", 404);
    return id;
  }

  private async requireOwner(userId: string, characterId: string) {
    const character = await this.model.findCharacterAccess(userId, characterId);
    if (!character) throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    if (character.ownerId !== userId) throw new AppError("CHARACTER_FORBIDDEN", "Solo el propietario puede gestionar esta aspiración", 403);
    return character;
  }

  async aspire(userId: string, characterId: string, rawProfessionId: string) {
    const professionId = this.validateProfessionId(rawProfessionId);
    await this.requireOwner(userId, characterId);
    try {
      await this.model.setAspiration(characterId, professionId, userId);
    } catch (error) {
      translateProfessionError(error);
    }
    return this.model.listForCharacter(characterId);
  }

  async removeAspiration(userId: string, characterId: string, rawProfessionId: string) {
    const professionId = this.validateProfessionId(rawProfessionId);
    await this.requireOwner(userId, characterId);
    if (!(await this.model.removeAspiration(characterId, professionId, userId))) {
      throw new AppError("PROFESSION_STATE_CONFLICT", "No se puede retirar una profesión pendiente o activa", 409);
    }
  }

  async request(userId: string, characterId: string, rawProfessionId: string) {
    const professionId = this.validateProfessionId(rawProfessionId);
    await this.requireOwner(userId, characterId);
    try {
      await this.model.requestMembership(characterId, professionId, userId);
    } catch (error) {
      translateProfessionError(error);
    }
    return this.model.listForCharacter(characterId);
  }

  async decide(userId: string, userRole: UserRole, campaignId: string, requestId: string, input: ProfessionDecisionInput) {
    const payload = professionDecisionSchema.parse(input);
    const access = await this.model.findCharacterAccess(userId, (await this.model.findRequestCharacterId(requestId)) ?? "00000000-0000-0000-0000-000000000000");
    const campaign = access?.campaignLinks.find((entry) => entry.campaignId === campaignId)?.campaign;
    if (!campaign || (userRole !== "superadmin" && campaign.gmId !== userId)) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo el DJ de la campaña puede resolver esta solicitud", 403);
    }
    try {
      const characterId = await this.model.decide(requestId, campaignId, userId, payload.decision, payload.note);
      return this.model.listForCharacter(characterId);
    } catch (error) {
      translateProfessionError(error);
    }
  }

  async leave(userId: string, userRole: UserRole, characterId: string, rawProfessionId: string) {
    const professionId = this.validateProfessionId(rawProfessionId);
    const character = await this.model.findCharacterAccess(userId, characterId);
    if (!character) throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    const campaign = character.campaignLinks[0]?.campaign;
    const isOwner = character.ownerId === userId;
    const isCurrentGm = Boolean(campaign && (userRole === "superadmin" || campaign.gmId === userId));
    if (!isOwner && !isCurrentGm) throw new AppError("CHARACTER_FORBIDDEN", "No puedes retirar esta profesión", 403);
    if (!(await this.model.leave(characterId, professionId, userId, isCurrentGm ? campaign?.id : undefined))) {
      throw new AppError("PROFESSION_NOT_FOUND", "El personaje no tiene esa profesión", 404);
    }
    return this.model.listForCharacter(characterId);
  }
}
