import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../services/AuthService.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await this.authService.login(request.body);
    reply.send({ data: session });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await this.authService.refresh(request.body);
    reply.send({ data: session });
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.authService.logout(request.body);
    reply.code(204).send();
  }

  async requestPasswordReset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.authService.requestPasswordReset(request.body);
    reply.code(204).send();
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.authService.resetPassword(request.body);
    reply.code(204).send();
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await this.authService.changePassword(request.authUser!.id, request.body);
    reply.send({ data: session });
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await this.authService.getUserById(request.authUser!.id);
    reply.send({ data: user });
  }
}
