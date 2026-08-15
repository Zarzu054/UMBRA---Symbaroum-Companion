import { randomUUID } from "node:crypto";
import type { CampaignItemDefinition, CharacterSheet } from "@umbra/shared";

type InventoryItem = CharacterSheet["inventoryItems"][number];

export function campaignItemKindForDefinition(definition: CampaignItemDefinition): "weapon" | "armor" | "item" {
  if (definition.category === "weapon") return "weapon";
  if (definition.category === "armor") return "armor";
  return "item";
}

export function applyCampaignItemDefinition(
  item: InventoryItem,
  campaignItemId: string,
  definition: CampaignItemDefinition,
  isUnique: boolean
): InventoryItem {
  return {
    ...item,
    name: definition.name,
    category: definition.category,
    quantity: isUnique ? 1 : Math.max(0, item.quantity),
    stackable: isUnique ? false : definition.stackable,
    isCustom: true,
    description: definition.description,
    weight: definition.weight,
    value: definition.value,
    attackAttribute: definition.attackAttribute,
    damageFormula: definition.damageFormula,
    protectionFormula: definition.protectionFormula,
    qualities: definition.qualities,
    notes: definition.notes,
    grantedActions: definition.grantedActions,
    modifiers: definition.modifiers,
    campaignItemId,
    officialTemplateId: undefined
  };
}

export function createCampaignInventoryItem(
  campaignItemId: string,
  definition: CampaignItemDefinition,
  isUnique: boolean
): InventoryItem {
  return applyCampaignItemDefinition({
    id: `campaign-item-${randomUUID()}`,
    name: definition.name,
    category: definition.category,
    quantity: isUnique ? 1 : definition.defaultQuantity,
    stackable: isUnique ? false : definition.stackable,
    isCustom: true,
    description: definition.description,
    weight: definition.weight,
    value: definition.value,
    equipped: false,
    slot: definition.defaultSlot,
    attackAttribute: definition.attackAttribute,
    damageFormula: definition.damageFormula,
    protectionFormula: definition.protectionFormula,
    qualities: definition.qualities,
    notes: definition.notes,
    grantedActions: definition.grantedActions,
    modifiers: definition.modifiers,
    campaignItemId
  }, campaignItemId, definition, isUnique);
}

export function removeCampaignInventoryItems(sheet: CharacterSheet, campaignItemIds: Set<string>): CharacterSheet {
  const removedIds = new Set(sheet.inventoryItems
    .filter((item) => item.campaignItemId && campaignItemIds.has(item.campaignItemId))
    .map((item) => item.id));
  if (removedIds.size === 0) return sheet;
  return {
    ...sheet,
    inventoryItems: sheet.inventoryItems.filter((item) => !removedIds.has(item.id)),
    equipmentSlots: Object.fromEntries(Object.entries(sheet.equipmentSlots).map(([slot, itemId]) => (
      [slot, removedIds.has(itemId) ? "" : itemId]
    ))) as CharacterSheet["equipmentSlots"]
  };
}

export function upsertCampaignInventoryItem(
  sheet: CharacterSheet,
  campaignItemId: string,
  definition: CampaignItemDefinition,
  isUnique: boolean
): CharacterSheet {
  let found = false;
  const inventoryItems = sheet.inventoryItems.flatMap((item) => {
    if (item.campaignItemId !== campaignItemId) return [item];
    if (isUnique && found) return [];
    found = true;
    return [applyCampaignItemDefinition(item, campaignItemId, definition, isUnique)];
  });
  if (!found) inventoryItems.push(createCampaignInventoryItem(campaignItemId, definition, isUnique));
  return { ...sheet, inventoryItems };
}

