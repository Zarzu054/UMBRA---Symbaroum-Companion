import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { type AuthSession, type AuthUser, loginSchema, refreshSchema, registerSchema } from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: "player" | "gm" | "admin";
  type: "access";
};

type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  type: "refresh";
};

export class AuthService {
  async register(input: unknown): Promise<AuthSession> {
    const payload = registerSchema.parse(input);
    const email = payload.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("EMAIL_TAKEN", "Email already registered", 409);
    }

    const passwordHash = await argon2.hash(payload.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: payload.role
      }
    });

    return this.issueSession({ id: user.id, email: user.email, role: user.role });
  }

  async login(input: unknown): Promise<AuthSession> {
    const payload = loginSchema.parse(input);
    const email = payload.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    const validPassword = await argon2.verify(user.passwordHash, payload.password);
    if (!validPassword) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
    }

    return this.issueSession({ id: user.id, email: user.email, role: user.role });
  }

  async refresh(input: unknown): Promise<AuthSession> {
    const payload = refreshSchema.parse(input);

    const decoded = this.verifyRefreshToken(payload.refreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: { user: true }
    });

    if (!stored || stored.userId !== decoded.sub || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
    }

    const tokenMatches = await argon2.verify(stored.tokenHash, payload.refreshToken);
    if (!tokenMatches) {
      throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() }
    });

    return this.issueSession({ id: stored.user.id, email: stored.user.email, role: stored.user.role });
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
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    return user;
  }

  private async issueSession(user: AuthUser): Promise<AuthSession> {
    const tokenId = randomUUID();

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access"
      } satisfies AccessTokenPayload,
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.ACCESS_TOKEN_TTL }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        tokenId,
        type: "refresh"
      } satisfies RefreshTokenPayload,
      env.JWT_REFRESH_SECRET,
      { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` }
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
        throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
      }

      return {
        sub: decoded.sub,
        tokenId: decoded.tokenId,
        type: "refresh"
      };
    } catch {
      throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
    }
  }
}