import type { Prisma } from "@prisma/client";
import {
  concealOwnedMysticArtifact,
  parseCharacterSheet,
  type CharacterSheet,
  type MysticArtifact,
  type MysticArtifactDefinitionInput,
  type MysticArtifactPaymentType,
  type OwnedMysticArtifact,
  type UpdateMysticArtifactResourceInput
} from "@umbra/shared";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export const mysticArtifactInclude = {
  bindingCosts: true,
  abilities: {
    include: {
      rolls: { orderBy: { sortOrder: "asc" as const } },
      requirements: true,
      resourceCosts: { include: { resource: true } }
    },
    orderBy: { sortOrder: "asc" as const }
  },
  resources: { orderBy: { sortOrder: "asc" as const } },
  bindings: { where: { endedAt: null }, orderBy: { boundAt: "desc" as const }, take: 1 },
  ownerCharacter: {
    include: {
      character: { include: { owner: { select: { email: true } } } },
      campaign: { select: { name: true } }
    }
  },
  ownerNpc: true,
  campaign: { select: { name: true, gmId: true } }
} satisfies Prisma.MysticArtifactInclude;

export type MysticArtifactRow = Prisma.MysticArtifactGetPayload<{ include: typeof mysticArtifactInclude }>;

function asStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function levelRank(level: string | null | undefined): number {
  if (level === "maestro") return 3;
  if (level === "adepto") return 2;
  if (level === "novato") return 1;
  return 0;
}

function effectiveExperienceSpent(sheet: CharacterSheet): number {
  const rankCost = (level: string) => level === "maestro" ? 60 : level === "adepto" ? 30 : 10;
  const computed = sheet.habilidades
    .filter((entry) => normalizeName(entry.nombre) !== "poder mistico")
    .reduce((sum, entry) => sum + rankCost(entry.nivel), 0)
    + sheet.poderesMisticos.reduce((sum, entry) => sum + rankCost(entry.nivel), 0)
    + sheet.rituales.length * 10
    + sheet.bendiciones.length * 5;
  return Math.max(sheet.progreso.experienciaGastada, computed);
}

function capabilityLockReason(sheet: CharacterSheet | null, requirements: MysticArtifactRow["abilities"][number]["requirements"]): string {
  if (!sheet) return "";
  const capabilities = [...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales];
  for (const requirement of requirements) {
    if (requirement.type !== "capability") continue;
    const found = capabilities.find((entry) => normalizeName(entry.nombre) === normalizeName(requirement.capabilityName));
    if (!found) return `Requiere ${requirement.capabilityName}`;
    if (requirement.minimumLevel && levelRank(found.nivel) < levelRank(requirement.minimumLevel)) {
      return `Requiere ${requirement.capabilityName} a nivel ${requirement.minimumLevel}`;
    }
  }
  return "";
}

