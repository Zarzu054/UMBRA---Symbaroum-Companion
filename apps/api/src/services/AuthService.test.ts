import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn()
    },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

vi.mock("../config/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../config/env.js", () => ({
  env: {
    APP_BASE_URL: "https://umbra.example",
    JWT_ACCESS_SECRET: "access-secret",
    JWT_REFRESH_SECRET: "refresh-secret",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL_DAYS: 7
  }
}));
vi.mock("./MailService.js", () => ({ MailService: class {} }));

import { AuthService } from "./AuthService.js";

describe("AuthService inactive-account recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["pending", "deactivated"] as const)(
    "does not issue recovery credentials or reactivate a %s account",
    async (status) => {
      const mail = { sendPasswordResetEmail: vi.fn() };
      prismaMock.user.findUnique.mockResolvedValue({
        id: "20000000-0000-0000-0000-000000000002",
        email: "player@example.com",
        status
      });

      await new AuthService(mail as never).requestPasswordReset({
        email: "player@example.com"
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    }
  );
});
