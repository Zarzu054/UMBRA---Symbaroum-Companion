import type { UserRole } from "@umbra/shared";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      role: UserRole;
    };
  }
}