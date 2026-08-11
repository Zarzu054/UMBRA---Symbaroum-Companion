import { describe, expect, it, vi } from "vitest";
import { ProfessionService } from "./ProfessionService.js";

function membership(state = "aspiration") {
  return [{ id: "membership-1", professionId: "templario", state }];
}

describe("ProfessionService permissions and workflow", () => {
  it("allows the owner to create an aspiration and request membership", async () => {
    const model = {
      findCharacterAccess: vi.fn().mockResolvedValue({ ownerId: "owner", campaignLinks: [] }),
      setAspiration: vi.fn().mockResolvedValue(undefined),
      requestMembership: vi.fn().mockResolvedValue("active"),
      listForCharacter: vi.fn().mockResolvedValue(membership("active"))
    };
    const service = new ProfessionService(model as never);
    await expect(service.aspire("owner", "character", "templario")).resolves.toEqual(membership("active"));
    await expect(service.request("owner", "character", "templario")).resolves.toEqual(membership("active"));
    expect(model.setAspiration).toHaveBeenCalledWith("character", "templario", "owner");
    expect(model.requestMembership).toHaveBeenCalledWith("character", "templario", "owner");
  });

  it("rejects profession management by an unrelated user", async () => {
    const model = { findCharacterAccess: vi.fn().mockResolvedValue({ ownerId: "owner", campaignLinks: [] }) };
    await expect(new ProfessionService(model as never).aspire("stranger", "character", "templario"))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows only the current campaign GM to approve a pending request", async () => {
    const model = {
      findCharacterAccess: vi.fn().mockResolvedValue({
        ownerId: "owner",
        campaignLinks: [{ campaignId: "campaign", campaign: { id: "campaign", gmId: "gm" } }]
      }),
      findRequestCharacterId: vi.fn().mockResolvedValue("character"),
      decide: vi.fn().mockResolvedValue("character"),
      listForCharacter: vi.fn().mockResolvedValue(membership("active"))
    };
    const service = new ProfessionService(model as never);
    await expect(service.decide("gm", "gm", "campaign", "request", { decision: "approve", note: "" }))
      .resolves.toEqual(membership("active"));
    await expect(service.decide("other-gm", "gm", "campaign", "request", { decision: "approve", note: "" }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
