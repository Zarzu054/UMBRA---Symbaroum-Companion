import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser(email: string, password: string, role: "player" | "gm" | "superadmin"): Promise<void> {
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role
    },
    create: {
      email,
      passwordHash,
      role
    }
  });
}

async function main(): Promise<void> {
  await upsertUser("dev-player@umbra.local", "ChangeMe123!", "player");

  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? "superadmin@umbra.local";
  const superadminPassword = process.env.SUPERADMIN_PASSWORD ?? "SuperAdmin123!";

  await upsertUser(superadminEmail, superadminPassword, "superadmin");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });