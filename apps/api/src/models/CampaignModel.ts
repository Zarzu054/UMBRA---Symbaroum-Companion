import type { Prisma } from "@prisma/client";
import { parseCharacterSheet, type Campaign, type CampaignAvailableCharacter, type UserRole } from "@umbra/shared";
import { prisma } from "../config/prisma.js";

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

function mapAvailableCharacter(row: CharacterAvailabilityRow, linkedIds: Set<string>): CampaignAvailableCharacter {
  let experienceTotal = 0;
  let experienceSpent = 0;

  try {
    const sheet = parseCharacterSheet(row.sheet);
    experienceTotal = sheet.progreso.experienciaTotal;
    experienceSpent = sheet.progreso.experienciaGastada;
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

function mapCampaign(
  row: CampaignRow,
  viewerId: string,
  viewerRole: UserRole,
  availableRows: CharacterAvailabilityRow[] = []
): Campaign {
  const linkedIds = new Set(row.characters.map((entry) => entry.characterId));
  const isDirector = viewerRole === "superadmin" || row.gmId === viewerId;
  const visibleSessions = row.sessions;

  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    setting: row.setting,
    notes: isDirector ? row.notes : "",
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
    characters: row.characters.map((entry) => {
      let experienceTotal = 0;
      let experienceSpent = 0;
      try {
        const sheet = parseCharacterSheet(entry.character.sheet);
        experienceTotal = sheet.progreso.experienciaTotal;
        experienceSpent = sheet.progreso.experienciaGastada;
      } catch {
        experienceTotal = 0;
        experienceSpent = 0;
      }

      return {
        id: entry.id,
        characterId: entry.characterId,
        name: entry.character.name,
        ownerId: entry.character.ownerId,
        ownerEmail: entry.character.owner.email,
        experienceTotal,
        experienceSpent,
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
    }))
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

  async create(gmId: string, payload: { name: string; summary: string; setting: string; notes: string }, userRole: UserRole): Promise<Campaign> {
    const row = await prisma.campaign.create({
      data: {
        gmId,
        name: payload.name,
        summary: payload.summary,
        setting: payload.setting,
        notes: payload.notes,
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
    payload: Partial<{ name: string; summary: string; setting: string; notes: string }>,
    viewerId: string,
    viewerRole: UserRole
  ): Promise<Campaign> {
    const row = await prisma.campaign.update({
      where: { id: campaignId },
      data: payload,
      include: campaignInclude
    });

    const availableRows = (await this.getAvailableCharactersForCampaignRows([row])).get(row.id) ?? [];
    return mapCampaign(row, viewerId, viewerRole, availableRows);
  }

  async addMember(campaignId: string, userId: string): Promise<void> {
    await prisma.campaignMember.upsert({
      where: {
        campaignId_userId: {
          campaignId,
          userId
        }
      },
      update: {},
      create: {
        campaignId,
        userId,
        role: "player"
      }
    });
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
      isGenerated: boolean;
    }
  ): Promise<void> {
    await prisma.campaignNpc.create({
      data: {
        campaignId,
        ...payload
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
      isGenerated: boolean;
    }>
  ): Promise<void> {
    await prisma.campaignNpc.update({
      where: { id: npcId },
      data: payload
    });
  }

  async deleteNpc(npcId: string): Promise<void> {
    await prisma.campaignNpc.delete({
      where: { id: npcId }
    });
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

  async findMemberByEmail(email: string): Promise<{ id: string; email: string; role: string } | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true }
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

  async findNpcById(npcId: string): Promise<{ id: string; campaignId: string } | null> {
    return prisma.campaignNpc.findUnique({
      where: { id: npcId },
      select: { id: true, campaignId: true }
    });
  }

  async findSessionById(sessionId: string): Promise<{ id: string; campaignId: string; title: string } | null> {
    return prisma.campaignSession.findUnique({
      where: { id: sessionId },
      select: { id: true, campaignId: true, title: true }
    });
  }

  async grantExperience(campaignId: string, characterId: string, grantedById: string, amount: number, reason: string): Promise<void> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { sheet: true }
    });

    if (!character) return;

    const sheet = parseCharacterSheet(character.sheet);
    const nextSheet = {
      ...sheet,
      progreso: {
        ...sheet.progreso,
        experienciaTotal: sheet.progreso.experienciaTotal + amount
      }
    };

    await prisma.$transaction([
      prisma.character.update({
        where: { id: characterId },
        data: { sheet: nextSheet }
      }),
      prisma.campaignXpLog.create({
        data: {
          campaignId,
          characterId,
          grantedById,
          amount,
          reason
        }
      })
    ]);
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

