import { computeCharacterCombatSummary, findWeaponQualityOption, getCharacterMonsterTraitEffects, parseWeaponQualities, type CharacterSheet } from "@umbra/shared";
import { getCharacterExperienceSummary } from "./characterExperience";

type ModifierKey = "DEF" | "INI" | "ROBMAX" | "ROBACT" | "UMBDOLOR" | "UMBCORR" | "CORRTEMP" | "CORRPERM";

type DerivedStats = {
  modifiers: Record<ModifierKey, number>;
  xpDisponible: number;
  corrupcionTotal: number;
  robustezMaximaTotal: number;
  robustezActualTotal: number;
  defensaTotal: number;
  defensaArmaduraMod: number;
  defensaArmaduraDetalle: string;
  iniciativaTotal: number;
  umbralDolorTotal: number;
  umbralCorrupcionTotal: number;
  armaduraNatural: string;
  armaduraActiva: string;
  armaduraNaturalBreakdown: Array<{
    label: string;
    formula?: string;
    detail?: string;
  }>;
  warnings: string[];
};

const MODIFIER_REGEX = /\b(DEF|INI|ROBMAX|ROBACT|UMBDOLOR|UMBCORR|CORRTEMP|CORRPERM)\s*([+-]\d+)\b/gi;

export function computeDerivedStats(sheet: CharacterSheet): DerivedStats {
  const combatSummary = computeCharacterCombatSummary(sheet);
  const modifiers = collectCapabilityModifiers(sheet);
  const monsterTraitEffects = getCharacterMonsterTraitEffects(sheet);
  const experienceSummary = getCharacterExperienceSummary(sheet);
  const armorDefensePenalty = getArmorDefensePenalty(sheet);

  const xpDisponible = experienceSummary.effectiveAvailable;
  const corrupcionTotal =
    Math.max(0, sheet.corrupcion.temporal + modifiers.CORRTEMP) + Math.max(0, sheet.corrupcion.permanente + modifiers.CORRPERM);
  const robustezMaximaTotal = combatSummary.robustnessMaximum;
  const robustezActualTotal = combatSummary.robustnessCurrent;
  const umbralDolorTotal = combatSummary.painThreshold;
  const umbralCorrupcionTotal = combatSummary.corruptionThreshold;

  const defensaTotal = combatSummary.defense;
  const iniciativaTotal = combatSummary.initiative;
  const armaduraNatural = monsterTraitEffects.armorFormula;
  const armaduraActiva = combatSummary.armor || armaduraNatural;
  const armaduraNaturalBreakdown = [
    monsterTraitEffects.duroLevel > 0
      ? {
          label: "Duro",
          formula: monsterTraitEffects.duroLevel === 3 ? "1d8" : monsterTraitEffects.duroLevel === 2 ? "1d6" : "1d4"
        }
      : null,
    monsterTraitEffects.robustoLevel > 0
      ? {
          label: "Robusto",
          formula: monsterTraitEffects.robustoLevel === 3 ? "1d8" : monsterTraitEffects.robustoLevel === 2 ? "1d6" : "1d4"
        }
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const warnings: string[] = [];
  if (corrupcionTotal >= sheet.atributos.tenaz) {
    warnings.push("La corrupción total alcanza o supera Tenaz");
  }
  if (sheet.progreso.experienciaGastada > sheet.progreso.experienciaTotal) {
    warnings.push("La experiencia gastada supera la experiencia total");
  }
  if (experienceSummary.computedSpent > experienceSummary.effectiveTotal) {
    warnings.push("Las capacidades, bendiciones y cargas dejan la experiencia por debajo de cero");
  }
  if (sheet.combate.robustezActual > robustezMaximaTotal) {
    warnings.push("La robustez actual supera la robustez máxima");
  }

  return {
    modifiers,
    xpDisponible,
    corrupcionTotal,
    robustezMaximaTotal,
    robustezActualTotal,
    defensaTotal,
    defensaArmaduraMod: armorDefensePenalty.value,
    defensaArmaduraDetalle: combatSummary.armorDetail,
    iniciativaTotal,
    umbralDolorTotal,
    umbralCorrupcionTotal,
    armaduraNatural,
    armaduraActiva,
    armaduraNaturalBreakdown,
    warnings
  };
}

function getEquippedWeaponDefenseBonus(sheet: CharacterSheet): { value: number; detail: string } {
  const equippedWeaponIds = new Set([
    sheet.equipmentSlots.mainHand,
    sheet.equipmentSlots.offHand,
    sheet.equipmentSlots.ranged
  ].filter(Boolean));

  const bonuses = sheet.inventoryItems.flatMap((item) => {
    if (item.category !== "weapon" || item.quantity <= 0) return [];
    if (!item.equipped && !equippedWeaponIds.has(item.id)) return [];
    const explicitBonus = item.modifiers
      .filter((modifier) => modifier.modifierType === "defense")
      .reduce((total, modifier) => total + (Number.parseInt(modifier.value, 10) || 0), 0);
    const balancedBonus = parseWeaponQualities(item.qualities)
      .some((quality) => findWeaponQualityOption(quality)?.id === "equilibrada") ? 1 : 0;
    const total = explicitBonus + balancedBonus;
    return total > 0 ? [{ label: item.name, total }] : [];
  });

  const value = bonuses.reduce((total, bonus) => total + bonus.total, 0);
  return {
    value,
    detail: bonuses.map((bonus) => `${bonus.label}: +${bonus.total} a Defensa.`).join(" ")
  };
}

function getArmorDefensePenalty(sheet: CharacterSheet): { value: number; detail: string } {
  const equippedArmor = sheet.inventoryItems.find((item) => (
    item.category === "armor"
    && item.quantity > 0
    && (item.id === sheet.equipmentSlots.armor || item.equipped)
  ));
  const armorName = (equippedArmor?.name ?? sheet.combate.armadura ?? "").trim();
  const armorProtection = (equippedArmor?.protectionFormula ?? sheet.combate.armaduraProteccion ?? "").trim();
  if (!armorName && !armorProtection) {
    return { value: 0, detail: "" };
  }

  const qualities = parseCommaList(equippedArmor?.qualities ?? sheet.combate.armaduraCualidad ?? "");
  const normalizedQualities = new Set(qualities.map((entry) => normalizeCapabilityName(entry)));
  const armorTier = resolveArmorPenaltyTier(normalizedQualities, equippedArmor?.weight ?? "", armorName);
  if (!armorTier) {
    return { value: 0, detail: "" };
  }

  const basePenalty = armorTier === "ligera" ? -2 : armorTier === "media" ? -3 : -4;
  const cumbersomePenalty = normalizedQualities.has("aparatosa") ? basePenalty - 1 : basePenalty;
  const reducedPenalty = normalizedQualities.has("flexible") ? Math.min(0, basePenalty + 2) : cumbersomePenalty;
  if (reducedPenalty === 0) {
    return {
      value: 0,
      detail: normalizedQualities.has("flexible") ? `Flexible anula la penalizacion de ${armorTier}.` : ""
    };
  }

  return {
    value: reducedPenalty,
    detail: normalizedQualities.has("flexible")
      ? `${capitalizeArmorTier(armorTier)} ${basePenalty} por Incómoda, reducido a ${reducedPenalty} por Flexible.`
      : normalizedQualities.has("aparatosa")
        ? `${capitalizeArmorTier(armorTier)} ${cumbersomePenalty} por Aparatosa.`
        : `${capitalizeArmorTier(armorTier)} ${basePenalty} por Incómoda.`
  };
}

function resolveArmorPenaltyTier(normalizedQualities: Set<string>, armorWeight: string, armorName: string): "ligera" | "media" | "pesada" | null {
  if (normalizedQualities.has("ligera")) return "ligera";
  if (normalizedQualities.has("media")) return "media";
  if (normalizedQualities.has("pesada")) return "pesada";

  const normalizedWeight = normalizeCapabilityName(armorWeight);
  if (normalizedWeight === "ligera") return "ligera";
  if (normalizedWeight === "media") return "media";
  if (normalizedWeight === "pesada") return "pesada";

  const normalizedName = normalizeCapabilityName(armorName);
  if (["armadura ligera", "armadura oculta", "capa de la ordo", "coraza de escaldo", "cuero tachonado", "hilo de seda", "piel de lobo", "ropajes de bruja", "tunica bendita"].some((name) => normalizedName.includes(name))) return "ligera";
  if (["armadura media", "armadura de cuervo", "armadura lamelar", "coraza de seda lacada", "cota de malla doble", "cota de malla de doble"].some((name) => normalizedName.includes(name))) return "media";
  if (["armadura pesada", "armadura completa", "armadura de la furia", "armadura de placas"].some((name) => normalizedName.includes(name))) return "pesada";
  return null;
}

function parseCommaList(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function capitalizeArmorTier(value: "ligera" | "media" | "pesada"): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveInitiativeAttribute(sheet: CharacterSheet): number {
  const candidates = [sheet.atributos.agil];

  if (hasCapabilityAtLevel(sheet, "Sexto sentido", "adepto")) {
    candidates.push(sheet.atributos.atento);
  }

  if (hasCapabilityAtLevel(sheet, "Tactico", "principiante")) {
    candidates.push(sheet.atributos.inteligente);
  }

  return Math.max(...candidates);
}

function resolveDefenseAttribute(sheet: CharacterSheet): number {
  const candidates = [sheet.atributos.agil];

  if (hasCapabilityAtLevel(sheet, "Sexto sentido", "adepto")) {
    candidates.push(sheet.atributos.atento);
  }

  if (hasCapabilityAtLevel(sheet, "Tactico", "adepto")) {
    candidates.push(sheet.atributos.inteligente);
  }

  return Math.max(...candidates);
}

function hasCapabilityAtLevel(sheet: CharacterSheet, capabilityName: string, minimumLevel: "principiante" | "adepto" | "maestro"): boolean {
  const capabilities = [...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales];
  const normalizedTarget = normalizeCapabilityName(capabilityName);
  const minimumRank = capabilityRank(minimumLevel);

  return capabilities.some((capability) => normalizeCapabilityName(capability.nombre) === normalizedTarget && capabilityRank(capability.nivel) >= minimumRank);
}

function capabilityRank(level: string): number {
  switch (normalizeCapabilityName(level)) {
    case "maestro":
      return 3;
    case "adepto":
      return 2;
    case "principiante":
    default:
      return 1;
  }
}

function normalizeCapabilityName(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
