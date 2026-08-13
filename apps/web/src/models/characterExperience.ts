import { getActorCapabilityXpDelta, type CharacterSheet } from "@umbra/shared";

function normalizeCapabilityName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getRatedEntryXpCost(level: string): number {
  switch (level) {
    case "maestro":
      return 60;
    case "adepto":
      return 30;
    case "principiante":
    default:
      return 10;
  }
}

export type CharacterExperienceSummary = {
  spentFromCapabilities: number;
  spentFromRituals: number;
  spentFromBlessings: number;
  extraFromBurdens: number;
  computedSpent: number;
  effectiveTotal: number;
  effectiveAvailable: number;
};

export function getCharacterExperienceSummary(sheet: CharacterSheet): CharacterExperienceSummary {
  if ((sheet.capabilitySelections?.length ?? 0) > 0) {
    const spent = sheet.capabilitySelections.reduce(
      (total, entry) => total + Math.max(0, getActorCapabilityXpDelta(entry)),
      0
    );
    const extraFromBurdens = sheet.capabilitySelections.filter((entry) => entry.kind === "carga").length * 5;
    const effectiveTotal = sheet.progreso.experienciaTotal + extraFromBurdens;
    return {
      spentFromCapabilities: sheet.capabilitySelections
        .filter((entry) => !["ritual", "bendicion", "carga", "rasgo_personaje"].includes(entry.kind))
        .reduce((total, entry) => total + Math.max(0, getActorCapabilityXpDelta(entry)), 0),
      spentFromRituals: sheet.capabilitySelections.filter((entry) => entry.kind === "ritual").length * 10,
      spentFromBlessings: sheet.capabilitySelections
        .filter((entry) => entry.kind === "bendicion")
        .reduce((total, entry) => total + Math.max(0, getActorCapabilityXpDelta(entry)), 0),
      extraFromBurdens,
      computedSpent: spent,
      effectiveTotal,
      effectiveAvailable: Math.max(0, effectiveTotal - Math.max(sheet.progreso.experienciaGastada, spent))
    };
  }
  const spentFromAbilities = sheet.habilidades
    .filter((entry) => normalizeCapabilityName(entry.nombre) !== "poder mistico")
    .reduce(
      (total, entry) => total + getRatedEntryXpCost(entry.nivel),
      0
    );
  const spentFromMysticPowers = sheet.poderesMisticos.reduce(
    (total, entry) => total + getRatedEntryXpCost(entry.nivel),
    0
  );
  const spentFromRituals = sheet.rituales.length * 10;
  const spentFromCapabilities = spentFromAbilities + spentFromMysticPowers;
  const spentFromBlessings = (sheet.bendiciones?.length ?? 0) * 5;
  const extraFromBurdens = (sheet.cargas?.length ?? 0) * 5;
  const computedSpent = spentFromCapabilities + spentFromRituals + spentFromBlessings;
  const effectiveTotal = sheet.progreso.experienciaTotal + extraFromBurdens;
  const effectiveAvailable = Math.max(0, effectiveTotal - Math.max(sheet.progreso.experienciaGastada, computedSpent));

  return {
    spentFromCapabilities,
    spentFromRituals,
    spentFromBlessings,
    extraFromBurdens,
    computedSpent,
    effectiveTotal,
    effectiveAvailable
  };
}
