import { importAllLegacyCampaignItems } from "../src/utils/legacyCampaignItemImport.js";
import { prisma } from "../src/config/prisma.js";

try {
  const result = await importAllLegacyCampaignItems();
  console.log(`[import-campaign-items] Personajes actualizados: ${result.characters}; plantillas creadas: ${result.templates}.`);
} finally {
  await prisma.$disconnect();
}
