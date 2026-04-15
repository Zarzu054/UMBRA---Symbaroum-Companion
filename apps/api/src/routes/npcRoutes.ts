import type { FastifyInstance } from "fastify";
import type { CreateNpcInput, UpdateNpcInput } from "@umbra/shared";
import { NpcController } from "../controllers/NpcController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { NpcModel } from "../models/NpcModel.js";
import { NpcService } from "../services/NpcService.js";

export async function npcRoutes(app: FastifyInstance): Promise<void> {
  const model = new NpcModel();
  const service = new NpcService(model);
  const controller = new NpcController(service);

  app.get("/npcs", { preHandler: [requireAuth, requirePasswordChangeComplete] }, controller.list.bind(controller));
  app.post<{ Body: CreateNpcInput }>("/npcs", { preHandler: [requireAuth, requirePasswordChangeComplete] }, async (request, reply) =>
    controller.create(request, reply)
  );
  app.put<{ Params: { npcId: string }; Body: UpdateNpcInput }>(
    "/npcs/:npcId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.update(request, reply)
  );
  app.delete<{ Params: { npcId: string } }>(
    "/npcs/:npcId",
    { preHandler: [requireAuth, requirePasswordChangeComplete] },
    async (request, reply) => controller.remove(request, reply)
  );
}
