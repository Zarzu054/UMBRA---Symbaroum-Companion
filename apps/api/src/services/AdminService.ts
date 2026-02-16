import type { SupportUser } from "@umbra/shared";
import type { UserRole as DbUserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export class AdminService {
  async listUsers(): Promise<SupportUser[]> {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        refreshTokens: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: toAppRole(row.role),
      createdAt: row.createdAt.toISOString(),
      activeRefreshTokens: row.refreshTokens.length
    }));
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}

function toAppRole(role: DbUserRole): "player" | "gm" | "superadmin" {
  if (role === "player" || role === "gm") return role;
  return "superadmin";
}
