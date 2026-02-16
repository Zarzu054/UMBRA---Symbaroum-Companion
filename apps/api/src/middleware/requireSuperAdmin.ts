import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.authUser || request.authUser.role !== "superadmin") {
    reply.code(403).send({ error: "SUPERADMIN_REQUERIDO" });
    return;
  }
}
