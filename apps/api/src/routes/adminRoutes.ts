import type { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/AdminController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin.js";
import { AdminService } from "../services/AdminService.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const service = new AdminService();
  const controller = new AdminController(service);

  app.get("/users", { preHandler: [requireAuth, requireSuperAdmin] }, controller.listUsers.bind(controller));
  app.post<{ Params: { userId: string } }>("/users/:userId/revoke-sessions", { preHandler: [requireAuth, requireSuperAdmin] }, async (request, reply) =>
    controller.revokeSessions(request, reply)
  );
}
