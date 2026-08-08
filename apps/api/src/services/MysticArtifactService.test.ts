import { describe, expect, it, vi } from "vitest";
import { MysticArtifactService } from "./MysticArtifactService.js";

describe("MysticArtifactService permissions and ownership", () => {
  it("keeps the preset catalog restricted to directors", async () => {
    const model = { listPresets: vi.fn() };
    await expect(new MysticArtifactService(model as never).listPresets("player")).rejects.toMatchObject({ code: "CAMPAIGN_FORBIDDEN" });
    expect(model.listPresets).not.toHaveBeenCalled();
  });

  it("keeps PDF source files restricted to directors", async () => {
    const model = { findById: vi.fn() };
    await expect(new MysticArtifactService(model as never).getSource("player-a", "player", "artifact-a"))
      .rejects.toMatchObject({ code: "CAMPAIGN_FORBIDDEN" });
    expect(model.findById).not.toHaveBeenCalled();
  });

  it("rejects an empty foreign campaign instead of leaking an apparently valid result", async () => {
    const model = {
      findCampaign: vi.fn().mockResolvedValue({ id: "campaign-b", gmId: "gm-b" }),
      listCampaign: vi.fn()
    };
    await expect(new MysticArtifactService(model as never).listCampaignArtifacts("gm-a", "gm", "campaign-b"))
      .rejects.toMatchObject({ code: "CAMPAIGN_FORBIDDEN" });
    expect(model.listCampaign).not.toHaveBeenCalled();
  });

  it("blocks transfer while an active binding exists", async () => {
    const model = {
      findById: vi.fn().mockResolvedValue({
        id: "artifact-a", scope: "campaign", campaignId: "campaign-a", campaign: { gmId: "gm-a" },
        ownerCharacterId: "link-a", ownerNpcId: null, bindings: [{ id: "binding-a" }]
      }),
      assign: vi.fn()
    };
    await expect(new MysticArtifactService(model as never).assignOwner("gm-a", "gm", "artifact-a", { ownerType: "none" }))
      .rejects.toMatchObject({ code: "ARTIFACT_BOUND" });
    expect(model.assign).not.toHaveBeenCalled();
  });
});
