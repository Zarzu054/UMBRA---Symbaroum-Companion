import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateCharacterInput, UpdateCharacterInput } from "@umbra/shared";
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

  async update(
    request: FastifyRequest<{ Params: { characterId: string }; Body: UpdateCharacterInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const ownerId = request.authUser!.id;
    const updated = await this.service.updateCharacter(ownerId, request.params.characterId, request.body);
    reply.send({ data: updated });
  }
}
