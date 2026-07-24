import type { FastifyReply, FastifyRequest } from "fastify";
import type { CreateManagedUserInput, DeactivateManagedUserInput } from "@umbra/shared";
import { AdminService } from "../services/AdminService.js";

export class AdminController {
  constructor(private readonly service: AdminService) {}

  async listUsers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const users = await this.service.listUsers(request.query);
    reply.send({ data: users });
  }

  async createUser(
    request: FastifyRequest<{ Body: CreateManagedUserInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.createUser(request.authUser!.id, request.body);
    reply.code(201).send({ data: result });
  }

  async deactivateUser(
    request: FastifyRequest<{ Params: { userId: string }; Body: DeactivateManagedUserInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.deactivateUser(
      request.authUser!.id,
      request.params.userId,
      request.body
    );
    reply.send({ data: result });
  }

  async reactivateUser(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.reactivateUser(request.authUser!.id, request.params.userId);
    reply.send({ data: result });
  }

  async revokeSessions(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.revokeAllSessions(request.authUser!.id, request.params.userId);
    reply.send({ data: result });
  }

  async listUserEvents(
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const events = await this.service.listUserEvents(request.params.userId);
    reply.send({ data: events });
  }

  async retryEventEmail(
    request: FastifyRequest<{ Params: { userId: string; eventId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.retryEventEmail(
      request.authUser!.id,
      request.params.userId,
      request.params.eventId
    );
    reply.send({ data: result });
  }
}
