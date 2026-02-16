import type { FastifyReply, FastifyRequest } from "fastify";
import { CharacterService } from "../services/CharacterService.js";

type CreateCharacterBody = {
  name: string;
  archetype: string;
  race: string;
  level: number;
};

export class CharacterController {
  constructor(private readonly service: CharacterService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const characters = await this.service.listCharacters(ownerId);
    reply.send({ data: characters });
  }

  async create(request: FastifyRequest<{ Body: CreateCharacterBody }>, reply: FastifyReply): Promise<void> {
    const ownerId = request.authUser!.id;
    const created = await this.service.createCharacter(ownerId, request.body);
    reply.code(201).send({ data: created });
  }
}