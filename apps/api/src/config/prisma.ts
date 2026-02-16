import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function verifyDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}