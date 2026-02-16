import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = "dev-player@umbra.local";
  const passwordHash = await argon2.hash("ChangeMe123!");

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "player"
    },
    create: {
      email,
      passwordHash,
      role: "player"
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });