import type { FastifyReply, FastifyRequest } from "fastify";
import type { AddCampaignCombatParticipantInput, AdvanceCampaignCombatTurnInput, ReorderCampaignCombatInput, UpdateCampaignCombatParticipantInput, UpdateCampaignCombatResourcesInput } from "@umbra/shared";
import { CampaignCombatService } from "../services/CampaignCombatService.js";

export class CampaignCombatController {
  constructor(private readonly service = new CampaignCombatService()) {}

  async get(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.get(user.id, user.role, request.params.campaignId) });
  }

  async start(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.start(user.id, user.role, request.params.campaignId) });
  }

  async finish(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    await this.service.finish(user.id, user.role, request.params.campaignId);
    reply.code(204).send();
  }

  async addParticipant(request: FastifyRequest<{ Params: { campaignId: string }; Body: AddCampaignCombatParticipantInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.code(201).send({ data: await this.service.addParticipant(user.id, user.role, request.params.campaignId, request.body) });
  }

  async updateParticipant(request: FastifyRequest<{ Params: { campaignId: string; participantId: string }; Body: UpdateCampaignCombatParticipantInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.updateParticipant(user.id, user.role, request.params.campaignId, request.params.participantId, request.body) });
  }

  async removeParticipant(request: FastifyRequest<{ Params: { campaignId: string; participantId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.removeParticipant(user.id, user.role, request.params.campaignId, request.params.participantId) });
  }

  async reorder(request: FastifyRequest<{ Params: { campaignId: string }; Body: ReorderCampaignCombatInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.reorder(user.id, user.role, request.params.campaignId, request.body) });
  }

  async advanceTurn(request: FastifyRequest<{ Params: { campaignId: string }; Body: AdvanceCampaignCombatTurnInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.advanceTurn(user.id, user.role, request.params.campaignId, request.body) });
  }

  async updateResources(request: FastifyRequest<{ Params: { campaignId: string; participantId: string }; Body: UpdateCampaignCombatResourcesInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.updateResources(user.id, user.role, request.params.campaignId, request.params.participantId, request.body) });
  }
}
