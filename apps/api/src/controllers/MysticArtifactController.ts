import type { FastifyReply, FastifyRequest } from "fastify";
import { createReadStream } from "node:fs";
import type {
  AssignMysticArtifactOwnerInput,
  BindMysticArtifactInput,
  CreateCampaignMysticArtifactInput,
  UpdateCampaignMysticArtifactInput,
  UpdateMysticArtifactResourceInput
} from "@umbra/shared";
import { MysticArtifactService } from "../services/MysticArtifactService.js";

export class MysticArtifactController {
  constructor(private readonly service: MysticArtifactService) {}

  async listPresets(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send({ data: await this.service.listPresets(request.authUser!.role) });
  }

  async listCampaign(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.listCampaignArtifacts(user.id, user.role, request.params.campaignId) });
  }

  async source(request: FastifyRequest<{ Params: { artifactId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    const source = await this.service.getSource(user.id, user.role, request.params.artifactId);
    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(source.fileName)}`)
      .header("X-Umbra-Pdf-Page", String(source.pdfPage))
      .send(createReadStream(source.absolutePath));
  }

  async create(request: FastifyRequest<{ Params: { campaignId: string }; Body: CreateCampaignMysticArtifactInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.code(201).send({ data: await this.service.create(user.id, user.role, request.params.campaignId, request.body) });
  }

  async update(request: FastifyRequest<{ Params: { artifactId: string }; Body: UpdateCampaignMysticArtifactInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.update(user.id, user.role, request.params.artifactId, request.body) });
  }

  async remove(request: FastifyRequest<{ Params: { artifactId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    await this.service.remove(user.id, user.role, request.params.artifactId);
    reply.code(204).send();
  }

  async assign(request: FastifyRequest<{ Params: { artifactId: string }; Body: AssignMysticArtifactOwnerInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.assignOwner(user.id, user.role, request.params.artifactId, request.body) });
  }

  async bind(request: FastifyRequest<{ Params: { artifactId: string }; Body: BindMysticArtifactInput }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.bind(user.id, user.role, request.params.artifactId, request.body) });
  }

  async bindNpc(request: FastifyRequest<{ Params: { artifactId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.bindNpc(user.id, user.role, request.params.artifactId) });
  }

  async unbind(request: FastifyRequest<{ Params: { artifactId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.unbind(user.id, user.role, request.params.artifactId) });
  }

  async updateResource(
    request: FastifyRequest<{ Params: { artifactId: string; resourceId: string }; Body: UpdateMysticArtifactResourceInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.updateResource(user.id, user.role, request.params.artifactId, request.params.resourceId, request.body) });
  }

  async useAbility(request: FastifyRequest<{ Params: { artifactId: string; abilityId: string } }>, reply: FastifyReply): Promise<void> {
    const user = request.authUser!;
    reply.send({ data: await this.service.useAbility(user.id, user.role, request.params.artifactId, request.params.abilityId) });
  }
}
