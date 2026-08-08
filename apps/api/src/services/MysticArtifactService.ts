import {
  assignMysticArtifactOwnerSchema,
  bindMysticArtifactSchema,
  createCampaignMysticArtifactSchema,
  mysticArtifactDefinitionInputSchema,
  updateMysticArtifactResourceSchema,
  type AssignMysticArtifactOwnerInput,
  type BindMysticArtifactInput,
  type CreateCampaignMysticArtifactInput,
  type MysticArtifact,
  type UpdateCampaignMysticArtifactInput,
  type UpdateMysticArtifactResourceInput,
  type UseMysticArtifactAbilityResult,
  type UserRole
} from "@umbra/shared";
import { MysticArtifactModel, mapMysticArtifact, type MysticArtifactRow } from "../models/MysticArtifactModel.js";
import { AppError } from "../utils/AppError.js";
import { resolveMysticArtifactSource } from "../utils/mysticArtifactSources.js";

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") throw new AppError("CAMPAIGN_FORBIDDEN", "Solo un director de juego puede gestionar artefactos", 403);
}

export class MysticArtifactService {
  constructor(private readonly model: MysticArtifactModel) {}

  private assertManagedBy(row: MysticArtifactRow, userId: string, userRole: UserRole): void {
    if (row.scope !== "campaign" || !row.campaignId || !row.campaign) throw new AppError("ARTIFACT_NOT_FOUND", "Artefacto de campaña no encontrado", 404);
    if (userRole !== "superadmin" && row.campaign.gmId !== userId) throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta campaña", 403);
  }

  private async getManagedArtifact(userId: string, userRole: UserRole, artifactId: string): Promise<MysticArtifactRow> {
    requireDirectorRole(userRole);
    const row = await this.model.findById(artifactId);
    if (!row) throw new AppError("ARTIFACT_NOT_FOUND", "Artefacto no encontrado", 404);
    this.assertManagedBy(row, userId, userRole);
    return row;
  }

  async listPresets(userRole: UserRole): Promise<MysticArtifact[]> {
    requireDirectorRole(userRole);
    return (await this.model.listPresets()).map((row) => mapMysticArtifact(row) as MysticArtifact);
  }

  async listCampaignArtifacts(userId: string, userRole: UserRole, campaignId: string): Promise<MysticArtifact[]> {
    requireDirectorRole(userRole);
    const campaign = await this.model.findCampaign(campaignId);
    if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", "Campaña no encontrada", 404);
    if (userRole !== "superadmin" && campaign.gmId !== userId) throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta campaña", 403);
    const rows = await this.model.listCampaign(campaignId);
    return rows.map((row) => mapMysticArtifact(row) as MysticArtifact);
  }

  async getSource(userId: string, userRole: UserRole, artifactId: string) {
    requireDirectorRole(userRole);
    const row = await this.model.findById(artifactId);
    if (!row) throw new AppError("ARTIFACT_NOT_FOUND", "Artefacto no encontrado", 404);
    if (row.scope === "campaign") this.assertManagedBy(row, userId, userRole);
    return resolveMysticArtifactSource(row.sourceTitle, row.sourcePage);
  }

  async create(
    userId: string,
    userRole: UserRole,
    campaignId: string,
    input: CreateCampaignMysticArtifactInput
  ): Promise<MysticArtifact> {
    requireDirectorRole(userRole);
    const payload = createCampaignMysticArtifactSchema.parse(input);
    const existing = await this.model.listCampaign(campaignId);
    if (existing.length > 0) this.assertManagedBy(existing[0], userId, userRole);
    else {
      const campaignProbe = await this.model.findCampaign(campaignId);
      if (!campaignProbe) throw new AppError("CAMPAIGN_NOT_FOUND", "Campaña no encontrada", 404);
      if (userRole !== "superadmin" && campaignProbe.gmId !== userId) throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta campaña", 403);
    }
    if (payload.mode === "custom") return mapMysticArtifact(await this.model.createCustom(campaignId, payload.artifact)) as MysticArtifact;
    const preset = await this.model.findById(payload.presetId);
    if (!preset || preset.scope !== "preset") throw new AppError("ARTIFACT_PRESET_NOT_FOUND", "Plantilla de artefacto no encontrada", 404);
    const missingResource = preset.resources.find((resource) => resource.suggestedMaxFormula && !payload.resources.some((entry) => entry.key === resource.key));
    if (missingResource) throw new AppError("ARTIFACT_RESOURCE_MAX_REQUIRED", `Indica el máximo de ${missingResource.name}`, 400);
    return mapMysticArtifact(await this.model.clonePreset(campaignId, preset, payload.name, payload.resources)) as MysticArtifact;
  }

  async update(userId: string, userRole: UserRole, artifactId: string, input: UpdateCampaignMysticArtifactInput): Promise<MysticArtifact> {
    await this.getManagedArtifact(userId, userRole, artifactId);
    const payload = mysticArtifactDefinitionInputSchema.parse(input);
    return mapMysticArtifact(await this.model.update(artifactId, payload)) as MysticArtifact;
  }

  async remove(userId: string, userRole: UserRole, artifactId: string): Promise<void> {
    const row = await this.getManagedArtifact(userId, userRole, artifactId);
    if (row.bindings.length > 0) throw new AppError("ARTIFACT_BOUND", "Rompe el vínculo antes de eliminar el artefacto", 409);
    if (row.ownerCharacterId || row.ownerNpcId) throw new AppError("ARTIFACT_ASSIGNED", "Retira el poseedor antes de eliminar el artefacto", 409);
    await this.model.delete(artifactId);
  }

