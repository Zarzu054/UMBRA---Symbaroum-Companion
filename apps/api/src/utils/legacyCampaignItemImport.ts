import { Prisma } from "@prisma/client";
import {
  campaignItemDefinitionSchema,
  ITEM_CATALOG,
  parseCharacterSheet,
  type CampaignItemDefinition,
  type CharacterSheet,
  type ItemTemplate
} from "@umbra/shared";
import { campaignItemKindForDefinition } from "./campaignItemInventory.js";

type Transaction = Prisma.TransactionClient;

function definitionFromInventoryItem(item: CharacterSheet["inventoryItems"][number]): CampaignItemDefinition {
  return campaignItemDefinitionSchema.parse({
    name: item.name,
    category: item.category,
    stackable: item.stackable,
    description: item.description,
    weight: item.weight,
    value: item.value,
    defaultQuantity: 1,
    defaultSlot: item.slot,
    attackAttribute: item.attackAttribute,
    damageFormula: item.damageFormula,
    protectionFormula: item.protectionFormula,
    qualities: item.qualities,
    notes: item.notes,
    grantedActions: item.grantedActions,
    modifiers: item.modifiers
  });
}

function fingerprint(definition: CampaignItemDefinition): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)]));
    }
    return value;
  };
  return JSON.stringify(stable({ ...definition, defaultQuantity: 1 }));
}

function officialFingerprint(definition: CampaignItemDefinition): string {
  return fingerprint({ ...definition, defaultSlot: "none" });
}

function definitionFromOfficialTemplate(template: ItemTemplate): CampaignItemDefinition {
  return campaignItemDefinitionSchema.parse({
    name: template.name,
    category: template.category,
    stackable: template.stackable,
    description: template.description,
    weight: template.weight,
    value: template.value,
    defaultQuantity: 1,
    defaultSlot: template.slot,
    attackAttribute: template.attackAttribute,
    damageFormula: template.damageFormula,
    protectionFormula: template.protectionFormula,
    qualities: template.qualities,
    notes: template.notes,
    grantedActions: template.grantedActions,
    modifiers: template.modifiers
  });
}

const officialTemplateByFingerprint = new Map(ITEM_CATALOG.map((template) => [
  officialFingerprint(definitionFromOfficialTemplate(template)),
  template.templateId
]));

export async function importLegacyCampaignItemsForCharacter(
  tx: Transaction,
  campaignId: string,
  characterId: string
): Promise<number> {
  const character = await tx.character.findUnique({ where: { id: characterId }, select: { sheet: true } });
  if (!character) return 0;
  const sheet = parseCharacterSheet(character.sheet);
  const legacyItems = sheet.inventoryItems.filter((item) => !item.campaignItemId && !item.managedArtifactId && !item.officialTemplateId);
  if (legacyItems.length === 0) return 0;

  const existing = await tx.campaignItemTemplate.findMany({ where: { campaignId, isUnique: false, archivedAt: null } });
  const byFingerprint = new Map(existing.map((item) => [fingerprint(campaignItemDefinitionSchema.parse(item.definition)), item.id]));
  let created = 0;
  let changed = false;
  const inventoryItems = [...sheet.inventoryItems];
  for (const legacy of legacyItems) {
    const definition = definitionFromInventoryItem(legacy);
    const key = fingerprint(definition);
    const officialTemplateId = officialTemplateByFingerprint.get(officialFingerprint(definition));
    if (officialTemplateId) {
      const index = inventoryItems.findIndex((item) => item.id === legacy.id);
      if (index >= 0) inventoryItems[index] = {
        ...legacy,
        isCustom: false,
        officialTemplateId,
        campaignItemId: undefined
      };
      changed = true;
      continue;
    }
    if (!legacy.isCustom) continue;
    let templateId = byFingerprint.get(key);
    if (!templateId) {
      const template = await tx.campaignItemTemplate.create({ data: {
        campaignId,
        kind: campaignItemKindForDefinition(definition),
        definition: definition as unknown as Prisma.InputJsonValue,
        isUnique: false
      } });
      templateId = template.id;
      byFingerprint.set(key, templateId);
      created += 1;
    }
    const index = inventoryItems.findIndex((item) => item.id === legacy.id);
    if (index >= 0) {
      inventoryItems[index] = { ...legacy, campaignItemId: templateId };
      changed = true;
    }
  }
  if (changed) {
    await tx.character.update({
      where: { id: characterId },
      data: { sheet: { ...sheet, inventoryItems } as unknown as Prisma.InputJsonValue }
    });
  }
  return created;
}

export async function importAllLegacyCampaignItems(): Promise<{ characters: number; templates: number }> {
  const links = await (await import("../config/prisma.js")).prisma.campaignCharacter.findMany({ select: { campaignId: true, characterId: true } });
  let characters = 0;
  let templates = 0;
  const { prisma } = await import("../config/prisma.js");
  for (const link of links) {
    const count = await prisma.$transaction((tx) => importLegacyCampaignItemsForCharacter(tx, link.campaignId, link.characterId));
    if (count > 0) characters += 1;
    templates += count;
  }
  return { characters, templates };
}
