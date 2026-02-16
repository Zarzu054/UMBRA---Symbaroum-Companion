import type { FastifyInstance } from "fastify";
import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { characterRoutes } from "./characterRoutes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(characterRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/admin" });
}