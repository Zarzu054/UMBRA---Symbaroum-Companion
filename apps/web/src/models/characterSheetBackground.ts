import { useEffect, useState } from "react";

export type CharacterSheetBackgroundId =
  | "none"
  | "davokar-guardian"
  | "forest-ruins"
  | "forgotten-fortress"
  | "ambrian-paths"
  | "thistle-hold"
  | "blood-hunter"
  | "winter-warrior"
  | "stone-titan"
  | "karvosti-procession"
  | "symbar-spirit";

export type CharacterSheetBackground = {
  id: Exclude<CharacterSheetBackgroundId, "none">;
  name: string;
  source: string;
  page: number;
  imageUrl: string;
  thumbnailUrl: string;
  position: string;
};

export const DEFAULT_CHARACTER_SHEET_BACKGROUND: CharacterSheetBackgroundId = "davokar-guardian";
export const CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX = "umbra:character-sheet-background:";

export const CHARACTER_SHEET_BACKGROUNDS: CharacterSheetBackground[] = [
  { id: "davokar-guardian", name: "Guardián de Davokar", source: "Libro Básico", page: 75, imageUrl: "/backgrounds/character-sheets/01-davokar-guardian.jpg", thumbnailUrl: "/backgrounds/character-sheets/01-davokar-guardian-thumb.jpg", position: "center 42%" },
  { id: "forest-ruins", name: "Ruinas del bosque", source: "Mundo de Symbaroum", page: 50, imageUrl: "/backgrounds/character-sheets/02-forest-ruins.jpg", thumbnailUrl: "/backgrounds/character-sheets/02-forest-ruins-thumb.jpg", position: "center 38%" },
  { id: "forgotten-fortress", name: "Fortaleza olvidada", source: "Guía del Director", page: 42, imageUrl: "/backgrounds/character-sheets/03-forgotten-fortress.jpg", thumbnailUrl: "/backgrounds/character-sheets/03-forgotten-fortress-thumb.jpg", position: "center 45%" },
  { id: "ambrian-paths", name: "Senderos de Ambria", source: "Guía del Jugador", page: 86, imageUrl: "/backgrounds/character-sheets/04-ambrian-paths.jpg", thumbnailUrl: "/backgrounds/character-sheets/04-ambrian-paths-thumb.jpg", position: "center 46%" },
  { id: "thistle-hold", name: "Fuerte Espina", source: "La Estrella Más Oscura: Fuerte Espina", page: 24, imageUrl: "/backgrounds/character-sheets/05-thistle-hold.jpg", thumbnailUrl: "/backgrounds/character-sheets/05-thistle-hold-thumb.jpg", position: "center 48%" },
  { id: "blood-hunter", name: "Cazadora de sangre", source: "Guía Avanzada del Jugador", page: 16, imageUrl: "/backgrounds/character-sheets/06-blood-hunter.jpg", thumbnailUrl: "/backgrounds/character-sheets/06-blood-hunter-thumb.jpg", position: "center 40%" },
  { id: "winter-warrior", name: "Guerrero del invierno", source: "Guía Avanzada del Jugador", page: 47, imageUrl: "/backgrounds/character-sheets/07-winter-warrior.jpg", thumbnailUrl: "/backgrounds/character-sheets/07-winter-warrior-thumb.jpg", position: "center 44%" },
  { id: "stone-titan", name: "Titán de piedra", source: "Guía Avanzada del Jugador", page: 51, imageUrl: "/backgrounds/character-sheets/08-stone-titan.jpg", thumbnailUrl: "/backgrounds/character-sheets/08-stone-titan-thumb.jpg", position: "center 46%" },
  { id: "karvosti-procession", name: "Procesión de Karvosti", source: "La Estrella Más Oscura: Karvosti", page: 89, imageUrl: "/backgrounds/character-sheets/09-karvosti-procession.jpg", thumbnailUrl: "/backgrounds/character-sheets/09-karvosti-procession-thumb.jpg", position: "center 43%" },
  { id: "symbar-spirit", name: "Espíritu de Symbar", source: "La Estrella Más Oscura: Symbar", page: 216, imageUrl: "/backgrounds/character-sheets/10-symbar-spirit.jpg", thumbnailUrl: "/backgrounds/character-sheets/10-symbar-spirit-thumb.jpg", position: "center 44%" }
];

const VALID_BACKGROUND_IDS = new Set<CharacterSheetBackgroundId>([
  "none",
  ...CHARACTER_SHEET_BACKGROUNDS.map((background) => background.id)
]);

function storageKey(scope: string): string {
  return `${CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX}${encodeURIComponent(scope.trim() || "default")}`;
}

export function readCharacterSheetBackground(scope: string): CharacterSheetBackgroundId {
  if (typeof window === "undefined") return DEFAULT_CHARACTER_SHEET_BACKGROUND;
  try {
    const stored = window.localStorage.getItem(storageKey(scope)) as CharacterSheetBackgroundId | null;
    return stored && VALID_BACKGROUND_IDS.has(stored) ? stored : DEFAULT_CHARACTER_SHEET_BACKGROUND;
  } catch {
    return DEFAULT_CHARACTER_SHEET_BACKGROUND;
  }
}

export function useCharacterSheetBackground(scope: string): [CharacterSheetBackgroundId, (next: CharacterSheetBackgroundId) => void] {
  const [preference, setPreference] = useState<CharacterSheetBackgroundId>(() => readCharacterSheetBackground(scope));

  useEffect(() => {
    setPreference(readCharacterSheetBackground(scope));
  }, [scope]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(scope), preference);
    } catch {
      // The selected background remains active for this session.
    }
  }, [preference, scope]);

  return [preference, setPreference];
}

export function findCharacterSheetBackground(id: CharacterSheetBackgroundId): CharacterSheetBackground | null {
  return CHARACTER_SHEET_BACKGROUNDS.find((background) => background.id === id) ?? null;
}
