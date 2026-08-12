import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  STARTER_MONSTER_CODEX,
  addCampaignCombatParticipantSchema,
  advanceCampaignCombatTurnSchema,
  campaignCombatParticipantSchema,
  computeCharacterCombatSummary,
  parseCharacterSheet,
  reorderCampaignCombatSchema,
  updateCampaignCombatParticipantSchema,
  updateCampaignCombatResourcesSchema,
  type AddCampaignCombatParticipantInput,
  type AdvanceCampaignCombatTurnInput,
  type CampaignCombat,
  type CampaignCombatAttack,
  type CampaignCombatMonsterSnapshot,
  type CampaignCombatParticipant,
  type CampaignCombatParticipantView,
  type CharacterSheet,
  type ReorderCampaignCombatInput,
  type UpdateCampaignCombatParticipantInput,
  type UpdateCampaignCombatResourcesInput,
  type UserRole
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import { buildCharacterChanges, getCharacterAuditActor, recordCharacterChange } from "../models/CharacterAuditModel.js";
import { MonsterModel } from "../models/MonsterModel.js";
import { AppError } from "../utils/AppError.js";

type CombatRow = {
  id: string;
  campaignId: string;
  round: number;
  activeParticipantId: string | null;
  revision: number;
  participants: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

function parseParticipants(value: Prisma.JsonValue): CampaignCombatParticipant[] {
  const parsed = campaignCombatParticipantSchema.array().safeParse(value);
  return parsed.success ? parsed.data.sort((left, right) => left.sortOrder - right.sortOrder) : [];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseNumber(value: string | number | null | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : fallback;
}

function attacksFromCharacterSheet(sheet: CharacterSheet): CampaignCombatAttack[] {
  const inventoryWeapons = sheet.inventoryItems
    .filter((item) => item.category === "weapon" && item.quantity > 0)
    .map((item) => ({
      name: item.name,
      attribute: item.attackAttribute || "Diestro",
      damage: item.damageFormula || "—",
      qualities: item.qualities
    }));
  if (inventoryWeapons.length > 0) return inventoryWeapons;

  return [
    [sheet.combate.armaPrincipal, sheet.combate.armaPrincipalAtributo, sheet.combate.danioPrincipal, sheet.combate.armaPrincipalCualidad],
    [sheet.combate.armaSecundaria, sheet.combate.armaSecundariaAtributo, sheet.combate.danioSecundaria, ""],
    [sheet.combate.armaTerciaria, sheet.combate.armaTerciariaAtributo, sheet.combate.danioTerciaria, sheet.combate.armaTerciariaCualidad],
    [sheet.combate.armaCuaternaria, sheet.combate.armaCuaternariaAtributo, sheet.combate.danioCuaternaria, ""]
  ].filter(([name]) => Boolean(name)).map(([name, attribute, damage, qualities]) => ({
    name: name || "Ataque",
    attribute: attribute || "Diestro",
    damage: damage || "—",
    qualities: qualities || ""
  }));
}

function snapshotMonster(monster: (typeof STARTER_MONSTER_CODEX)[number]): CampaignCombatMonsterSnapshot {
  return {
    id: monster.id,
    name: monster.name,
    category: monster.category,
    threat: monster.threat,
    source: monster.source,
    summary: monster.summary,
    sheet: monster.sheet,
    createdAt: monster.createdAt,
    updatedAt: monster.updatedAt
  };
}

function synchronizeMonsterConditions(participant: Extract<CampaignCombatParticipant, { kind: "monster" }>): void {
  const manual = participant.state.conditions.filter((condition) => !["condition-dying", "legacy-dying", "legacy-corruption"].includes(condition.id));
  if (participant.state.robustnessCurrent <= 0) {
    manual.push({ id: "condition-dying", name: "Moribundo", category: "state", active: true, severity: "major", summary: "La Resistencia ha llegado a 0.", notes: "" });
  }
  if (participant.state.temporaryCorruption + participant.state.permanentCorruption > 0) {
    manual.push({ id: "legacy-corruption", name: "Corrupción", category: "corruption", active: true, severity: "moderate", summary: "La criatura tiene Corrupción acumulada.", notes: "" });
  }
  participant.state.conditions = manual;
}

export class CampaignCombatService {
  constructor(private readonly monsterModel = new MonsterModel()) {}

  private async assertManaged(userId: string, role: UserRole, campaignId: string): Promise<void> {
    if (role !== "gm" && role !== "superadmin") throw new AppError("CAMPAIGN_FORBIDDEN", "Solo el DJ puede acceder al combate", 403);
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { gmId: true } });
    if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", "Campaña no encontrada", 404);
    if (role !== "superadmin" && campaign.gmId !== userId) throw new AppError("CAMPAIGN_FORBIDDEN", "No puedes gestionar esta campaña", 403);
  }

  private async requireRow(campaignId: string): Promise<CombatRow> {
    const row = await prisma.campaignCombat.findUnique({ where: { campaignId } });
    if (!row) throw new AppError("CAMPAIGN_COMBAT_NOT_FOUND", "No hay un combate activo", 404);
    return row;
  }

  async get(userId: string, role: UserRole, campaignId: string): Promise<CampaignCombat | null> {
    await this.assertManaged(userId, role, campaignId);
    const row = await prisma.campaignCombat.findUnique({ where: { campaignId } });
    return row ? this.enrich(row) : null;
  }

  async start(userId: string, role: UserRole, campaignId: string): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const row = await prisma.campaignCombat.upsert({
      where: { campaignId },
      create: { campaignId, round: 1, participants: [] },
      update: { round: 1, activeParticipantId: null, participants: [], revision: { increment: 1 } }
    });
    return this.enrich(row);
  }

  async finish(userId: string, role: UserRole, campaignId: string): Promise<void> {
    await this.assertManaged(userId, role, campaignId);
    await prisma.campaignCombat.deleteMany({ where: { campaignId } });
  }

  async addParticipant(userId: string, role: UserRole, campaignId: string, input: AddCampaignCombatParticipantInput): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const payload = addCampaignCombatParticipantSchema.parse(input);
    let monsterSnapshot: CampaignCombatMonsterSnapshot | null = null;
    if (payload.kind === "monster") {
      const monster = payload.sourceKind === "official"
        ? STARTER_MONSTER_CODEX.find((entry) => entry.id === payload.sourceId) ?? null
        : await this.monsterModel.findById(userId, payload.sourceId);
      if (!monster) throw new AppError("MONSTER_NOT_FOUND", "Monstruo no encontrado", 404);
      monsterSnapshot = snapshotMonster(monster);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_combats" WHERE "campaign_id" = ${campaignId}::uuid FOR UPDATE`);
      const row = await tx.campaignCombat.findUnique({ where: { campaignId } });
      if (!row) throw new AppError("CAMPAIGN_COMBAT_NOT_FOUND", "No hay un combate activo", 404);
      const participants = parseParticipants(row.participants);
      let additions: CampaignCombatParticipant[] = [];

      if (payload.kind === "character") {
        if (participants.some((entry) => entry.kind === "character" && entry.campaignCharacterId === payload.campaignCharacterId)) throw new AppError("COMBAT_PARTICIPANT_EXISTS", "El PJ ya participa en el combate", 409);
        const link = await tx.campaignCharacter.findFirst({ where: { id: payload.campaignCharacterId, campaignId }, include: { character: true } });
        if (!link) throw new AppError("CAMPAIGN_CHARACTER_LINK_NOT_FOUND", "PJ vinculado no encontrado", 404);
        additions = [{ id: randomUUID(), kind: "character", campaignCharacterId: link.id, alias: link.character.name, initiativeOverride: null, sortOrder: participants.length }];
      } else if (payload.kind === "npc") {
        if (participants.some((entry) => entry.kind === "npc" && entry.campaignNpcId === payload.campaignNpcId)) throw new AppError("COMBAT_PARTICIPANT_EXISTS", "El PNJ ya participa en el combate", 409);
        const npc = await tx.campaignNpc.findFirst({ where: { id: payload.campaignNpcId, campaignId } });
        if (!npc || !npc.sheet) throw new AppError("CAMPAIGN_NPC_SHEET_REQUIRED", "El PNJ necesita una ficha completa", 409);
        additions = [{ id: randomUUID(), kind: "npc", campaignNpcId: npc.id, alias: npc.name, initiativeOverride: null, sortOrder: participants.length }];
      } else {
        const snapshot = monsterSnapshot!;
        const maximum = Math.max(1, parseNumber(snapshot.sheet.toughness, snapshot.sheet.attributes.strong));
        additions = Array.from({ length: payload.quantity }, (_, index) => ({
          id: randomUUID(), kind: "monster" as const, sourceKind: payload.sourceKind, sourceId: payload.sourceId,
          alias: payload.alias?.trim() || (payload.quantity > 1 ? `${snapshot.name} ${index + 1}` : snapshot.name),
          initiativeOverride: null, sortOrder: participants.length + index, snapshot,
          state: { robustnessCurrent: maximum, temporaryCorruption: 0, permanentCorruption: snapshot.sheet.corruption ?? 0, conditions: [] }
        }));
      }

      await tx.campaignCombat.update({
        where: { campaignId },
        data: { participants: asJson([...participants, ...additions]), activeParticipantId: row.activeParticipantId ?? additions[0]?.id ?? null, revision: { increment: 1 } }
      });
    });
    return (await this.get(userId, role, campaignId))!;
  }

  async updateParticipant(userId: string, role: UserRole, campaignId: string, participantId: string, input: UpdateCampaignCombatParticipantInput): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const payload = updateCampaignCombatParticipantSchema.parse(input);
    await this.mutateParticipants(campaignId, payload.revision, (participants) => {
      const participant = participants.find((entry) => entry.id === participantId);
      if (!participant) throw new AppError("COMBAT_PARTICIPANT_NOT_FOUND", "Participante no encontrado", 404);
      if (payload.alias !== undefined) participant.alias = payload.alias;
      if (payload.initiativeOverride !== undefined) participant.initiativeOverride = payload.initiativeOverride;
      return {};
    });
    return (await this.get(userId, role, campaignId))!;
  }

  async removeParticipant(userId: string, role: UserRole, campaignId: string, participantId: string): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    await this.mutateParticipants(campaignId, undefined, (participants, row) => {
      const index = participants.findIndex((entry) => entry.id === participantId);
      if (index < 0) throw new AppError("COMBAT_PARTICIPANT_NOT_FOUND", "Participante no encontrado", 404);
      participants.splice(index, 1);
      participants.forEach((entry, order) => { entry.sortOrder = order; });
      return { activeParticipantId: row.activeParticipantId === participantId ? participants[Math.min(index, participants.length - 1)]?.id ?? null : row.activeParticipantId };
    });
    return (await this.get(userId, role, campaignId))!;
  }

  async reorder(userId: string, role: UserRole, campaignId: string, input: ReorderCampaignCombatInput): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const payload = reorderCampaignCombatSchema.parse(input);
    await this.mutateParticipants(campaignId, payload.revision, (participants) => {
      if (payload.participantIds.length !== participants.length || payload.participantIds.some((id) => !participants.some((entry) => entry.id === id))) throw new AppError("COMBAT_ORDER_INVALID", "El orden no incluye a todos los participantes", 409);
      const order = new Map(payload.participantIds.map((id, index) => [id, index]));
      participants.sort((left, right) => order.get(left.id)! - order.get(right.id)!);
      participants.forEach((entry, index) => { entry.sortOrder = index; });
      return {};
    });
    return (await this.get(userId, role, campaignId))!;
  }

  async advanceTurn(userId: string, role: UserRole, campaignId: string, input: AdvanceCampaignCombatTurnInput): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const payload = advanceCampaignCombatTurnSchema.parse(input);
    await this.mutateParticipants(campaignId, payload.revision, (participants, row) => {
      if (participants.length === 0) return { activeParticipantId: null, round: 1 };
      if (payload.action === "select") {
        if (!participants.some((entry) => entry.id === payload.participantId)) throw new AppError("COMBAT_PARTICIPANT_NOT_FOUND", "Participante no encontrado", 404);
        return { activeParticipantId: payload.participantId! };
      }
      const currentIndex = Math.max(0, participants.findIndex((entry) => entry.id === row.activeParticipantId));
      if (payload.action === "next") {
        const wraps = currentIndex === participants.length - 1;
        return { activeParticipantId: participants[wraps ? 0 : currentIndex + 1].id, round: wraps ? row.round + 1 : row.round };
      }
      const wraps = currentIndex === 0;
      return { activeParticipantId: participants[wraps ? participants.length - 1 : currentIndex - 1].id, round: wraps ? Math.max(1, row.round - 1) : row.round };
    });
    return (await this.get(userId, role, campaignId))!;
  }

  async updateResources(userId: string, role: UserRole, campaignId: string, participantId: string, input: UpdateCampaignCombatResourcesInput): Promise<CampaignCombat> {
    await this.assertManaged(userId, role, campaignId);
    const payload = updateCampaignCombatResourcesSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_combats" WHERE "campaign_id" = ${campaignId}::uuid FOR UPDATE`);
      const row = await tx.campaignCombat.findUnique({ where: { campaignId } });
      if (!row) throw new AppError("CAMPAIGN_COMBAT_NOT_FOUND", "No hay un combate activo", 404);
      const participants = parseParticipants(row.participants);
      const participant = participants.find((entry) => entry.id === participantId);
      if (!participant) throw new AppError("COMBAT_PARTICIPANT_NOT_FOUND", "Participante no encontrado", 404);

      if (participant.kind === "monster") {
        const maximum = Math.max(1, parseNumber(participant.snapshot.sheet.toughness, participant.snapshot.sheet.attributes.strong));
        if (payload.robustnessCurrent !== undefined) participant.state.robustnessCurrent = Math.min(maximum, payload.robustnessCurrent);
        if (payload.temporaryCorruption !== undefined) participant.state.temporaryCorruption = payload.temporaryCorruption;
        if (payload.permanentCorruption !== undefined) participant.state.permanentCorruption = payload.permanentCorruption;
        if (payload.conditions !== undefined) participant.state.conditions = payload.conditions;
        synchronizeMonsterConditions(participant);
        await tx.campaignCombat.update({ where: { campaignId }, data: { participants: asJson(participants), revision: { increment: 1 } } });
        return;
      }

      if (participant.kind === "character") {
        const link = await tx.campaignCharacter.findFirst({ where: { id: participant.campaignCharacterId, campaignId }, select: { characterId: true } });
        if (!link) throw new AppError("CAMPAIGN_CHARACTER_LINK_NOT_FOUND", "PJ vinculado no encontrado", 404);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "characters" WHERE "id" = ${link.characterId}::uuid FOR UPDATE`);
        const current = await tx.character.findUnique({ where: { id: link.characterId }, select: { sheet: true } });
        if (!current) throw new AppError("CHARACTER_NOT_FOUND", "Personaje no encontrado", 404);
        const before = parseCharacterSheet(current.sheet);
        const next = patchSheetResources(before, payload);
        await tx.character.update({ where: { id: link.characterId }, data: { sheet: asJson(next) } });
        const actor = await getCharacterAuditActor(tx, userId);
        if (actor) await recordCharacterChange(tx, { characterId: link.characterId, actor, campaignId, source: "combat", summary: "Actualizó recursos desde el combate", changes: buildCharacterChanges({ sheet: before }, { sheet: next }) });
      } else {
        const npcLink = await tx.campaignNpc.findFirst({ where: { id: participant.campaignNpcId, campaignId }, select: { id: true } });
        if (!npcLink) throw new AppError("CAMPAIGN_NPC_NOT_FOUND", "PNJ no encontrado", 404);
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_npcs" WHERE "id" = ${npcLink.id}::uuid FOR UPDATE`);
        const npc = await tx.campaignNpc.findUnique({ where: { id: npcLink.id }, select: { id: true, sheet: true } });
        if (!npc?.sheet) throw new AppError("CAMPAIGN_NPC_SHEET_REQUIRED", "El PNJ ya no tiene una ficha completa", 409);
        const next = patchSheetResources(parseCharacterSheet(npc.sheet), payload);
        await tx.campaignNpc.update({ where: { id: npc.id }, data: { sheet: asJson(next) } });
      }
      await tx.campaignCombat.update({ where: { campaignId }, data: { revision: { increment: 1 } } });
    });
    return (await this.get(userId, role, campaignId))!;
  }

  private async mutateParticipants(campaignId: string, expectedRevision: number | undefined, mutation: (participants: CampaignCombatParticipant[], row: CombatRow) => Partial<Pick<CombatRow, "activeParticipantId" | "round">>): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "campaign_combats" WHERE "campaign_id" = ${campaignId}::uuid FOR UPDATE`);
      const row = await tx.campaignCombat.findUnique({ where: { campaignId } });
      if (!row) throw new AppError("CAMPAIGN_COMBAT_NOT_FOUND", "No hay un combate activo", 404);
      if (expectedRevision !== undefined && row.revision !== expectedRevision) throw new AppError("CAMPAIGN_COMBAT_CONFLICT", "El combate cambió en otra pestaña; se ha recargado", 409);
      const participants = parseParticipants(row.participants);
      const state = mutation(participants, row);
      await tx.campaignCombat.update({ where: { campaignId }, data: { participants: asJson(participants), ...state, revision: { increment: 1 } } });
    });
  }

  private async enrich(row: CombatRow): Promise<CampaignCombat> {
    const participants = parseParticipants(row.participants);
    const characterIds = participants.filter((entry): entry is Extract<CampaignCombatParticipant, { kind: "character" }> => entry.kind === "character").map((entry) => entry.campaignCharacterId);
    const npcIds = participants.filter((entry): entry is Extract<CampaignCombatParticipant, { kind: "npc" }> => entry.kind === "npc").map((entry) => entry.campaignNpcId);
    const [characters, npcs] = await Promise.all([
      prisma.campaignCharacter.findMany({ where: { campaignId: row.campaignId, id: { in: characterIds } }, include: { character: true } }),
      prisma.campaignNpc.findMany({ where: { campaignId: row.campaignId, id: { in: npcIds } } })
    ]);
    const characterMap = new Map(characters.map((entry) => [entry.id, entry]));
    const npcMap = new Map(npcs.map((entry) => [entry.id, entry]));
    const views = participants.flatMap((participant): CampaignCombatParticipantView[] => {
      if (participant.kind === "monster") return [monsterView(participant)];
      const source = participant.kind === "character" ? characterMap.get(participant.campaignCharacterId)?.character : npcMap.get(participant.campaignNpcId);
      if (!source?.sheet) return [];
      return [sheetView(participant, parseCharacterSheet(source.sheet))];
    });
    return { id: row.id, campaignId: row.campaignId, round: row.round, activeParticipantId: views.some((entry) => entry.id === row.activeParticipantId) ? row.activeParticipantId : views[0]?.id ?? null, revision: row.revision, participants: views, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
}

function patchSheetResources(sheet: CharacterSheet, input: UpdateCampaignCombatResourcesInput): CharacterSheet {
  const summary = computeCharacterCombatSummary(sheet);
  return parseCharacterSheet({
    ...sheet,
    combate: { ...sheet.combate, robustezMax: Math.max(sheet.combate.robustezMax, summary.robustnessMaximum), robustezActual: input.robustnessCurrent === undefined ? sheet.combate.robustezActual : Math.min(summary.robustnessMaximum, input.robustnessCurrent) },
    corrupcion: { ...sheet.corrupcion, temporal: input.temporaryCorruption ?? sheet.corrupcion.temporal, permanente: input.permanentCorruption ?? sheet.corrupcion.permanente },
    conditions: input.conditions ?? sheet.conditions
  });
}

function sheetView(participant: Extract<CampaignCombatParticipant, { kind: "character" | "npc" }>, sheet: CharacterSheet): CampaignCombatParticipantView {
  const summary = computeCharacterCombatSummary(sheet);
  return {
    id: participant.id, kind: participant.kind, sourceId: participant.kind === "character" ? participant.campaignCharacterId : participant.campaignNpcId,
    alias: participant.alias, initiativeOverride: participant.initiativeOverride, sortOrder: participant.sortOrder,
    initiative: participant.initiativeOverride ?? summary.initiative, defense: summary.defense, armor: summary.armor || "Sin armadura", armorDetail: summary.armorDetail,
    robustnessCurrent: summary.robustnessCurrent, robustnessMaximum: summary.robustnessMaximum, painThreshold: summary.painThreshold,
    temporaryCorruption: sheet.corrupcion.temporal, permanentCorruption: sheet.corrupcion.permanente, corruptionThreshold: summary.corruptionThreshold,
    conditions: sheet.conditions, attacks: attacksFromCharacterSheet(sheet)
  };
}

function monsterView(participant: Extract<CampaignCombatParticipant, { kind: "monster" }>): CampaignCombatParticipantView {
  const sheet = participant.snapshot.sheet;
  const maximum = Math.max(1, parseNumber(sheet.toughness, sheet.attributes.strong));
  return {
    id: participant.id, kind: "monster", sourceId: participant.sourceId, sourceKind: participant.sourceKind, alias: participant.alias,
    initiativeOverride: participant.initiativeOverride, sortOrder: participant.sortOrder, initiative: participant.initiativeOverride ?? sheet.attributes.quick,
    defense: sheet.defense, armor: sheet.fixedValues.armor === null ? sheet.armor : String(sheet.fixedValues.armor), armorDetail: sheet.armorDetails, robustnessCurrent: Math.min(maximum, participant.state.robustnessCurrent), robustnessMaximum: maximum,
    painThreshold: sheet.painThreshold, temporaryCorruption: participant.state.temporaryCorruption, permanentCorruption: participant.state.permanentCorruption,
    corruptionThreshold: sheet.attributes.resolute, conditions: participant.state.conditions,
    attacks: sheet.weapons.length > 0 ? sheet.weapons.map((weapon) => ({ name: weapon.name, attribute: weapon.attribute || "Diestro", damage: weapon.fixedValue === null ? weapon.damage : `${weapon.fixedValue}`, qualities: weapon.qualities })) : [{ name: sheet.attack, attribute: "Diestro", damage: sheet.fixedValues.damage === null ? sheet.damage : `${sheet.fixedValues.damage}`, qualities: "" }],
    snapshot: participant.snapshot
  };
}
