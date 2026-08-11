import { Prisma, type CharacterProfessionMembership as ProfessionRow } from "@prisma/client";
import {
  evaluateProfession,
  getBenefitProfessionIds,
  getHigherRitualBase,
  getProfessionById,
  normalizeProfessionText,
  normalizeProfessionCapabilities,
  parseCharacterSheet,
  synchronizeCharacterSheet,
  type CharacterProfessionMembership,
  type CharacterSheet
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import { buildCharacterChanges, getCharacterAuditActor, recordCharacterChange } from "./CharacterAuditModel.js";

export function professionContextFromSheet(sheet: CharacterSheet) {
  return {
    race: sheet.identidad.raza,
    culture: sheet.identidad.cultura,
    permanentCorruption: sheet.corrupcion.permanente,
    blessings: sheet.bendiciones,
    capabilities: normalizeProfessionCapabilities([
      ...sheet.capabilitySelections,
      ...sheet.habilidades.map((entry) => ({ name: entry.nombre, kind: "habilidad" as const, level: entry.nivel })),
      ...sheet.poderesMisticos.map((entry) => ({ name: entry.nombre, kind: "poder_mistico" as const, level: entry.nivel })),
      ...sheet.rituales.map((entry) => ({ name: entry.nombre, kind: "ritual" as const, level: entry.nivel }))
    ])
  };
}

export function mapProfessionMembership(row: ProfessionRow, sheet: CharacterSheet): CharacterProfessionMembership {
  const profession = getProfessionById(row.professionId);
  const eligibility = evaluateProfession(row.professionId, professionContextFromSheet(sheet), {
    includeAdmissionOnly: row.state !== "active"
  });
  return {
    id: row.id,
    characterId: row.characterId,
    professionId: row.professionId,
    professionName: profession?.name ?? row.professionId,
    state: row.state,
    effectiveState: row.state === "active" && !eligibility.eligible ? "suspended" : row.state,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    requestedAt: row.requestedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    eligibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function collectSheetCapabilityNames(sheet: CharacterSheet): string[] {
  return [
    ...sheet.habilidades.map((entry) => entry.nombre),
    ...sheet.poderesMisticos.map((entry) => entry.nombre),
    ...sheet.rituales.map((entry) => entry.nombre)
  ];
}

export async function validateProfessionBenefitAcquisition(
  characterId: string,
  previousSheet: CharacterSheet,
  nextSheet: CharacterSheet
): Promise<void> {
  const memberships = await prisma.characterProfessionMembership.findMany({
    where: { characterId, state: "active" }
  });
  validateProfessionBenefitAcquisitionWithMemberships(previousSheet, nextSheet, memberships);
}

export function validateProfessionBenefitAcquisitionWithMemberships(
  previousSheet: CharacterSheet,
  nextSheet: CharacterSheet,
  memberships: Pick<ProfessionRow, "professionId" | "state">[]
): void {
  const activeProfessionIds = new Set(
    memberships
      .filter((membership) => membership.state === "active" && evaluateProfession(membership.professionId, professionContextFromSheet(nextSheet), { includeAdmissionOnly: false }).eligible)
      .map((membership) => membership.professionId)
  );
  const previousNames = new Set(collectSheetCapabilityNames(previousSheet).map(normalizeProfessionText));
  const nextNames = collectSheetCapabilityNames(nextSheet);
  const nextNormalizedNames = new Set(nextNames.map(normalizeProfessionText));

  for (const name of nextNames) {
    if (previousNames.has(normalizeProfessionText(name))) continue;
    const requiredProfessionIds = getBenefitProfessionIds(name);
    if (requiredProfessionIds.length > 0 && !requiredProfessionIds.some((id) => activeProfessionIds.has(id))) {
      throw new Error(`PROFESSION_BENEFIT_LOCKED:${name}`);
    }
    const baseRitual = getHigherRitualBase(name);
    if (baseRitual && !nextNormalizedNames.has(normalizeProfessionText(baseRitual))) {
      throw new Error(`PROFESSION_BASE_RITUAL_REQUIRED:${name}:${baseRitual}`);
    }
  }
}

export function projectActiveProfessionBenefits(
  sheet: CharacterSheet,
  memberships: Pick<ProfessionRow, "professionId" | "state">[]
): CharacterSheet {
  const activeProfessionIds = new Set(
    memberships
      .filter((membership) => membership.state === "active" && evaluateProfession(membership.professionId, professionContextFromSheet(sheet), { includeAdmissionOnly: false }).eligible)
      .map((membership) => membership.professionId)
  );
  const isEnabled = (name: string) => {
    const professionIds = getBenefitProfessionIds(name);
    return professionIds.length === 0 || professionIds.some((id) => activeProfessionIds.has(id));
  };
  return synchronizeCharacterSheet({
    ...sheet,
    habilidades: sheet.habilidades.filter((entry) => isEnabled(entry.nombre)),
    poderesMisticos: sheet.poderesMisticos.filter((entry) => isEnabled(entry.nombre)),
    rituales: sheet.rituales.filter((entry) => isEnabled(entry.nombre)),
    capabilitySelections: sheet.capabilitySelections.filter((entry) => isEnabled(entry.name)),
    actions: sheet.actions.filter((entry) => isEnabled(entry.sourceName))
  });
}

export class ProfessionModel {
  async findRequestCharacterId(requestId: string): Promise<string | null> {
    return (await prisma.characterProfessionMembership.findUnique({ where: { id: requestId }, select: { characterId: true } }))?.characterId ?? null;
  }

  async projectActiveBenefits(characterId: string, sheet: CharacterSheet): Promise<CharacterSheet> {
    const memberships = await prisma.characterProfessionMembership.findMany({ where: { characterId } });
    return projectActiveProfessionBenefits(sheet, memberships);
  }

  async listForCharacter(characterId: string): Promise<CharacterProfessionMembership[]> {
    const character = await prisma.character.findUnique({ where: { id: characterId }, include: { professionMemberships: { orderBy: { createdAt: "asc" } } } });
    if (!character) return [];
    const sheet = parseCharacterSheet(character.sheet);
    return character.professionMemberships.map((entry) => mapProfessionMembership(entry, sheet));
  }

  async findCharacterAccess(userId: string, characterId: string) {
    return prisma.character.findUnique({
      where: { id: characterId },
      include: {
        owner: true,
        campaignLinks: { include: { campaign: true } },
        professionMemberships: true
      }
    });
  }

  async setAspiration(characterId: string, professionId: string, actorId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const actor = await getCharacterAuditActor(tx, actorId);
      const previous = await tx.characterProfessionMembership.findUnique({ where: { characterId_professionId: { characterId, professionId } } });
      if (previous?.state === "active" || previous?.state === "pending") throw new Error("PROFESSION_STATE_CONFLICT");
      const next = await tx.characterProfessionMembership.upsert({
        where: { characterId_professionId: { characterId, professionId } },
        update: { state: "aspiration", requestedById: null, reviewedById: null, requestedAt: null, reviewedAt: null, decisionNote: "" },
        create: { characterId, professionId, state: "aspiration" }
      });
      if (actor) await recordCharacterChange(tx, {
        characterId, actor, source: "profession", summary: "Marcó una profesión como objetivo",
        changes: buildCharacterChanges({ profession: previous?.professionId ?? null, state: previous?.state ?? null }, { profession: next.professionId, state: next.state })
      });
    });
  }

  async removeAspiration(characterId: string, professionId: string, actorId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.characterProfessionMembership.findUnique({ where: { characterId_professionId: { characterId, professionId } } });
      if (!current || current.state === "active" || current.state === "pending") return false;
      await tx.characterProfessionMembership.delete({ where: { id: current.id } });
      const actor = await getCharacterAuditActor(tx, actorId);
      if (actor) await recordCharacterChange(tx, {
        characterId, actor, source: "profession", summary: "Retiró un objetivo profesional",
        changes: buildCharacterChanges({ profession: current.professionId, state: current.state }, { profession: null, state: null })
      });
      return true;
    });
  }

  async requestMembership(characterId: string, professionId: string, actorId: string): Promise<"pending" | "active"> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "characters" WHERE "id" = ${characterId}::uuid FOR UPDATE`);
      const character = await tx.character.findUnique({ where: { id: characterId }, include: { campaignLinks: { include: { campaign: true } } } });
      if (!character) throw new Error("CHARACTER_NOT_FOUND");
      const sheet = parseCharacterSheet(character.sheet);
      const eligibility = evaluateProfession(professionId, professionContextFromSheet(sheet));
      if (!eligibility.eligible) throw new Error(`PROFESSION_INELIGIBLE:${eligibility.unmetRequirements.join("|")}`);
      const campaign = character.campaignLinks[0]?.campaign ?? null;
      const state = campaign ? "pending" as const : "active" as const;
      const now = new Date();
      const next = await tx.characterProfessionMembership.upsert({
        where: { characterId_professionId: { characterId, professionId } },
        update: {
          state,
          campaignId: campaign?.id ?? null,
          campaignName: campaign?.name ?? null,
          requestedById: actorId,
          requestedAt: now,
          reviewedById: campaign ? null : actorId,
          reviewedAt: campaign ? null : now,
          decisionNote: ""
        },
        create: {
          characterId, professionId, state,
          campaignId: campaign?.id ?? null, campaignName: campaign?.name ?? null,
          requestedById: actorId, requestedAt: now,
          reviewedById: campaign ? null : actorId, reviewedAt: campaign ? null : now
        }
      });
      const actor = await getCharacterAuditActor(tx, actorId);
      if (actor) await recordCharacterChange(tx, {
        characterId, actor, campaignId: campaign?.id, source: "profession",
        summary: state === "active" ? "Ingresó en una profesión" : "Solicitó el ingreso en una profesión",
        changes: buildCharacterChanges({ profession: professionId, state: "aspiration" }, { profession: next.professionId, state: next.state })
      });
      return state;
    });
  }

  async decide(requestId: string, campaignId: string, actorId: string, decision: "approve" | "reject", note: string): Promise<string> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "character_profession_memberships" WHERE "id" = ${requestId}::uuid FOR UPDATE`);
      const request = await tx.characterProfessionMembership.findFirst({ where: { id: requestId, campaignId, state: "pending" }, include: { character: true } });
      if (!request) throw new Error("PROFESSION_REQUEST_NOT_FOUND");
      const sheet = parseCharacterSheet(request.character.sheet);
      const eligibility = evaluateProfession(request.professionId, professionContextFromSheet(sheet));
      if (decision === "approve" && !eligibility.eligible) throw new Error(`PROFESSION_INELIGIBLE:${eligibility.unmetRequirements.join("|")}`);
      const now = new Date();
      const nextState = decision === "approve" ? "active" as const : "rejected" as const;
      await tx.characterProfessionMembership.update({ where: { id: request.id }, data: { state: nextState, reviewedById: actorId, reviewedAt: now, decisionNote: note } });
      const actor = await getCharacterAuditActor(tx, actorId);
      if (actor) await recordCharacterChange(tx, {
        characterId: request.characterId, actor, campaignId, source: "profession",
        summary: decision === "approve" ? "Aprobó el ingreso en una profesión" : "Rechazó el ingreso en una profesión",
        changes: buildCharacterChanges({ profession: request.professionId, state: request.state }, { profession: request.professionId, state: nextState, note })
      });
      return request.characterId;
    });
  }

  async leave(characterId: string, professionId: string, actorId: string, campaignId?: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.characterProfessionMembership.findUnique({ where: { characterId_professionId: { characterId, professionId } } });
      if (!current) return false;
      await tx.characterProfessionMembership.update({ where: { id: current.id }, data: { state: "aspiration", reviewedById: actorId, reviewedAt: new Date(), decisionNote: "" } });
      const actor = await getCharacterAuditActor(tx, actorId);
      if (actor) await recordCharacterChange(tx, {
        characterId, actor, campaignId, source: "profession", summary: campaignId ? "Revocó una profesión" : "Abandonó una profesión",
        changes: buildCharacterChanges({ profession: professionId, state: current.state }, { profession: professionId, state: "aspiration" })
      });
      return true;
    });
  }
}
