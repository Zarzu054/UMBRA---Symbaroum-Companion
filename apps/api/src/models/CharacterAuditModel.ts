import { Prisma, type UserRole } from "@prisma/client";
import type { CharacterChangeDiff, CharacterChangeLogPage } from "@umbra/shared";
import { prisma } from "../config/prisma.js";

export type CharacterAuditActor = {
  id: string;
  email: string;
  role: UserRole;
};

export async function getCharacterAuditActor(tx: TransactionClient, userId: string): Promise<CharacterAuditActor | null> {
  return tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
}

type TransactionClient = Prisma.TransactionClient;

const ROOT_SECTIONS: Record<string, string> = {
  name: "Identidad",
  archetype: "Identidad",
  race: "Identidad",
  culture: "Identidad",
  profession: "Identidad",
  level: "Progreso",
  identidad: "Identidad",
  atributos: "Atributos",
  combate: "Combate",
  robustez: "Recursos",
  corrupcion: "Corrupción",
  condiciones: "Condiciones",
  inventario: "Inventario",
  habilidades: "Capacidades",
  poderesMisticos: "Capacidades",
  rituales: "Capacidades",
  rasgos: "Capacidades",
  rasgosMonstruosos: "Capacidades",
  bendiciones: "Capacidades",
  cargas: "Capacidades",
  professionMemberships: "Profesiones",
  progreso: "Progreso",
  trasfondo: "Trasfondo",
  personalNotes: "Notas",
  artefactos: "Artefactos",
  campaign: "Campaña"
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  archetype: "Arquetipo",
  race: "Raza",
  culture: "Cultura",
  profession: "Profesión",
  level: "Nivel",
  experienciaTotal: "PX total",
  experienciaGastada: "PX gastada",
  temporal: "Corrupción temporal",
  permanente: "Corrupción permanente",
  taleros: "Táleros",
  chelines: "Chelines",
  ortegs: "Ortegs"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayIdentity(value: unknown): string | null {
  if (!isRecord(value)) return null;
  for (const key of ["id", "templateId", "nombre", "name", "titulo", "title", "key"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return `${key}:${candidate.trim().toLocaleLowerCase("es")}`;
  }
  return null;
}

function sectionFor(path: string): string {
  const parts = path.replace(/^sheet\./, "").split(/[.[]/).filter(Boolean);
  return ROOT_SECTIONS[parts[0]] ?? "Ficha";
}

function labelFor(path: string): string {
  const last = path.split(/[.[]/).filter(Boolean).at(-1)?.replace(/]$/, "") ?? path;
  if (FIELD_LABELS[last]) return FIELD_LABELS[last];
  return last.replace(/([a-záéíóúñ])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toLocaleUpperCase("es"));
}

function pushChange(
  changes: CharacterChangeDiff[],
  path: string,
  operation: CharacterChangeDiff["operation"],
  before?: unknown,
  after?: unknown
): void {
  changes.push({
    path,
    section: sectionFor(path),
    label: labelFor(path),
    operation,
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {})
  });
}

function compareValues(before: unknown, after: unknown, path: string, changes: CharacterChangeDiff[]): void {
  if (Object.is(before, after)) return;
  if (before === undefined) return pushChange(changes, path, "added", undefined, after);
  if (after === undefined) return pushChange(changes, path, "removed", before);

  if (Array.isArray(before) && Array.isArray(after)) {
    const beforeIds = before.map(arrayIdentity);
    const afterIds = after.map(arrayIdentity);
    if (beforeIds.every(Boolean) && afterIds.every(Boolean)) {
      const beforeMap = new Map(before.map((value, index) => [beforeIds[index]!, value]));
      const afterMap = new Map(after.map((value, index) => [afterIds[index]!, value]));
      for (const [id, value] of beforeMap) {
        if (!afterMap.has(id)) pushChange(changes, `${path}[${id.split(":").slice(1).join(":")}]`, "removed", value);
      }
      for (const [id, value] of afterMap) {
        const itemPath = `${path}[${id.split(":").slice(1).join(":")}]`;
        if (!beforeMap.has(id)) pushChange(changes, itemPath, "added", undefined, value);
        else compareValues(beforeMap.get(id), value, itemPath, changes);
      }
      return;
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) pushChange(changes, path, "changed", before, after);
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) compareValues(before[key], after[key], path ? `${path}.${key}` : key, changes);
    return;
  }

  if (JSON.stringify(before) !== JSON.stringify(after)) pushChange(changes, path, "changed", before, after);
}

export function buildCharacterChanges(before: unknown, after: unknown): CharacterChangeDiff[] {
  const changes: CharacterChangeDiff[] = [];
  compareValues(before, after, "", changes);
  return changes.filter((change) => change.path);
}

export async function recordCharacterChange(
  tx: TransactionClient,
  input: {
    characterId: string;
    actor: CharacterAuditActor;
    source: string;
    summary: string;
    changes: CharacterChangeDiff[];
    campaignId?: string | null;
  }
): Promise<void> {
  if (input.changes.length === 0) return;

  const character = await tx.character.findUnique({
    where: { id: input.characterId },
    select: {
      ownerId: true,
      campaignLinks: {
        take: 1,
        include: { campaign: { select: { id: true, name: true, gmId: true } } }
      }
    }
  });
  if (!character) return;

  const linkedCampaign = character.campaignLinks[0]?.campaign ?? null;
  const campaignId = input.campaignId === undefined ? linkedCampaign?.id ?? null : input.campaignId;
  const campaign = campaignId
    ? linkedCampaign?.id === campaignId
      ? linkedCampaign
      : await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, name: true, gmId: true } })
    : null;
  const recipientId = input.actor.id === character.ownerId ? campaign?.gmId ?? null : character.ownerId;

  await tx.characterChangeEvent.create({
    data: {
      characterId: input.characterId,
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      source: input.source,
      summary: input.summary,
      changes: JSON.parse(JSON.stringify(input.changes)) as Prisma.InputJsonValue,
      receipts: recipientId && recipientId !== input.actor.id
        ? { create: { userId: recipientId, characterId: input.characterId } }
        : undefined
    }
  });
}

