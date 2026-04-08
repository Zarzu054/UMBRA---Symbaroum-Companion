import type { CharacterCardViewModel } from "../models/characterModel";

type Props = {
  item: CharacterCardViewModel;
  selected: boolean;
  onOpenSheet: () => void;
  onExportPdf: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function CharacterCard({ item, selected, onOpenSheet, onExportPdf, onDuplicate, onDelete }: Props) {
  return (
    <article className={`card ${selected ? "card-selected" : ""}`}>
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      <p className="meta-text">{item.meta}</p>
      <small>{item.createdLabel}</small>
      <div className="card-actions">
        <button onClick={onOpenSheet}>{selected ? "Hoja abierta" : "Abrir hoja"}</button>
        <button onClick={onExportPdf}>Exportar PDF</button>
        <button onClick={onDuplicate}>Duplicar</button>
        <button className="danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </article>
  );
}
