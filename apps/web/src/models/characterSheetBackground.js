import { useCallback, useEffect, useState } from "react";
export const DEFAULT_CHARACTER_SHEET_BACKGROUND = "davokar-guardian";
export const CHARACTER_SHEET_BACKGROUND_STORAGE_KEY = "umbra:background";
export const CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX = "umbra:character-sheet-background:";
const BACKGROUND_CHANGE_EVENT = "umbra:background-change";
export const CHARACTER_SHEET_BACKGROUNDS = [
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
const VALID_BACKGROUND_IDS = new Set([
    "none",
    ...CHARACTER_SHEET_BACKGROUNDS.map((background) => background.id)
]);
function legacyStorageKey(scope) {
    return `${CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX}${encodeURIComponent(scope.trim() || "default")}`;
}
function readValidStoredBackground(key) {
    const stored = window.localStorage.getItem(key);
    return stored && VALID_BACKGROUND_IDS.has(stored) ? stored : null;
}
export function readCharacterSheetBackground(legacyScope) {
    if (typeof window === "undefined")
        return DEFAULT_CHARACTER_SHEET_BACKGROUND;
    try {
        const current = readValidStoredBackground(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY);
        if (current)
            return current;
        const scopedLegacy = legacyScope ? readValidStoredBackground(legacyStorageKey(legacyScope)) : null;
        if (scopedLegacy)
            return scopedLegacy;
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (!key?.startsWith(CHARACTER_SHEET_BACKGROUND_STORAGE_PREFIX))
                continue;
            const migrated = readValidStoredBackground(key);
            if (migrated)
                return migrated;
        }
        return DEFAULT_CHARACTER_SHEET_BACKGROUND;
    }
    catch {
        return DEFAULT_CHARACTER_SHEET_BACKGROUND;
    }
}
export function applyCharacterSheetBackground(id) {
    if (typeof document === "undefined")
        return;
    const root = document.documentElement;
    const selected = findCharacterSheetBackground(id);
    if (!selected) {
        delete root.dataset.characterSheetBackground;
        root.style.removeProperty("--character-sheet-background-image");
        root.style.removeProperty("--character-sheet-background-position");
        return;
    }
    root.dataset.characterSheetBackground = selected.id;
    root.style.setProperty("--character-sheet-background-image", `url("${selected.imageUrl}")`);
    root.style.setProperty("--character-sheet-background-position", selected.position);
}
export function setCharacterSheetBackgroundPreference(next) {
    applyCharacterSheetBackground(next);
    try {
        window.localStorage.setItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY, next);
    }
    catch {
        // The selected background remains active for this session when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(BACKGROUND_CHANGE_EVENT, { detail: next }));
}
export function initializeCharacterSheetBackground() {
    if (typeof window === "undefined")
        return;
    const preference = readCharacterSheetBackground();
    applyCharacterSheetBackground(preference);
    try {
        if (!window.localStorage.getItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY)) {
            window.localStorage.setItem(CHARACTER_SHEET_BACKGROUND_STORAGE_KEY, preference);
        }
    }
    catch {
        // Initialization still applies the preference to the current session.
    }
}
export function useCharacterSheetBackground(legacyScope) {
    const [preference, setPreference] = useState(() => readCharacterSheetBackground(legacyScope));
    useEffect(() => {
        const synchronize = (event) => {
            const detail = event?.detail;
            setPreference(detail && VALID_BACKGROUND_IDS.has(detail) ? detail : readCharacterSheetBackground(legacyScope));
        };
        const handleStorage = (event) => {
            if (event.key === CHARACTER_SHEET_BACKGROUND_STORAGE_KEY)
                synchronize();
        };
        window.addEventListener(BACKGROUND_CHANGE_EVENT, synchronize);
        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener(BACKGROUND_CHANGE_EVENT, synchronize);
            window.removeEventListener("storage", handleStorage);
        };
    }, [legacyScope]);
    const selectPreference = useCallback((next) => {
        setPreference(next);
        setCharacterSheetBackgroundPreference(next);
    }, []);
    return [preference, selectPreference];
}
export function findCharacterSheetBackground(id) {
    return CHARACTER_SHEET_BACKGROUNDS.find((background) => background.id === id) ?? null;
}
