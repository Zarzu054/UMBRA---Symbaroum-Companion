import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
export function AppIcon({ name, size = 18 }) {
    const paths = {
        menu: _jsx(_Fragment, { children: _jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }) }),
        user: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "8", r: "3.25" }), _jsx("path", { d: "M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" })] }),
        sun: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "3.5" }), _jsx("path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" })] }),
        moon: _jsx("path", { d: "M20 15.4A8 8 0 0 1 8.6 4 8.2 8.2 0 1 0 20 15.4Z" }),
        monitor: _jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "13", rx: "2" }), _jsx("path", { d: "M8 21h8M12 17v4" })] }),
        close: _jsx("path", { d: "m6 6 12 12M18 6 6 18" }),
        "arrow-left": _jsx("path", { d: "m15 18-6-6 6-6M9 12h11" })
    };
    return (_jsx("svg", { className: "app-icon", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", children: paths[name] }));
}
