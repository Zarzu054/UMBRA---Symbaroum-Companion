import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function ReferenceContent({ source, page, eyebrow = "Fuente" }) {
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: "source-reference-link__icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 24 24", focusable: "false", children: [_jsx("path", { d: "M6.5 4.5h8.25A2.75 2.75 0 0 1 17.5 7.25V19H8.25A2.75 2.75 0 0 1 5.5 16.25V5.5a1 1 0 0 1 1-1Z" }), _jsx("path", { d: "M8.25 16.5h9.25M8.5 8h5.75M8.5 11h5.75" })] }) }), _jsxs("span", { className: "source-reference-link__copy", children: [_jsx("small", { children: eyebrow }), _jsx("strong", { children: source })] }), page ? _jsxs("span", { className: "source-reference-link__page", children: ["p.", page] }) : null, _jsx("span", { className: "source-reference-link__arrow", "aria-hidden": "true", children: "\u2197" })] }));
}
function accessibleLabel(source, page) {
    return page ? `${source} · p.${page}` : source;
}
export function SourceReferenceLink({ href, source, page, eyebrow, ariaLabel, className = "", target = "_blank", rel = "noreferrer", ...props }) {
    return (_jsx("a", { ...props, className: `source-reference-link ${className}`.trim(), href: href, target: target, rel: rel, "aria-label": ariaLabel ?? accessibleLabel(source, page), children: _jsx(ReferenceContent, { source: source, page: page, eyebrow: eyebrow }) }));
}
export function SourceReferenceButton({ source, page, eyebrow, ariaLabel, className = "", ...props }) {
    return (_jsx("button", { ...props, type: "button", className: `source-reference-link ${className}`.trim(), "aria-label": ariaLabel ?? accessibleLabel(source, page), children: _jsx(ReferenceContent, { source: source, page: page, eyebrow: eyebrow }) }));
}
