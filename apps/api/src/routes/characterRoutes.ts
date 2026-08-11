import type { FastifyInstance } from "fastify";
import type { CreateCharacterInput, ImportCharacterInput, UpdateCharacterInput } from "@umbra/shared";
import { CharacterController } from "../controllers/CharacterController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { CharacterModel } from "../models/CharacterModel.js";
import { CharacterService } from "../services/CharacterService.js";
import { ProfessionController } from "../controllers/ProfessionController.js";

export async function characterRoutes(app: FastifyInstance): Promise<void> {
  const model = new CharacterModel();
  const service = new CharacterService(model);
  const controller = new CharacterController(service);
  const professionController = new ProfessionController();

  app.get("/characters", { preHandler: [requireAuth, requirePasswordChangeComplete] }, controller.list.bind(controller));
  app.get<{ Params: { characterId: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/characters/:characterId/change-log",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.changeLog(request, reply)
  );
  app.post<{ Params: { characterId: string } }>(
    "/characters/:characterId/change-log/read",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.markChangeLogRead(request, reply)
  );
  app.post<{ Body: CreateCharacterInput }>("/characters", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.create(request, reply)
  );
  app.post<{ Body: ImportCharacterInput }>("/characters/import", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.import(request, reply)
  );
  app.put<{ Params: { characterId: string }; Body: UpdateCharacterInput }>(
    "/characters/:characterId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.update(request, reply)
  );
  app.post<{ Params: { characterId: string } }>(
    "/characters/:characterId/duplicate",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.duplicate(request, reply)
  );
  app.delete<{ Params: { characterId: string } }>(
    "/characters/:characterId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.remove(request, reply)
  );
  app.post<{ Params: { characterId: string; professionId: string } }>("/characters/:characterId/professions/:professionId/aspiration", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) => professionController.aspire(request, reply));
  app.delete<{ Params: { characterId: string; professionId: string } }>("/characters/:characterId/professions/:professionId/aspiration", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) => professionController.removeAspiration(request, reply));
  app.post<{ Params: { characterId: string; professionId: string } }>("/characters/:characterId/professions/:professionId/request", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) => professionController.requestMembership(request, reply));
  app.delete<{ Params: { characterId: string; professionId: string } }>("/characters/:characterId/professions/:professionId", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) => professionController.leave(request, reply));
}
