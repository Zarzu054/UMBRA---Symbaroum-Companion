import type { FastifyInstance } from "fastify";
import type {
  CreateCampaignInvitationInput,
  AssignCampaignSessionExperienceInput,
  CreateCampaignChatMessageInput,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  CreateCampaignReferenceInput,
  CreateCampaignSessionInput,
  GrantCampaignExperienceInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput,
  UpdateCampaignNpcSheetInput,
  UpdateCampaignReferenceInput,
  UpdateCampaignCharacterSheetInput,
  UpdateCampaignSessionInput
} from "@umbra/shared";
import { CampaignController } from "../controllers/CampaignController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { CampaignModel } from "../models/CampaignModel.js";
import { CampaignService } from "../services/CampaignService.js";
import { ProfessionController } from "../controllers/ProfessionController.js";

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  const model = new CampaignModel();
  const service = new CampaignService(model);
  const controller = new CampaignController(service);
  const professionController = new ProfessionController();

  app.get("/campaigns", { preHandler: [requireAuth, requirePasswordChangeComplete] }, controller.list.bind(controller));
  app.get<{ Params: { campaignId: string } }>("/campaigns/:campaignId", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.get(request, reply)
  );
  app.get<{ Params: { campaignId: string } }>(
    "/campaigns/:campaignId/chat-messages",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.listChatMessages(request, reply)
  );
  app.get<{ Params: { campaignId: string } }>(
    "/campaigns/:campaignId/chat-stream",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.streamChat(request, reply)
  );
  app.post<{ Body: CreateCampaignInput }>("/campaigns", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.create(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignChatMessageInput }>(
    "/campaigns/:campaignId/chat-messages",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.createChatMessage(request, reply)
  );
  app.put<{ Params: { campaignId: string }; Body: UpdateCampaignInput }>(
    "/campaigns/:campaignId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.update(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignInvitationInput }>(
    "/campaigns/:campaignId/invitations",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.inviteMember(request, reply)
  );
  app.get(
    "/campaign-invitations",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.listInvitations(request, reply)
  );
  app.post<{ Params: { invitationId: string } }>(
    "/campaign-invitations/:invitationId/accept",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.acceptInvitation(request, reply)
  );
  app.delete<{ Params: { invitationId: string } }>(
    "/campaign-invitations/:invitationId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.dismissInvitation(request, reply)
  );
  app.delete<{ Params: { memberId: string } }>("/campaign-members/:memberId", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.removeMember(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: { characterId: string } }>(
    "/campaigns/:campaignId/characters",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.linkCharacter(request, reply)
  );
  app.delete<{ Params: { linkId: string } }>(
    "/campaign-characters/:linkId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.unlinkCharacter(request, reply)
  );
  app.put<{ Params: { linkId: string }; Body: UpdateCampaignCharacterSheetInput }>(
    "/campaign-characters/:linkId/sheet",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.updateCharacterSheet(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignNpcInput }>(
    "/campaigns/:campaignId/npcs",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.createNpc(request, reply)
  );
  app.post<{ Params: { campaignId: string } }>(
    "/campaigns/:campaignId/npcs/generate",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.generateNpc(request, reply)
  );
  app.put<{ Params: { npcId: string }; Body: UpdateCampaignNpcInput }>(
    "/campaign-npcs/:npcId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.updateNpc(request, reply)
  );
  app.delete<{ Params: { npcId: string } }>("/campaign-npcs/:npcId", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.deleteNpc(request, reply)
  );
  app.post<{ Params: { npcId: string } }>(
    "/campaign-npcs/:npcId/sheet",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.createNpcSheet(request, reply)
  );
  app.put<{ Params: { npcId: string }; Body: UpdateCampaignNpcSheetInput }>(
    "/campaign-npcs/:npcId/sheet",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.updateNpcSheet(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignSessionInput }>(
    "/campaigns/:campaignId/sessions",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.createSession(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: CreateCampaignReferenceInput }>(
    "/campaigns/:campaignId/references",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.createReference(request, reply)
  );
  app.put<{ Params: { sessionId: string }; Body: UpdateCampaignSessionInput }>(
    "/campaign-sessions/:sessionId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.updateSession(request, reply)
  );
  app.delete<{ Params: { sessionId: string } }>(
    "/campaign-sessions/:sessionId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.deleteSession(request, reply)
  );
  app.put<{ Params: { referenceId: string }; Body: UpdateCampaignReferenceInput }>(
    "/campaign-references/:referenceId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.updateReference(request, reply)
  );
  app.delete<{ Params: { referenceId: string } }>(
    "/campaign-references/:referenceId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.deleteReference(request, reply)
  );
  app.post<{ Params: { sessionId: string }; Body: AssignCampaignSessionExperienceInput }>(
    "/campaign-sessions/:sessionId/xp-awards",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.assignSessionExperience(request, reply)
  );
  app.post<{ Params: { campaignId: string }; Body: GrantCampaignExperienceInput }>(
    "/campaigns/:campaignId/xp-grants",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.grantExperience(request, reply)
  );
  app.post<{ Params: { campaignId: string; requestId: string }; Body: import("@umbra/shared").ProfessionDecisionInput }>("/campaigns/:campaignId/profession-requests/:requestId/decision", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) => professionController.decide(request, reply));
}
