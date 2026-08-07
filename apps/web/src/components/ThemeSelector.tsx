import { AppIcon, type AppIconName } from "./AppIcon";
import { useThemePreference, type ThemePreference } from "../models/themePreference";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: AppIconName }> = [
  { value: "system", label: "Automático", icon: "monitor" },
  { value: "light", label: "Claro", icon: "sun" },
  { value: "dark", label: "Oscuro", icon: "moon" }
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useThemePreference();

  return (
    <div className={`theme-selector${compact ? " is-compact" : ""}`} role="group" aria-label="Tema de la interfaz">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={preference === option.value ? "is-active" : ""}
          aria-pressed={preference === option.value}
          title={`Tema ${option.label.toLowerCase()}`}
          onClick={() => setPreference(option.value)}
        >
          <AppIcon name={option.icon} size={16} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
