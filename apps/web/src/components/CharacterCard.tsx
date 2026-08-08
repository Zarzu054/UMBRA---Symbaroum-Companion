import type { CharacterCardViewModel } from "../models/characterModel";

type Props = {
  item: CharacterCardViewModel;
  selected: boolean;
  onOpenSheet: () => void;
  onOpenBuilder: () => void;
  onExportPdf: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function CharacterCard({ item, selected, onOpenSheet, onOpenBuilder, onExportPdf, onDuplicate, onDelete }: Props) {
  const initials = item.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "PJ";

  return (
    <article className={`card character-record-card ${selected ? "card-selected" : ""}`}>
      <div className="character-record-card-head">
        <div className="character-record-card-portrait" aria-hidden="true">
          <span>{initials}</span>
        </div>
        <div className="character-record-card-copy">
          <h3>{item.title}</h3>
          <p>{item.subtitle}</p>
        </div>
      </div>
      <small className="character-record-card-updated">Actualizada {item.createdLabel}</small>
      <div className="card-actions">
        <button className="character-record-primary-action" onClick={onOpenSheet}>{selected ? "Hoja abierta" : "Abrir hoja"}</button>
        <details className="character-record-actions-menu">
          <summary>Más acciones</summary>
          <div className="character-record-secondary-actions">
            <button onClick={onOpenBuilder}>Constructor</button>
            <button onClick={onExportPdf}>Exportar PDF</button>
            <button onClick={onDuplicate}>Duplicar</button>
            <button className="danger" onClick={onDelete}>Eliminar</button>
          </div>
        </details>
      </div>
    </article>
  );
}
