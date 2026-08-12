import { ThemeSelector } from "./ThemeSelector";
import {
  usePalettePreference,
  type PalettePreference
} from "../models/themePreference";
import {
  CHARACTER_SHEET_BACKGROUNDS,
  useCharacterSheetBackground
} from "../models/characterSheetBackground";

const PALETTES: Array<{
  value: PalettePreference;
  label: string;
  description: string;
}> = [
  { value: "davokar", label: "Davokar", description: "Musgo, carbón y oro viejo" },
  { value: "corruption", label: "Corrupción", description: "Acero, ceniza y cobre" },
  { value: "ambria", label: "Ambria", description: "Burdeos, marfil y latón" }
];

export function AppearanceSelector() {
  const [palette, setPalette] = usePalettePreference();
  const [background, setBackground] = useCharacterSheetBackground();

  return (
    <div className="appearance-selector">
      <div className="appearance-selector-heading">
        <span>Atmósfera</span>
        <small>La ambientación no cambia la luminosidad.</small>
      </div>
      <div className="palette-selector" role="group" aria-label="Atmósfera visual">
        {PALETTES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={palette === option.value ? "is-active" : ""}
            aria-pressed={palette === option.value}
            onClick={() => setPalette(option.value)}
          >
            <span className="palette-swatch" data-palette-swatch={option.value} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="palette-option-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="appearance-theme-section">
        <span>Tema</span>
        <ThemeSelector />
      </div>
      <div className="appearance-background-section">
        <div className="appearance-selector-heading">
          <span>Fondo de pantalla</span>
          <small>La ilustración elegida se comparte entre todas tus pantallas.</small>
        </div>
        <div className="appearance-background-selector" role="group" aria-label="Fondo de pantalla">
          <button
            type="button"
            className={`appearance-background-option is-none${background === "none" ? " is-active" : ""}`}
            aria-pressed={background === "none"}
            onClick={() => setBackground("none")}
          >
            <span className="appearance-background-none" aria-hidden="true" />
            <span>Sin ilustración</span>
          </button>
          {CHARACTER_SHEET_BACKGROUNDS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={background === option.id ? "is-active" : ""}
              aria-pressed={background === option.id}
              onClick={() => setBackground(option.id)}
            >
              <img src={option.thumbnailUrl} alt="" loading="lazy" />
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
