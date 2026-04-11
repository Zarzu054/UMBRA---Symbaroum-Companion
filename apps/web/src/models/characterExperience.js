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
    const spentFromCapabilities = [...sheet.habilidades, ...sheet.poderesMisticos].reduce((total, entry) => total + getRatedEntryXpCost(entry.nivel), 0);
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
