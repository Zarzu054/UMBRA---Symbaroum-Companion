import type { CharacterSheet } from "@umbra/shared";

type ModifierKey = "DEF" | "INI" | "ROBMAX" | "ROBACT" | "UMBDOLOR" | "UMBCORR" | "CORRTEMP" | "CORRPERM";

type DerivedStats = {
  modifiers: Record<ModifierKey, number>;
  xpDisponible: number;
  corrupcionTotal: number;
  robustezMaximaTotal: number;
  robustezActualTotal: number;
  defensaTotal: number;
  iniciativaTotal: number;
  umbralDolorTotal: number;
  umbralCorrupcionTotal: number;
  warnings: string[];
};

const MODIFIER_REGEX = /\b(DEF|INI|ROBMAX|ROBACT|UMBDOLOR|UMBCORR|CORRTEMP|CORRPERM)\s*([+-]\d+)\b/gi;

export function computeDerivedStats(sheet: CharacterSheet): DerivedStats {
  const modifiers = collectCapabilityModifiers(sheet);

  const xpDisponible = Math.max(0, sheet.progreso.experienciaTotal - sheet.progreso.experienciaGastada);
  const corrupcionTotal =
    Math.max(0, sheet.corrupcion.temporal + modifiers.CORRTEMP) + Math.max(0, sheet.corrupcion.permanente + modifiers.CORRPERM);
  const robustezMaximaTotal = Math.max(0, sheet.combate.robustezMax + modifiers.ROBMAX);
  const robustezActualTotal = Math.min(Math.max(0, sheet.combate.robustezActual + modifiers.ROBACT), robustezMaximaTotal);
  const umbralDolorTotal = Math.max(0, sheet.combate.umbralDolor + modifiers.UMBDOLOR);
  const umbralCorrupcionTotal = Math.max(0, sheet.corrupcion.umbral + modifiers.UMBCORR);

  const baseDefensa = Number(sheet.combate.defensaBase || 10);
  const defensaTotal = baseDefensa + sheet.combate.defensaMod + modifiers.DEF;
  const iniciativaTotal = sheet.combate.iniciativaMod + modifiers.INI;

  const warnings: string[] = [];
  if (corrupcionTotal >= sheet.atributos.tenaz) {
    warnings.push("La corrupción total alcanza o supera Tenaz");
  }
  if (sheet.progreso.experienciaGastada > sheet.progreso.experienciaTotal) {
    warnings.push("La experiencia gastada supera la experiencia total");
  }
  if (sheet.combate.robustezActual > sheet.combate.robustezMax) {
    warnings.push("La robustez actual supera la robustez máxima");
  }

  return {
    modifiers,
    xpDisponible,
    corrupcionTotal,
    robustezMaximaTotal,
    robustezActualTotal,
    defensaTotal,
    iniciativaTotal,
    umbralDolorTotal,
    umbralCorrupcionTotal,
    warnings
  };
}

function collectCapabilityModifiers(sheet: CharacterSheet): Record<ModifierKey, number> {
  const result: Record<ModifierKey, number> = {
    DEF: 0,
    INI: 0,
    ROBMAX: 0,
    ROBACT: 0,
    UMBDOLOR: 0,
    UMBCORR: 0,
    CORRTEMP: 0,
    CORRPERM: 0
  };

  const capabilities = [...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales];
  for (const capability of capabilities) {
    const source = `${capability.efecto ?? ""} ${capability.notas ?? ""}`;
    if (!source) continue;

    for (const match of source.matchAll(MODIFIER_REGEX)) {
      const key = (match[1] ?? "").toUpperCase() as ModifierKey;
      const delta = Number(match[2] ?? "0");
      if (!Number.isFinite(delta)) continue;
      result[key] += delta;
    }
  }

  return result;
}
