import { describe, expect, it, vi } from "vitest";
import type { CampaignItemDefinition } from "@umbra/shared";
import { CampaignItemService } from "./CampaignItemService.js";

const definition: CampaignItemDefinition = {
  name: "Martillo del Alba", category: "weapon", stackable: true, description: "", weight: "", value: "",
  defaultQuantity: 4, defaultSlot: "mainHand", attackAttribute: "diestro", damageFormula: "1d10", protectionFormula: "",
  qualities: "Pesada", notes: "", grantedActions: [], modifiers: []
};

describe("CampaignItemService", () => {
  it("restricts creation to the campaign director and normalizes unique pieces", async () => {
    const model = {
      findCampaign: vi.fn().mockResolvedValue({ id: "campaign", gmId: "gm" }),
      ownerExists: vi.fn().mockResolvedValue(true),
      create: vi.fn().mockResolvedValue({
        id: "item", campaignId: "campaign", kind: "weapon", definition: { ...definition, stackable: false, defaultQuantity: 1 },
        isUnique: true, ownerCharacterId: "33333333-3333-4333-8333-333333333333", ownerNpcId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
        ownerCharacter: { character: { name: "Alda" } }, ownerNpc: null
      })
    };
    const service = new CampaignItemService(model as never);
    await expect(service.create("player", "player", "campaign", { definition, isUnique: true })).rejects.toThrow("Solo el DJ");
    const ownerId = "33333333-3333-4333-8333-333333333333";
    const created = await service.create("gm", "gm", "campaign", { definition, isUnique: true, ownerType: "character", ownerId });
    expect(created).toMatchObject({ isUnique: true, ownerName: "Alda" });
    expect(model.create).toHaveBeenCalledWith("campaign", expect.objectContaining({ stackable: false, defaultQuantity: 1 }), true, { type: "character", id: ownerId }, null, "gm");
  });

  it("validates transfers and delegates an exclusive owner assignment", async () => {
    const ownerId = "33333333-3333-4333-8333-333333333333";
    const row = {
      id: "item", campaignId: "campaign", kind: "weapon", definition: { ...definition, stackable: false, defaultQuantity: 1 },
      isUnique: true, ownerCharacterId: null, ownerNpcId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
      ownerCharacter: null, ownerNpc: null
    };
    const model = {
      findById: vi.fn().mockResolvedValue(row),
      findCampaign: vi.fn().mockResolvedValue({ id: "campaign", gmId: "gm" }),
      ownerExists: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      assign: vi.fn().mockResolvedValue({
        ...row,
        ownerNpcId: ownerId,
        ownerNpc: { name: "Capitán de la guardia" }
      })
    };
    const service = new CampaignItemService(model as never);

    await expect(service.assign("gm", "gm", "item", { ownerType: "npc", ownerId })).rejects.toThrow("no pertenece");
    const assigned = await service.assign("gm", "gm", "item", { ownerType: "npc", ownerId });
    expect(model.assign).toHaveBeenCalledWith("item", { type: "npc", id: ownerId }, "gm");
    expect(assigned).toMatchObject({ ownerType: "npc", ownerId, ownerName: "Capitán de la guardia" });
  });

  it("does not assign reusable or archived templates", async () => {
    const base = {
      id: "item", campaignId: "campaign", kind: "weapon", definition, isUnique: false,
      ownerCharacterId: null, ownerNpcId: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(),
      ownerCharacter: null, ownerNpc: null
    };
    const model = {
      findById: vi.fn().mockResolvedValue(base),
      findCampaign: vi.fn().mockResolvedValue({ id: "campaign", gmId: "gm" })
    };
    const service = new CampaignItemService(model as never);
    await expect(service.assign("gm", "gm", "item", { ownerType: null, ownerId: null })).rejects.toThrow("piezas");

    model.findById.mockResolvedValue({ ...base, isUnique: true, archivedAt: new Date() });
    await expect(service.assign("gm", "gm", "item", { ownerType: null, ownerId: null })).rejects.toThrow("Restaura");
  });
});
