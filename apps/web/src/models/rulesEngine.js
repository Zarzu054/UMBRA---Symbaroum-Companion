import { getCharacterMonsterTraitEffects, getEffectiveCharacterRobustezMax } from "@umbra/shared";
import { getCharacterExperienceSummary } from "./characterExperience";
const MODIFIER_REGEX = /\b(DEF|INI|ROBMAX|ROBACT|UMBDOLOR|UMBCORR|CORRTEMP|CORRPERM)\s*([+-]\d+)\b/gi;
export function computeDerivedStats(sheet) {
    const modifiers = collectCapabilityModifiers(sheet);
    const monsterTraitEffects = getCharacterMonsterTraitEffects(sheet);
    const experienceSummary = getCharacterExperienceSummary(sheet);
    const xpDisponible = experienceSummary.effectiveAvailable;
    const corrupcionTotal = Math.max(0, sheet.corrupcion.temporal + modifiers.CORRTEMP) + Math.max(0, sheet.corrupcion.permanente + modifiers.CORRPERM);
    const robustezBase = getEffectiveCharacterRobustezMax(sheet);
    const robustezMaximaTotal = Math.max(0, robustezBase + modifiers.ROBMAX);
    const robustezActualTotal = Math.min(Math.max(0, sheet.combate.robustezActual + modifiers.ROBACT), robustezMaximaTotal);
    const umbralDolorTotal = Math.max(0, sheet.combate.umbralDolor + modifiers.UMBDOLOR);
    const umbralCorrupcionTotal = Math.max(0, sheet.corrupcion.umbral + modifiers.UMBCORR);
    const iniciativaBase = resolveInitiativeAttribute(sheet);
    const defensaBase = resolveDefenseAttribute(sheet) + monsterTraitEffects.defenseModifier;
    const defensaTotal = defensaBase + sheet.combate.defensaMod + modifiers.DEF;
    const iniciativaTotal = iniciativaBase + sheet.combate.iniciativaMod + modifiers.INI;
    const armaduraNatural = monsterTraitEffects.armorFormula;
    const armaduraActiva = sheet.combate.armaduraProteccion || armaduraNatural;
    const warnings = [];
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
        iniciativaTotal,
        umbralDolorTotal,
        umbralCorrupcionTotal,
        armaduraNatural,
        armaduraActiva,
        warnings
    };
}
function resolveInitiativeAttribute(sheet) {
    const candidates = [sheet.atributos.agil];
    if (hasCapabilityAtLevel(sheet, "Sexto sentido", "adepto")) {
        candidates.push(sheet.atributos.atento);
    }
    if (hasCapabilityAtLevel(sheet, "Tactico", "novato")) {
        candidates.push(sheet.atributos.inteligente);
    }
    return Math.max(...candidates);
}
function resolveDefenseAttribute(sheet) {
    const candidates = [sheet.atributos.agil];
    if (hasCapabilityAtLevel(sheet, "Sexto sentido", "adepto")) {
        candidates.push(sheet.atributos.atento);
    }
    if (hasCapabilityAtLevel(sheet, "Tactico", "adepto")) {
        candidates.push(sheet.atributos.inteligente);
    }
    return Math.max(...candidates);
}
function hasCapabilityAtLevel(sheet, capabilityName, minimumLevel) {
    const capabilities = [...sheet.habilidades, ...sheet.poderesMisticos, ...sheet.rituales];
    const normalizedTarget = normalizeCapabilityName(capabilityName);
    const minimumRank = capabilityRank(minimumLevel);
    return capabilities.some((capability) => normalizeCapabilityName(capability.nombre) === normalizedTarget && capabilityRank(capability.nivel) >= minimumRank);
}
function capabilityRank(level) {
    switch (normalizeCapabilityName(level)) {
        case "maestro":
            return 3;
        case "adepto":
            return 2;
        case "novato":
        default:
            return 1;
    }
}
function normalizeCapabilityName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}
function collectCapabilityModifiers(sheet) {
    const result = {
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
        if (!source)
            continue;
        for (const match of source.matchAll(MODIFIER_REGEX)) {
            const key = (match[1] ?? "").toUpperCase();
            const delta = Number(match[2] ?? "0");
            if (!Number.isFinite(delta))
                continue;
            result[key] += delta;
        }
    }
    return result;
}
