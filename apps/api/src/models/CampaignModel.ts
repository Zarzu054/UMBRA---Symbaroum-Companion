import type { Prisma } from "@prisma/client";
import { createEmptyCharacterSheet, decodeCampaignDmNotes, decodeCampaignSharedNotes, encodeCampaignDmNotes, encodeCampaignSharedNotes, parseCharacterSheet, projectMysticArtifactsIntoSheet, synchronizeCharacterSheet, type Campaign, type CampaignAvailableCharacter, type CampaignInvitation, type CharacterSheet, type OwnedMysticArtifact, type UserRole } from "@umbra/shared";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { getEffectiveCharacterExperienceSpent } from "../services/characterExperiencePolicy.js";
import { mapMysticArtifact, mysticArtifactInclude } from "./MysticArtifactModel.js";

const campaignInclude = {
  gm: true,
  members: {
    include: {
      user: true
    },
    orderBy: {
      joinedAt: "asc"
    }
  },
  characters: {
    include: {
      character: {
        include: {
          owner: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  npcs: {
    orderBy: {
      updatedAt: "desc"
    }
  },
  experienceLog: {
    include: {
      character: true,
      grantedBy: true
    },
    orderBy: {
      createdAt: "desc"
    }
  },
  sessions: {
    orderBy: {
      scheduledFor: "desc"
    }
  },
  references: {
    include: {
      author: true,
      sharedWith: {
        include: {
          user: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  },
  chatMessages: {
    include: {
      user: true,
      character: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  invitations: {
    include: {
      user: true,
      invitedBy: true
    },
    orderBy: {
      createdAt: "desc"
    }
  },
  mysticArtifacts: {
    include: mysticArtifactInclude,
    orderBy: { updatedAt: "desc" }
  }
} satisfies Prisma.CampaignInclude;

type CampaignRow = Prisma.CampaignGetPayload<{
  include: typeof campaignInclude;
}>;

type CharacterAvailabilityRow = {
  id: string;
  ownerId: string;
  name: string;
  updatedAt: Date;
  owner: {
    email: string;
  };
  sheet: Prisma.JsonValue;
};

type CampaignChatMessageRow = Prisma.CampaignChatMessageGetPayload<{
  include: {
    user: true;
    character: true;
  };
}>;

function mapAvailableCharacter(row: CharacterAvailabilityRow, linkedIds: Set<string>): CampaignAvailableCharacter {
  let experienceTotal = 0;
  let experienceSpent = 0;

  try {
    const sheet = parseCharacterSheet(row.sheet);
    experienceTotal = sheet.progreso.experienciaTotal;
    experienceSpent = getEffectiveCharacterExperienceSpent(sheet);
  } catch {
    experienceTotal = 0;
    experienceSpent = 0;
  }

  return {
    characterId: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerEmail: row.owner.email,
    experienceTotal,
    experienceSpent,
    linked: linkedIds.has(row.id)
  };
}

function mapChatMessage(row: CampaignChatMessageRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    userId: row.userId,
    userEmail: row.user.email,
    characterId: row.characterId,
    characterName: row.character?.name ?? null,
    visibility: row.visibility,
    messageType: row.messageType,
    text: row.text,
    actionId: row.actionId,
    actionLabel: row.actionLabel,
    actionCost: row.actionCost as "free" | "movement" | "combat" | "reaction" | null,
    actionSummary: row.actionSummary,
    rolls: Array.isArray(row.rolls) ? row.rolls as [] : [],
    createdAt: row.createdAt.toISOString()
  };
}

function mapCampaign(
  row: CampaignRow,
  viewerId: string,
  viewerRole: UserRole,
  availableRows: CharacterAvailabilityRow[] = []
): Campaign {
  const linkedIds = new Set(row.characters.map((entry) => entry.characterId));
  const isDirector = viewerRole === "superadmin" || row.gmId === viewerId;
  const visibleSessions = row.sessions;
  const visibleReferences = row.references.filter((reference) =>
    isDirector ||
    reference.visibility === "campaign" ||
    (reference.visibility === "selected_players" && reference.sharedWith.some((entry) => entry.userId === viewerId))
  );
  const visibleChatMessages = row.chatMessages.filter(
    (message) => isDirector || message.userId === viewerId || message.visibility === "all"
  );
  const decodedSharedNotes = decodeCampaignSharedNotes(row.sharedNotes);
  const decodedDmNotes = isDirector ? decodeCampaignDmNotes(row.notes) : { legacyText: "", entries: [] };

  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    setting: row.setting,
    notes: decodedDmNotes.legacyText,
    dmNoteEntries: decodedDmNotes.entries,
    sharedNotes: decodedSharedNotes.legacyText,
    sharedNoteEntries: decodedSharedNotes.entries,
    gmId: row.gmId,
    gmEmail: row.gm.email,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    members: row.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      role: member.role,
      joinedAt: member.joinedAt.toISOString()
    })),
    pendingInvitations: isDirector ? row.invitations.map((invitation) => ({
      id: invitation.id,
      campaignId: invitation.campaignId,
      campaignName: row.name,
      gmEmail: invitation.invitedBy.email,
      invitedEmail: invitation.user.email,
      createdAt: invitation.createdAt.toISOString()
    })) : [],
    characters: row.characters.map((entry) => {
      let experienceTotal = 0;
      let experienceSpent = 0;
      const baseSheet = parseCharacterSheet(entry.character.sheet);
      try {
        experienceTotal = baseSheet.progreso.experienciaTotal;
        experienceSpent = getEffectiveCharacterExperienceSpent(baseSheet);
      } catch {
        experienceTotal = 0;
        experienceSpent = 0;
      }

      const ownedArtifacts = row.mysticArtifacts
        .filter((artifact) => artifact.ownerCharacterId === entry.id)
        .map((artifact) => mapMysticArtifact(artifact, { characterSheet: baseSheet, concealForOwner: !isDirector }) as OwnedMysticArtifact);
      const visibleSheet = synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(baseSheet, ownedArtifacts));
      return {
        id: entry.id,
        characterId: entry.characterId,
        name: entry.character.name,
        ownerId: entry.character.ownerId,
        ownerEmail: entry.character.owner.email,
        experienceTotal,
        experienceSpent,
        sheet: isDirector || entry.character.ownerId === viewerId ? visibleSheet : null,
        updatedAt: entry.character.updatedAt.toISOString()
      };
    }),
    availableCharacters: availableRows.map((availableRow) => mapAvailableCharacter(availableRow, linkedIds)),
    npcs: row.npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      race: npc.race,
      archetype: npc.archetype,
      occupation: npc.occupation,
      threat: npc.threat,
      summary: npc.summary,
      notes: npc.notes,
      statBlock: npc.statBlock,
      sheet: npc.sheet ? synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(
        parseCharacterSheet(npc.sheet),
        row.mysticArtifacts
          .filter((artifact) => artifact.ownerNpcId === npc.id)
          .map((artifact) => mapMysticArtifact(artifact, { characterSheet: parseCharacterSheet(npc.sheet), concealForOwner: false }) as OwnedMysticArtifact)
      )) : null,
      isGenerated: npc.isGenerated,
      createdAt: npc.createdAt.toISOString(),
      updatedAt: npc.updatedAt.toISOString()
    })),
    experienceLog: row.experienceLog.map((entry) => ({
      id: entry.id,
      sessionId: entry.sessionId,
      characterId: entry.characterId,
      characterName: entry.character.name,
      grantedById: entry.grantedById,
      grantedByEmail: entry.grantedBy.email,
      amount: entry.amount,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString()
    })),
    sessions: visibleSessions.map((session) => ({
      id: session.id,
      title: session.title,
      scheduledFor: session.scheduledFor.toISOString(),
      location: session.location,
      summary: session.summary,
      publicNotes: session.publicNotes,
      dmNotes: isDirector ? session.dmNotes : "",
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    })),
    references: visibleReferences.map((reference) => ({
      id: reference.id,
      name: reference.name,
      label: reference.label,
      aliases: Array.isArray(reference.aliases) ? reference.aliases.filter((entry): entry is string => typeof entry === "string") : [],
      summary: reference.summary,
      content: reference.content,
      authorId: reference.authorId,
      authorEmail: reference.author.email,
      visibility: reference.visibility,
      sharedWithUserIds: isDirector ? reference.sharedWith.map((entry) => entry.userId) : [],
      sharedWithEmails: isDirector ? reference.sharedWith.map((entry) => entry.user.email) : [],
      createdAt: reference.createdAt.toISOString(),
      updatedAt: reference.updatedAt.toISOString()
    })),
    chatMessages: visibleChatMessages.map((message) => mapChatMessage(message)),
    mysticArtifacts: isDirector ? row.mysticArtifacts.map((artifact) => mapMysticArtifact(artifact)) : []
  };
}

