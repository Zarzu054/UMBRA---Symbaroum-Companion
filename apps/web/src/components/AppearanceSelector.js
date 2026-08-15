import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemeSelector } from "./ThemeSelector";
import { usePalettePreference } from "../models/themePreference";
import { CharacterSheetBackgroundPicker } from "./CharacterSheetBackgroundPicker";
const PALETTES = [
    { value: "davokar", label: "Davokar", description: "Musgo, carbón y oro viejo" },
    { value: "corruption", label: "Corrupción", description: "Acero, ceniza y cobre" },
    { value: "ambria", label: "Ambria", description: "Burdeos, marfil y latón" }
];
export function AppearanceSelector() {
    const [palette, setPalette] = usePalettePreference();
    return (_jsxs("div", { className: "appearance-selector", children: [_jsxs("div", { className: "appearance-selector-heading", children: [_jsx("span", { children: "Atm\u00F3sfera" }), _jsx("small", { children: "La ambientaci\u00F3n no cambia la luminosidad." })] }), _jsx("div", { className: "palette-selector", role: "group", "aria-label": "Atm\u00F3sfera visual", children: PALETTES.map((option) => (_jsxs("button", { type: "button", className: palette === option.value ? "is-active" : "", "aria-pressed": palette === option.value, onClick: () => setPalette(option.value), children: [_jsxs("span", { className: "palette-swatch", "data-palette-swatch": option.value, "aria-hidden": "true", children: [_jsx("i", {}), _jsx("i", {}), _jsx("i", {})] }), _jsxs("span", { className: "palette-option-copy", children: [_jsx("strong", { children: option.label }), _jsx("small", { children: option.description })] })] }, option.value))) }), _jsxs("div", { className: "appearance-theme-section", children: [_jsx("span", { children: "Tema" }), _jsx(ThemeSelector, {})] }), _jsxs("div", { className: "appearance-background-section", children: [_jsxs("div", { className: "appearance-selector-heading", children: [_jsx("span", { children: "Fondo de pantalla" }), _jsx("small", { children: "La ilustraci\u00F3n elegida se comparte entre todas tus pantallas." })] }), _jsx(CharacterSheetBackgroundPicker, { triggerVariant: "appearance" })] })] }));
}
