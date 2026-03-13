import {
  addCampaignMemberSchema,
  createCampaignNpcSchema,
  createCampaignReferenceSchema,
  createCampaignSchema,
  createCampaignSessionSchema,
  assignCampaignSessionExperienceSchema,
  grantCampaignExperienceSchema,
  linkCampaignCharacterSchema,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_RACES,
  updateCampaignNpcSchema,
  updateCampaignReferenceSchema,
  updateCampaignSchema,
  updateCampaignSessionSchema,
  type AddCampaignMemberInput,
  type AssignCampaignSessionExperienceInput,
  type Campaign,
  type CreateCampaignInput,
  type CreateCampaignNpcInput,
  type CreateCampaignReferenceInput,
  type CreateCampaignSessionInput,
  type GrantCampaignExperienceInput,
  type UpdateCampaignInput,
  type UpdateCampaignNpcInput,
  type UpdateCampaignReferenceInput,
  type UpdateCampaignSessionInput,
  type UserRole
} from "@umbra/shared";
import { CampaignModel } from "../models/CampaignModel.js";
import { AppError } from "../utils/AppError.js";

const NPC_THREATS = ["Bajo", "Medio", "Alto", "Elite"] as const;
const NPC_OCCUPATIONS = ["Guardia", "Explorador", "Mercader", "Cultista", "Cazador", "Bruja", "Erudito", "Bandido"] as const;
const NPC_NAME_PREFIXES = ["Ar", "Bel", "Cor", "Dar", "El", "Fen", "Gal", "Mor", "Syl", "Tor"] as const;
const NPC_NAME_SUFFIXES = ["an", "or", "ia", "eth", "rik", "a", "os", "en", "ar", "is"] as const;

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") {
    throw new AppError("CAMPAIGN_FORBIDDEN", "Solo un director de juego puede realizar esta accion", 403);
  }
}

function randomFrom<const T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateNpcPayload(): CreateCampaignNpcInput {
  const race = String(randomFrom(SYMBAROUM_RACES));
  const archetype = String(randomFrom(SYMBAROUM_ARCHETYPES));
  const occupation = String(randomFrom(NPC_OCCUPATIONS));
  const threat = String(randomFrom(NPC_THREATS));
  const name = `${randomFrom(NPC_NAME_PREFIXES)}${randomFrom(NPC_NAME_SUFFIXES)}`;

  return {
    name,
    race,
    archetype,
    occupation,
    threat,
    summary: `${occupation} ${race.toLowerCase()} preparado para intervenir en escenas de campaña.`,
    notes: "PNJ generado automaticamente. Ajusta motivaciones, equipo y rasgos segun la situacion.",
    statBlock: `Atributo principal: ${archetype}. Amenaza: ${threat}.`,
    isGenerated: true
  };
}

function toSessionPayload(input: CreateCampaignSessionInput | UpdateCampaignSessionInput) {
  return {
    ...input,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined
  };
}

export class CampaignService {
  constructor(private readonly model: CampaignModel) {}

  async listCampaigns(userId: string, userRole: UserRole): Promise<Campaign[]> {
    return this.model.listAccessible(userId, userRole);
  }

  async getCampaign(userId: string, userRole: UserRole, campaignId: string): Promise<Campaign> {
    const campaign = await this.model.findAccessibleById(userId, userRole, campaignId);
    if (!campaign) {
      throw new AppError("CAMPAIGN_NOT_FOUND", "Campana no encontrada", 404);
    }

    return campaign;
  }

  async createCampaign(userId: string, userRole: UserRole, input: CreateCampaignInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    const payload = createCampaignSchema.parse(input);
    return this.model.create(userId, payload, userRole);
  }

  async updateCampaign(userId: string, userRole: UserRole, campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = updateCampaignSchema.parse(input);
    return this.model.update(campaignId, payload, userId, userRole);
  }

