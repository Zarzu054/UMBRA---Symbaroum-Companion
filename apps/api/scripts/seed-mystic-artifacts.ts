import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedMysticArtifactPresets } from "../prisma/mysticArtifactPresets.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(scriptDir, "../../../.env") });
dotenv.config();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  await seedMysticArtifactPresets(prisma);
} finally {
  await prisma.$disconnect();
}

