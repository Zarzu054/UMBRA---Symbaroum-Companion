import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    refreshToken: {
      updateMany: vi.fn()
    },
    passwordResetToken: {
      updateMany: vi.fn()
    },
    adminAccountEvent: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("../config/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("./MailService.js", () => ({ MailService: class {} }));

import { AdminService } from "./AdminService.js";

const actorId = "10000000-0000-0000-0000-000000000001";
const userId = "20000000-0000-0000-0000-000000000002";
const now = new Date("2026-07-24T12:00:00.000Z");

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    email: "player@example.com",
    passwordHash: "stored-hash",
    mustChangePassword: true,
    role: "player",
    status: "active",
    deactivatedAt: null,
    createdAt: now,
    refreshTokens: [],
    adminEventsAsTarget: [],
    ...overrides
  };
}

function accountEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-0000-0000-000000000003",
    actorId,
    targetUserId: userId,
    targetEmail: "player@example.com",
    action: "created",
    reason: null,
    explanation: "",
    notificationStatus: "sent",
    notificationAttempts: 1,
    notificationLastAttemptAt: now,
    notificationError: "",
    createdAt: now,
    actor: { email: "admin@example.com" },
    ...overrides
  };
}

describe("AdminService account lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (input: unknown) =>
      typeof input === "function"
        ? (input as (client: typeof prismaMock) => Promise<unknown>)(prismaMock)
        : Promise.all(input as Promise<unknown>[])
    );
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.user.update.mockResolvedValue(user());
    prismaMock.adminAccountEvent.update.mockResolvedValue(accountEvent());
  });

  it("creates a pending user, emails a one-time password, and only stores its hash", async () => {
    const mail = { sendTemporaryCredentialsEmail: vi.fn().mockResolvedValue(undefined) };
    let createData: Record<string, unknown> | undefined;
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user({ status: "active" }));
    prismaMock.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      createData = data;
      return user({ ...data, status: "pending" });
    });
    prismaMock.adminAccountEvent.create.mockResolvedValue(accountEvent({ notificationStatus: "pending" }));
    prismaMock.adminAccountEvent.findUnique.mockResolvedValue(accountEvent());

    const result = await new AdminService(mail as never).createUser(actorId, {
      email: "PLAYER@example.com",
      role: "player"
    });

    expect(createData?.email).toBe("player@example.com");
    expect(createData?.status).toBe("pending");
    expect(createData?.mustChangePassword).toBe(true);
    expect(mail.sendTemporaryCredentialsEmail).toHaveBeenCalledOnce();
    const temporaryPassword = mail.sendTemporaryCredentialsEmail.mock.calls[0]?.[1] as string;
    expect(temporaryPassword).toHaveLength(20);
    expect(createData?.passwordHash).not.toBe(temporaryPassword);
    expect(await argon2.verify(createData?.passwordHash as string, temporaryPassword)).toBe(true);
    expect(result.user.status).toBe("active");
  });

  it("keeps a created account pending and records a retryable failure when mail fails", async () => {
    const mail = { sendTemporaryCredentialsEmail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")) };
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user({ status: "pending", adminEventsAsTarget: [{ id: "event" }] }));
    prismaMock.user.create.mockResolvedValue(user({ status: "pending" }));
    prismaMock.adminAccountEvent.create.mockResolvedValue(accountEvent({ notificationStatus: "pending" }));
    prismaMock.adminAccountEvent.findUnique.mockResolvedValue(accountEvent({ notificationStatus: "failed" }));

    const result = await new AdminService(mail as never).createUser(actorId, {
      email: "player@example.com",
      role: "player"
    });

    expect(result.user.status).toBe("pending");
    expect(result.event.notificationStatus).toBe("failed");
    expect(prismaMock.adminAccountEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationStatus: "failed" })
    }));
  });

  it("rejects duplicate email addresses without generating or sending credentials", async () => {
    const mail = { sendTemporaryCredentialsEmail: vi.fn() };
    prismaMock.user.findUnique.mockResolvedValue(user());

    await expect(new AdminService(mail as never).createUser(actorId, {
      email: "player@example.com",
      role: "gm"
    })).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
      statusCode: 409
    });

    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(mail.sendTemporaryCredentialsEmail).not.toHaveBeenCalled();
  });

  it("deactivates without deleting owned data and sends the exact cause", async () => {
    const mail = { sendAccountDeactivatedEmail: vi.fn().mockResolvedValue(undefined) };
    prismaMock.user.findUnique
      .mockResolvedValueOnce(user())
      .mockResolvedValueOnce(user({ status: "deactivated", deactivatedAt: now }));
    prismaMock.adminAccountEvent.create.mockResolvedValue(accountEvent({
      action: "deactivated",
      reason: "security_concern",
      explanation: "Actividad de acceso no reconocida.",
      notificationStatus: "pending"
    }));
    prismaMock.adminAccountEvent.findUnique.mockResolvedValue(accountEvent({
      action: "deactivated",
      reason: "security_concern",
      explanation: "Actividad de acceso no reconocida."
    }));

    const result = await new AdminService(mail as never).deactivateUser(actorId, userId, {
      reason: "security_concern",
      explanation: "Actividad de acceso no reconocida."
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "deactivated" })
    }));
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(mail.sendAccountDeactivatedEmail).toHaveBeenCalledWith(
      "player@example.com",
      "Motivo de seguridad",
      "Actividad de acceso no reconocida."
    );
    expect(result.user.status).toBe("deactivated");
    expect("delete" in prismaMock.user).toBe(false);
  });

  it("never permits management of a superadmin account", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user({ role: "superadmin" }));
    const service = new AdminService({} as never);

    await expect(service.revokeAllSessions(actorId, userId)).rejects.toMatchObject({
      code: "PROTECTED_ACCOUNT",
      statusCode: 403
    });
  });

  it("reactivates with rotated credentials and stays pending when SMTP fails", async () => {
    const mail = { sendTemporaryCredentialsEmail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")) };
    let rotatedHash = "";
    prismaMock.user.findUnique
      .mockResolvedValueOnce(user({ status: "deactivated", mustChangePassword: false }))
      .mockResolvedValueOnce(user({
        status: "pending",
        mustChangePassword: true,
        adminEventsAsTarget: [{ id: "event" }]
      }));
    prismaMock.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (typeof data.passwordHash === "string") rotatedHash = data.passwordHash;
      return user({ ...data });
    });
    prismaMock.adminAccountEvent.create.mockResolvedValue(accountEvent({
      action: "reactivated",
      notificationStatus: "pending"
    }));
    prismaMock.adminAccountEvent.findUnique.mockResolvedValue(accountEvent({
      action: "reactivated",
      notificationStatus: "failed"
    }));

    const result = await new AdminService(mail as never).reactivateUser(actorId, userId);
    const temporaryPassword = mail.sendTemporaryCredentialsEmail.mock.calls[0]?.[1] as string;

    expect(rotatedHash).not.toBe("stored-hash");
    expect(await argon2.verify(rotatedHash, temporaryPassword)).toBe(true);
    expect(result.user.status).toBe("pending");
    expect(result.user.mustChangePassword).toBe(true);
    expect(result.event.notificationStatus).toBe("failed");
  });

  it("retries onboarding with newly generated credentials and activates after SMTP accepts them", async () => {
    const mail = { sendTemporaryCredentialsEmail: vi.fn().mockResolvedValue(undefined) };
    let retriedHash = "";
    prismaMock.user.findUnique
      .mockResolvedValueOnce(user({ status: "pending" }))
      .mockResolvedValueOnce(user({ status: "active" }));
    prismaMock.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (typeof data.passwordHash === "string") retriedHash = data.passwordHash;
      return user({ ...data });
    });
    prismaMock.adminAccountEvent.findFirst.mockResolvedValue(accountEvent({
      notificationStatus: "failed"
    }));
    prismaMock.adminAccountEvent.findUnique.mockResolvedValue(accountEvent({
      notificationStatus: "sent",
      notificationAttempts: 2
    }));

    const result = await new AdminService(mail as never).retryEventEmail(
      actorId,
      userId,
      "30000000-0000-0000-0000-000000000003"
    );
    const temporaryPassword = mail.sendTemporaryCredentialsEmail.mock.calls[0]?.[1] as string;

    expect(await argon2.verify(retriedHash, temporaryPassword)).toBe(true);
    expect(mail.sendTemporaryCredentialsEmail).toHaveBeenCalledWith(
      "player@example.com",
      temporaryPassword,
      "resend"
    );
    expect(result.user.status).toBe("active");
    expect(result.event.notificationStatus).toBe("sent");
  });
});
