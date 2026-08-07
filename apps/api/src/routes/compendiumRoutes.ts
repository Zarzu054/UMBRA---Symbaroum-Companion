import type { FastifyInstance } from "fastify";
import type { SetCompendiumFavoriteInput } from "@umbra/shared";
import { CompendiumController } from "../controllers/CompendiumController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { CompendiumModel } from "../models/CompendiumModel.js";
import { CompendiumService } from "../services/CompendiumService.js";

type EntryParams = { entryId: string };

export async function compendiumRoutes(app: FastifyInstance): Promise<void> {
  const controller = new CompendiumController(new CompendiumService(new CompendiumModel()));
  const preHandler = [requireAuth, requirePasswordChangeComplete];

  app.get("/compendium/library", { preHandler }, controller.getLibrary.bind(controller));
  app.put<{ Params: EntryParams; Body: SetCompendiumFavoriteInput }>(
    "/compendium/library/:entryId/favorite",
    { preHandler },
    async (request, reply) => controller.setFavorite(request, reply)
  );
  app.post<{ Params: EntryParams }>(
    "/compendium/library/:entryId/view",
    { preHandler },
    async (request, reply) => controller.recordView(request, reply)
  );
}
