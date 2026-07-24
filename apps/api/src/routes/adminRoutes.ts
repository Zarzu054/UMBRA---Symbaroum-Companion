import type { FastifyInstance } from "fastify";
import type { CreateManagedUserInput, DeactivateManagedUserInput } from "@umbra/shared";
import { AdminController } from "../controllers/AdminController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin.js";
import { AdminService } from "../services/AdminService.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const service = new AdminService();
  const controller = new AdminController(service);
  const guards = [requireAuth, requirePasswordChangeComplete, requireSuperAdmin];

  app.get("/users", { preHandler: guards }, controller.listUsers.bind(controller));
  app.post<{ Body: CreateManagedUserInput }>(
    "/users",
    { preHandler: guards },
    async (request, reply) => controller.createUser(request, reply)
  );
  app.post<{ Params: { userId: string }; Body: DeactivateManagedUserInput }>(
    "/users/:userId/deactivate",
    { preHandler: guards },
    async (request, reply) => controller.deactivateUser(request, reply)
  );
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/reactivate",
    { preHandler: guards },
    async (request, reply) => controller.reactivateUser(request, reply)
  );
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/revoke-sessions",
    { preHandler: guards },
    async (request, reply) => controller.revokeSessions(request, reply)
  );
  app.get<{ Params: { userId: string } }>(
    "/users/:userId/events",
    { preHandler: guards },
    async (request, reply) => controller.listUserEvents(request, reply)
  );
  app.post<{ Params: { userId: string; eventId: string } }>(
    "/users/:userId/events/:eventId/retry-email",
    { preHandler: guards },
    async (request, reply) => controller.retryEventEmail(request, reply)
  );
}
