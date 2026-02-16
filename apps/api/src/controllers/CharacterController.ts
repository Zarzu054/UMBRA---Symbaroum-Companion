import type { FastifyReply, FastifyRequest } from "fastify";
import { CharacterService } from "../services/CharacterService.js";

const DEV_OWNER_ID = "00000000-0000-0000-0000-000000000001";

type CreateCharacterBody = {
  name: string;
  archetype: string;
  race: string;
  level: number;
};

export class CharacterController {
  constructor(private readonly service: CharacterService) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const characters = await this.service.listCharacters(DEV_OWNER_ID);
    reply.send({ data: characters });
  }

  async create(request: FastifyRequest<{ Body: CreateCharacterBody }>, reply: FastifyReply): Promise<void> {
    const created = await this.service.createCharacter(DEV_OWNER_ID, request.body);
    reply.code(201).send({ data: created });
  }
}