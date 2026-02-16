import type { FastifyInstance } from "fastify";
import { CharacterController } from "../controllers/CharacterController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { CharacterModel } from "../models/CharacterModel.js";
import { CharacterService } from "../services/CharacterService.js";

export async function characterRoutes(app: FastifyInstance): Promise<void> {
  const model = new CharacterModel();
  const service = new CharacterService(model);
  const controller = new CharacterController(service);

  app.get("/characters", { preHandler: [requireAuth] }, controller.list.bind(controller));
  app.post<{ Body: { name: string; archetype: string; race: string; level: number } }>(
    "/characters",
    { preHandler: [requireAuth] },
    async (request, reply) => controller.create(request, reply)
  );
}
