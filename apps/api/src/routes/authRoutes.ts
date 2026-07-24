import type { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/AuthController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { AuthService } from "../services/AuthService.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const service = new AuthService();
  const controller = new AuthController(service);

  app.post("/login", controller.login.bind(controller));
  app.post("/refresh", controller.refresh.bind(controller));
  app.post("/logout", controller.logout.bind(controller));
  app.post("/request-password-reset", controller.requestPasswordReset.bind(controller));
  app.post("/reset-password", controller.resetPassword.bind(controller));
  app.post("/change-password", { preHandler: [requireAuth] }, controller.changePassword.bind(controller));
  app.get("/me", { preHandler: [requireAuth] }, controller.me.bind(controller));
}
