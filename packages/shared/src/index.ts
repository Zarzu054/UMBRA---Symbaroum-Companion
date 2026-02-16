import { z } from "zod";

export const userRoleSchema = z.enum(["player", "gm", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const createCharacterSchema = z.object({
  name: z.string().min(2).max(80),
  archetype: z.string().min(2).max(80),
  race: z.string().min(2).max(80),
  level: z.number().int().min(1).max(20)
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

export type Character = {
  id: string;
  name: string;
  archetype: string;
  race: string;
  level: number;
  createdAt: string;
};

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: userRoleSchema.default("player")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};