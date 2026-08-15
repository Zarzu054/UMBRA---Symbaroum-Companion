import { Prisma } from "@prisma/client";
import {
  campaignItemDefinitionSchema,
  parseCharacterSheet,
  type CampaignItemDefinition,
  type CampaignItemTemplate,
  type CharacterSheet
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import {
  applyCampaignItemDefinition,
  campaignItemKindForDefinition,
  removeCampaignInventoryItems,
  upsertCampaignInventoryItem
} from "../utils/campaignItemInventory.js";
import {
  buildCharacterChanges,
  getCharacterAuditActor,
  recordCharacterChange,
  type CharacterAuditActor
} from "./CharacterAuditModel.js";

export const campaignItemInclude = {
  ownerCharacter: { include: { character: { select: { name: true, ownerId: true } } } },
  ownerNpc: { select: { name: true } }
} satisfies Prisma.CampaignItemTemplateInclude;

export type CampaignItemRow = Prisma.CampaignItemTemplateGetPayload<{ include: typeof campaignItemInclude }>;
type Transaction = Prisma.TransactionClient;
type AuditContext = { actor: CharacterAuditActor; campaignId: string; summary: string } | null;

function asJson(sheet: CharacterSheet): Prisma.InputJsonValue {
  return sheet as unknown as Prisma.InputJsonValue;
}

export function mapCampaignItem(row: CampaignItemRow): CampaignItemTemplate {
  const ownerType = row.ownerCharacterId ? "character" : row.ownerNpcId ? "npc" : null;
  return {
    id: row.id,
    campaignId: row.campaignId,
    kind: row.kind,
    definition: campaignItemDefinitionSchema.parse(row.definition),
    isUnique: row.isUnique,
    ownerType,
    ownerId: row.ownerCharacterId ?? row.ownerNpcId,
    ownerName: row.ownerCharacter?.character.name ?? row.ownerNpc?.name ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function writeCharacterSheet(
  tx: Transaction,
  characterId: string,
  before: CharacterSheet,
  after: CharacterSheet,
  audit: AuditContext
): Promise<void> {
  await tx.character.update({ where: { id: characterId }, data: { sheet: asJson(after) } });
  if (!audit) return;
  await recordCharacterChange(tx, {
    characterId,
    actor: audit.actor,
    campaignId: audit.campaignId,
    source: "campaign-items",
    summary: audit.summary,
    changes: buildCharacterChanges({ inventoryItems: before.inventoryItems, equipmentSlots: before.equipmentSlots }, {
      inventoryItems: after.inventoryItems,
      equipmentSlots: after.equipmentSlots
    })
  });
}

async function removeItemFromCampaignInventories(tx: Transaction, campaignId: string, itemId: string, audit: AuditContext): Promise<void> {
  const ids = new Set([itemId]);
  const links = await tx.campaignCharacter.findMany({
    where: { campaignId },
    include: { character: { select: { id: true, sheet: true } } }
  });
  for (const link of links) {
    const sheet = parseCharacterSheet(link.character.sheet);
    const next = removeCampaignInventoryItems(sheet, ids);
    if (next !== sheet) await writeCharacterSheet(tx, link.character.id, sheet, next, audit);
  }
  const npcs = await tx.campaignNpc.findMany({ where: { campaignId }, select: { id: true, sheet: true } });
  for (const npc of npcs) {
    if (!npc.sheet) continue;
    const sheet = parseCharacterSheet(npc.sheet);
    const next = removeCampaignInventoryItems(sheet, ids);
    if (next !== sheet) await tx.campaignNpc.update({ where: { id: npc.id }, data: { sheet: asJson(next) } });
  }
}

async function writeItemToOwner(
  tx: Transaction,
  campaignId: string,
  itemId: string,
  definition: CampaignItemDefinition,
  isUnique: boolean,
  owner: { type: "character" | "npc"; id: string } | null,
  audit: AuditContext
): Promise<void> {
  if (!owner) return;
  if (owner.type === "character") {
    const link = await tx.campaignCharacter.findFirst({ where: { id: owner.id, campaignId }, include: { character: true } });
    if (!link) return;
    const currentSheet = parseCharacterSheet(link.character.sheet);
    const sheet = upsertCampaignInventoryItem(currentSheet, itemId, definition, isUnique);
    await writeCharacterSheet(tx, link.characterId, currentSheet, sheet, audit);
    return;
  }
  const npc = await tx.campaignNpc.findFirst({ where: { id: owner.id, campaignId } });
  if (!npc?.sheet) return;
  const sheet = upsertCampaignInventoryItem(parseCharacterSheet(npc.sheet), itemId, definition, isUnique);
  await tx.campaignNpc.update({ where: { id: npc.id }, data: { sheet: asJson(sheet) } });
}

async function synchronizeReusableCopies(
  tx: Transaction,
  campaignId: string,
  itemId: string,
  definition: CampaignItemDefinition,
  audit: AuditContext
): Promise<void> {
  const links = await tx.campaignCharacter.findMany({ where: { campaignId }, include: { character: true } });
  for (const link of links) {
    const sheet = parseCharacterSheet(link.character.sheet);
    if (!sheet.inventoryItems.some((item) => item.campaignItemId === itemId)) continue;
    const next = { ...sheet, inventoryItems: sheet.inventoryItems.map((item) => (
      item.campaignItemId === itemId ? applyCampaignItemDefinition(item, itemId, definition, false) : item
    )) };
    await writeCharacterSheet(tx, link.characterId, sheet, next, audit);
  }
  const npcs = await tx.campaignNpc.findMany({ where: { campaignId } });
  for (const npc of npcs) {
    if (!npc.sheet) continue;
    const sheet = parseCharacterSheet(npc.sheet);
    if (!sheet.inventoryItems.some((item) => item.campaignItemId === itemId)) continue;
    const next = { ...sheet, inventoryItems: sheet.inventoryItems.map((item) => (
      item.campaignItemId === itemId ? applyCampaignItemDefinition(item, itemId, definition, false) : item
    )) };
    await tx.campaignNpc.update({ where: { id: npc.id }, data: { sheet: asJson(next) } });
  }
}

export class CampaignItemModel {
  async findCampaign(campaignId: string) {
    return prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, gmId: true } });
  }

  async findById(itemId: string): Promise<CampaignItemRow | null> {
    return prisma.campaignItemTemplate.findUnique({ where: { id: itemId }, include: campaignItemInclude });
  }

  async listCampaign(campaignId: string, includeArchived = false): Promise<CampaignItemRow[]> {
    return prisma.campaignItemTemplate.findMany({
      where: { campaignId, archivedAt: includeArchived ? undefined : null },
      include: campaignItemInclude,
      orderBy: [{ kind: "asc" }, { updatedAt: "desc" }]
    });
  }

  async ownerExists(campaignId: string, type: "character" | "npc", id: string): Promise<boolean> {
    return type === "character"
      ? Boolean(await prisma.campaignCharacter.findFirst({ where: { id, campaignId }, select: { id: true } }))
      : Boolean(await prisma.campaignNpc.findFirst({ where: { id, campaignId }, select: { id: true } }));
  }

  async create(
    campaignId: string,
    definition: CampaignItemDefinition,
    isUnique: boolean,
    owner: { type: "character" | "npc"; id: string } | null,
    assignTo: { type: "character" | "npc"; id: string } | null,
    actorId: string
  ): Promise<CampaignItemRow> {
    const id = await prisma.$transaction(async (tx) => {
      const actor = await getCharacterAuditActor(tx, actorId);
      const audit: AuditContext = actor ? { actor, campaignId, summary: `Creó el objeto de campaña ${definition.name}` } : null;
      const created = await tx.campaignItemTemplate.create({
        data: {
          campaignId,
          kind: campaignItemKindForDefinition(definition),
          definition: definition as unknown as Prisma.InputJsonValue,
          isUnique,
          ownerCharacterId: isUnique && owner?.type === "character" ? owner.id : null,
          ownerNpcId: isUnique && owner?.type === "npc" ? owner.id : null
        }
      });
      const recipient = isUnique ? owner : assignTo;
      await writeItemToOwner(tx, campaignId, created.id, definition, isUnique, recipient, audit);
      return created.id;
    });
    return (await this.findById(id))!;
  }

  async update(
    itemId: string,
    definition: CampaignItemDefinition,
    isUnique: boolean,
    owner: { type: "character" | "npc"; id: string } | null,
    actorId: string
  ): Promise<CampaignItemRow> {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_item_templates" WHERE "id" = ${itemId}::uuid FOR UPDATE`);
      const current = await tx.campaignItemTemplate.findUnique({ where: { id: itemId } });
      if (!current) return;
      const actor = await getCharacterAuditActor(tx, actorId);
      const audit: AuditContext = actor ? { actor, campaignId: current.campaignId, summary: `Actualizó el objeto de campaña ${definition.name}` } : null;
      const previousOwner = current.ownerCharacterId
        ? { type: "character" as const, id: current.ownerCharacterId }
        : current.ownerNpcId ? { type: "npc" as const, id: current.ownerNpcId } : null;
      await tx.campaignItemTemplate.update({
        where: { id: itemId },
        data: {
          kind: campaignItemKindForDefinition(definition),
          definition: definition as unknown as Prisma.InputJsonValue,
          isUnique,
          ownerCharacterId: isUnique && owner?.type === "character" ? owner.id : null,
          ownerNpcId: isUnique && owner?.type === "npc" ? owner.id : null
        }
      });
      if (isUnique) {
        await removeItemFromCampaignInventories(tx, current.campaignId, itemId, audit);
        await writeItemToOwner(tx, current.campaignId, itemId, definition, true, owner, audit);
      } else {
        await synchronizeReusableCopies(tx, current.campaignId, itemId, definition, audit);
        if (current.isUnique && previousOwner) {
          await writeItemToOwner(tx, current.campaignId, itemId, definition, false, previousOwner, audit);
        }
      }
    });
    return (await this.findById(itemId))!;
  }

  async assign(itemId: string, owner: { type: "character" | "npc"; id: string } | null, actorId: string): Promise<CampaignItemRow> {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_item_templates" WHERE "id" = ${itemId}::uuid FOR UPDATE`);
      const current = await tx.campaignItemTemplate.findUnique({ where: { id: itemId } });
      if (!current) return;
      const definition = campaignItemDefinitionSchema.parse(current.definition);
      const actor = await getCharacterAuditActor(tx, actorId);
      const audit: AuditContext = actor ? { actor, campaignId: current.campaignId, summary: `Transfirió la pieza única ${definition.name}` } : null;
      await removeItemFromCampaignInventories(tx, current.campaignId, itemId, audit);
      await tx.campaignItemTemplate.update({ where: { id: itemId }, data: {
        ownerCharacterId: owner?.type === "character" ? owner.id : null,
        ownerNpcId: owner?.type === "npc" ? owner.id : null
      } });
      await writeItemToOwner(tx, current.campaignId, itemId, definition, true, owner, audit);
    });
    return (await this.findById(itemId))!;
  }

  async setArchived(itemId: string, archived: boolean): Promise<CampaignItemRow> {
    await prisma.campaignItemTemplate.update({ where: { id: itemId }, data: { archivedAt: archived ? new Date() : null } });
    return (await this.findById(itemId))!;
  }
}
