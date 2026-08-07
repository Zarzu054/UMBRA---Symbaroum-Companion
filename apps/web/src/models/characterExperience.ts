import type { CharacterSheet } from "@umbra/shared";

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
    case "novato":
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
  const effectiveTotal = sheet.progreso.experienciaTotal;
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
