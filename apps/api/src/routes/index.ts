import type { FastifyInstance } from "fastify";
import { adminRoutes } from "./adminRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { campaignRoutes } from "./campaignRoutes.js";
import { characterRoutes } from "./characterRoutes.js";
import { compendiumRoutes } from "./compendiumRoutes.js";
import { monsterRoutes } from "./monsterRoutes.js";
import { npcRoutes } from "./npcRoutes.js";
import { mysticArtifactRoutes } from "./mysticArtifactRoutes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(characterRoutes, { prefix: "/api" });
  await app.register(compendiumRoutes, { prefix: "/api" });
  await app.register(monsterRoutes, { prefix: "/api" });
  await app.register(npcRoutes, { prefix: "/api" });
  await app.register(campaignRoutes, { prefix: "/api" });
  await app.register(mysticArtifactRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/admin" });
}
