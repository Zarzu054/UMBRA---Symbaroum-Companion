import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { AppearanceSelector } from "./AppearanceSelector";

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function AppearancePopover() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  function closeAndRestoreFocus(): void {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="appearance-popover">
      <button
        ref={triggerRef}
        type="button"
        className="subtle-button appearance-popover-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <AppIcon name="palette" />
        <span>Apariencia</span>
      </button>
      {isOpen ? (
        <div ref={panelRef} className="appearance-popover-panel" role="dialog" aria-label="Apariencia">
          <header>
            <div>
              <strong>Apariencia</strong>
              <span>Atmósfera y luminosidad</span>
            </div>
            <button type="button" className="icon-button" aria-label="Cerrar apariencia" onClick={closeAndRestoreFocus}>
              <AppIcon name="close" />
            </button>
          </header>
          <AppearanceSelector />
        </div>
      ) : null}
    </div>
  );
}
