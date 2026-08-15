import { describe, expect, it, vi } from "vitest";
import { createCustomInventoryItem, createEmptyCharacterSheet, createInventoryItemFromTemplate, ITEM_CATALOG } from "@umbra/shared";
import { importLegacyCampaignItemsForCharacter } from "./legacyCampaignItemImport.js";

describe("legacy campaign item import", () => {
  it("deduplicates identical custom definitions and is idempotent", async () => {
    const sheet = createEmptyCharacterSheet();
    const first = { ...createCustomInventoryItem("weapon"), id: "custom-a", name: "Hoja del Alba", damageFormula: "1d10" };
    const second = { ...first, id: "custom-b", quantity: 2 };
    sheet.inventoryItems.push(first, second);
    let storedSheet = sheet;
    const create = vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    const update = vi.fn().mockImplementation(({ data }) => { storedSheet = data.sheet; });
    const tx = {
      character: { findUnique: vi.fn().mockImplementation(() => ({ sheet: storedSheet })), update },
      campaignItemTemplate: { findMany: vi.fn().mockResolvedValue([]), create }
    };

    expect(await importLegacyCampaignItemsForCharacter(tx as never, "campaign", "character")).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(storedSheet.inventoryItems.map((item) => item.campaignItemId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111"
    ]);

    create.mockClear();
    update.mockClear();
    expect(await importLegacyCampaignItemsForCharacter(tx as never, "campaign", "character")).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("tags an exact official match instead of creating a campaign template", async () => {
    const template = ITEM_CATALOG.find((entry) => entry.templateId === "weapon-single-handed")!;
    const official = createInventoryItemFromTemplate(template);
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems.push({ ...official, isCustom: true, officialTemplateId: undefined });
    let storedSheet = sheet;
    const create = vi.fn();
    const tx = {
      character: {
        findUnique: vi.fn().mockResolvedValue({ sheet }),
        update: vi.fn().mockImplementation(({ data }) => { storedSheet = data.sheet; })
      },
      campaignItemTemplate: { findMany: vi.fn().mockResolvedValue([]), create }
    };

    expect(await importLegacyCampaignItemsForCharacter(tx as never, "campaign", "character")).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(storedSheet.inventoryItems[0]).toMatchObject({
      isCustom: false,
      officialTemplateId: "weapon-single-handed"
    });
  });
});
