import type { CharacterSheet } from "./index.js";
import type { MysticArtifact, MysticArtifactAbility, MysticArtifactWeaponTag, OwnedMysticArtifact } from "./mysticArtifacts.js";

const TAG_LABELS: Record<MysticArtifactWeaponTag, string> = {
  one_handed: "Una mano",
  short: "Corta",
  long: "Larga",
  heavy: "Pesada",
  ranged: "A distancia",
  thrown: "Arrojadiza"
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function artifactCostLabel(artifact: Pick<MysticArtifact, "bindingCosts">): string {
  return artifact.bindingCosts
    .map((cost) => cost.paymentType === "xp" ? `${cost.amount} PX` : `${cost.amount} Corrupcion permanente`)
    .join(" o ");
}

export function getVisibleMysticArtifactAbilities(artifact: MysticArtifact): MysticArtifactAbility[] {
  return artifact.abilities.filter((ability) => artifact.isBound || !ability.requiresBinding);
}

export function concealOwnedMysticArtifact(artifact: OwnedMysticArtifact): OwnedMysticArtifact {
  if (artifact.isBound) return artifact;
  return {
    ...artifact,
    description: "",
    sourceTitle: "",
    sourcePage: undefined,
    weapon: artifact.weapon && !artifact.weapon.requiresBinding ? artifact.weapon : undefined,
    armor: artifact.armor && !artifact.armor.requiresBinding ? artifact.armor : undefined,
    abilities: artifact.abilities.filter((ability) => !ability.requiresBinding)
  };
}

export function projectMysticArtifactsIntoSheet(
  input: CharacterSheet,
  artifacts: OwnedMysticArtifact[]
): CharacterSheet {
  const unmanagedItems = input.inventoryItems.filter((item) => !item.managedArtifactId);
  const managedItems: CharacterSheet["inventoryItems"] = artifacts.map((artifact) => {
    const weaponAvailable = artifact.kind === "weapon" && artifact.weapon && (artifact.isBound || !artifact.weapon.requiresBinding);
    const armorAvailable = artifact.kind === "armor" && artifact.armor && (artifact.isBound || !artifact.armor.requiresBinding);
    const visibleAbilities = getVisibleMysticArtifactAbilities(artifact);
    const category = weaponAvailable ? "weapon" : armorAvailable ? "armor" : "artifact";
    const weaponQualities = weaponAvailable
      ? unique([...(artifact.weapon?.qualities ?? []), ...(artifact.weapon?.tags ?? []).map((tag) => TAG_LABELS[tag]), "Mistico"])
      : [];
    const armorQualities = armorAvailable ? unique([...(artifact.armor?.qualities ?? []), "Mistico"]) : [];
    const itemId = `managed-artifact:${artifact.id}`;

    return {
      id: itemId,
      name: artifact.name,
      category,
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: artifact.isBound ? artifact.description : "",
      weight: "",
      value: "",
      equipped: input.equipmentSlots.armor === itemId || input.equipmentSlots.artifact === itemId,
      slot: weaponAvailable
        ? artifact.weapon?.tags.includes("ranged") ? "ranged" : "mainHand"
        : armorAvailable ? "armor" : "artifact",
      attackAttribute: weaponAvailable ? artifact.weapon?.attackAttribute : undefined,
      damageFormula: weaponAvailable ? artifact.weapon?.damageFormula ?? "" : "",
      protectionFormula: armorAvailable ? artifact.armor?.protectionFormula ?? "" : "",
      qualities: unique([...weaponQualities, ...armorQualities]).join(", "),
      notes: artifact.isBound ? [artifact.sourceTitle, artifact.sourcePage ? `p. ${artifact.sourcePage}` : ""].filter(Boolean).join(" ") : "",
      managedArtifactId: artifact.id,
      artifactBound: artifact.isBound,
      artifactBindingCostLabel: artifactCostLabel(artifact),
      artifactResources: artifact.resources
        .filter((resource) => resource.maximum !== undefined && resource.current !== undefined)
        .map((resource) => ({ id: resource.id, name: resource.name, maximum: resource.maximum!, current: resource.current! })),
      grantedActions: visibleAbilities
        .filter((ability) => ability.activation === "active" && !ability.locked)
        .map((ability) => {
          const checkRoll = ability.rolls.find((roll) => roll.kind === "check" || roll.kind === "attack");
          const damageRoll = ability.rolls.find((roll) => roll.kind === "damage" || roll.kind === "healing" || roll.kind === "custom");
          return {
            id: ability.id,
            label: ability.name,
            cost: ability.actionCost ?? "combat",
            rollAttribute: checkRoll?.actorAttribute,
            opponentAttribute: checkRoll?.opponentAttribute,
            fixedTarget: checkRoll?.fixedTarget,
            damageFormula: damageRoll?.formula || undefined,
            effectSummary: ability.description,
            corruptionFormula: ability.corruptionFormula,
            artifactAbilityId: ability.id,
            rolls: ability.rolls
          };
        }),
      modifiers: []
    };
  });

  const validManagedIds = new Set(managedItems.map((item) => item.id));
  const preserveSlot = (value: string): string => value.startsWith("managed-artifact:") && !validManagedIds.has(value) ? "" : value;
  return {
    ...input,
    inventoryItems: [...unmanagedItems, ...managedItems],
    equipmentSlots: {
      mainHand: preserveSlot(input.equipmentSlots.mainHand),
      offHand: preserveSlot(input.equipmentSlots.offHand),
      ranged: preserveSlot(input.equipmentSlots.ranged),
      armor: preserveSlot(input.equipmentSlots.armor),
      artifact: preserveSlot(input.equipmentSlots.artifact),
      worn: preserveSlot(input.equipmentSlots.worn)
    }
  };
}

export function stripManagedMysticArtifactsFromSheet(input: CharacterSheet): CharacterSheet {
  const isManagedId = (value: string): boolean => value.startsWith("managed-artifact:");
  return {
    ...input,
    inventoryItems: input.inventoryItems.filter((item) => !item.managedArtifactId),
    actions: input.actions.filter((action) => !action.linkedItemId || !isManagedId(action.linkedItemId))
  };
}

export function preserveLegacyMysticArtifacts(
  current: CharacterSheet,
  requested: CharacterSheet
): CharacterSheet {
  const legacyInventory = current.inventoryItems.filter((item) => item.category === "artifact" && !item.managedArtifactId);
  return {
    ...requested,
    artefactos: current.artefactos,
    inventoryItems: [
      ...requested.inventoryItems.filter((item) => item.category !== "artifact"),
      ...legacyInventory
    ]
  };
}
