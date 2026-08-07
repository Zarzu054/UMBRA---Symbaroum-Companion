import { describe, expect, it, vi } from "vitest";

const middlewareMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requirePasswordChangeComplete: vi.fn()
}));

vi.mock("../middleware/requireAuth.js", () => ({ requireAuth: middlewareMocks.requireAuth }));
vi.mock("../middleware/requirePasswordChangeComplete.js", () => ({
  requirePasswordChangeComplete: middlewareMocks.requirePasswordChangeComplete
}));
vi.mock("../models/CompendiumModel.js", () => ({ CompendiumModel: class {} }));

import { requireAuth } from "../middleware/requireAuth.js";
import { requirePasswordChangeComplete } from "../middleware/requirePasswordChangeComplete.js";
import { compendiumRoutes } from "./compendiumRoutes.js";

describe("compendiumRoutes", () => {
  it("protects every library endpoint with authentication and completed-password middleware", async () => {
    const app = {
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn()
    };

    await compendiumRoutes(app as never);

    for (const register of [app.get, app.put, app.post]) {
      const options = register.mock.calls[0]?.[1] as { preHandler?: unknown[] };
      expect(options.preHandler).toEqual([requireAuth, requirePasswordChangeComplete]);
    }
    expect(app.get).toHaveBeenCalledWith("/compendium/library", expect.any(Object), expect.any(Function));
    expect(app.put).toHaveBeenCalledWith("/compendium/library/:entryId/favorite", expect.any(Object), expect.any(Function));
    expect(app.post).toHaveBeenCalledWith("/compendium/library/:entryId/view", expect.any(Object), expect.any(Function));
  });
});
