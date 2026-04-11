import type { FastifyInstance } from "fastify";
import type { CreateMonsterInput, UpdateMonsterInput } from "@umbra/shared";
import { MonsterController } from "../controllers/MonsterController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { MonsterModel } from "../models/MonsterModel.js";
import { MonsterService } from "../services/MonsterService.js";

export async function monsterRoutes(app: FastifyInstance): Promise<void> {
  const model = new MonsterModel();
  const service = new MonsterService(model);
  const controller = new MonsterController(service);

  app.get("/monsters/codex", { preHandler: [requireAuth, requirePasswordChangeComplete] }, controller.listCodex.bind(controller));
  app.get("/monsters", { preHandler: [requireAuth, requirePasswordChangeComplete] }, controller.listCustom.bind(controller));
  app.post<{ Body: CreateMonsterInput }>("/monsters", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.create(request, reply)
  );
  app.put<{ Params: { monsterId: string }; Body: UpdateMonsterInput }>(
    "/monsters/:monsterId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.update(request, reply)
  );
  app.delete<{ Params: { monsterId: string } }>(
    "/monsters/:monsterId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.remove(request, reply)
  );
}
