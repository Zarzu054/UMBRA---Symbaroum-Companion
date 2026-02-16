import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../services/AuthService.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await this.authService.register(request.body);
    reply.code(201).send({ data: session });
  }

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

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await this.authService.getUserById(request.authUser!.id);
    reply.send({ data: user });
  }
}