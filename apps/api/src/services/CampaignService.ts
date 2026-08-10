import {
  createCampaignInvitationSchema,
  assignCampaignSessionExperienceSchema,
  campaignInvitationIdSchema,
  createCampaignChatMessageSchema,
  createCampaignNpcSchema,
  createCampaignReferenceSchema,
  createCampaignSchema,
  createCampaignSessionSchema,
  createEmptyCharacterSheet,
  executeCharacterAction,
  grantCampaignExperienceSchema,
  linkCampaignCharacterSchema,
  parseCharacterSheet,
  stripManagedMysticArtifactsFromSheet,
  preserveLegacyMysticArtifacts,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_RACES,
  updateCampaignNpcSchema,
  updateCampaignNpcSheetSchema,
  updateCampaignReferenceSchema,
  updateCampaignSchema,
  updateCampaignCharacterSheetSchema,
  updateCampaignSessionSchema,
  type CreateCampaignInvitationInput,
  type AssignCampaignSessionExperienceInput,
  type Campaign,
  type CampaignInvitation,
  type CampaignChatMessage,
  type CreateCampaignChatMessageInput,
  type CreateCampaignInput,
  type CreateCampaignNpcInput,
  type CreateCampaignReferenceInput,
  type CreateCampaignSessionInput,
  type GrantCampaignExperienceInput,
  type UpdateCampaignInput,
  type UpdateCampaignNpcInput,
  type UpdateCampaignNpcSheetInput,
  type UpdateCampaignReferenceInput,
  type UpdateCampaignCharacterSheetInput,
  type UpdateCampaignSessionInput,
  type UserRole
} from "@umbra/shared";
import { CampaignModel } from "../models/CampaignModel.js";
import { campaignLiveHub } from "./CampaignLiveHub.js";
import { AppError } from "../utils/AppError.js";
import { protectGrantedCharacterExperience } from "./characterExperiencePolicy.js";

const NPC_THREATS = ["Bajo", "Medio", "Alto", "Elite"] as const;
const NPC_OCCUPATIONS = ["Guardia", "Explorador", "Mercader", "Cultista", "Cazador", "Bruja", "Erudito", "Bandido"] as const;
const NPC_NAME_PREFIXES = ["Ar", "Bel", "Cor", "Dar", "El", "Fen", "Gal", "Mor", "Syl", "Tor"] as const;
const NPC_NAME_SUFFIXES = ["an", "or", "ia", "eth", "rik", "a", "os", "en", "ar", "is"] as const;

function requireDirectorRole(role: UserRole): void {
  if (role !== "gm" && role !== "superadmin") {
    throw new AppError("CAMPAIGN_FORBIDDEN", "Solo un director de juego puede realizar esta accion", 403);
  }
}

