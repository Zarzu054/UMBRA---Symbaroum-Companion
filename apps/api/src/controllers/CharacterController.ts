import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCharacterInput, ImportCharacterInput, UpdateCharacterInput } from "@umbra/shared";
import { CharacterService } from "../services/CharacterService.js";

export class CharacterController {
  constructor(private readonly service: CharacterService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const characters = await this.service.listCharacters(ownerId);
    reply.send({ data: characters });
  }

  async create(request: FastifyRequest<{ Body: CreateCharacterInput }>, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const created = await this.service.createCharacter(ownerId, request.body);
    reply.code(201).send({ data: created });
  }

  async import(request: FastifyRequest<{ Body: ImportCharacterInput }>, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const created = await this.service.importCharacter(ownerId, request.body);
    reply.code(201).send({ data: created });
  }

  async update(
    request: FastifyRequest<{ Params: { characterId: string }; Body: UpdateCharacterInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const ownerId = request.authUser!.id;
    const updated = await this.service.updateCharacter(ownerId, request.params.characterId, request.body, request.authUser!);
    reply.send({ data: updated });
  }

  async changeLog(
    request: FastifyRequest<{ Params: { characterId: string }; Querystring: { cursor?: string; limit?: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    const page = await this.service.getChangeLog(user.id, user.role, request.params.characterId, request.query.cursor, limit);
    reply.send({ data: page });
  }

  async markChangeLogRead(
    request: FastifyRequest<{ Params: { characterId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    await this.service.markChangeLogRead(user.id, user.role, request.params.characterId);
    reply.code(204).send();
  }

  async duplicate(request: FastifyRequest<{ Params: { characterId: string } }>, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const duplicated = await this.service.duplicateCharacter(ownerId, request.params.characterId);
    reply.code(201).send({ data: duplicated });
  }

  async remove(request: FastifyRequest<{ Params: { characterId: string } }>, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    await this.service.deleteCharacter(ownerId, request.params.characterId);
    reply.code(204).send();
  }
}
