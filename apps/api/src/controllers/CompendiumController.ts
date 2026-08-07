import type { FastifyReply, FastifyRequest } from "fastify";
import type { SetCompendiumFavoriteInput } from "@umbra/shared";
import { CompendiumService } from "../services/CompendiumService.js";

type EntryParams = { entryId: string };

export class CompendiumController {
  constructor(private readonly service: CompendiumService) {}

  async getLibrary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const library = await this.service.getLibrary(request.authUser!.id);
    reply.send({ data: library });
  }

  async setFavorite(
    request: FastifyRequest<{ Params: EntryParams; Body: SetCompendiumFavoriteInput }>,
    reply: FastifyReply
  ): Promise<void> {
    await this.service.setFavorite(request.authUser!.id, request.params.entryId, request.body);
    reply.send({ data: { entryId: request.params.entryId, favorite: request.body.favorite } });
  }

  async recordView(request: FastifyRequest<{ Params: EntryParams }>, reply: FastifyReply): Promise<void> {
    await this.service.recordView(request.authUser!.id, request.params.entryId);
    reply.code(204).send();
  }
}
