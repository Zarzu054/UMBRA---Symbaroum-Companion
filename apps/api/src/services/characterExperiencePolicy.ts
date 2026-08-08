import type { CharacterSheet, SkillLevel } from "@umbra/shared";
import { AppError } from "../utils/AppError.js";

function normalizeCapabilityName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getRatedEntryXpCost(level: SkillLevel): number {
  if (level === "maestro") return 60;
  if (level === "adepto") return 30;
  return 10;
}

export function getComputedCharacterExperienceSpent(sheet: CharacterSheet): number {
  const abilities = sheet.habilidades
    .filter((entry) => normalizeCapabilityName(entry.nombre) !== "poder mistico")
    .reduce((total, entry) => total + getRatedEntryXpCost(entry.nivel), 0);
  const powers = sheet.poderesMisticos.reduce(
    (total, entry) => total + getRatedEntryXpCost(entry.nivel),
    0
  );
  const rituals = sheet.rituales.length * 10;
  const blessings = sheet.bendiciones.length * 5;
  return abilities + powers + rituals + blessings;
}

export function getEffectiveCharacterExperienceSpent(sheet: CharacterSheet): number {
  return Math.max(sheet.progreso.experienciaGastada, getComputedCharacterExperienceSpent(sheet));
}

export function protectGrantedCharacterExperience(
  currentSheet: CharacterSheet,
  requestedSheet: CharacterSheet
): CharacterSheet {
  const experienceTotal = currentSheet.progreso.experienciaTotal;
  const currentSpent = getEffectiveCharacterExperienceSpent(currentSheet);
  const requestedSpent = getEffectiveCharacterExperienceSpent(requestedSheet);

  if (requestedSpent > experienceTotal && requestedSpent > currentSpent) {
    throw new AppError(
      "CHARACTER_EXPERIENCE_EXCEEDED",
      `No puedes gastar ${requestedSpent} PX: el personaje solo tiene ${experienceTotal} PX concedidos`,
      400
    );
  }

  return {
    ...requestedSheet,
    progreso: {
      ...requestedSheet.progreso,
      experienciaTotal: experienceTotal,
      experienciaGastada: requestedSpent <= experienceTotal
        ? requestedSpent
        : requestedSheet.progreso.experienciaGastada
    }
  };
}