  async addMember(userId: string, userRole: UserRole, campaignId: string, input: AddCampaignMemberInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = addCampaignMemberSchema.parse(input);
    const target = await this.model.findMemberByEmail(payload.email.trim().toLowerCase());

    if (!target) {
      throw new AppError("USER_NOT_FOUND", "No existe un usuario con ese email", 404);
    }

    await this.model.addMember(campaignId, target.id);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async removeMember(userId: string, userRole: UserRole, memberId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const member = await this.model.findMemberById(memberId);
    if (!member) {
      throw new AppError("CAMPAIGN_MEMBER_NOT_FOUND", "Miembro de campana no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, member.campaignId);
    if (member.role === "gm") {
      throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes eliminar al director de la campana", 400);
    }

    await this.model.removeMember(memberId);
    return this.getCampaign(userId, userRole, member.campaignId);
  }

  async linkCharacter(userId: string, userRole: UserRole, campaignId: string, characterId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = linkCampaignCharacterSchema.parse({ characterId });
    const character = await this.model.findCharacterById(payload.characterId);

    if (!character) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    const campaign = await this.getCampaign(userId, userRole, campaignId);
    const isMemberCharacter = campaign.members.some((member: Campaign["members"][number]) => member.userId === character.ownerId);
    if (!isMemberCharacter) {
      throw new AppError(
        "CAMPAIGN_CHARACTER_OWNER_REQUIRED",
        "Solo puedes vincular personajes cuyos propietarios pertenezcan a la campana",
        400
      );
    }

    await this.model.linkCharacter(campaignId, payload.characterId);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async unlinkCharacter(userId: string, userRole: UserRole, linkId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const link = await this.model.findCharacterLinkById(linkId);
    if (!link) {
      throw new AppError("CAMPAIGN_CHARACTER_LINK_NOT_FOUND", "Vinculo de personaje no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, link.campaignId);
    await this.model.unlinkCharacter(linkId);
    return this.getCampaign(userId, userRole, link.campaignId);
  }

  async createNpc(userId: string, userRole: UserRole, campaignId: string, input: CreateCampaignNpcInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = createCampaignNpcSchema.parse(input);
    await this.model.createNpc(campaignId, payload);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async generateNpc(userId: string, userRole: UserRole, campaignId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    await this.model.createNpc(campaignId, generateNpcPayload());
    return this.getCampaign(userId, userRole, campaignId);
  }

  async updateNpc(userId: string, userRole: UserRole, npcId: string, input: UpdateCampaignNpcInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    const npc = await this.model.findNpcById(npcId);
    if (!npc) {
      throw new AppError("CAMPAIGN_NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, npc.campaignId);
    const payload = updateCampaignNpcSchema.parse(input);
    await this.model.updateNpc(npcId, payload);
    return this.getCampaign(userId, userRole, npc.campaignId);
  }

  async deleteNpc(userId: string, userRole: UserRole, npcId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const npc = await this.model.findNpcById(npcId);
    if (!npc) {
      throw new AppError("CAMPAIGN_NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, npc.campaignId);
    await this.model.deleteNpc(npcId);
    return this.getCampaign(userId, userRole, npc.campaignId);
  }

  async createSession(userId: string, userRole: UserRole, campaignId: string, input: CreateCampaignSessionInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = createCampaignSessionSchema.parse(input);
    await this.model.createSession(campaignId, toSessionPayload(payload) as ReturnType<typeof toSessionPayload> & { scheduledFor: Date });
    return this.getCampaign(userId, userRole, campaignId);
  }

  async updateSession(userId: string, userRole: UserRole, sessionId: string, input: UpdateCampaignSessionInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    const session = await this.model.findSessionById(sessionId);
    if (!session) {
      throw new AppError("CAMPAIGN_SESSION_NOT_FOUND", "Sesion no encontrada", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, session.campaignId);
    const payload = updateCampaignSessionSchema.parse(input);
    await this.model.updateSession(sessionId, toSessionPayload(payload));
    return this.getCampaign(userId, userRole, session.campaignId);
  }

  async createReference(
    userId: string,
    userRole: UserRole,
    campaignId: string,
    input: CreateCampaignReferenceInput
  ): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = createCampaignReferenceSchema.parse({
      ...input,
      aliases: input.aliases.map((alias: string) => alias.trim()).filter(Boolean)
    });
    await this.model.createReference(campaignId, payload);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async updateReference(
    userId: string,
    userRole: UserRole,
    referenceId: string,
    input: UpdateCampaignReferenceInput
  ): Promise<Campaign> {
    requireDirectorRole(userRole);
    const reference = await this.model.findReferenceById(referenceId);
    if (!reference) {
      throw new AppError("CAMPAIGN_REFERENCE_NOT_FOUND", "Referencia de campaña no encontrada", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, reference.campaignId);
    const payload = updateCampaignReferenceSchema.parse({
      ...input,
      aliases: input.aliases?.map((alias: string) => alias.trim()).filter(Boolean)
    });
    await this.model.updateReference(referenceId, payload);
    return this.getCampaign(userId, userRole, reference.campaignId);
  }

  async deleteReference(userId: string, userRole: UserRole, referenceId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const reference = await this.model.findReferenceById(referenceId);
    if (!reference) {
      throw new AppError("CAMPAIGN_REFERENCE_NOT_FOUND", "Referencia de campaña no encontrada", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, reference.campaignId);
    await this.model.deleteReference(referenceId);
    return this.getCampaign(userId, userRole, reference.campaignId);
  }

  async assignSessionExperience(
    userId: string,
    userRole: UserRole,
    sessionId: string,
    input: AssignCampaignSessionExperienceInput
  ): Promise<Campaign> {
    requireDirectorRole(userRole);
    const session = await this.model.findSessionById(sessionId);
    if (!session) {
      throw new AppError("CAMPAIGN_SESSION_NOT_FOUND", "Sesion no encontrada", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, session.campaignId);
    const payload = assignCampaignSessionExperienceSchema.parse(input);
    const campaign = await this.getCampaign(userId, userRole, session.campaignId);
    const linkedCharacterIds = new Set(campaign.characters.map((entry: Campaign["characters"][number]) => entry.characterId));
    const invalid = payload.awards.find((award: AssignCampaignSessionExperienceInput["awards"][number]) => !linkedCharacterIds.has(award.characterId));
    if (invalid) {
      throw new AppError("CAMPAIGN_CHARACTER_NOT_LINKED", "Todos los personajes deben estar vinculados a la campana", 400);
    }
    await this.model.assignSessionExperience(session.campaignId, sessionId, session.title, userId, payload.awards);
    return this.getCampaign(userId, userRole, session.campaignId);
  }

  async grantExperience(
    userId: string,
    userRole: UserRole,
    campaignId: string,
    input: GrantCampaignExperienceInput
  ): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = grantCampaignExperienceSchema.parse(input);
    const campaign = await this.getCampaign(userId, userRole, campaignId);
    const isLinked = campaign.characters.some((entry: Campaign["characters"][number]) => entry.characterId === payload.characterId);

    if (!isLinked) {
      throw new AppError(
        "CAMPAIGN_CHARACTER_NOT_LINKED",
        "El personaje debe estar vinculado a la campana antes de otorgar experiencia",
        400
      );
    }

    await this.model.grantExperience(campaignId, payload.characterId, userId, payload.amount, payload.reason);
    return this.getCampaign(userId, userRole, campaignId);
  }

  private async assertCampaignManagedBy(userId: string, userRole: UserRole, campaignId: string): Promise<void> {
    if (userRole === "superadmin") return;

    const campaign = await this.model.findCampaignOwner(campaignId);
    if (!campaign) {
      throw new AppError("CAMPAIGN_NOT_FOUND", "Campana no encontrada", 404);
    }

    if (campaign.gmId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo el director de la campana puede gestionarla", 403);
    }
  }
}
