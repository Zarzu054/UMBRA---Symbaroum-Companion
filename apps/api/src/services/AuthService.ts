import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  changePasswordSchema,
  type AuthSession,
  type AuthUser,
  loginSchema,
  refreshSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} from "@umbra/shared";
import type { UserRole as DbUserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { MailService } from "./MailService.js";
import { AppError } from "../utils/AppError.js";

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: "player" | "gm" | "superadmin";
  mustChangePassword: boolean;
  type: "access";
};

type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  type: "refresh";
};

export class AuthService {
  constructor(private readonly mailService = new MailService()) {}

  async login(input: unknown): Promise<AuthSession> {
    const payload = loginSchema.parse(input);
    const email = payload.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    }

    const validPassword = await argon2.verify(user.passwordHash, payload.password);
    if (!validPassword) {
      throw new AppError("INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    }
    if (user.status === "pending") {
      throw new AppError("ACCOUNT_PENDING", "La cuenta esta pendiente de activacion", 403);
    }
    if (user.status === "deactivated") {
      throw new AppError("ACCOUNT_DEACTIVATED", "La cuenta esta desactivada", 403);
    }

    return this.issueSession({
      id: user.id,
      email: user.email,
      role: toAppRole(user.role),
      status: user.status,
      mustChangePassword: user.mustChangePassword
    });
  }

  async refresh(input: unknown): Promise<AuthSession> {
    const payload = refreshSchema.parse(input);

    const decoded = this.verifyRefreshToken(payload.refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: { user: true }
    });

    if (
      !stored ||
      stored.userId !== decoded.sub ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.status !== "active"
    ) {
      throw new AppError("INVALID_REFRESH_TOKEN", "Token de refresco invalido", 401);
    }

    const tokenMatches = await argon2.verify(stored.tokenHash, payload.refreshToken);
    if (!tokenMatches) {
      throw new AppError("INVALID_REFRESH_TOKEN", "Token de refresco invalido", 401);
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession({
      id: stored.user.id,
      email: stored.user.email,
      role: toAppRole(stored.user.role),
      status: stored.user.status,
      mustChangePassword: stored.user.mustChangePassword
    });
  }

  async logout(input: unknown): Promise<void> {
    const payload = refreshSchema.parse(input);

    const decoded = this.verifyRefreshToken(payload.refreshToken);

    await prisma.refreshToken.updateMany({
      where: {
        id: decoded.tokenId,
        userId: decoded.sub,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async getUserById(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true, mustChangePassword: true }
    });

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "Usuario no encontrado", 404);
    }

    if (user.status !== "active") {
      throw new AppError("ACCOUNT_INACTIVE", "La cuenta no esta activa", 401);
    }
    return { ...user, role: toAppRole(user.role) };
  }

  async changePassword(userId: string, input: unknown): Promise<AuthSession> {
    const payload = changePasswordSchema.parse(input);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "Usuario no encontrado", 404);
    }
    if (user.status !== "active") {
      throw new AppError("ACCOUNT_INACTIVE", "La cuenta no esta activa", 401);
    }

    const validPassword = await argon2.verify(user.passwordHash, payload.currentPassword);
    if (!validPassword) {
      throw new AppError("INVALID_CREDENTIALS", "Credenciales invalidas", 401);
    }

    const passwordHash = await argon2.hash(payload.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false
        }
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })
    ]);

    return this.issueSession({
      id: user.id,
      email: user.email,
      role: toAppRole(user.role),
      status: user.status,
      mustChangePassword: false
    });
  }

  async requestPasswordReset(input: unknown): Promise<void> {
    const payload = requestPasswordResetSchema.parse(input);
    const email = payload.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true }
    });

    if (!user || user.status !== "active") {
      return;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        }
      })
    ]);

    const resetUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/#reset-password?token=${encodeURIComponent(rawToken)}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(input: unknown): Promise<void> {
    const payload = resetPasswordSchema.parse(input);
    const tokenHash = hashResetToken(payload.token);
    const now = new Date();

    const stored = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: {
        user: true
      }
    });

    if (!stored) {
      throw new AppError("INVALID_RESET_TOKEN", "El enlace de recuperacion no es valido o ya ha expirado", 400);
    }
    if (stored.user.status !== "active") {
      throw new AppError("ACCOUNT_INACTIVE", "La cuenta no esta activa", 403);
    }

    const passwordHash = await argon2.hash(payload.newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          mustChangePassword: false
        }
      }),
      prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: {
          usedAt: now
        }
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: stored.userId,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId: stored.userId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      })
    ]);
  }

  private async issueSession(user: AuthUser): Promise<AuthSession> {
    const tokenId = randomUUID();

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        type: "access"
      } satisfies AccessTokenPayload,
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"] }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        tokenId,
        type: "refresh"
      } satisfies RefreshTokenPayload,
      env.JWT_REFRESH_SECRET,
      { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"] }
    );

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;

      if (decoded.type !== "refresh" || typeof decoded.sub !== "string" || typeof decoded.tokenId !== "string") {
        throw new AppError("INVALID_REFRESH_TOKEN", "Token de refresco invalido", 401);
      }

      return {
        sub: decoded.sub,
        tokenId: decoded.tokenId,
        type: "refresh"
      };
    } catch {
      throw new AppError("INVALID_REFRESH_TOKEN", "Token de refresco invalido", 401);
    }
  }
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAppRole(role: DbUserRole): "player" | "gm" | "superadmin" {
  if (role === "player" || role === "gm") return role;
  return "superadmin";
}
