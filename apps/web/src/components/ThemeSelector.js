import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AppIcon } from "./AppIcon";
import { useThemePreference } from "../models/themePreference";
const OPTIONS = [
    { value: "system", label: "Automático", icon: "monitor" },
    { value: "light", label: "Claro", icon: "sun" },
    { value: "dark", label: "Oscuro", icon: "moon" }
];
export function ThemeSelector({ compact = false }) {
    const [preference, setPreference] = useThemePreference();
    return (_jsx("div", { className: `theme-selector${compact ? " is-compact" : ""}`, role: "group", "aria-label": "Tema de la interfaz", children: OPTIONS.map((option) => (_jsxs("button", { type: "button", className: preference === option.value ? "is-active" : "", "aria-pressed": preference === option.value, title: `Tema ${option.label.toLowerCase()}`, onClick: () => setPreference(option.value), children: [_jsx(AppIcon, { name: option.icon, size: 16 }), _jsx("span", { children: option.label })] }, option.value))) }));
}