export function mapMysticArtifact(
  row: MysticArtifactRow,
  options: { characterSheet?: CharacterSheet | null; concealForOwner?: boolean } = {}
): MysticArtifact | OwnedMysticArtifact {
  const activeBinding = row.bindings[0] ?? null;
  const sheet = options.characterSheet === undefined
    ? row.ownerCharacter?.character.sheet ? parseCharacterSheet(row.ownerCharacter.character.sheet) : row.ownerNpc?.sheet ? parseCharacterSheet(row.ownerNpc.sheet) : null
    : options.characterSheet;
  const resourceKeyById = new Map(row.resources.map((resource) => [resource.id, resource.key]));
  const mapped: MysticArtifact = {
    id: row.id,
    scope: row.scope,
    campaignId: row.campaignId,
    presetSourceId: row.presetSourceId,
    name: row.name,
    description: row.description,
    kind: row.kind,
    sourceTitle: row.sourceTitle,
    sourcePage: row.sourcePage ?? undefined,
    bindingCosts: row.bindingCosts
      .filter((cost) => cost.paymentType !== "narrative")
      .map((cost) => ({ paymentType: cost.paymentType as MysticArtifactPaymentType, amount: cost.amount })),
    weapon: row.kind === "weapon" ? {
      attackAttribute: (row.weaponAttackAttribute ?? "diestro") as NonNullable<MysticArtifactDefinitionInput["weapon"]>["attackAttribute"],
      attackFormula: row.weaponAttackFormula,
      damageFormula: row.weaponDamageFormula,
      tags: asStrings(row.weaponTags) as NonNullable<MysticArtifactDefinitionInput["weapon"]>["tags"],
      qualities: asStrings(row.weaponQualities),
      requiresBinding: row.weaponRequiresBinding
    } : undefined,
    armor: row.kind === "armor" ? {
      protectionFormula: row.armorProtectionFormula,
      qualities: asStrings(row.armorQualities),
      requiresBinding: row.armorRequiresBinding
    } : undefined,
    ownerType: row.ownerCharacterId ? "character" : row.ownerNpcId ? "npc" : null,
    ownerId: row.ownerCharacterId ?? row.ownerNpcId,
    ownerName: row.ownerCharacter?.character.name ?? row.ownerNpc?.name ?? null,
    ownerEmail: row.ownerCharacter?.character.owner.email ?? null,
    isBound: Boolean(activeBinding),
    boundAt: activeBinding?.boundAt.toISOString() ?? null,
    bindingPaymentType: activeBinding?.paymentType ?? null,
    bindingPaymentAmount: activeBinding?.amount ?? null,
    abilities: row.abilities.map((ability) => {
      const lockReason = capabilityLockReason(sheet, ability.requirements);
      return {
        id: ability.id,
        name: ability.name,
        description: ability.description,
        activation: ability.activation,
        actionCost: (ability.actionCost || undefined) as "free" | "movement" | "combat" | "reaction" | undefined,
        corruptionFormula: ability.corruptionFormula,
        requiresBinding: ability.requiresBinding,
        perSceneLimit: ability.perSceneLimit ?? undefined,
        perSceneNote: ability.perSceneNote,
        rolls: ability.rolls.map((roll) => ({
          id: roll.id,
          kind: roll.kind,
          label: roll.label,
          formula: roll.formula,
          actorAttribute: (roll.actorAttribute || undefined) as MysticArtifact["abilities"][number]["rolls"][number]["actorAttribute"],
          opponentAttribute: (roll.opponentAttribute || undefined) as MysticArtifact["abilities"][number]["rolls"][number]["opponentAttribute"],
          fixedTarget: roll.fixedTarget ?? undefined
        })),
        requirements: ability.requirements.map((requirement) => ({
          id: requirement.id,
          type: requirement.type,
          capabilityName: requirement.capabilityName,
          minimumLevel: (requirement.minimumLevel || undefined) as "novato" | "adepto" | "maestro" | undefined,
          description: requirement.description
        })),
        resourceCosts: ability.resourceCosts.map((cost) => ({
          resourceKey: resourceKeyById.get(cost.resourceId) ?? cost.resource.key,
          amount: cost.amount
        })),
        locked: Boolean(lockReason),
        lockReason
      };
    }),
    resources: row.resources.map((resource) => ({
      id: resource.id,
      key: resource.key,
      name: resource.name,
      suggestedMaxFormula: resource.suggestedMaxFormula,
      maximum: resource.maximum ?? undefined,
      current: resource.current ?? undefined
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  if (row.scope === "campaign" && row.campaign) {
    const owned = { ...mapped, campaignName: row.campaign.name } as OwnedMysticArtifact;
    return options.concealForOwner ? concealOwnedMysticArtifact(owned) : owned;
  }
  return mapped;
}

function baseArtifactData(input: MysticArtifactDefinitionInput) {
  return {
    name: input.name,
    description: input.description,
    kind: input.kind,
    sourceTitle: input.sourceTitle,
    sourcePage: input.sourcePage,
    weaponAttackAttribute: input.weapon?.attackAttribute,
    weaponAttackFormula: input.weapon?.attackFormula ?? "1d20",
    weaponDamageFormula: input.weapon?.damageFormula ?? "",
    weaponTags: input.weapon?.tags ?? [],
    weaponQualities: input.weapon?.qualities ?? [],
    weaponRequiresBinding: input.weapon?.requiresBinding ?? true,
    armorProtectionFormula: input.armor?.protectionFormula ?? "",
    armorQualities: input.armor?.qualities ?? [],
    armorRequiresBinding: input.armor?.requiresBinding ?? true
  };
}

async function createArtifactGraph(
  tx: Prisma.TransactionClient,
  input: MysticArtifactDefinitionInput,
  metadata: { scope: "preset" | "campaign"; campaignId?: string; presetSourceId?: string; slug?: string }
): Promise<string> {
  const artifact = await tx.mysticArtifact.create({
    data: { ...baseArtifactData(input), ...metadata }
  });
  await tx.mysticArtifactBindingCost.createMany({
    data: input.bindingCosts.map((cost) => ({ artifactId: artifact.id, paymentType: cost.paymentType, amount: cost.amount }))
  });
  const resourceIds = new Map<string, string>();
  for (const [index, resource] of input.resources.entries()) {
    const created = await tx.mysticArtifactResource.create({
      data: {
        artifactId: artifact.id,
        key: resource.key,
        name: resource.name,
        suggestedMaxFormula: resource.suggestedMaxFormula,
        maximum: resource.maximum,
        current: resource.current,
        sortOrder: index
      }
    });
    resourceIds.set(resource.key, created.id);
  }
  for (const [index, ability] of input.abilities.entries()) {
    const created = await tx.mysticArtifactAbility.create({
      data: {
        artifactId: artifact.id,
        name: ability.name,
        description: ability.description,
        activation: ability.activation,
        actionCost: ability.actionCost,
        corruptionFormula: ability.corruptionFormula,
        requiresBinding: ability.requiresBinding,
        perSceneLimit: ability.perSceneLimit,
        perSceneNote: ability.perSceneNote,
        sortOrder: index,
        rolls: { create: ability.rolls.map((roll, rollIndex) => ({ ...roll, sortOrder: rollIndex })) },
        requirements: { create: ability.requirements.map((requirement) => ({
          type: requirement.type,
          capabilityName: requirement.capabilityName,
          minimumLevel: requirement.minimumLevel,
          description: requirement.description
        })) }
      }
    });
    for (const cost of ability.resourceCosts) {
      const resourceId = resourceIds.get(cost.resourceKey);
      if (!resourceId) continue;
      await tx.mysticArtifactAbilityResourceCost.create({ data: { abilityId: created.id, resourceId, amount: cost.amount } });
    }
  }
  return artifact.id;
}

function artifactRowToInput(row: MysticArtifactRow): MysticArtifactDefinitionInput {
  const mapped = mapMysticArtifact(row) as MysticArtifact;
  return {
    name: mapped.name,
    description: mapped.description,
    kind: mapped.kind,
    sourceTitle: mapped.sourceTitle,
    sourcePage: mapped.sourcePage,
    bindingCosts: mapped.bindingCosts,
    weapon: mapped.weapon,
    armor: mapped.armor,
    abilities: mapped.abilities.map(({ id: _id, locked: _locked, lockReason: _lockReason, rolls, requirements, ...ability }) => ({
      ...ability,
      rolls: rolls.map(({ id: _rollId, ...roll }) => roll),
      requirements: requirements.map(({ id: _requirementId, ...requirement }) => requirement)
    })),
    resources: mapped.resources.map(({ id: _id, ...resource }) => resource)
  };
}

export class MysticArtifactModel {
  async findCampaign(campaignId: string): Promise<{ id: string; gmId: string } | null> {
    return prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, gmId: true } });
  }

  async findCharacterLink(linkId: string): Promise<{ id: string; campaignId: string } | null> {
    return prisma.campaignCharacter.findUnique({ where: { id: linkId }, select: { id: true, campaignId: true } });
  }

  async findNpc(npcId: string): Promise<{ id: string; campaignId: string } | null> {
    return prisma.campaignNpc.findUnique({ where: { id: npcId }, select: { id: true, campaignId: true } });
  }

  async listPresets(): Promise<MysticArtifactRow[]> {
    return prisma.mysticArtifact.findMany({ where: { scope: "preset" }, include: mysticArtifactInclude, orderBy: [{ sourceTitle: "asc" }, { name: "asc" }] });
  }

  async listCampaign(campaignId: string): Promise<MysticArtifactRow[]> {
    return prisma.mysticArtifact.findMany({ where: { scope: "campaign", campaignId }, include: mysticArtifactInclude, orderBy: { updatedAt: "desc" } });
  }

  async findById(artifactId: string): Promise<MysticArtifactRow | null> {
    return prisma.mysticArtifact.findUnique({ where: { id: artifactId }, include: mysticArtifactInclude });
  }

  async createCustom(campaignId: string, input: MysticArtifactDefinitionInput): Promise<MysticArtifactRow> {
    const id = await prisma.$transaction((tx) => createArtifactGraph(tx, input, { scope: "campaign", campaignId }));
    return (await this.findById(id))!;
  }

  async clonePreset(
    campaignId: string,
    preset: MysticArtifactRow,
    name: string | undefined,
    resources: Array<{ key: string; maximum: number; current?: number }>
  ): Promise<MysticArtifactRow> {
    const input = artifactRowToInput(preset);
    input.name = name ?? input.name;
    input.resources = input.resources.map((resource) => {
      const override = resources.find((entry) => entry.key === resource.key);
      if (!override) return { ...resource, maximum: undefined, current: undefined };
      return { ...resource, maximum: override.maximum, current: override.current ?? override.maximum };
    });
    const id = await prisma.$transaction((tx) => createArtifactGraph(tx, input, { scope: "campaign", campaignId, presetSourceId: preset.id }));
    return (await this.findById(id))!;
  }

  async update(artifactId: string, input: MysticArtifactDefinitionInput): Promise<MysticArtifactRow> {
    await prisma.$transaction(async (tx) => {
      await tx.mysticArtifactAbility.deleteMany({ where: { artifactId } });
      await tx.mysticArtifactResource.deleteMany({ where: { artifactId } });
      await tx.mysticArtifactBindingCost.deleteMany({ where: { artifactId } });
      await tx.mysticArtifact.update({ where: { id: artifactId }, data: baseArtifactData(input) });
      await tx.mysticArtifactBindingCost.createMany({ data: input.bindingCosts.map((cost) => ({ artifactId, paymentType: cost.paymentType, amount: cost.amount })) });
      const resourceIds = new Map<string, string>();
      for (const [index, resource] of input.resources.entries()) {
        const created = await tx.mysticArtifactResource.create({ data: { artifactId, ...resource, sortOrder: index } });
        resourceIds.set(resource.key, created.id);
      }
      for (const [index, ability] of input.abilities.entries()) {
        const created = await tx.mysticArtifactAbility.create({
          data: {
            artifactId,
            name: ability.name,
            description: ability.description,
            activation: ability.activation,
            actionCost: ability.actionCost,
            corruptionFormula: ability.corruptionFormula,
            requiresBinding: ability.requiresBinding,
            perSceneLimit: ability.perSceneLimit,
            perSceneNote: ability.perSceneNote,
            sortOrder: index,
            rolls: { create: ability.rolls.map((roll, rollIndex) => ({ ...roll, sortOrder: rollIndex })) },
            requirements: { create: ability.requirements.map((requirement) => ({ ...requirement })) }
          }
        });
        for (const cost of ability.resourceCosts) {
          const resourceId = resourceIds.get(cost.resourceKey);
          if (resourceId) await tx.mysticArtifactAbilityResourceCost.create({ data: { abilityId: created.id, resourceId, amount: cost.amount } });
        }
      }
    });
    return (await this.findById(artifactId))!;
  }

  async delete(artifactId: string): Promise<void> {
    await prisma.mysticArtifact.delete({ where: { id: artifactId } });
  }

  async assign(artifactId: string, owner: { characterId?: string; npcId?: string }): Promise<void> {
    await prisma.mysticArtifact.update({
      where: { id: artifactId },
      data: { ownerCharacterId: owner.characterId ?? null, ownerNpcId: owner.npcId ?? null }
    });
  }

  async bindCharacter(artifactId: string, characterLinkId: string, paymentType: MysticArtifactPaymentType): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const artifact = await tx.mysticArtifact.findUnique({
        where: { id: artifactId },
        include: { bindingCosts: true, bindings: { where: { endedAt: null } }, ownerCharacter: { include: { character: true } } }
      });
      if (!artifact || artifact.ownerCharacterId !== characterLinkId || !artifact.ownerCharacter) throw new AppError("ARTIFACT_NOT_OWNED", "El personaje no posee este artefacto", 403);
      if (artifact.bindings.length > 0) throw new AppError("ARTIFACT_ALREADY_BOUND", "El artefacto ya esta vinculado", 409);
      const cost = artifact.bindingCosts.find((entry) => entry.paymentType === paymentType);
      if (!cost) throw new AppError("ARTIFACT_PAYMENT_NOT_ALLOWED", "Ese pago no esta permitido para el artefacto", 400);
      const sheet = parseCharacterSheet(artifact.ownerCharacter.character.sheet);
      if (paymentType === "xp") {
        const spent = effectiveExperienceSpent(sheet);
        if (sheet.progreso.experienciaTotal - spent < cost.amount) throw new AppError("CHARACTER_EXPERIENCE_EXCEEDED", "No hay PX suficientes para completar el vinculo", 400);
        sheet.progreso.experienciaGastada = spent + cost.amount;
      } else {
        sheet.corrupcion.permanente += cost.amount;
      }
      await tx.character.update({ where: { id: artifact.ownerCharacter.characterId }, data: { sheet } });
      await tx.mysticArtifactBinding.create({ data: { artifactId, characterOwnerId: characterLinkId, paymentType, amount: cost.amount } });
    }, { isolationLevel: "Serializable" });
  }

  async bindNpc(artifactId: string, npcId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const artifact = await tx.mysticArtifact.findUnique({ where: { id: artifactId }, include: { bindings: { where: { endedAt: null } } } });
      if (!artifact || artifact.ownerNpcId !== npcId) throw new AppError("ARTIFACT_NOT_OWNED", "El PNJ no posee este artefacto", 400);
      if (artifact.bindings.length > 0) throw new AppError("ARTIFACT_ALREADY_BOUND", "El artefacto ya esta vinculado", 409);
      await tx.mysticArtifactBinding.create({ data: { artifactId, npcOwnerId: npcId, paymentType: "narrative", amount: 0 } });
    }, { isolationLevel: "Serializable" });
  }

  async unbind(artifactId: string): Promise<void> {
    await prisma.mysticArtifactBinding.updateMany({ where: { artifactId, endedAt: null }, data: { endedAt: new Date() } });
  }

  async updateResource(resourceId: string, input: UpdateMysticArtifactResourceInput): Promise<void> {
    await prisma.mysticArtifactResource.update({ where: { id: resourceId }, data: input });
  }

  async consumeAbility(artifactId: string, abilityId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const ability = await tx.mysticArtifactAbility.findFirst({
        where: { id: abilityId, artifactId },
        include: { resourceCosts: true }
      });
      if (!ability) throw new AppError("ARTIFACT_ABILITY_NOT_FOUND", "Capacidad de artefacto no encontrada", 404);
      for (const cost of ability.resourceCosts) {
        const updated = await tx.mysticArtifactResource.updateMany({
          where: { id: cost.resourceId, artifactId, current: { gte: cost.amount } },
          data: { current: { decrement: cost.amount } }
        });
        if (updated.count !== 1) throw new AppError("ARTIFACT_RESOURCE_EXHAUSTED", "El artefacto no tiene recursos suficientes", 409);
      }
    }, { isolationLevel: "Serializable" });
  }
}
