import dotenv from "dotenv";
import argon2 from "argon2";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const seedDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(seedDir, "../../.env") });
dotenv.config();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const DEFAULT_MVP_PASSWORD = process.env.MVP_SEED_PASSWORD ?? "UmbraStart123!";
const RESET_SEEDED_PASSWORDS = process.env.RESET_SEEDED_PASSWORDS === "true";

async function upsertUser(
  email: string,
  password: string,
  role: "player" | "gm" | "superadmin",
  mustChangePassword = false
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existing) {
    if (RESET_SEEDED_PASSWORDS) {
      const passwordHash = await argon2.hash(password);
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: {
          passwordHash,
          role,
          mustChangePassword
        }
      });
      return;
    }

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        role
      }
    });
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role,
      mustChangePassword
    }
  });
}

async function main(): Promise<void> {
  await upsertUser("aliciagarciamanzano16@gmail.com", DEFAULT_MVP_PASSWORD, "player", true);
  await upsertUser("carloszarzuelar@gmail.com", DEFAULT_MVP_PASSWORD, "player", true);
  await upsertUser("pabpinbae@gmail.com", DEFAULT_MVP_PASSWORD, "player", true);
  await upsertUser("hugo.villasan.gt@gmail.com", DEFAULT_MVP_PASSWORD, "gm", true);

  if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
    await upsertUser(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
