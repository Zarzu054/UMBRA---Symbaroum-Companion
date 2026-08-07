import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type PalettePreference = "davokar" | "corruption" | "ambria";

export const THEME_STORAGE_KEY = "umbra:theme";
export const PALETTE_STORAGE_KEY = "umbra:palette";
export const DEFAULT_PALETTE: PalettePreference = "ambria";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isPalettePreference(value: unknown): value is PalettePreference {
  return value === "davokar" || value === "corruption" || value === "ambria";
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function readPalettePreference(): PalettePreference {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPalettePreference(stored) ? stored : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function applyPalettePreference(preference: PalettePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = preference;
}

export function initializeThemePreference(): void {
  applyThemePreference(readThemePreference());
}

export function initializeAppearancePreferences(): void {
  applyPalettePreference(readPalettePreference());
  initializeThemePreference();
}

export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyThemePreference(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The theme remains active for the current session when storage is unavailable.
    }

    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemePreference("system");
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, [preference]);

  return [preference, setPreferenceState];
}

export function usePalettePreference(): [PalettePreference, (next: PalettePreference) => void] {
  const [preference, setPreferenceState] = useState<PalettePreference>(readPalettePreference);

  useEffect(() => {
    applyPalettePreference(preference);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, preference);
    } catch {
      // The palette remains active for the current session when storage is unavailable.
    }
  }, [preference]);

  return [preference, setPreferenceState];
}