export class CampaignModel {
  async listAccessible(userId: string, userRole: UserRole): Promise<Campaign[]> {
    const rows = await prisma.campaign.findMany({
      where:
        userRole === "superadmin"
          ? undefined
          : {
              OR: [{ gmId: userId }, { members: { some: { userId } } }]
            },
      include: campaignInclude,
      orderBy: {
        updatedAt: "desc"
      }
    });

    const availableByCampaign = await this.getAvailableCharactersForCampaignRows(rows);
    return rows.map((row) => mapCampaign(row, userId, userRole, availableByCampaign.get(row.id) ?? []));
  }

  async findAccessibleById(userId: string, userRole: UserRole, campaignId: string): Promise<Campaign | null> {
    const row = await prisma.campaign.findFirst({
      where:
        userRole === "superadmin"
          ? { id: campaignId }
          : {
              id: campaignId,
              OR: [{ gmId: userId }, { members: { some: { userId } } }]
            },
      include: campaignInclude
    });

    if (!row) return null;
    const availableRows = (await this.getAvailableCharactersForCampaignRows([row])).get(row.id) ?? [];
    return mapCampaign(row, userId, userRole, availableRows);
  }

  async create(
    gmId: string,
    payload: { name: string; summary: string; setting: string; notes: string; dmNoteEntries?: Campaign["dmNoteEntries"]; sharedNotes: string; sharedNoteEntries?: Campaign["sharedNoteEntries"] },
    userRole: UserRole
  ): Promise<Campaign> {
    const row = await prisma.campaign.create({
      data: {
        gmId,
        name: payload.name,
        summary: payload.summary,
        setting: payload.setting,
        notes: payload.dmNoteEntries?.length ? encodeCampaignDmNotes(payload.dmNoteEntries) : payload.notes,
        sharedNotes: payload.sharedNoteEntries !== undefined ? encodeCampaignSharedNotes(payload.sharedNoteEntries) : payload.sharedNotes,
        members: {
          create: {
            userId: gmId,
            role: "gm"
          }
        }
      },
      include: campaignInclude
    });

    return mapCampaign(row, gmId, userRole);
  }

