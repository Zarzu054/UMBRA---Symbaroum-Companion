import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateMonsterInput, UpdateMonsterInput } from "@umbra/shared";
import { MonsterService } from "../services/MonsterService.js";

export class MonsterController {
  constructor(private readonly service: MonsterService) {}

  async listCodex(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const monsters = await this.service.listCodex(request.authUser!.role);
    reply.send({ data: monsters });
  }

  async listCustom(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const monsters = await this.service.listCustomMonsters(user.id, user.role);
    reply.send({ data: monsters });
  }

  async create(request: FastifyRequest<{ Body: CreateMonsterInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const created = await this.service.createMonster(user.id, user.role, request.body);
    reply.code(201).send({ data: created });
  }

  async update(
    request: FastifyRequest<{ Params: { monsterId: string }; Body: UpdateMonsterInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const updated = await this.service.updateMonster(user.id, user.role, request.params.monsterId, request.body);
    reply.send({ data: updated });
  }

  async remove(request: FastifyRequest<{ Params: { monsterId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    await this.service.deleteMonster(user.id, user.role, request.params.monsterId);
    reply.code(204).send();
  }
}
