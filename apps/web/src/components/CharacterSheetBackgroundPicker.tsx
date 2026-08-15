import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  CHARACTER_SHEET_BACKGROUNDS,
  applyCharacterSheetBackground,
  findCharacterSheetBackground,
  useCharacterSheetBackground,
  type CharacterSheetBackgroundId
} from "../models/characterSheetBackground";
import { AppIcon } from "./AppIcon";

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

type Props = {
  preferenceScope?: string;
  triggerVariant?: "sheet" | "appearance";
};

export function CharacterSheetBackgroundPicker({ preferenceScope, triggerVariant = "sheet" }: Props) {
  const [selectedId, setSelectedId] = useCharacterSheetBackground(preferenceScope);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const selectedBackground = findCharacterSheetBackground(selectedId);
  const selectedName = selectedBackground?.name ?? "Sin ilustración";
  useBodyScrollLock(isOpen);

  useEffect(() => {
    applyCharacterSheetBackground(selectedId);
  }, [selectedId]);

  function closePicker(): void {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>(".is-selected")?.focus(), 0);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function selectBackground(id: CharacterSheetBackgroundId): void {
    setSelectedId(id);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerVariant === "appearance" ? "appearance-background-dialog-trigger" : "unified-sheet-background-trigger"}
        aria-label={triggerVariant === "appearance" ? `Elegir fondo de pantalla. Actual: ${selectedName}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        {triggerVariant === "appearance" ? (
          <>
            <span className="appearance-background-trigger-preview" aria-hidden="true">
              {selectedBackground ? <img src={selectedBackground.thumbnailUrl} alt="" /> : <span className="appearance-background-none" />}
            </span>
            <span className="appearance-background-trigger-copy">
              <strong>Elegir fondo</strong>
              <small>Actual: {selectedName}</small>
            </span>
            <AppIcon name="palette" size={18} />
          </>
        ) : (
          <>
            <AppIcon name="palette" size={16} />
            <span>Fondo</span>
          </>
        )}
      </button>

      {isOpen ? createPortal(
        <div className="modal-backdrop character-sheet-background-backdrop" onClick={closePicker}>
          <div
            ref={dialogRef}
            className="modal-panel character-sheet-background-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-sheet-background-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="character-sheet-background-dialog-header">
              <div>
                <span className="compendium-eyebrow">Ambientación de la ficha</span>
                <h2 id="character-sheet-background-title">Elige una ilustración</h2>
                <p>La selección se guarda para tu usuario en este dispositivo y se aplica inmediatamente.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Cerrar selector de fondo" onClick={closePicker}>
                <AppIcon name="close" />
              </button>
            </header>

            <div className="character-sheet-background-grid" role="group" aria-label="Fondos disponibles">
              <button
                type="button"
                className={`character-sheet-background-option is-none${selectedId === "none" ? " is-selected" : ""}`}
                aria-pressed={selectedId === "none"}
                onClick={() => selectBackground("none")}
              >
                <span className="character-sheet-background-none-preview" aria-hidden="true" />
                <span className="character-sheet-background-option-copy">
                  <strong>Sin ilustración</strong>
                  <small>Usar el fondo de la atmósfera</small>
                </span>
              </button>
              {CHARACTER_SHEET_BACKGROUNDS.map((background) => (
                <button
                  key={background.id}
                  type="button"
                  className={`character-sheet-background-option${selectedId === background.id ? " is-selected" : ""}`}
                  aria-pressed={selectedId === background.id}
                  onClick={() => selectBackground(background.id)}
                >
                  <img src={background.thumbnailUrl} alt="" loading="lazy" />
                  <span className="character-sheet-background-option-copy">
                    <strong>{background.name}</strong>
                    <small>{background.source} · p.{background.page}</small>
                  </span>
                </button>
              ))}
            </div>

            <footer className="character-sheet-background-dialog-footer">
              <span>{selectedName}</span>
              <button type="button" onClick={closePicker}>Aplicar y cerrar</button>
            </footer>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}
