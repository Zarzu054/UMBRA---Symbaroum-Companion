import type { FastifyInstance } from "fastify";
import type { AssignCampaignItemOwnerInput, CreateCampaignItemInput, UpdateCampaignItemInput } from "@umbra/shared";
import { CampaignItemController } from "../controllers/CampaignItemController.js";
import { CampaignItemModel } from "../models/CampaignItemModel.js";
import { CampaignItemService } from "../services/CampaignItemService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";

export async function campaignItemRoutes(app: FastifyInstance): Promise<void> {
  const controller = new CampaignItemController(new CampaignItemService(new CampaignItemModel()));
  const auth = [requireAuth, requirePasswordChangeComplete];
  app.get<{ Params: { campaignId: string } }>("/campaigns/:campaignId/items", { preHandler: auth }, (request, reply) => controller.list(request, reply));
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignItemInput }>("/campaigns/:campaignId/items", { preHandler: auth }, (request, reply) => controller.create(request, reply));
  app.put<{ Params: { itemId: string }; Body: UpdateCampaignItemInput }>("/campaign-items/:itemId", { preHandler: auth }, (request, reply) => controller.update(request, reply));
  app.put<{ Params: { itemId: string }; Body: AssignCampaignItemOwnerInput }>("/campaign-items/:itemId/owner", { preHandler: auth }, (request, reply) => controller.assign(request, reply));
  app.delete<{ Params: { itemId: string } }>("/campaign-items/:itemId", { preHandler: auth }, (request, reply) => controller.archive(request, reply));
  app.post<{ Params: { itemId: string } }>("/campaign-items/:itemId/restore", { preHandler: auth }, (request, reply) => controller.restore(request, reply));
}

