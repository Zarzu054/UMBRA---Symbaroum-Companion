import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet, type CampaignItemDefinition } from "@umbra/shared";
import { protectCampaignItemInventory } from "./campaignItemInventoryPolicy.js";
import type { CampaignItemRow } from "../models/CampaignItemModel.js";

const definition: CampaignItemDefinition = {
  name: "Espada de Alda",
  category: "weapon",
  stackable: false,
  description: "Una pieza de campaña.",
  weight: "1",
  value: "20 táleros",
  defaultQuantity: 1,
  defaultSlot: "mainHand",
  attackAttribute: "diestro",
  damageFormula: "1d10",
  protectionFormula: "",
  qualities: "Precisa",
  notes: "",
  grantedActions: [],
  modifiers: []
};

function row(overrides: Record<string, unknown> = {}): CampaignItemRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    campaignId: "22222222-2222-4222-8222-222222222222",
    kind: "weapon",
    definition,
    isUnique: false,
    ownerCharacterId: null,
    ownerNpcId: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerCharacter: null,
    ownerNpc: null,
    ...overrides
  } as CampaignItemRow;
}

describe("campaign item inventory policy", () => {
  it("restores the campaign definition while preserving instance state", () => {
    const current = createEmptyCharacterSheet();
    current.inventoryItems.push({
      id: "copy", name: definition.name, category: "weapon", quantity: 2, stackable: false, isCustom: true,
      description: definition.description, weight: "", value: "", equipped: true, slot: "mainHand", attackAttribute: "diestro",
      damageFormula: "1d10", protectionFormula: "", qualities: "Precisa", notes: "", grantedActions: [], modifiers: [],
      campaignItemId: "11111111-1111-4111-8111-111111111111"
    });
    const requested = structuredClone(current);
    requested.inventoryItems[0].name = "Objeto manipulado";
    const result = protectCampaignItemInventory(current, requested, [row()], "link-a");
    expect(result.inventoryItems[0]).toMatchObject({ name: "Espada de Alda", quantity: 2, equipped: true });
  });

  it("keeps a unique piece only for its authoritative owner", () => {
    const current = createEmptyCharacterSheet();
    const requested = createEmptyCharacterSheet();
    const template = row({ isUnique: true, ownerCharacterId: "link-a" });
    const ownerResult = protectCampaignItemInventory(current, requested, [template], "link-a");
    expect(ownerResult.inventoryItems).toHaveLength(1);
    expect(ownerResult.inventoryItems[0]).toMatchObject({ campaignItemId: template.id, quantity: 1 });
    const otherResult = protectCampaignItemInventory(ownerResult, ownerResult, [template], "link-b");
    expect(otherResult.inventoryItems).toHaveLength(0);
  });

  it("rejects custom definitions created by a player payload", () => {
    const current = createEmptyCharacterSheet();
    const requested = createEmptyCharacterSheet();
    requested.inventoryItems.push({
      id: "forged", name: "Forjado", category: "gear", quantity: 1, stackable: false, isCustom: true,
      description: "", weight: "", value: "", equipped: false, slot: "none", damageFormula: "", protectionFormula: "",
      qualities: "", notes: "", grantedActions: [], modifiers: []
    });
    expect(() => protectCampaignItemInventory(current, requested, [], "link-a")).toThrow("Solo el DJ");
  });

  it("preserves official definitions and requires catalog provenance for additions", () => {
    const current = createEmptyCharacterSheet();
    current.inventoryItems.push({
      id: "official-existing", name: "Espada", category: "weapon", quantity: 1, stackable: false, isCustom: false,
      description: "Oficial", weight: "1", value: "", equipped: false, slot: "none", damageFormula: "1d8",
      protectionFormula: "", qualities: "", notes: "", grantedActions: [], modifiers: [], officialTemplateId: "weapon-single-handed"
    });
    const requested = structuredClone(current);
    requested.inventoryItems[0] = {
      ...requested.inventoryItems[0], name: "Espada falsificada", damageFormula: "99d20", equipped: true, slot: "mainHand"
    };

    expect(protectCampaignItemInventory(current, requested, [], "link-a").inventoryItems[0]).toMatchObject({
      name: "Arma de una mano", damageFormula: "1d8", equipped: true, slot: "mainHand"
    });

    const forged = structuredClone(current);
    forged.inventoryItems.push({
      id: "official-forged", name: "Falso", category: "weapon", quantity: 1, stackable: false, isCustom: false,
      description: "", weight: "", value: "", equipped: false, slot: "none", damageFormula: "99d20",
      protectionFormula: "", qualities: "", notes: "", grantedActions: [], modifiers: []
    });
    expect(() => protectCampaignItemInventory(current, forged, [], "link-a")).toThrow("catálogo oficial");

    const catalogued = structuredClone(current);
    catalogued.inventoryItems.push({
      id: "official-new", name: "Arco", category: "weapon", quantity: 1, stackable: false, isCustom: false,
      description: "", weight: "", value: "", equipped: false, slot: "none", damageFormula: "1d8",
      protectionFormula: "", qualities: "", notes: "", grantedActions: [], modifiers: [], officialTemplateId: "weapon-ranged"
    });
    expect(protectCampaignItemInventory(current, catalogued, [], "link-a").inventoryItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "official-new", name: "Arma a distancia", officialTemplateId: "weapon-ranged" })
    ]));
  });
});