  async update(
    campaignId: string,
    payload: Partial<{ name: string; summary: string; setting: string; notes: string; dmNoteEntries: Campaign["dmNoteEntries"]; sharedNotes: string; sharedNoteEntries: Campaign["sharedNoteEntries"] }>,
    viewerId: string,
    viewerRole: UserRole
  ): Promise<Campaign> {
    const nextPayload = {
      ...payload,
      notes: payload.dmNoteEntries !== undefined ? encodeCampaignDmNotes(payload.dmNoteEntries) : payload.notes,
      sharedNotes: payload.sharedNoteEntries !== undefined ? encodeCampaignSharedNotes(payload.sharedNoteEntries) : payload.sharedNotes
    };
    delete (nextPayload as { dmNoteEntries?: Campaign["dmNoteEntries"] }).dmNoteEntries;
    delete (nextPayload as { sharedNoteEntries?: Campaign["sharedNoteEntries"] }).sharedNoteEntries;

    const row = await prisma.campaign.update({
      where: { id: campaignId },
      data: nextPayload,
      include: campaignInclude
    });

    const availableRows = (await this.getAvailableCharactersForCampaignRows([row])).get(row.id) ?? [];
    return mapCampaign(row, viewerId, viewerRole, availableRows);
  }

  async removeMember(memberId: string): Promise<void> {
    await prisma.campaignMember.delete({
      where: { id: memberId }
    });
  }

