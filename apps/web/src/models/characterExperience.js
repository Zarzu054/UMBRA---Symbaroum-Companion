import { getActorCapabilityXpDelta } from "@umbra/shared";
function normalizeCapabilityName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function getRatedEntryXpCost(level) {
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
export function getCharacterExperienceSummary(sheet, options = {}) {
    const capabilityExpenses = [];
    const pendingSelections = sheet.capabilitySelections.map((entry) => ({
        entry,
        cost: Math.max(0, getActorCapabilityXpDelta(entry)),
        used: false
    }));
    const consumeStructuredCost = (kind, name, legacyCost, preferStructuredCost = false) => {
        const normalizedName = normalizeCapabilityName(name);
        const match = pendingSelections.find((candidate) => !candidate.used
            && candidate.entry.kind === kind
            && normalizeCapabilityName(candidate.entry.name) === normalizedName);
        if (!match)
            return legacyCost;
        match.used = true;
        return preferStructuredCost ? match.cost : Math.max(legacyCost, match.cost);
    };
    const spentFromAbilities = sheet.habilidades
        .filter((entry) => normalizeCapabilityName(entry.nombre) !== "poder mistico")
        .reduce((total, entry) => {
        const cost = consumeStructuredCost("habilidad", entry.nombre, getRatedEntryXpCost(entry.nivel));
        capabilityExpenses.push({ name: entry.nombre, kind: "habilidad", level: entry.nivel, cost });
        return total + cost;
    }, 0);
    const spentFromMysticPowers = sheet.poderesMisticos.reduce((total, entry) => {
        const cost = consumeStructuredCost("poder_mistico", entry.nombre, getRatedEntryXpCost(entry.nivel));
        capabilityExpenses.push({ name: entry.nombre, kind: "poder_mistico", level: entry.nivel, cost });
        return total + cost;
    }, 0);
    const spentFromLegacyRituals = sheet.rituales.reduce((total, entry) => {
        const cost = consumeStructuredCost("ritual", entry.nombre, 10);
        capabilityExpenses.push({ name: entry.nombre, kind: "ritual", level: entry.nivel, cost });
        return total + cost;
    }, 0);
    const spentFromLegacyBlessings = sheet.bendiciones.reduce((total, entry) => {
        const cost = consumeStructuredCost("bendicion", entry, 5, true);
        capabilityExpenses.push({ name: entry, kind: "bendicion", cost });
        return total + cost;
    }, 0);
    const unusedSelections = pendingSelections.filter((candidate) => !candidate.used);
    capabilityExpenses.push(...unusedSelections
        .filter(({ entry, cost }) => !["carga", "rasgo_personaje"].includes(entry.kind) && cost > 0)
        .map(({ entry, cost }) => ({ name: entry.name, kind: entry.kind, level: entry.level, cost })));
    const spentFromCapabilities = spentFromAbilities
        + spentFromMysticPowers
        + unusedSelections
            .filter(({ entry }) => !["ritual", "bendicion", "carga", "rasgo_personaje"].includes(entry.kind))
            .reduce((total, entry) => total + entry.cost, 0);
    const spentFromRituals = spentFromLegacyRituals
        + unusedSelections.filter(({ entry }) => entry.kind === "ritual").reduce((total, entry) => total + entry.cost, 0);
    const spentFromBlessings = spentFromLegacyBlessings
        + unusedSelections.filter(({ entry }) => entry.kind === "bendicion").reduce((total, entry) => total + entry.cost, 0);
    const structuredBurdenNames = sheet.capabilitySelections
        .filter((entry) => entry.kind === "carga")
        .map((entry) => normalizeCapabilityName(entry.name));
    const unmatchedLegacyBurdens = sheet.cargas.filter((burden) => {
        const matchIndex = structuredBurdenNames.indexOf(normalizeCapabilityName(burden));
        if (matchIndex < 0)
            return true;
        structuredBurdenNames.splice(matchIndex, 1);
        return false;
    });
    const extraFromBurdens = (sheet.capabilitySelections.filter((entry) => entry.kind === "carga").length + unmatchedLegacyBurdens.length) * 5;
    const rerollExpenses = sheet.progreso.gastosExperiencia.filter((entry) => entry.tipo === "repeticion_tirada");
    const featExpenses = sheet.progreso.gastosExperiencia.filter((entry) => entry.tipo === "hazana");
    const spentFromRerolls = rerollExpenses
        .reduce((total, entry) => total + entry.cantidad, 0);
    const spentFromFeats = featExpenses
        .reduce((total, entry) => total + entry.cantidad, 0);
    const computedSpent = spentFromCapabilities + spentFromRituals + spentFromBlessings + spentFromRerolls + spentFromFeats;
    const effectiveTotal = sheet.progreso.experienciaTotal + (options.includeBurdenBonus ? extraFromBurdens : 0);
    const effectiveAvailable = Math.max(0, effectiveTotal - Math.max(sheet.progreso.experienciaGastada, computedSpent));
    return {
        capabilityExpenses: capabilityExpenses.filter((entry) => entry.cost > 0),
        rerollExpenses,
        featExpenses,
        spentFromCapabilities,
        spentFromRituals,
        spentFromBlessings,
        spentFromRerolls,
        spentFromFeats,
        extraFromBurdens,
        computedSpent,
        effectiveTotal,
        effectiveAvailable
    };
}
