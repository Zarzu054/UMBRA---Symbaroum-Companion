import { ThemeSelector } from "./ThemeSelector";
import {
  usePalettePreference,
  type PalettePreference
} from "../models/themePreference";

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
    </div>
  );
}
