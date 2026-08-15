import {
  assignCampaignItemOwnerSchema,
  campaignItemDefinitionSchema,
  createCampaignItemSchema,
  updateCampaignItemSchema,
  type AssignCampaignItemOwnerInput,
  type CampaignItemTemplate,
  type CreateCampaignItemInput,
  type UpdateCampaignItemInput,
  type UserRole
} from "@umbra/shared";
import { CampaignItemModel, mapCampaignItem, type CampaignItemRow } from "../models/CampaignItemModel.js";
import { AppError } from "../utils/AppError.js";

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") {
    throw new AppError("CAMPAIGN_FORBIDDEN", "Solo el DJ puede gestionar objetos de campaña", 403);
  }
}

function normalizeDefinition(input: ReturnType<typeof campaignItemDefinitionSchema.parse>, isUnique: boolean) {
  return {
    ...input,
    stackable: isUnique ? false : input.stackable,
    defaultQuantity: isUnique ? 1 : input.defaultQuantity
  };
}

export class CampaignItemService {
  constructor(private readonly model: CampaignItemModel) {}

  private async assertCampaignManaged(userId: string, userRole: UserRole, campaignId: string): Promise<void> {
    requireDirectorRole(userRole);
    const campaign = await this.model.findCampaign(campaignId);
    if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", "Campaña no encontrada", 404);
    if (userRole !== "superadmin" && campaign.gmId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta campaña", 403);
    }
  }

  private async getManaged(userId: string, userRole: UserRole, itemId: string): Promise<CampaignItemRow> {
    requireDirectorRole(userRole);
    const row = await this.model.findById(itemId);
    if (!row) throw new AppError("CAMPAIGN_ITEM_NOT_FOUND", "Objeto de campaña no encontrado", 404);
    await this.assertCampaignManaged(userId, userRole, row.campaignId);
    return row;
  }

  private async validateOwner(campaignId: string, owner: { type: "character" | "npc"; id: string } | null): Promise<void> {
    if (!owner) return;
    if (!await this.model.ownerExists(campaignId, owner.type, owner.id)) {
      throw new AppError("CAMPAIGN_ITEM_OWNER_INVALID", "El poseedor no pertenece a esta campaña", 400);
    }
  }

  async list(userId: string, userRole: UserRole, campaignId: string): Promise<CampaignItemTemplate[]> {
    await this.assertCampaignManaged(userId, userRole, campaignId);
    return (await this.model.listCampaign(campaignId, true)).map(mapCampaignItem);
  }

  async create(userId: string, userRole: UserRole, campaignId: string, input: CreateCampaignItemInput): Promise<CampaignItemTemplate> {
    await this.assertCampaignManaged(userId, userRole, campaignId);
    const payload = createCampaignItemSchema.parse(input);
    const requestedOwner = payload.ownerType && payload.ownerId ? { type: payload.ownerType, id: payload.ownerId } : null;
    const assignment = payload.assignToType && payload.assignToId ? { type: payload.assignToType, id: payload.assignToId } : null;
    const owner = payload.isUnique ? (requestedOwner ?? assignment) : null;
    await this.validateOwner(campaignId, owner);
    await this.validateOwner(campaignId, assignment);
    const row = await this.model.create(
      campaignId,
      normalizeDefinition(payload.definition, payload.isUnique),
      payload.isUnique,
      owner,
      assignment,
      userId
    );
    return mapCampaignItem(row);
  }

  async update(userId: string, userRole: UserRole, itemId: string, input: UpdateCampaignItemInput): Promise<CampaignItemTemplate> {
    const current = await this.getManaged(userId, userRole, itemId);
    const payload = updateCampaignItemSchema.parse(input);
    const owner = payload.ownerType && payload.ownerId ? { type: payload.ownerType, id: payload.ownerId } : null;
    await this.validateOwner(current.campaignId, owner);
    return mapCampaignItem(await this.model.update(itemId, normalizeDefinition(payload.definition, payload.isUnique), payload.isUnique, owner, userId));
  }

  async assign(userId: string, userRole: UserRole, itemId: string, input: AssignCampaignItemOwnerInput): Promise<CampaignItemTemplate> {
    const current = await this.getManaged(userId, userRole, itemId);
    if (!current.isUnique) throw new AppError("CAMPAIGN_ITEM_NOT_UNIQUE", "Solo las piezas únicas tienen poseedor", 409);
    if (current.archivedAt) throw new AppError("CAMPAIGN_ITEM_ARCHIVED", "Restaura la pieza antes de transferirla", 409);
    const payload = assignCampaignItemOwnerSchema.parse(input);
    const owner = payload.ownerType && payload.ownerId ? { type: payload.ownerType, id: payload.ownerId } : null;
    await this.validateOwner(current.campaignId, owner);
    return mapCampaignItem(await this.model.assign(itemId, owner, userId));
  }

  async archive(userId: string, userRole: UserRole, itemId: string): Promise<CampaignItemTemplate> {
    await this.getManaged(userId, userRole, itemId);
    return mapCampaignItem(await this.model.setArchived(itemId, true));
  }

  async restore(userId: string, userRole: UserRole, itemId: string): Promise<CampaignItemTemplate> {
    await this.getManaged(userId, userRole, itemId);
    return mapCampaignItem(await this.model.setArchived(itemId, false));
  }
}
