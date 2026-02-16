import type { Character } from "@umbra/shared";

export type CharacterCardViewModel = {
  id: string;
  title: string;
  subtitle: string;
  levelLabel: string;
  createdLabel: string;
};

export function toCharacterCardViewModel(character: Character): CharacterCardViewModel {
  return {
    id: character.id,
    title: character.name,
    subtitle: `${character.archetype} - ${character.race}`,
    levelLabel: `Level ${character.level}`,
    createdLabel: new Date(character.createdAt).toLocaleString()
  };
}