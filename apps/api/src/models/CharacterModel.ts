import { Prisma } from "@prisma/client";
import { createEmptyCharacterSheet, parseCharacterSheet, projectMysticArtifactsIntoSheet, synchronizeCharacterSheet, type Character, type CharacterSheet, type CreateCharacterInput, type OwnedMysticArtifact, type UpdateCharacterInput } from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import { mapMysticArtifact, mysticArtifactInclude } from "./MysticArtifactModel.js";
import { buildCharacterChanges, getUnreadCharacterChangeCounts, recordCharacterChange, type CharacterAuditActor } from "./CharacterAuditModel.js";
import { mapProfessionMembership, validateProfessionBenefitAcquisitionWithMemberships } from "./ProfessionModel.js";

const characterArtifactInclude = {
  professionMemberships: { orderBy: { createdAt: "asc" as const } },
  campaignLinks: {
    include: {
      ownedMysticArtifacts: { include: mysticArtifactInclude },
      mysticArtifactBindings: { where: { paymentType: "xp" as const } }
    }
  }
} satisfies Prisma.CharacterInclude;

type CharacterRow = Prisma.CharacterGetPayload<{ include: typeof characterArtifactInclude }>;

function mapRow(row: CharacterRow, unreadChangeCount = 0): Character {
  const safeSheet = normalizeSheet(row.sheet, {
    name: row.name,
    race: row.race,
    archetype: row.archetype,
    culture: row.culture,
    profession: row.profession,
    level: row.level
  });
  const mysticArtifacts = row.campaignLinks.flatMap((link) =>
    link.ownedMysticArtifacts.map((artifact) => mapMysticArtifact(artifact, { characterSheet: safeSheet, concealForOwner: true }) as OwnedMysticArtifact)
  );
  const projectedSheet = synchronizeCharacterSheet(projectMysticArtifactsIntoSheet(safeSheet, mysticArtifacts));

  return {
    id: row.id,
    name: row.name,
    archetype: row.archetype,
    race: row.race,
    culture: row.culture,
    profession: row.profession,
    level: row.level,
    sheet: projectedSheet,
    mysticArtifacts,
    artifactBindingXpSpent: row.campaignLinks.flatMap((link) => link.mysticArtifactBindings).reduce((sum, binding) => sum + binding.amount, 0),
    unreadChangeCount,
    professionMemberships: row.professionMemberships.map((entry) => mapProfessionMembership(entry, projectedSheet)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class CharacterModel {
  async ownsCampaignMysticArtifacts(ownerId: string, characterId: string): Promise<boolean> {
    return (await prisma.mysticArtifact.count({
      where: { ownerCharacter: { characterId, character: { ownerId } } }
    })) > 0;
  }

  async listByOwner(ownerId: string): Promise<Character[]> {
    const rows = await prisma.character.findMany({
      where: { ownerId },
      include: characterArtifactInclude,
      orderBy: { updatedAt: "desc" }
    });

    const unreadCounts = await getUnreadCharacterChangeCounts(ownerId, rows.map((row) => row.id));
    return rows.map((row) => mapRow(row, unreadCounts.get(row.id) ?? 0));
  }

  async create(ownerId: string, payload: CreateCharacterInput): Promise<Character> {
    const row = await prisma.character.create({
      data: {
        ownerId,
        name: payload.name,
        archetype: payload.archetype,
        race: payload.race,
        culture: payload.culture,
        profession: payload.profession,
        level: payload.level,
        sheet: payload.sheet
      },
      include: characterArtifactInclude
    });

    return mapRow(row, 0);
  }

  async findById(ownerId: string, characterId: string): Promise<Character | null> {
    const row = await prisma.character.findFirst({
      where: { id: characterId, ownerId },
      include: characterArtifactInclude
    });

    if (!row) return null;
    const unreadCounts = await getUnreadCharacterChangeCounts(ownerId, [row.id]);
    return mapRow(row, unreadCounts.get(row.id) ?? 0);
  }

  async update(
    ownerId: string,
    characterId: string,
    payload: UpdateCharacterInput,
    actor?: CharacterAuditActor,
    source = "sheet"
  ): Promise<Character | null> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "characters" WHERE "id" = ${characterId}::uuid FOR UPDATE`);
      const current = await tx.character.findFirst({
        where: { id: characterId, ownerId },
        include: characterArtifactInclude
      });
      if (!current) return null;

      const currentSheet = normalizeSheet(current.sheet, {
        name: current.name,
        race: current.race,
        archetype: current.archetype,
        culture: current.culture,
        profession: current.profession,
        level: current.level
      });
      const mergedSheet = payload.sheet ?? currentSheet;
      validateProfessionBenefitAcquisitionWithMemberships(currentSheet, mergedSheet, current.professionMemberships);
      const updated = await tx.character.update({
        where: { id: characterId },
        data: {
          name: payload.name ?? current.name,
          archetype: payload.archetype ?? current.archetype,
          race: payload.race ?? current.race,
          culture: payload.culture ?? current.culture,
          profession: payload.profession ?? current.profession,
          level: payload.level ?? current.level,
          sheet: mergedSheet
        },
        include: characterArtifactInclude
      });

      if (actor) {
        const before = { name: current.name, archetype: current.archetype, race: current.race, culture: current.culture, profession: current.profession, level: current.level, sheet: currentSheet, professionMemberships: current.professionMemberships.map((entry) => ({ id: entry.id, professionId: entry.professionId, state: mapProfessionMembership(entry, currentSheet).effectiveState })) };
        const after = { name: updated.name, archetype: updated.archetype, race: updated.race, culture: updated.culture, profession: updated.profession, level: updated.level, sheet: mergedSheet, professionMemberships: updated.professionMemberships.map((entry) => ({ id: entry.id, professionId: entry.professionId, state: mapProfessionMembership(entry, mergedSheet).effectiveState })) };
        await recordCharacterChange(tx, {
          characterId,
          actor,
          source,
          summary: source === "builder" ? "Actualizó el personaje desde el constructor" : "Actualizó la hoja del personaje",
          changes: buildCharacterChanges(before, after)
        });
      }
      return updated;
    });

    if (!row) return null;
    const unreadCounts = await getUnreadCharacterChangeCounts(ownerId, [row.id]);
    return mapRow(row, unreadCounts.get(row.id) ?? 0);
  }

  async delete(ownerId: string, characterId: string): Promise<boolean> {
    const deleted = await prisma.character.deleteMany({
      where: { id: characterId, ownerId }
    });
    return deleted.count > 0;
  }
}

function normalizeSheet(
  raw: Prisma.JsonValue | null | undefined,
  context: { name: string; race: string; archetype: string; culture: string; profession: string; level: number }
): CharacterSheet {
  const migratedRaw = migrateLegacySheet(raw);
  try {
    return parseCharacterSheet(migratedRaw ?? createEmptyCharacterSheet());
  } catch {
    const base = createEmptyCharacterSheet();
    base.identidad.raza = context.race;
    base.identidad.arquetipo = context.archetype;
    base.identidad.cultura = context.culture || base.identidad.cultura;
    base.identidad.profesion = context.profession || "";
    base.identidad.nombrePersonaje = context.name || "";
    base.progreso.nivel = 1;
    return base;
  }
}

function migrateLegacySheet(raw: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const candidate = structuredClone(raw) as Prisma.JsonObject;
  const attrs = candidate.atributos;
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return candidate;

  const old = attrs as Prisma.JsonObject;

  if ("agil" in old || "atento" in old || "diestro" in old || "inteligente" in old || "tenaz" in old) {
    return candidate;
  }

  const mapValue = (primary: string, fallback: number): number => {
    const value = old[primary];
    return typeof value === "number" ? value : fallback;
  };

  candidate.atributos = {
    agil: mapValue("rapido", 10),
    atento: mapValue("vigilante", 10),
    discreto: mapValue("discreto", 10),
    diestro: mapValue("preciso", 10),
    fuerte: mapValue("fuerte", 10),
    inteligente: mapValue("astuto", 10),
    persuasivo: mapValue("persuasivo", 10),
    tenaz: mapValue("resolutivo", 10)
  } as Prisma.JsonObject;

  return candidate;
}