  async assignOwner(userId: string, userRole: UserRole, artifactId: string, input: AssignMysticArtifactOwnerInput): Promise<MysticArtifact> {
    const row = await this.getManagedArtifact(userId, userRole, artifactId);
    const payload = assignMysticArtifactOwnerSchema.parse(input);
    const nextCharacterId = payload.ownerType === "character" ? payload.ownerId : undefined;
    const nextNpcId = payload.ownerType === "npc" ? payload.ownerId : undefined;
    const changing = row.ownerCharacterId !== (nextCharacterId ?? null) || row.ownerNpcId !== (nextNpcId ?? null);
    if (changing && row.bindings.length > 0) throw new AppError("ARTIFACT_BOUND", "Rompe el vínculo antes de transferir el artefacto", 409);
    if (nextCharacterId) {
      const target = await this.model.findCharacterLink(nextCharacterId);
      if (!target || target.campaignId !== row.campaignId) throw new AppError("ARTIFACT_OWNER_INVALID", "El personaje no pertenece a esta campaña", 400);
    }
    if (nextNpcId) {
      const target = await this.model.findNpc(nextNpcId);
      if (!target || target.campaignId !== row.campaignId) throw new AppError("ARTIFACT_OWNER_INVALID", "El PNJ no pertenece a esta campaña", 400);
    }
    await this.model.assign(artifactId, { characterId: nextCharacterId, npcId: nextNpcId });
    return mapMysticArtifact((await this.model.findById(artifactId))!) as MysticArtifact;
  }

  async bind(userId: string, userRole: UserRole, artifactId: string, input: BindMysticArtifactInput): Promise<MysticArtifact> {
    const payload = bindMysticArtifactSchema.parse(input);
    const row = await this.model.findById(artifactId);
    if (!row || row.scope !== "campaign" || !row.ownerCharacter) throw new AppError("ARTIFACT_NOT_FOUND", "Artefacto poseído no encontrado", 404);
    if (row.ownerCharacter.character.ownerId !== userId && userRole !== "superadmin") throw new AppError("ARTIFACT_NOT_OWNED", "Solo el propietario del personaje puede vincularlo", 403);
    await this.model.bindCharacter(artifactId, row.ownerCharacter.id, payload.paymentType);
    return mapMysticArtifact((await this.model.findById(artifactId))!, { concealForOwner: true }) as MysticArtifact;
  }

  async bindNpc(userId: string, userRole: UserRole, artifactId: string): Promise<MysticArtifact> {
    const row = await this.getManagedArtifact(userId, userRole, artifactId);
    if (!row.ownerNpcId) throw new AppError("ARTIFACT_NOT_OWNED", "Asigna el artefacto a un PNJ antes de vincularlo", 400);
    await this.model.bindNpc(artifactId, row.ownerNpcId);
    return mapMysticArtifact((await this.model.findById(artifactId))!) as MysticArtifact;
  }

  async unbind(userId: string, userRole: UserRole, artifactId: string): Promise<MysticArtifact> {
    await this.getManagedArtifact(userId, userRole, artifactId);
    await this.model.unbind(artifactId);
    return mapMysticArtifact((await this.model.findById(artifactId))!) as MysticArtifact;
  }

  async updateResource(
    userId: string,
    userRole: UserRole,
    artifactId: string,
    resourceId: string,
    input: UpdateMysticArtifactResourceInput
  ): Promise<MysticArtifact> {
    const row = await this.getManagedArtifact(userId, userRole, artifactId);
    if (!row.resources.some((resource) => resource.id === resourceId)) throw new AppError("ARTIFACT_RESOURCE_NOT_FOUND", "Recurso no encontrado", 404);
    await this.model.updateResource(resourceId, updateMysticArtifactResourceSchema.parse(input));
    return mapMysticArtifact((await this.model.findById(artifactId))!) as MysticArtifact;
  }

  async useAbility(userId: string, userRole: UserRole, artifactId: string, abilityId: string): Promise<UseMysticArtifactAbilityResult> {
    const row = await this.model.findById(artifactId);
    if (!row || row.scope !== "campaign") throw new AppError("ARTIFACT_NOT_FOUND", "Artefacto no encontrado", 404);
    const isCharacterOwner = row.ownerCharacter?.character.ownerId === userId;
    const isCampaignDirector = userRole === "superadmin" || row.campaign?.gmId === userId;
    if (!isCharacterOwner && !isCampaignDirector) throw new AppError("ARTIFACT_NOT_OWNED", "No puedes usar este artefacto", 403);
    const mapped = mapMysticArtifact(row, { concealForOwner: true }) as MysticArtifact;
    const ability = mapped.abilities.find((entry) => entry.id === abilityId);
    if (!ability) throw new AppError("ARTIFACT_ABILITY_NOT_AVAILABLE", "La capacidad no está disponible sin vínculo", 403);
    if (ability.activation !== "active") throw new AppError("ARTIFACT_ABILITY_NOT_ACTIVE", "Esta capacidad no se activa manualmente", 400);
    if (ability.locked) throw new AppError("ARTIFACT_REQUIREMENT_MISSING", ability.lockReason, 403);
    await this.model.consumeAbility(artifactId, abilityId);
    const refreshed = mapMysticArtifact((await this.model.findById(artifactId))!, { concealForOwner: true }) as MysticArtifact;
    return { artifactId, abilityId, resources: refreshed.resources };
  }
}