export async function getUnreadCharacterChangeCounts(
  userId: string,
  characterIds: string[],
  campaignByCharacter?: Map<string, string>
): Promise<Map<string, number>> {
  if (characterIds.length === 0) return new Map();
  if (campaignByCharacter) {
    const receipts = await prisma.characterChangeReceipt.findMany({
      where: { userId, characterId: { in: characterIds }, readAt: null },
      select: { characterId: true, event: { select: { campaignId: true } } }
    });
    const counts = new Map<string, number>();
    for (const receipt of receipts) {
      if (campaignByCharacter.get(receipt.characterId) !== receipt.event.campaignId) continue;
      counts.set(receipt.characterId, (counts.get(receipt.characterId) ?? 0) + 1);
    }
    return counts;
  }
  const grouped = await prisma.characterChangeReceipt.groupBy({
    by: ["characterId"],
    where: { userId, characterId: { in: characterIds }, readAt: null },
    _count: { _all: true }
  });
  return new Map(grouped.map((entry) => [entry.characterId, entry._count._all]));
}

export class CharacterAuditModel {
  async list(userId: string, userRole: UserRole, characterId: string, cursor?: string, limit = 50): Promise<CharacterChangeLogPage | null> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: {
        ownerId: true,
        campaignLinks: { take: 1, include: { campaign: { select: { id: true, gmId: true } } } }
      }
    });
    if (!character) return null;
    const link = character.campaignLinks[0] ?? null;
    const isOwner = character.ownerId === userId;
    const canManage = Boolean(link && (userRole === "superadmin" || link.campaign.gmId === userId));
    if (!isOwner && !canManage) return null;

    const safeLimit = Math.max(1, Math.min(100, limit));
    const rows = await prisma.characterChangeEvent.findMany({
      where: {
        characterId,
        ...(!isOwner ? { campaignId: link!.campaign.id } : {})
      },
      include: { receipts: { where: { userId }, select: { readAt: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: safeLimit + 1
    });
    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit);
    return {
      events: page.map((row) => ({
        id: row.id,
        characterId: row.characterId,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        actorRole: row.actorRole,
        source: row.source,
        summary: row.summary,
        changes: Array.isArray(row.changes) ? row.changes as unknown as CharacterChangeDiff[] : [],
        isUnread: row.receipts.some((receipt) => receipt.readAt === null),
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async markRead(userId: string, userRole: UserRole, characterId: string): Promise<boolean> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { ownerId: true, campaignLinks: { take: 1, include: { campaign: { select: { id: true, gmId: true } } } } }
    });
    if (!character) return false;
    const link = character.campaignLinks[0] ?? null;
    const isOwner = character.ownerId === userId;
    if (!isOwner && !(link && (userRole === "superadmin" || link.campaign.gmId === userId))) return false;
    await prisma.characterChangeReceipt.updateMany({
      where: {
        userId,
        characterId,
        readAt: null,
        ...(!isOwner ? { event: { campaignId: link!.campaign.id } } : {})
      },
      data: { readAt: new Date() }
    });
    return true;
  }
}
