import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_MVP_PASSWORD = process.env.MVP_SEED_PASSWORD ?? "UmbraStart123!";

async function upsertUser(
  email: string,
  password: string,
  role: "player" | "gm" | "superadmin",
  mustChangePassword = false
): Promise<void> {
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      passwordHash,
      role,
      mustChangePassword
    },
    create: {
      email: email.toLowerCase(),
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
