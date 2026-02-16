import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing bearer token" });
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
      reply.code(401).send({ error: "Invalid access token" });
      return;
    }

    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch {
    reply.code(401).send({ error: "Invalid access token" });
  }
}