import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import {
  adminUserListQuerySchema,
  createManagedUserSchema,
  deactivateManagedUserSchema,
  type AdminAccountEvent,
  type AdminAccountMutationResult,
  type AdminDeactivationReason,
  type AdminUserList,
  type AdminUserSummary
} from "@umbra/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { MailService } from "./MailService.js";

const MANAGED_ROLES = ["player", "gm"] as const;
const REASON_LABELS: Record<AdminDeactivationReason, string> = {
  access_no_longer_required: "El acceso ya no es necesario",
  policy_violation: "Incumplimiento de las normas de uso",
  security_concern: "Motivo de seguridad",
  duplicate_or_error: "Cuenta duplicada o creada por error",
  other: "Otro motivo"
};

type UserWithAdminSummary = Prisma.UserGetPayload<{
  include: {
    refreshTokens: true;
    adminEventsAsTarget: { select: { id: true } };
  };
}>;

type EventWithActor = Prisma.AdminAccountEventGetPayload<{
  include: { actor: { select: { email: true } } };
}>;

export class AdminService {
  constructor(private readonly mailService = new MailService()) {}

  async listUsers(input: unknown): Promise<AdminUserList> {
    const query = adminUserListQuerySchema.parse(input);
    const where: Prisma.UserWhereInput = {
      role: query.role === "all" ? { in: [...MANAGED_ROLES] } : query.role,
      status: query.status === "all" ? undefined : query.status,
      email: query.query ? { contains: query.query.toLowerCase(), mode: "insensitive" } : undefined
    };
    const now = new Date();
    const [rows, total, activeCount, pendingCount, deactivatedCount, attentionTargets] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          refreshTokens: { where: { revokedAt: null, expiresAt: { gt: now } } },
          adminEventsAsTarget: {
            where: { notificationStatus: { in: ["pending", "failed"] } },
            select: { id: true }
          }
        }
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: { in: [...MANAGED_ROLES] }, status: "active" } }),
      prisma.user.count({ where: { role: { in: [...MANAGED_ROLES] }, status: "pending" } }),
      prisma.user.count({ where: { role: { in: [...MANAGED_ROLES] }, status: "deactivated" } }),
      prisma.adminAccountEvent.findMany({
        where: {
          target: { role: { in: [...MANAGED_ROLES] } },
          notificationStatus: { in: ["pending", "failed"] }
        },
        distinct: ["targetUserId"],
        select: { targetUserId: true }
      })
    ]);

    return {
      items: rows.map(mapUserSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
      counts: {
        active: activeCount,
        pending: pendingCount,
        deactivated: deactivatedCount,
        notificationAttention: attentionTargets.length
      }
    };
  }

  async createUser(actorId: string, input: unknown): Promise<AdminAccountMutationResult> {
    const payload = createManagedUserSchema.parse(input);
    const email = payload.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new AppError("EMAIL_TAKEN", "El correo ya esta registrado", 409);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    let created: Awaited<ReturnType<typeof createPendingUser>>;
    try {
      created = await prisma.$transaction((tx) =>
        createPendingUser(tx, actorId, email, payload.role, passwordHash)
      );
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError("EMAIL_TAKEN", "El correo ya esta registrado", 409);
      }
      throw error;
    }

    await this.attemptCredentialDelivery(created.event.id, created.user.id, email, temporaryPassword, "welcome");
    return this.loadMutationResult(created.user.id, created.event.id);
  }

  async deactivateUser(actorId: string, userId: string, input: unknown): Promise<AdminAccountMutationResult> {
    const payload = deactivateManagedUserSchema.parse(input);
    const target = await this.requireManagedUser(userId);
    if (target.status === "deactivated") {
      throw new AppError("ACCOUNT_ALREADY_DEACTIVATED", "La cuenta ya esta desactivada", 409);
    }

    const now = new Date();
    const event = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: "deactivated", deactivatedAt: now }
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now }
      });
      return tx.adminAccountEvent.create({
        data: {
          actorId,
          targetUserId: userId,
          targetEmail: target.email,
          action: "deactivated",
          reason: payload.reason,
          explanation: payload.explanation,
          notificationStatus: "pending"
        }
      });
    });

    await this.attemptDeactivationDelivery(
      event.id,
      target.email,
      payload.reason,
      payload.explanation
    );
    return this.loadMutationResult(userId, event.id);
  }

  async reactivateUser(actorId: string, userId: string): Promise<AdminAccountMutationResult> {
    const target = await this.requireManagedUser(userId);
    if (target.status !== "deactivated") {
      throw new AppError("ACCOUNT_NOT_DEACTIVATED", "Solo se pueden reactivar cuentas desactivadas", 409);
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const now = new Date();
    const event = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          status: "pending",
          deactivatedAt: null,
          mustChangePassword: true
        }
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now }
      });
      return tx.adminAccountEvent.create({
        data: {
          actorId,
          targetUserId: userId,
          targetEmail: target.email,
          action: "reactivated",
          notificationStatus: "pending"
        }
      });
    });

    await this.attemptCredentialDelivery(event.id, userId, target.email, temporaryPassword, "reactivation");
    return this.loadMutationResult(userId, event.id);
  }

  async revokeAllSessions(actorId: string, userId: string): Promise<AdminAccountMutationResult> {
    const target = await this.requireManagedUser(userId);
    const now = new Date();
    const event = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now }
      });
      return tx.adminAccountEvent.create({
        data: {
          actorId,
          targetUserId: userId,
          targetEmail: target.email,
          action: "sessions_revoked",
          notificationStatus: "not_required"
        }
      });
    });
    return this.loadMutationResult(userId, event.id);
  }

  async listUserEvents(userId: string): Promise<AdminAccountEvent[]> {
    await this.requireManagedUser(userId);
    const events = await prisma.adminAccountEvent.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { email: true } } },
      take: 100
    });
    return events.map(mapAccountEvent);
  }

  async retryEventEmail(actorId: string, userId: string, eventId: string): Promise<AdminAccountMutationResult> {
    const target = await this.requireManagedUser(userId);
    const sourceEvent = await prisma.adminAccountEvent.findFirst({
      where: { id: eventId, targetUserId: userId }
    });
    if (!sourceEvent) {
      throw new AppError("ADMIN_EVENT_NOT_FOUND", "No se encontro la notificacion", 404);
    }

    if (sourceEvent.action === "deactivated") {
      if (target.status !== "deactivated" || sourceEvent.notificationStatus === "sent" || !sourceEvent.reason) {
        throw new AppError("NOTIFICATION_NOT_RETRYABLE", "Esta notificacion no se puede reenviar", 409);
      }
      await this.attemptDeactivationDelivery(
        sourceEvent.id,
        target.email,
        sourceEvent.reason,
        sourceEvent.explanation
      );
      return this.loadMutationResult(userId, sourceEvent.id);
    }

    const credentialActions = new Set(["created", "reactivated", "credentials_resent"]);
    if (!credentialActions.has(sourceEvent.action)) {
      throw new AppError("NOTIFICATION_NOT_RETRYABLE", "Esta notificacion no se puede reenviar", 409);
    }

    if (!target.mustChangePassword || target.status === "deactivated") {
      throw new AppError(
        "CREDENTIAL_RESEND_NOT_ALLOWED",
        "Las credenciales solo se pueden reenviar durante la incorporacion",
        409
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const now = new Date();
    const eventIdToSend = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, status: "pending", mustChangePassword: true }
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now }
      });
      if (sourceEvent.notificationStatus !== "sent") {
        await tx.adminAccountEvent.update({
          where: { id: sourceEvent.id },
          data: { notificationStatus: "pending", notificationError: "" }
        });
        return sourceEvent.id;
      }
      const resend = await tx.adminAccountEvent.create({
        data: {
          actorId,
          targetUserId: userId,
          targetEmail: target.email,
          action: "credentials_resent",
          notificationStatus: "pending"
        }
      });
      return resend.id;
    });

    await this.attemptCredentialDelivery(eventIdToSend, userId, target.email, temporaryPassword, "resend");
    return this.loadMutationResult(userId, eventIdToSend);
  }

  private async requireManagedUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "Usuario no encontrado", 404);
    }
    if (user.role === "superadmin") {
      throw new AppError("PROTECTED_ACCOUNT", "Las cuentas superadmin no se gestionan desde este panel", 403);
    }
    return user;
  }

  private async attemptCredentialDelivery(
    eventId: string,
    userId: string,
    email: string,
    temporaryPassword: string,
    kind: "welcome" | "reactivation" | "resend"
  ): Promise<void> {
    const attemptAt = new Date();
    try {
      await this.mailService.sendTemporaryCredentialsEmail(email, temporaryPassword, kind);
      await prisma.$transaction([
        prisma.adminAccountEvent.update({
          where: { id: eventId },
          data: {
            notificationStatus: "sent",
            notificationAttempts: { increment: 1 },
            notificationLastAttemptAt: attemptAt,
            notificationError: ""
          }
        }),
        prisma.user.update({
          where: { id: userId },
          data: { status: "active" }
        })
      ]);
    } catch (error) {
      await prisma.adminAccountEvent.update({
        where: { id: eventId },
        data: {
          notificationStatus: "failed",
          notificationAttempts: { increment: 1 },
          notificationLastAttemptAt: attemptAt,
          notificationError: sanitizeMailError(error)
        }
      });
    }
  }

  private async attemptDeactivationDelivery(
    eventId: string,
    email: string,
    reason: AdminDeactivationReason,
    explanation: string
  ): Promise<void> {
    const attemptAt = new Date();
    try {
      await this.mailService.sendAccountDeactivatedEmail(email, REASON_LABELS[reason], explanation);
      await prisma.adminAccountEvent.update({
        where: { id: eventId },
        data: {
          notificationStatus: "sent",
          notificationAttempts: { increment: 1 },
          notificationLastAttemptAt: attemptAt,
          notificationError: ""
        }
      });
    } catch (error) {
      await prisma.adminAccountEvent.update({
        where: { id: eventId },
        data: {
          notificationStatus: "failed",
          notificationAttempts: { increment: 1 },
          notificationLastAttemptAt: attemptAt,
          notificationError: sanitizeMailError(error)
        }
      });
    }
  }

  private async loadMutationResult(userId: string, eventId: string): Promise<AdminAccountMutationResult> {
    const [user, event] = await Promise.all([
      this.loadUserSummary(userId),
      prisma.adminAccountEvent.findUnique({
        where: { id: eventId },
        include: { actor: { select: { email: true } } }
      })
    ]);
    if (!event) {
      throw new AppError("ADMIN_EVENT_NOT_FOUND", "No se encontro el evento administrativo", 404);
    }
    return { user, event: mapAccountEvent(event) };
  }

  private async loadUserSummary(userId: string): Promise<AdminUserSummary> {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        refreshTokens: { where: { revokedAt: null, expiresAt: { gt: now } } },
        adminEventsAsTarget: {
          where: { notificationStatus: { in: ["pending", "failed"] } },
          select: { id: true }
        }
      }
    });
    if (!user || user.role === "superadmin") {
      throw new AppError("USER_NOT_FOUND", "Usuario no encontrado", 404);
    }
    return mapUserSummary(user);
  }
}

