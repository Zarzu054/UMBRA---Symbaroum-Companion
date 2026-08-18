import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { AppearancePopover } from "./AppearancePopover";
import { AppearanceSelector } from "./AppearanceSelector";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useMediaQuery } from "../hooks/useMediaQuery";

export type AppNavigationItem = {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

type Props = {
  items: AppNavigationItem[];
  currentTitle: string;
  userEmail: string;
  roleLabel: string;
  onLogout: () => Promise<void>;
};

const MOBILE_QUERY = "(max-width: 900px)";

export function AppTopNavigation({ items, currentTitle, userEmail, roleLabel, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useBodyScrollLock(isOpen && isMobile);

  useEffect(() => {
    setIsOpen(false);
    setIsCustomizationOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector(".character-sheet-background-dialog")) return;
      if (event.key === "Escape") {
        setIsOpen(false);
        setIsCustomizationOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(menuRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
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
      if (target instanceof Element && target.closest(".character-sheet-background-backdrop")) return;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
      setIsCustomizationOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const selectItem = (item: AppNavigationItem) => {
    item.onSelect();
    setIsOpen(false);
    setIsCustomizationOpen(false);
  };

  return (
    <header className="app-top-navigation">
      <div className="app-top-navigation-inner">
        <button type="button" className="app-brand" onClick={() => items[0] && selectItem(items[0])} aria-label="Ir al inicio de UMBRA">
          UMBRA
        </button>
        <span className="app-current-title">{currentTitle}</span>
        {!isMobile ? (
          <nav className="app-primary-navigation" aria-label="Navegación principal">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.active ? "is-active" : ""}
                aria-current={item.active ? "page" : undefined}
                onClick={() => selectItem(item)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
        {isMobile ? <AppearancePopover compact /> : null}
        <button
          ref={triggerRef}
          type="button"
          className="app-navigation-menu-trigger"
          aria-label="Abrir navegación"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => {
            if (current) setIsCustomizationOpen(false);
            return !current;
          })}
        >
          <AppIcon name={isMobile ? "menu" : "user"} />
          <span>{isMobile ? "Menú" : userEmail}</span>
        </button>
      </div>

      {isOpen ? (
        <div ref={menuRef} className="app-navigation-menu" role="dialog" aria-label="Navegación y preferencias">
          <div className="app-navigation-menu-heading">
            <div>
              <strong>{userEmail}</strong>
              <span>{roleLabel}</span>
            </div>
            <button type="button" className="icon-button" aria-label="Cerrar navegación" onClick={() => { setIsOpen(false); setIsCustomizationOpen(false); }}>
              <AppIcon name="close" />
            </button>
          </div>
          {isMobile ? (
            <nav className="app-navigation-menu-modules" aria-label="Módulos">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.active ? "is-active" : ""}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => selectItem(item)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}
          {!isMobile ? (
            <>
              <button
                type="button"
                className="subtle-button app-navigation-customization-trigger"
                aria-expanded={isCustomizationOpen}
                aria-controls="session-customization-controls"
                onClick={() => setIsCustomizationOpen((current) => !current)}
              >
                <AppIcon name="palette" />
                <span>Personalización</span>
              </button>
              {isCustomizationOpen ? (
                <div id="session-customization-controls" className="app-navigation-menu-section">
                  <AppearanceSelector />
                </div>
              ) : null}
            </>
          ) : null}
          <button type="button" className="app-logout-button" onClick={() => void onLogout()}>
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </header>
  );
}