  async linkCharacter(campaignId: string, characterId: string): Promise<void> {
    await prisma.campaignCharacter.upsert({
      where: {
        campaignId_characterId: {
          campaignId,
          characterId
        }
      },
      update: {},
      create: {
        campaignId,
        characterId
      }
    });
  }

  async unlinkCharacter(linkId: string): Promise<void> {
    await prisma.campaignCharacter.delete({
      where: { id: linkId }
    });
  }

  async createInvitation(campaignId: string, userId: string, invitedById: string): Promise<CampaignInvitation> {
    const row = await prisma.campaignInvitation.upsert({
      where: { campaignId_userId: { campaignId, userId } },
      update: { invitedById, createdAt: new Date() },
      create: { campaignId, userId, invitedById },
      include: {
        campaign: { include: { gm: true } },
        user: true,
        invitedBy: true
      }
    });

    return {
      id: row.id,
      campaignId: row.campaignId,
      campaignName: row.campaign.name,
      gmEmail: row.campaign.gm.email,
      invitedEmail: row.user.email,
      createdAt: row.createdAt.toISOString()
    };
  }

  async deleteInvitation(invitationId: string): Promise<void> {
    await prisma.campaignInvitation.deleteMany({ where: { id: invitationId } });
  }

  async findInvitationById(invitationId: string): Promise<{
    id: string;
    campaignId: string;
    userId: string;
    invitedById: string;
  } | null> {
    return prisma.campaignInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, campaignId: true, userId: true, invitedById: true }
    });
  }

  async listInvitationsForUser(userId: string): Promise<CampaignInvitation[]> {
    const rows = await prisma.campaignInvitation.findMany({
      where: { userId },
      include: { campaign: { include: { gm: true } }, user: true, invitedBy: true },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      campaignName: row.campaign.name,
      gmEmail: row.campaign.gm.email,
      invitedEmail: row.user.email,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<string | null> {
    return prisma.$transaction(async (transaction) => {
      const invitation = await transaction.campaignInvitation.findFirst({
        where: { id: invitationId, userId },
        select: { campaignId: true }
      });
      if (!invitation) return null;

      await transaction.campaignMember.upsert({
        where: { campaignId_userId: { campaignId: invitation.campaignId, userId } },
        update: {},
        create: { campaignId: invitation.campaignId, userId, role: "player" }
      });
      await transaction.campaignInvitation.delete({ where: { id: invitationId } });
      return invitation.campaignId;
    });
  }

  async characterLinkOwnsMysticArtifacts(linkId: string): Promise<boolean> {
    return (await prisma.mysticArtifact.count({ where: { ownerCharacterId: linkId } })) > 0;
  }

  async createNpc(
    campaignId: string,
    payload: {
      name: string;
      race: string;
      archetype: string;
      occupation: string;
      threat: string;
      summary: string;
      notes: string;
      statBlock: string;
      sheet?: Prisma.JsonValue | null;
      isGenerated: boolean;
    }
  ): Promise<void> {
    const normalizedSheet = payload.sheet === null ? PrismaRuntime.JsonNull : payload.sheet;
    await prisma.campaignNpc.create({
      data: {
        campaignId,
        ...payload,
        sheet: normalizedSheet as Prisma.InputJsonValue | typeof PrismaRuntime.JsonNull | undefined
      }
    });
  }

  async updateNpc(
    npcId: string,
    payload: Partial<{
      name: string;
      race: string;
      archetype: string;
      occupation: string;
      threat: string;
      summary: string;
      notes: string;
      statBlock: string;
      sheet: Prisma.JsonValue | null;
      isGenerated: boolean;
    }>
  ): Promise<void> {
    const normalizedPayload = "sheet" in payload
      ? {
          ...payload,
          sheet: payload.sheet === null ? PrismaRuntime.JsonNull : payload.sheet
        }
      : payload;
    await prisma.campaignNpc.update({
      where: { id: npcId },
      data: normalizedPayload as Prisma.CampaignNpcUpdateInput
    });
  }

  async deleteNpc(npcId: string): Promise<void> {
    await prisma.campaignNpc.delete({
      where: { id: npcId }
    });
  }

  async npcOwnsMysticArtifacts(npcId: string): Promise<boolean> {
    return (await prisma.mysticArtifact.count({ where: { ownerNpcId: npcId } })) > 0;
  }

  async createSession(
    campaignId: string,
    payload: {
      title: string;
      scheduledFor: Date;
      location: string;
      summary: string;
      publicNotes: string;
      dmNotes: string;
      status: "planned" | "completed" | "cancelled";
    }
  ): Promise<void> {
    await prisma.campaignSession.create({
      data: {
        campaignId,
        title: payload.title,
        scheduledFor: payload.scheduledFor,
        location: payload.location,
        summary: payload.summary,
        publicNotes: payload.publicNotes,
        dmNotes: payload.dmNotes,
        status: payload.status
      }
    });
  }

  async updateSession(
    sessionId: string,
    payload: Partial<{
      title: string;
      scheduledFor: Date;
      location: string;
      summary: string;
      publicNotes: string;
      dmNotes: string;
      status: "planned" | "completed" | "cancelled";
    }>
  ): Promise<void> {
    await prisma.campaignSession.update({
      where: { id: sessionId },
      data: {
        title: payload.title,
        scheduledFor: payload.scheduledFor,
        location: payload.location,
        summary: payload.summary,
        publicNotes: payload.publicNotes,
        dmNotes: payload.dmNotes,
        status: payload.status
      }
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await prisma.campaignSession.delete({
      where: { id: sessionId }
    });
  }

  async createReference(
    campaignId: string,
    authorId: string,
    payload: {
      name: string;
      label: string;
      aliases: string[];
      summary: string;
      content: string;
      visibility: "gm_only" | "campaign" | "selected_players";
      sharedWithUserIds: string[];
    }
  ): Promise<void> {
    await prisma.campaignReference.create({
      data: {
        campaignId,
        authorId,
        name: payload.name,
        label: payload.label,
        aliases: payload.aliases,
        summary: payload.summary,
        content: payload.content,
        visibility: payload.visibility,
        sharedWith: payload.sharedWithUserIds.length > 0 ? {
          createMany: {
            data: payload.sharedWithUserIds.map((userId) => ({ userId }))
          }
        } : undefined
      }
    });
  }

  async updateReference(
    referenceId: string,
    payload: Partial<{
      name: string;
      label: string;
      aliases: string[];
      summary: string;
      content: string;
      visibility: "gm_only" | "campaign" | "selected_players";
      sharedWithUserIds: string[];
    }>
  ): Promise<void> {
    await prisma.campaignReference.update({
      where: { id: referenceId },
      data: {
        name: payload.name,
        label: payload.label,
        aliases: payload.aliases,
        summary: payload.summary,
        content: payload.content,
        visibility: payload.visibility,
        ...(payload.sharedWithUserIds
          ? {
              sharedWith: {
                deleteMany: {},
                ...(payload.sharedWithUserIds.length > 0
                  ? {
                      createMany: {
                        data: payload.sharedWithUserIds.map((userId) => ({ userId }))
                      }
                    }
                  : {})
              }
            }
          : {})
      }
    });
  }

  async deleteReference(referenceId: string): Promise<void> {
    await prisma.campaignReference.delete({
      where: { id: referenceId }
    });
  }

  async createChatMessage(
    campaignId: string,
    payload: {
      userId: string;
      characterId?: string;
      visibility: "all" | "gm_only";
      messageType: "text" | "action";
      text: string;
      actionId?: string;
      actionLabel?: string;
      actionCost?: string;
      actionSummary?: string;
      rolls?: unknown[];
    }
  ) {
    const row = await prisma.campaignChatMessage.create({
      data: {
        campaignId,
        userId: payload.userId,
        characterId: payload.characterId,
        visibility: payload.visibility,
        messageType: payload.messageType,
        text: payload.text,
        actionId: payload.actionId,
        actionLabel: payload.actionLabel,
        actionCost: payload.actionCost,
        actionSummary: payload.actionSummary,
        rolls: (payload.rolls ?? []) as Prisma.InputJsonValue
      },
      include: {
        user: true,
        character: true
      }
    });

    return mapChatMessage(row as CampaignChatMessageRow);
  }

  async listChatMessages(campaignId: string) {
    const rows = await prisma.campaignChatMessage.findMany({
      where: { campaignId },
      include: {
        user: true,
        character: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return rows.map((row) => mapChatMessage(row));
  }

  async findMemberByEmail(email: string): Promise<{ id: string; email: string; role: string; status: string } | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, status: true }
    });
  }

  async findCampaignOwner(campaignId: string): Promise<{ gmId: string } | null> {
    return prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { gmId: true }
    });
  }

  async findMemberById(memberId: string): Promise<{ id: string; campaignId: string; role: string; userId: string } | null> {
    return prisma.campaignMember.findUnique({
      where: { id: memberId },
      select: { id: true, campaignId: true, role: true, userId: true }
    });
  }

  async findCharacterById(characterId: string): Promise<{
    id: string;
    ownerId: string;
    name: string;
    sheet: Prisma.JsonValue;
  } | null> {
    return prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, ownerId: true, name: true, sheet: true }
    });
  }

  async findCharacterLinkById(linkId: string): Promise<{ id: string; campaignId: string; characterId: string } | null> {
    return prisma.campaignCharacter.findUnique({
      where: { id: linkId },
      select: { id: true, campaignId: true, characterId: true }
    });
  }

  async findCharacterLinkDetailById(
    linkId: string
  ): Promise<{ id: string; campaignId: string; characterId: string; ownerId: string } | null> {
    const row = await prisma.campaignCharacter.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        campaignId: true,
        characterId: true,
        character: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!row) return null;
    return {
      id: row.id,
      campaignId: row.campaignId,
      characterId: row.characterId,
      ownerId: row.character.ownerId
    };
  }

  async findNpcById(
    npcId: string
  ): Promise<{ id: string; campaignId: string; name: string; race: string; archetype: string; occupation: string; summary: string; notes: string; sheet: Prisma.JsonValue | null } | null> {
    return prisma.campaignNpc.findUnique({
      where: { id: npcId },
      select: { id: true, campaignId: true, name: true, race: true, archetype: true, occupation: true, summary: true, notes: true, sheet: true }
    });
  }

  async findSessionById(sessionId: string): Promise<{ id: string; campaignId: string; title: string } | null> {
    return prisma.campaignSession.findUnique({
      where: { id: sessionId },
      select: { id: true, campaignId: true, title: true }
    });
  }

  async findReferenceById(
    referenceId: string
  ): Promise<{ id: string; campaignId: string; authorId: string; visibility: "gm_only" | "campaign" | "selected_players" } | null> {
    return prisma.campaignReference.findUnique({
      where: { id: referenceId },
      select: { id: true, campaignId: true, authorId: true, visibility: true }
    });
  }

  async findCampaignCharacterForUser(campaignId: string, characterId: string): Promise<{ characterId: string; ownerId: string; sheet: CharacterSheet } | null> {
    const row = await prisma.campaignCharacter.findFirst({
      where: {
        campaignId,
        characterId
      },
      include: {
        character: { select: { ownerId: true, sheet: true } },
        ownedMysticArtifacts: { include: mysticArtifactInclude }
      }
    });

    if (!row) return null;
    const baseSheet = parseCharacterSheet(row.character.sheet);
    const artifacts = row.ownedMysticArtifacts.map((artifact) =>
      mapMysticArtifact(artifact, { characterSheet: baseSheet, concealForOwner: false }) as OwnedMysticArtifact
    );
    return {
      characterId: row.characterId,
      ownerId: row.character.ownerId,
      sheet: synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(baseSheet, artifacts))
    };
  }

  async updateLinkedCharacterSheet(characterId: string, sheet: CharacterSheet): Promise<void> {
    await prisma.character.update({
      where: { id: characterId },
      data: {
        name: sheet.identidad.nombrePersonaje || undefined,
        race: String(sheet.identidad.raza),
        culture: String(sheet.identidad.cultura),
        archetype: String(sheet.identidad.arquetipo),
        profession: sheet.identidad.profesion,
        sheet
      }
    });
  }

  async createNpcSheet(npcId: string, seed?: Partial<CharacterSheet>): Promise<void> {
    const base = createEmptyCharacterSheet();
    const nextSheet: CharacterSheet = {
      ...base,
      ...seed,
      identidad: {
        ...base.identidad,
        ...seed?.identidad
      },
      atributos: {
        ...base.atributos,
        ...seed?.atributos
      },
      progreso: {
        ...base.progreso,
        ...seed?.progreso
      },
      combate: {
        ...base.combate,
        ...seed?.combate
      },
      corrupcion: {
        ...base.corrupcion,
        ...seed?.corrupcion
      },
      recursos: {
        ...base.recursos,
        ...seed?.recursos
      },
      grupo: {
        ...base.grupo,
        ...seed?.grupo
      }
    };

    await prisma.campaignNpc.update({
      where: { id: npcId },
      data: { sheet: nextSheet }
    });
  }

  async updateNpcSheet(npcId: string, sheet: CharacterSheet | null): Promise<void> {
    await prisma.campaignNpc.update({
      where: { id: npcId },
      data: { sheet: (sheet === null ? PrismaRuntime.JsonNull : sheet) as Prisma.InputJsonValue | typeof PrismaRuntime.JsonNull }
    });
  }

  async grantExperience(campaignId: string, characterId: string, grantedById: string, amount: number, reason: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { sheet: true }
      });

      if (!character) return;

      const sheet = parseCharacterSheet(character.sheet);
      await tx.character.update({
        where: { id: characterId },
        data: {
          sheet: {
            ...sheet,
            progreso: {
              ...sheet.progreso,
              experienciaTotal: sheet.progreso.experienciaTotal + amount
            }
          }
        }
      });
      await tx.campaignXpLog.create({
        data: {
          campaignId,
          characterId,
          grantedById,
          amount,
          reason
        }
      });
    });
  }

  async assignSessionExperience(
    campaignId: string,
    sessionId: string,
    sessionTitle: string,
    grantedById: string,
    awards: Array<{ characterId: string; amount: number }>
  ): Promise<void> {
    const validAwards = awards.filter((award) => award.amount > 0);
    if (validAwards.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const award of validAwards) {
        const character = await tx.character.findUnique({
          where: { id: award.characterId },
          select: { sheet: true }
        });

        if (!character) continue;

        const sheet = parseCharacterSheet(character.sheet);
        await tx.character.update({
          where: { id: award.characterId },
          data: {
            sheet: {
              ...sheet,
              progreso: {
                ...sheet.progreso,
                experienciaTotal: sheet.progreso.experienciaTotal + award.amount
              }
            }
          }
        });

        await tx.campaignXpLog.create({
          data: {
            campaignId,
            sessionId,
            characterId: award.characterId,
            grantedById,
            amount: award.amount,
            reason: `Sesion: ${sessionTitle}`
          }
        });
      }
    });
  }

  private async getAvailableCharactersForCampaignRows(rows: CampaignRow[]): Promise<Map<string, CharacterAvailabilityRow[]>> {
    const map = new Map<string, CharacterAvailabilityRow[]>();
    for (const row of rows) {
      const ownerIds = row.members.map((member) => member.userId);
      if (ownerIds.length === 0) {
        map.set(row.id, []);
        continue;
      }

      const characters = await prisma.character.findMany({
        where: {
          ownerId: {
            in: ownerIds
          }
        },
        include: {
          owner: {
            select: {
              email: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      });

      map.set(row.id, characters);
    }

    return map;
  }
}

