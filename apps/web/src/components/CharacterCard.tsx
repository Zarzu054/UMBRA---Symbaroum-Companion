import type { CharacterCardViewModel } from "../models/characterModel";

type Props = {
  item: CharacterCardViewModel;
  selected: boolean;
  onSelect: () => void;
};

export function CharacterCard({ item, selected, onSelect }: Props) {
  return (
    <article className={`card ${selected ? "card-selected" : ""}`}>
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      <p>{item.levelLabel}</p>
      <p className="meta-text">{item.meta}</p>
      <small>{item.createdLabel}</small>
      <button onClick={onSelect}>{selected ? "Editando" : "Editar"}</button>
    </article>
  );
}
