import type { FastifyInstance } from "fastify";
import type {
  AssignMysticArtifactOwnerInput,
  BindMysticArtifactInput,
  CreateCampaignMysticArtifactInput,
  UpdateCampaignMysticArtifactInput,
  UpdateMysticArtifactResourceInput
} from "@umbra/shared";
import { MysticArtifactController } from "../controllers/MysticArtifactController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { MysticArtifactModel } from "../models/MysticArtifactModel.js";
import { MysticArtifactService } from "../services/MysticArtifactService.js";

export async function mysticArtifactRoutes(app: FastifyInstance): Promise<void> {
  const controller = new MysticArtifactController(new MysticArtifactService(new MysticArtifactModel()));
  const auth = [requireAuth, requirePasswordChangeComplete];

  app.get("/mystic-artifact-presets", { preHandler: auth }, controller.listPresets.bind(controller));
  app.get<{ Params: { artifactId: string } }>("/mystic-artifacts/:artifactId/source", { preHandler: auth }, (request, reply) => controller.source(request, reply));
  app.get<{ Params: { campaignId: string } }>("/campaigns/:campaignId/mystic-artifacts", { preHandler: auth }, (request, reply) => controller.listCampaign(request, reply));
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignMysticArtifactInput }>("/campaigns/:campaignId/mystic-artifacts", { preHandler: auth }, (request, reply) => controller.create(request, reply));
  app.put<{ Params: { artifactId: string }; Body: UpdateCampaignMysticArtifactInput }>("/mystic-artifacts/:artifactId", { preHandler: auth }, (request, reply) => controller.update(request, reply));
  app.delete<{ Params: { artifactId: string } }>("/mystic-artifacts/:artifactId", { preHandler: auth }, (request, reply) => controller.remove(request, reply));
  app.put<{ Params: { artifactId: string }; Body: AssignMysticArtifactOwnerInput }>("/mystic-artifacts/:artifactId/owner", { preHandler: auth }, (request, reply) => controller.assign(request, reply));
  app.post<{ Params: { artifactId: string }; Body: BindMysticArtifactInput }>("/mystic-artifacts/:artifactId/bind", { preHandler: auth }, (request, reply) => controller.bind(request, reply));
  app.post<{ Params: { artifactId: string } }>("/mystic-artifacts/:artifactId/bind-npc", { preHandler: auth }, (request, reply) => controller.bindNpc(request, reply));
  app.post<{ Params: { artifactId: string } }>("/mystic-artifacts/:artifactId/unbind", { preHandler: auth }, (request, reply) => controller.unbind(request, reply));
  app.put<{ Params: { artifactId: string; resourceId: string }; Body: UpdateMysticArtifactResourceInput }>("/mystic-artifacts/:artifactId/resources/:resourceId", { preHandler: auth }, (request, reply) => controller.updateResource(request, reply));
  app.post<{ Params: { artifactId: string; abilityId: string } }>("/mystic-artifacts/:artifactId/abilities/:abilityId/use", { preHandler: auth }, (request, reply) => controller.useAbility(request, reply));
}
