import type { FastifyReply, FastifyRequest } from "fastify";

export async function requirePasswordChangeComplete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.authUser?.mustChangePassword) {
    reply.code(403).send({
      error: "PASSWORD_CHANGE_REQUIRED",
      message: "Debes cambiar la contrasena temporal antes de continuar"
    });
  }
}
