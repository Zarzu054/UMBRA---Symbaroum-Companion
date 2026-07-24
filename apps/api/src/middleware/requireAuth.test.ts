import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, verifyMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() } },
  verifyMock: vi.fn()
}));

vi.mock("../config/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../config/env.js", () => ({ env: { JWT_ACCESS_SECRET: "test-access-secret" } }));
vi.mock("jsonwebtoken", () => ({ default: { verify: verifyMock } }));

import { requireAuth } from "./requireAuth.js";
import { requireSuperAdmin } from "./requireSuperAdmin.js";

function replyStub() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    code: vi.fn((status: number) => {
      reply.statusCode = status;
      return reply;
    }),
    send: vi.fn((body: unknown) => {
      reply.body = body;
      return reply;
    })
  };
  return reply;
}

describe("requireAuth account boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyMock.mockReturnValue({
      type: "access",
      sub: "10000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      role: "superadmin"
    });
  });

  it("blocks a superadmin from game module APIs", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      role: "superadmin",
      status: "active",
      mustChangePassword: false
    });
    const request = { headers: { authorization: "Bearer token" }, url: "/api/characters" } as never;
    const reply = replyStub();

    await requireAuth(request, reply as never);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({ error: "SUPERADMIN_MODULE_ACCESS_DENIED" });
  });

  it("blocks an already issued token as soon as the account is deactivated", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "10000000-0000-0000-0000-000000000001",
      email: "player@example.com",
      role: "player",
      status: "deactivated",
      mustChangePassword: false
    });
    const request = { headers: { authorization: "Bearer token" }, url: "/api/characters" } as never;
    const reply = replyStub();

    await requireAuth(request, reply as never);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toMatchObject({ error: "ACCOUNT_INACTIVE" });
  });

  it.each(["player", "gm"] as const)("blocks %s accounts from superadmin routes", async (role) => {
    const request = { authUser: { role } } as never;
    const reply = replyStub();

    await requireSuperAdmin(request, reply as never);

    expect(reply.statusCode).toBe(403);
    expect(reply.body).toMatchObject({ error: "SUPERADMIN_REQUERIDO" });
  });
});
