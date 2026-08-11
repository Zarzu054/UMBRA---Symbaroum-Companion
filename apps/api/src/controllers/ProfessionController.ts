import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProfessionDecisionInput } from "@umbra/shared";
import { ProfessionService } from "../services/ProfessionService.js";

type ProfessionParams = { characterId: string; professionId: string };

export class ProfessionController {
  constructor(private readonly service = new ProfessionService()) {}

  async aspire(request: FastifyRequest<{ Params: ProfessionParams }>, reply: FastifyReply) {
    reply.send({ data: await this.service.aspire(request.authUser!.id, request.params.characterId, request.params.professionId) });
  }
  async removeAspiration(request: FastifyRequest<{ Params: ProfessionParams }>, reply: FastifyReply) {
    await this.service.removeAspiration(request.authUser!.id, request.params.characterId, request.params.professionId);
    reply.code(204).send();
  }
  async requestMembership(request: FastifyRequest<{ Params: ProfessionParams }>, reply: FastifyReply) {
    reply.send({ data: await this.service.request(request.authUser!.id, request.params.characterId, request.params.professionId) });
  }
  async decide(request: FastifyRequest<{ Params: { campaignId: string; requestId: string }; Body: ProfessionDecisionInput }>, reply: FastifyReply) {
    const user = request.authUser!;
    reply.send({ data: await this.service.decide(user.id, user.role, request.params.campaignId, request.params.requestId, request.body) });
  }
  async leave(request: FastifyRequest<{ Params: ProfessionParams }>, reply: FastifyReply) {
    const user = request.authUser!;
    reply.send({ data: await this.service.leave(user.id, user.role, request.params.characterId, request.params.professionId) });
  }
}
