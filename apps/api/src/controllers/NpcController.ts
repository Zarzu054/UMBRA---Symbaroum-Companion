import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateNpcInput, UpdateNpcInput } from "@umbra/shared";
import { NpcService } from "../services/NpcService.js";

export class NpcController {
  constructor(private readonly service: NpcService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const npcs = await this.service.listNpcs(user.id, user.role);
    reply.send({ data: npcs });
  }

  async create(request: FastifyRequest<{ Body: CreateNpcInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const created = await this.service.createNpc(user.id, user.role, request.body);
    reply.code(201).send({ data: created });
  }

  async update(
    request: FastifyRequest<{ Params: { npcId: string }; Body: UpdateNpcInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const updated = await this.service.updateNpc(user.id, user.role, request.params.npcId, request.body);
    reply.send({ data: updated });
  }

  async remove(request: FastifyRequest<{ Params: { npcId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    await this.service.deleteNpc(user.id, user.role, request.params.npcId);
    reply.code(204).send();
  }
}
