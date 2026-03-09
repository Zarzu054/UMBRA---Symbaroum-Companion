import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  AddCampaignMemberInput,
  AssignCampaignSessionExperienceInput,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  CreateCampaignSessionInput,
  GrantCampaignExperienceInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput,
  UpdateCampaignSessionInput
} from "@umbra/shared";
import { CampaignService } from "../services/CampaignService.js";

export class CampaignController {
  constructor(private readonly service: CampaignService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaigns = await this.service.listCampaigns(user.id, user.role);
    reply.send({ data: campaigns });
  }

  async get(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.getCampaign(user.id, user.role, request.params.campaignId);
    reply.send({ data: campaign });
  }

  async create(request: FastifyRequest<{ Body: CreateCampaignInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.createCampaign(user.id, user.role, request.body);
    reply.code(201).send({ data: campaign });
  }

  async update(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: UpdateCampaignInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.updateCampaign(user.id, user.role, request.params.campaignId, request.body);
    reply.send({ data: campaign });
  }

  async addMember(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: AddCampaignMemberInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.addMember(user.id, user.role, request.params.campaignId, request.body);
    reply.send({ data: campaign });
  }

  async removeMember(request: FastifyRequest<{ Params: { memberId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.removeMember(user.id, user.role, request.params.memberId);
    reply.send({ data: campaign });
  }

  async linkCharacter(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: { characterId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.linkCharacter(user.id, user.role, request.params.campaignId, request.body.characterId);
    reply.send({ data: campaign });
  }

  async unlinkCharacter(request: FastifyRequest<{ Params: { linkId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.unlinkCharacter(user.id, user.role, request.params.linkId);
    reply.send({ data: campaign });
  }

  async createNpc(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: CreateCampaignNpcInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.createNpc(user.id, user.role, request.params.campaignId, request.body);
    reply.send({ data: campaign });
  }

  async generateNpc(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.generateNpc(user.id, user.role, request.params.campaignId);
    reply.code(201).send({ data: campaign });
  }

  async updateNpc(
    request: FastifyRequest<{ Params: { npcId: string }; Body: UpdateCampaignNpcInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.updateNpc(user.id, user.role, request.params.npcId, request.body);
    reply.send({ data: campaign });
  }

  async deleteNpc(request: FastifyRequest<{ Params: { npcId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.deleteNpc(user.id, user.role, request.params.npcId);
    reply.send({ data: campaign });
  }

  async createSession(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: CreateCampaignSessionInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.createSession(user.id, user.role, request.params.campaignId, request.body);
    reply.code(201).send({ data: campaign });
  }

  async updateSession(
    request: FastifyRequest<{ Params: { sessionId: string }; Body: UpdateCampaignSessionInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.updateSession(user.id, user.role, request.params.sessionId, request.body);
    reply.send({ data: campaign });
  }

  async assignSessionExperience(
    request: FastifyRequest<{ Params: { sessionId: string }; Body: AssignCampaignSessionExperienceInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.assignSessionExperience(user.id, user.role, request.params.sessionId, request.body);
    reply.send({ data: campaign });
  }

  async grantExperience(
    request: FastifyRequest<{ Params: { campaignId: string }; Body: GrantCampaignExperienceInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const campaign = await this.service.grantExperience(user.id, user.role, request.params.campaignId, request.body);
    reply.send({ data: campaign });
  }
}
