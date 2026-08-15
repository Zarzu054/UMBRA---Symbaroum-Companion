import type { FastifyReply, FastifyRequest } from "fastify";
import type { AssignCampaignItemOwnerInput, CreateCampaignItemInput, UpdateCampaignItemInput } from "@umbra/shared";
import { CampaignItemService } from "../services/CampaignItemService.js";

export class CampaignItemController {
  constructor(private readonly service: CampaignItemService) {}

  async list(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.list(user.id, user.role, request.params.campaignId) });
  }

  async create(request: FastifyRequest<{ Params: { campaignId: string }; Body: CreateCampaignItemInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.code(201).send({ data: await this.service.create(user.id, user.role, request.params.campaignId, request.body) });
  }

  async update(request: FastifyRequest<{ Params: { itemId: string }; Body: UpdateCampaignItemInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.update(user.id, user.role, request.params.itemId, request.body) });
  }

  async assign(request: FastifyRequest<{ Params: { itemId: string }; Body: AssignCampaignItemOwnerInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.assign(user.id, user.role, request.params.itemId, request.body) });
  }

  async archive(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.archive(user.id, user.role, request.params.itemId) });
  }

  async restore(request: FastifyRequest<{ Params: { itemId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.restore(user.id, user.role, request.params.itemId) });
  }
}

