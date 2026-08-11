import { getCharacterExperienceSummary } from "./characterExperience";
export function toCharacterCardViewModel(character) {
    const totalHabilidades = character.sheet.habilidades.length;
    const totalPoderes = character.sheet.poderesMisticos.length;
    const totalRituales = character.sheet.rituales.length;
    const experience = getCharacterExperienceSummary(character.sheet);
    const totalXpGastada = Math.max(character.sheet.progreso.experienciaGastada, experience.computedSpent);
    return {
        id: character.id,
        title: character.name,
        subtitle: `${character.archetype} - ${character.race}`,
        meta: `Hab: ${totalHabilidades} - Poderes: ${totalPoderes} - Rituales: ${totalRituales} - PX: ${totalXpGastada} - Corr: ${character.sheet.corrupcion.temporal}/${character.sheet.corrupcion.permanente}`,
        createdLabel: new Date(character.updatedAt).toLocaleString(),
        unreadChangeCount: character.unreadChangeCount ?? 0
    };
}
