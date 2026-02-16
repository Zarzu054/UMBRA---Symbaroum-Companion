import type { CharacterCardViewModel } from "../models/characterModel";

type Props = {
  item: CharacterCardViewModel;
};

export function CharacterCard({ item }: Props): JSX.Element {
  return (
    <article className="card">
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      <p>{item.levelLabel}</p>
      <small>{item.createdLabel}</small>
    </article>
  );
}