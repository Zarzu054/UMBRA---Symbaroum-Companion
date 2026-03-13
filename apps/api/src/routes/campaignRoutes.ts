import type { FastifyInstance } from "fastify";
import type {
  AddCampaignMemberInput,
  AssignCampaignSessionExperienceInput,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  CreateCampaignReferenceInput,
  CreateCampaignSessionInput,
  GrantCampaignExperienceInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput,
  UpdateCampaignReferenceInput,
  UpdateCampaignSessionInput
} from "@umbra/shared";
import { CampaignController } from "../controllers/CampaignController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { CampaignModel } from "../models/CampaignModel.js";
import { CampaignService } from "../services/CampaignService.js";

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  const model = new CampaignModel();
  const service = new CampaignService(model);
  const controller = new CampaignController(service);

  app.get("/campaigns", { preHandler: [requireAuth] }, controller.list.bind(controller));
  app.get<{ Params: { campaignId: string } }>("/campaigns/:campaignId", { preHandler: [requireAuth] }, async (request, reply) =>
    controller.get(request, reply)
  );
  app.post<{ Body: CreateCampaignInput }>("/campaigns", { preHandler: [requireAuth] }, async (request, reply) =>
    controller.create(request, reply)
  );
  app.put<{ Params: { campaignId: string }; Body: UpdateCampaignInput }>(
    "/campaigns/:campaignId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.update(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: AddCampaignMemberInput }>(
    "/campaigns/:campaignId/members",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.addMember(request, reply)
  );
  app.delete<{ Params: { memberId: string } }>("/campaign-members/:memberId", { preHandler: [requireAuth] }, async (request, reply) =>
    controller.removeMember(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: { characterId: string } }>(
    "/campaigns/:campaignId/characters",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.linkCharacter(request, reply)
  );
  app.delete<{ Params: { linkId: string } }>(
    "/campaign-characters/:linkId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.unlinkCharacter(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignNpcInput }>(
    "/campaigns/:campaignId/npcs",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.createNpc(request, reply)
  );
  app.post<{ Params: { campaignId: string } }>(
    "/campaigns/:campaignId/npcs/generate",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.generateNpc(request, reply)
  );
  app.put<{ Params: { npcId: string }; Body: UpdateCampaignNpcInput }>(
    "/campaign-npcs/:npcId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.updateNpc(request, reply)
  );
  app.delete<{ Params: { npcId: string } }>("/campaign-npcs/:npcId", { preHandler: [requireAuth] }, async (request, reply) =>
    controller.deleteNpc(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignSessionInput }>(
    "/campaigns/:campaignId/sessions",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.createSession(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignReferenceInput }>(
    "/campaigns/:campaignId/references",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.createReference(request, reply)
  );
  app.put<{ Params: { sessionId: string }; Body: UpdateCampaignSessionInput }>(
    "/campaign-sessions/:sessionId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.updateSession(request, reply)
  );
  app.put<{ Params: { referenceId: string }; Body: UpdateCampaignReferenceInput }>(
    "/campaign-references/:referenceId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.updateReference(request, reply)
  );
  app.delete<{ Params: { referenceId: string } }>(
    "/campaign-references/:referenceId",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.deleteReference(request, reply)
  );
  app.post<{ Params: { sessionId: string }; Body: AssignCampaignSessionExperienceInput }>(
    "/campaign-sessions/:sessionId/xp-awards",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.assignSessionExperience(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: GrantCampaignExperienceInput }>(
    "/campaigns/:campaignId/xp-grants",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.grantExperience(request, reply)
  );
}
