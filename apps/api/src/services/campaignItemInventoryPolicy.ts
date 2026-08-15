import { campaignItemDefinitionSchema, ITEM_CATALOG, type CharacterSheet, type ItemTemplate } from "@umbra/shared";
import type { CampaignItemRow } from "../models/CampaignItemModel.js";
import { AppError } from "../utils/AppError.js";
import { applyCampaignItemDefinition, createCampaignInventoryItem } from "../utils/campaignItemInventory.js";

const officialTemplatesById = new Map(ITEM_CATALOG.map((template) => [template.templateId, template]));

function applyOfficialDefinition(
  item: CharacterSheet["inventoryItems"][number],
  template: ItemTemplate
): CharacterSheet["inventoryItems"][number] {
  return {
    ...item,
    name: template.name,
    category: template.category,
    stackable: template.stackable,
    isCustom: false,
    description: template.description,
    weight: template.weight,
    value: template.value,
    attackAttribute: template.attackAttribute,
    damageFormula: template.damageFormula,
    protectionFormula: template.protectionFormula,
    qualities: template.qualities,
    notes: template.notes,
    grantedActions: template.grantedActions,
    modifiers: template.modifiers,
    officialTemplateId: template.templateId,
    campaignItemId: undefined
  };
}

export function protectCampaignItemInventory(
  current: CharacterSheet,
  requested: CharacterSheet,
  templates: CampaignItemRow[],
  ownerId: string,
  ownerType: "character" | "npc" = "character"
): CharacterSheet {
  const templatesById = new Map(templates.map((entry) => [entry.id, entry]));
  const currentById = new Map(current.inventoryItems.map((item) => [item.id, item]));
  const seenUnique = new Set<string>();
  const inventoryItems = requested.inventoryItems.flatMap((item) => {
    if (item.managedArtifactId) return [item];
    if (item.campaignItemId) {
      const template = templatesById.get(item.campaignItemId);
      if (!template) return [];
      const wasPresent = currentById.get(item.id)?.campaignItemId === template.id;
      if (template.archivedAt && !wasPresent) {
        throw new AppError("CAMPAIGN_ITEM_ARCHIVED", "Este objeto de campaña ya no está disponible", 409);
      }
      if (template.isUnique) {
        const isOwner = ownerType === "character" ? template.ownerCharacterId === ownerId : template.ownerNpcId === ownerId;
        if (!isOwner || seenUnique.has(template.id)) return [];
        seenUnique.add(template.id);
      }
      return [applyCampaignItemDefinition(item, template.id, campaignItemDefinitionSchema.parse(template.definition), template.isUnique)];
    }
    if (item.isCustom) {
      const previous = currentById.get(item.id);
      if (!previous?.isCustom || previous.campaignItemId) {
        throw new AppError("CAMPAIGN_ITEM_CUSTOM_FORBIDDEN", "Solo el DJ puede crear objetos personalizados", 403);
      }
      return [{
        ...previous,
        quantity: item.quantity,
        equipped: item.equipped,
        slot: item.slot
      }];
    }
    const previous = currentById.get(item.id);
    if (previous && !previous.isCustom && !previous.campaignItemId) {
      const officialTemplateId = previous.officialTemplateId ?? item.officialTemplateId;
      const officialTemplate = officialTemplateId ? officialTemplatesById.get(officialTemplateId) : undefined;
      if (officialTemplate) {
        return [applyOfficialDefinition({
          ...previous,
          quantity: item.quantity,
          equipped: item.equipped,
          slot: item.slot
        }, officialTemplate)];
      }
      return [{
        ...previous,
        quantity: item.quantity,
        equipped: item.equipped,
        slot: item.slot
      }];
    }
    if (!previous && !item.officialTemplateId) {
      throw new AppError("OFFICIAL_ITEM_TEMPLATE_REQUIRED", "El objeto no pertenece al catálogo oficial", 403);
    }
    const officialTemplate = item.officialTemplateId ? officialTemplatesById.get(item.officialTemplateId) : undefined;
    if (!officialTemplate) {
      throw new AppError("OFFICIAL_ITEM_TEMPLATE_INVALID", "El objeto no pertenece al catálogo oficial", 403);
    }
    return [applyOfficialDefinition(item, officialTemplate)];
  });

  for (const template of templates) {
    const isOwner = ownerType === "character" ? template.ownerCharacterId === ownerId : template.ownerNpcId === ownerId;
    if (!template.isUnique || !isOwner || seenUnique.has(template.id)) continue;
    const definition = campaignItemDefinitionSchema.parse(template.definition);
    const previous = current.inventoryItems.find((item) => item.campaignItemId === template.id);
    inventoryItems.push(previous
      ? applyCampaignItemDefinition(previous, template.id, definition, true)
      : createCampaignInventoryItem(template.id, definition, true));
  }

  const validIds = new Set(inventoryItems.map((item) => item.id));
  return {
    ...requested,
    inventoryItems,
    equipmentSlots: Object.fromEntries(Object.entries(requested.equipmentSlots).map(([slot, itemId]) => (
      [slot, itemId && validIds.has(itemId) ? itemId : ""]
    ))) as CharacterSheet["equipmentSlots"]
  };
}
