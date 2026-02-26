import type { Character } from "@umbra/shared";

export type CharacterCardViewModel = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  createdLabel: string;
};

export function toCharacterCardViewModel(character: Character): CharacterCardViewModel {
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
