import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Falta token Bearer" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;

    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "player" && payload.role !== "gm" && payload.role !== "superadmin")
    ) {
      reply.code(401).send({ error: "Token de acceso invalido" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, mustChangePassword: true }
    });
    if (!user || user.status !== "active") {
      reply.code(401).send({ error: "ACCOUNT_INACTIVE", message: "La cuenta no esta activa" });
      return;
    }
    if (user.role === "superadmin" && request.url.split("?")[0]?.startsWith("/api/")) {
      reply.code(403).send({
        error: "SUPERADMIN_MODULE_ACCESS_DENIED",
        message: "Las cuentas superadmin solo pueden acceder a la administracion de UMBRA"
      });
      return;
    }

    request.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword
    };
  } catch {
    reply.code(401).send({ error: "Token de acceso invalido" });
  }
}
