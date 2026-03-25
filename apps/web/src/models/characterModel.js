export function toCharacterCardViewModel(character) {
    const totalHabilidades = character.sheet.habilidades.length;
    const totalPoderes = character.sheet.poderesMisticos.length;
    return {
        id: character.id,
        title: character.name,
        subtitle: `${character.archetype} - ${character.race}`,
        meta: `Hab: ${totalHabilidades} - Poderes: ${totalPoderes} - Corr: ${character.sheet.corrupcion.temporal}/${character.sheet.corrupcion.permanente}`,
        createdLabel: new Date(character.updatedAt).toLocaleString()
    };
}
