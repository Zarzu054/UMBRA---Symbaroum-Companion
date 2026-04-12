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
        case "novato":
        default:
            return 10;
    }
}
export function getCharacterExperienceSummary(sheet) {
    const spentFromAbilities = sheet.habilidades
        .filter((entry) => normalizeCapabilityName(entry.nombre) !== "poder mistico")
        .reduce((total, entry) => total + getRatedEntryXpCost(entry.nivel), 0);
    const spentFromMysticPowers = sheet.poderesMisticos.reduce((total, entry) => total + getRatedEntryXpCost(entry.nivel), 0);
    const spentFromCapabilities = spentFromAbilities + spentFromMysticPowers;
    const spentFromBlessings = (sheet.bendiciones?.length ?? 0) * 5;
    const extraFromBurdens = (sheet.cargas?.length ?? 0) * 5;
    const computedSpent = spentFromCapabilities + spentFromBlessings;
    const effectiveTotal = sheet.progreso.experienciaTotal + extraFromBurdens;
    const effectiveAvailable = Math.max(0, effectiveTotal - Math.max(sheet.progreso.experienciaGastada, computedSpent));
    return {
        spentFromCapabilities,
        spentFromBlessings,
        extraFromBurdens,
        computedSpent,
        effectiveTotal,
        effectiveAvailable
    };
}