async function createPendingUser(
  tx: Prisma.TransactionClient,
  actorId: string,
  email: string,
  role: "player" | "gm",
  passwordHash: string
) {
  const user = await tx.user.create({
    data: {
      email,
      passwordHash,
      role,
      status: "pending",
      mustChangePassword: true
    }
  });
  const event = await tx.adminAccountEvent.create({
    data: {
      actorId,
      targetUserId: user.id,
      targetEmail: email,
      action: "created",
      notificationStatus: "pending"
    }
  });
  return { user, event };
}

function mapUserSummary(user: UserWithAdminSummary): AdminUserSummary {
  if (user.role === "superadmin") {
    throw new AppError("PROTECTED_ACCOUNT", "Cuenta protegida", 403);
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    activeRefreshTokens: user.refreshTokens.length,
    notificationAttention: user.adminEventsAsTarget.length > 0
  };
}

function mapAccountEvent(event: EventWithActor): AdminAccountEvent {
  return {
    id: event.id,
    action: event.action,
    actorEmail: event.actor.email,
    targetEmail: event.targetEmail,
    reason: event.reason,
    explanation: event.explanation,
    notificationStatus: event.notificationStatus,
    notificationAttempts: event.notificationAttempts,
    notificationLastAttemptAt: event.notificationLastAttemptAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString()
  };
}

function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(20);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function sanitizeMailError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Error de envio";
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
