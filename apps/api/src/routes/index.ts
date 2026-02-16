import type { FastifyInstance } from "fastify";
import { characterRoutes } from "./characterRoutes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));
  await app.register(characterRoutes, { prefix: "/api" });
}