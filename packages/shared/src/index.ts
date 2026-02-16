import { z } from "zod";

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