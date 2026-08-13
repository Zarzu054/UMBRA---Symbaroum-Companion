import { Prisma, PrismaClient } from "@prisma/client";
import { parseCharacterSheet, synchronizeCharacterSheet, type CharacterSheet } from "@umbra/shared";

const prisma = new PrismaClient();

type RepairSummary = {
  checked: number;
  repaired: number;
  concurrent: number;
  invalid: number;
};

function normalizeSheet(raw: unknown): CharacterSheet {
  return synchronizeCharacterSheet(parseCharacterSheet(raw));
}

function asJson(sheet: CharacterSheet): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(sheet)) as Prisma.InputJsonValue;
}

function differs(raw: unknown, normalized: CharacterSheet): boolean {
  return JSON.stringify(raw) !== JSON.stringify(normalized);
}

async function repairCharacters(summary: RepairSummary): Promise<void> {
  const rows = await prisma.character.findMany({ select: { id: true, sheet: true, updatedAt: true } });
  for (const row of rows) {
    summary.checked += 1;
    try {
      const sheet = normalizeSheet(row.sheet);
      if (!differs(row.sheet, sheet)) continue;
      const result = await prisma.character.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { sheet: asJson(sheet) }
      });
      result.count === 1 ? summary.repaired += 1 : summary.concurrent += 1;
    } catch (error) {
      summary.invalid += 1;
      console.warn(`[repair-character-sheets] No se pudo reparar el PJ ${row.id}: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }
}

async function repairCampaignNpcs(summary: RepairSummary): Promise<void> {
  const rows = await prisma.campaignNpc.findMany({
    where: { sheet: { not: Prisma.DbNull } },
    select: { id: true, sheet: true, updatedAt: true }
  });
  for (const row of rows) {
    summary.checked += 1;
    try {
      const sheet = normalizeSheet(row.sheet);
      if (!differs(row.sheet, sheet)) continue;
      const result = await prisma.campaignNpc.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { sheet: asJson(sheet) }
      });
      result.count === 1 ? summary.repaired += 1 : summary.concurrent += 1;
    } catch (error) {
      summary.invalid += 1;
      console.warn(`[repair-character-sheets] No se pudo reparar el PNJ de campaña ${row.id}: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }
}

async function repairNpcs(summary: RepairSummary): Promise<void> {
  const rows = await prisma.npc.findMany({
    where: { sheet: { not: Prisma.DbNull } },
    select: { id: true, sheet: true, updatedAt: true }
  });
  for (const row of rows) {
    summary.checked += 1;
    try {
      const sheet = normalizeSheet(row.sheet);
      if (!differs(row.sheet, sheet)) continue;
      const result = await prisma.npc.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { sheet: asJson(sheet) }
      });
      result.count === 1 ? summary.repaired += 1 : summary.concurrent += 1;
    } catch (error) {
      summary.invalid += 1;
      console.warn(`[repair-character-sheets] No se pudo reparar el PNJ ${row.id}: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }
}

async function main(): Promise<void> {
  const summary: RepairSummary = { checked: 0, repaired: 0, concurrent: 0, invalid: 0 };
  await repairCharacters(summary);
  await repairCampaignNpcs(summary);
  await repairNpcs(summary);
  console.log(`[repair-character-sheets] Revisadas: ${summary.checked}; reparadas: ${summary.repaired}; omitidas por cambios concurrentes: ${summary.concurrent}; todavía inválidas: ${summary.invalid}.`);
}

main()
  .catch((error) => {
    console.error("[repair-character-sheets] La reparación no pudo completarse.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
