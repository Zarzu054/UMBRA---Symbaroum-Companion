import type { FastifyReply, FastifyRequest } from "fastify";
import { AdminService } from "../services/AdminService.js";

export class AdminController {
  constructor(private readonly service: AdminService) {}

  async listUsers(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const users = await this.service.listUsers();
    reply.send({ data: users });
  }

  async revokeSessions(request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply): Promise<void> {
    await this.service.revokeAllSessions(request.params.userId);
    reply.code(204).send();
  }
}