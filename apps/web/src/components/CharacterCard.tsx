import type { CharacterCardViewModel } from "../models/characterModel";

type Props = {
  item: CharacterCardViewModel;
  selected: boolean;
  onSelect: () => void;
  onExportPdf: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function CharacterCard({ item, selected, onSelect, onExportPdf, onDuplicate, onDelete }: Props) {
  return (
    <article className={`card ${selected ? "card-selected" : ""}`}>
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      <p>{item.levelLabel}</p>
      <p className="meta-text">{item.meta}</p>
      <small>{item.createdLabel}</small>
      <div className="card-actions">
        <button onClick={onSelect}>{selected ? "Editando" : "Editar"}</button>
        <button onClick={onExportPdf}>Exportar PDF</button>
        <button onClick={onDuplicate}>Duplicar</button>
        <button className="danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </article>
  );
}