function isDirectorRole(role: UserRole): boolean {
  return role === "gm" || role === "superadmin";
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
  constructor(
    private readonly model: CampaignModel,
    private readonly mailService?: {
      sendCampaignInvitationEmail(
        recipientEmail: string,
        campaignName: string,
        gmEmail: string,
        invitationId: string
      ): Promise<void>;
    }
  ) {}

  private normalizeReferencePayload(
    campaign: Campaign,
    userId: string,
    userRole: UserRole,
    input: CreateCampaignReferenceInput | UpdateCampaignReferenceInput
  ) {
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    const sharedWithUserIds = input.sharedWithUserIds
      ? Array.from(new Set(input.sharedWithUserIds))
      : [];

    if (!isDirector) {
      if ((input.visibility && input.visibility !== "campaign") || sharedWithUserIds.length > 0) {
        throw new AppError(
          "CAMPAIGN_FORBIDDEN",
          "Las aportaciones de jugadores siempre son visibles para toda la campana",
          403
        );
      }
    }

    if (sharedWithUserIds.length > 0) {
      const validPlayerIds = new Set(
        campaign.members.filter((member) => member.role === "player").map((member) => member.userId)
      );
      const invalidTarget = sharedWithUserIds.find((memberId) => !validPlayerIds.has(memberId));
      if (invalidTarget) {
        throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes compartir entradas con jugadores de la campana", 400);
      }
    }

    return {
      ...input,
      visibility: isDirector ? input.visibility : "campaign",
      sharedWithUserIds: isDirector && input.visibility === "selected_players" ? sharedWithUserIds : []
    };
  }

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

  async listChatMessages(userId: string, userRole: UserRole, campaignId: string): Promise<CampaignChatMessage[]> {
    const campaign = await this.getCampaign(userId, userRole, campaignId);
    return campaign.chatMessages;
  }

  async createChatMessage(
    userId: string,
    _userEmail: string,
    userRole: UserRole,
    campaignId: string,
    input: CreateCampaignChatMessageInput
  ): Promise<CampaignChatMessage> {
    await this.getCampaign(userId, userRole, campaignId);
    const payload = createCampaignChatMessageSchema.parse(input);

    if (payload.actionExecution) {
      const linkedCharacter = await this.model.findCampaignCharacterForUser(campaignId, payload.actionExecution.characterId);
      if (!linkedCharacter) {
        throw new AppError("CAMPAIGN_CHARACTER_NOT_LINKED", "El personaje no esta vinculado a la campana", 404);
      }

      const isDirector = isDirectorRole(userRole);
      if (!isDirector && linkedCharacter.ownerId !== userId) {
        throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes ejecutar acciones con tus propios personajes", 403);
      }

      const sheet = parseCharacterSheet(linkedCharacter.sheet);
      const executed = executeCharacterAction(sheet, payload.actionExecution.actionId, payload.actionExecution.phase);
      const message = await this.model.createChatMessage(campaignId, {
        userId,
        characterId: payload.actionExecution.characterId,
        visibility: payload.visibility,
        messageType: "action",
        text: payload.actionExecution.note || payload.text,
        actionId: executed.action.id,
        actionLabel: executed.action.label,
        actionCost: executed.action.cost,
        actionSummary: executed.action.effectSummary,
        rolls: executed.rolls
      });
      campaignLiveHub.publish(campaignId, message);
      return message;
    }

    const message = await this.model.createChatMessage(campaignId, {
      userId,
      visibility: payload.visibility,
      messageType: "text",
      text: payload.text.trim()
    });
    campaignLiveHub.publish(campaignId, message);
    return message;
  }

  async createCampaign(userId: string, userRole: UserRole, input: CreateCampaignInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    const payload = createCampaignSchema.parse(input);
    return this.model.create(userId, payload, userRole);
  }

  async updateCampaign(userId: string, userRole: UserRole, campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    const payload = updateCampaignSchema.parse(input);
    const isDirector = isDirectorRole(userRole);

    if (isDirector) {
      await this.assertCampaignManagedBy(userId, userRole, campaignId);
      return this.model.update(campaignId, payload, userId, userRole);
    }

    await this.getCampaign(userId, userRole, campaignId);
    const payloadKeys = Object.keys(payload);
    const onlySharedNotesUpdate = payloadKeys.length > 0 && payloadKeys.every((key) => key === "sharedNotes" || key === "sharedNoteEntries");

    if (!onlySharedNotesUpdate) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes editar las notas compartidas de la campana", 403);
    }

    return this.model.update(campaignId, {
      sharedNotes: payload.sharedNotes ?? "",
      sharedNoteEntries: payload.sharedNoteEntries ?? []
    }, userId, userRole);
  }

  async inviteMember(userId: string, userRole: UserRole, campaignId: string, input: CreateCampaignInvitationInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = createCampaignInvitationSchema.parse(input);
    const target = await this.model.findMemberByEmail(payload.email.trim().toLowerCase());

    if (!target) {
      throw new AppError("USER_NOT_FOUND", "No existe un usuario con ese email", 404);
    }

    if (target.status !== "active") {
      throw new AppError("USER_NOT_ACTIVE", "La cuenta del jugador no está activa", 409);
    }

    if (target.role !== "player") {
      throw new AppError("CAMPAIGN_PLAYER_REQUIRED", "Solo se puede invitar a cuentas de jugador", 400);
    }

    const campaign = await this.getCampaign(userId, userRole, campaignId);
    if (campaign.members.some((member) => member.userId === target.id)) {
      throw new AppError("CAMPAIGN_MEMBER_EXISTS", "El jugador ya pertenece a esta campaña", 409);
    }

    const invitation = await this.model.createInvitation(campaignId, target.id, userId);
    try {
      const mailService = this.mailService ?? new (await import("./MailService.js")).MailService();
      await mailService.sendCampaignInvitationEmail(
        target.email,
        campaign.name,
        campaign.gmEmail,
        invitation.id
      );
    } catch (error) {
      await this.model.deleteInvitation(invitation.id);
      throw error;
    }

    return this.getCampaign(userId, userRole, campaignId);
  }

  async listInvitations(userId: string): Promise<CampaignInvitation[]> {
    return this.model.listInvitationsForUser(userId);
  }

  async acceptInvitation(userId: string, userRole: UserRole, invitationId: string): Promise<Campaign> {
    const normalizedInvitationId = campaignInvitationIdSchema.parse(invitationId);
    const invitation = await this.model.findInvitationById(normalizedInvitationId);
    if (!invitation || invitation.userId !== userId) {
      throw new AppError("CAMPAIGN_INVITATION_NOT_FOUND", "Invitación de campaña no encontrada", 404);
    }

    const campaignId = await this.model.acceptInvitation(normalizedInvitationId, userId);
    if (!campaignId) {
      throw new AppError("CAMPAIGN_INVITATION_NOT_FOUND", "La invitación ya no está disponible", 404);
    }
    return this.getCampaign(userId, userRole, campaignId);
  }

  async dismissInvitation(userId: string, userRole: UserRole, invitationId: string): Promise<void> {
    const normalizedInvitationId = campaignInvitationIdSchema.parse(invitationId);
    const invitation = await this.model.findInvitationById(normalizedInvitationId);
    if (!invitation) {
      throw new AppError("CAMPAIGN_INVITATION_NOT_FOUND", "Invitación de campaña no encontrada", 404);
    }

    const canDismiss = invitation.userId === userId || userRole === "superadmin" || (
      isDirectorRole(userRole) && (await this.model.findCampaignOwner(invitation.campaignId))?.gmId === userId
    );
    if (!canDismiss) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta invitación", 403);
    }
    await this.model.deleteInvitation(normalizedInvitationId);
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
    const payload = linkCampaignCharacterSchema.parse({ characterId });
    const character = await this.model.findCharacterById(payload.characterId);

    if (!character) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }

    const campaign = await this.getCampaign(userId, userRole, campaignId);
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    const isMember = campaign.members.some((member: Campaign["members"][number]) => member.userId === userId);

    if (!isDirector && !isMember) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo los miembros pueden vincular personajes a la campana", 403);
    }

    const isMemberCharacter = campaign.members.some((member: Campaign["members"][number]) => member.userId === character.ownerId);
    if (!isMemberCharacter) {
      throw new AppError(
        "CAMPAIGN_CHARACTER_OWNER_REQUIRED",
        "Solo puedes vincular personajes cuyos propietarios pertenezcan a la campana",
        400
      );
    }

    if (!isDirector && character.ownerId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes vincular tus propios personajes", 403);
    }

    await this.model.linkCharacter(campaignId, payload.characterId);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async unlinkCharacter(userId: string, userRole: UserRole, linkId: string): Promise<Campaign> {
    const link = await this.model.findCharacterLinkDetailById(linkId);
    if (!link) {
      throw new AppError("CAMPAIGN_CHARACTER_LINK_NOT_FOUND", "Vinculo de personaje no encontrado", 404);
    }

    const campaign = await this.getCampaign(userId, userRole, link.campaignId);
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    if (!isDirector && link.ownerId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes desvincular tus propios personajes", 403);
    }

    if (await this.model.characterLinkOwnsMysticArtifacts(linkId)) {
      throw new AppError("ARTIFACT_OWNER_IN_USE", "El personaje posee artefactos; el DJ debe desvincularlos y retirarlos antes", 409);
    }
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
    if (await this.model.npcOwnsMysticArtifacts(npcId)) {
      throw new AppError("ARTIFACT_OWNER_IN_USE", "El PNJ posee artefactos; desvincúlalos y retíralos antes", 409);
    }
    await this.model.deleteNpc(npcId);
    return this.getCampaign(userId, userRole, npc.campaignId);
  }

  async updateCharacterSheet(
    userId: string,
    userRole: UserRole,
    linkId: string,
    input: UpdateCampaignCharacterSheetInput
  ): Promise<Campaign> {
    const link = await this.model.findCharacterLinkDetailById(linkId);
    if (!link) {
      throw new AppError("CAMPAIGN_CHARACTER_LINK_NOT_FOUND", "Vinculo de personaje no encontrado", 404);
    }

    const isDirector = isDirectorRole(userRole);
    if (!isDirector && link.ownerId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes modificar la hoja de tus propios personajes", 403);
    }

    if (isDirector) {
      await this.assertCampaignManagedBy(userId, userRole, link.campaignId);
    }

    const character = await this.model.findCharacterById(link.characterId);
    if (!character) {
      throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
    }
    const currentSheet = parseCharacterSheet(character.sheet);
    const payload = updateCampaignCharacterSheetSchema.parse({
      sheet: {
        ...stripManagedMysticArtifactsFromSheet(input.sheet),
        progreso: {
          ...input.sheet.progreso,
          experienciaTotal: currentSheet.progreso.experienciaTotal
        }
      }
    });
    const playerSafeSheet = isDirector ? payload.sheet : preserveLegacyMysticArtifacts(currentSheet, payload.sheet);
    const protectedSheet = protectGrantedCharacterExperience(
      currentSheet,
      playerSafeSheet
    );
    await this.model.updateLinkedCharacterSheet(link.characterId, protectedSheet);
    return this.getCampaign(userId, userRole, link.campaignId);
  }

  async updateNpcSheet(
    userId: string,
    userRole: UserRole,
    npcId: string,
    input: UpdateCampaignNpcSheetInput
  ): Promise<Campaign> {
    requireDirectorRole(userRole);
    const npc = await this.model.findNpcById(npcId);
    if (!npc) {
      throw new AppError("CAMPAIGN_NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, npc.campaignId);
    const payload = updateCampaignNpcSheetSchema.parse({
      ...input,
      sheet: input.sheet ? stripManagedMysticArtifactsFromSheet(input.sheet) : null
    });
    await this.model.updateNpcSheet(npcId, payload.sheet);
    return this.getCampaign(userId, userRole, npc.campaignId);
  }

  async createNpcSheet(userId: string, userRole: UserRole, npcId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const npc = await this.model.findNpcById(npcId);
    if (!npc) {
      throw new AppError("CAMPAIGN_NPC_NOT_FOUND", "PNJ no encontrado", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, npc.campaignId);
    await this.model.createNpcSheet(npcId, {
      identidad: {
        ...createEmptyCharacterSheet().identidad,
        raza: npc.race || "Humano",
        arquetipo: npc.archetype || "Guerrero",
        profesion: npc.occupation || "",
        apariencia: npc.summary || "",
        trasfondo: npc.notes || ""
      }
    });
    return this.getCampaign(userId, userRole, npc.campaignId);
  }

  async createSession(userId: string, userRole: UserRole, campaignId: string, input: CreateCampaignSessionInput): Promise<Campaign> {
    requireDirectorRole(userRole);
    await this.assertCampaignManagedBy(userId, userRole, campaignId);
    const payload = createCampaignSessionSchema.parse(input);
    await this.model.createSession(campaignId, {
      ...payload,
      scheduledFor: new Date(payload.scheduledFor)
    });
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

  async deleteSession(userId: string, userRole: UserRole, sessionId: string): Promise<Campaign> {
    requireDirectorRole(userRole);
    const session = await this.model.findSessionById(sessionId);
    if (!session) {
      throw new AppError("CAMPAIGN_SESSION_NOT_FOUND", "Sesion no encontrada", 404);
    }

    await this.assertCampaignManagedBy(userId, userRole, session.campaignId);
    await this.model.deleteSession(sessionId);
    return this.getCampaign(userId, userRole, session.campaignId);
  }

  async createReference(
    userId: string,
    userRole: UserRole,
    campaignId: string,
    input: CreateCampaignReferenceInput
  ): Promise<Campaign> {
    const campaign = await this.getCampaign(userId, userRole, campaignId);
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    if (isDirector) {
      await this.assertCampaignManagedBy(userId, userRole, campaignId);
    }

    const payload = createCampaignReferenceSchema.parse(
      this.normalizeReferencePayload(campaign, userId, userRole, {
        ...input,
        aliases: input.aliases.map((alias: string) => alias.trim()).filter(Boolean)
      })
    );
    await this.model.createReference(campaignId, userId, payload);
    return this.getCampaign(userId, userRole, campaignId);
  }

  async updateReference(
    userId: string,
    userRole: UserRole,
    referenceId: string,
    input: UpdateCampaignReferenceInput
  ): Promise<Campaign> {
    const reference = await this.model.findReferenceById(referenceId);
    if (!reference) {
      throw new AppError("CAMPAIGN_REFERENCE_NOT_FOUND", "Referencia de campaña no encontrada", 404);
    }

    const campaign = await this.getCampaign(userId, userRole, reference.campaignId);
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    if (isDirector) {
      await this.assertCampaignManagedBy(userId, userRole, reference.campaignId);
    } else if (reference.authorId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes editar tus propias entradas de la wiki", 403);
    }

    const payload = updateCampaignReferenceSchema.parse(
      this.normalizeReferencePayload(campaign, userId, userRole, {
        ...input,
        aliases: input.aliases?.map((alias: string) => alias.trim()).filter(Boolean)
      })
    );
    await this.model.updateReference(referenceId, payload);
    return this.getCampaign(userId, userRole, reference.campaignId);
  }

  async deleteReference(userId: string, userRole: UserRole, referenceId: string): Promise<Campaign> {
    const reference = await this.model.findReferenceById(referenceId);
    if (!reference) {
      throw new AppError("CAMPAIGN_REFERENCE_NOT_FOUND", "Referencia de campaña no encontrada", 404);
    }

    const campaign = await this.getCampaign(userId, userRole, reference.campaignId);
    const isDirector = userRole === "superadmin" || campaign.gmId === userId;
    if (isDirector) {
      await this.assertCampaignManagedBy(userId, userRole, reference.campaignId);
    } else if (reference.authorId !== userId) {
      throw new AppError("CAMPAIGN_FORBIDDEN", "Solo puedes eliminar tus propias entradas de la wiki", 403);
    }

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
