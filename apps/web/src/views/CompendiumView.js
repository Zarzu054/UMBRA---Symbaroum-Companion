import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ALL_ENTRIES, TYPE_LABELS, canonicalizeCompendiumSourceName, getCompendiumSummaryLink, getCompendiumSourcePdfUrl } from "../models/compendiumEntries";
function includesQuery(entry, query) {
    const haystack = [
        entry.nombre,
        entry.resumen,
        entry.detalle,
        canonicalizeCompendiumSourceName(entry.fuente),
        ...entry.tags
    ]
        .join(" ")
        .toLowerCase();
    return haystack.includes(query);
}
function renderHighlightedText(text, query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
        return text;
    }
    const safeQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${safeQuery})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, index) => {
        const isMatch = part.toLowerCase() === normalizedQuery.toLowerCase();
        return isMatch ? (_jsx("mark", { className: "compendium-highlight", children: part }, `${part}-${index}`)) : (_jsx(Fragment, { children: part }, `${part}-${index}`));
    });
}
const LIST_TIER_PREVIEW_LENGTH = 90;
function parseCapabilityTiers(text) {
    const tierRegex = /(Novato:|Adepto:|Maestro:)/g;
    const matches = [...text.matchAll(tierRegex)];
    if (matches.length === 0) {
        return { tiers: [], reference: null, remainder: text.trim() || null };
    }
    const tiers = [];
    let reference = null;
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        const nextStart = matches[index + 1]?.index ?? text.length;
        const marker = match[0];
        const start = (match.index ?? 0) + marker.length;
        const rawContent = text.slice(start, nextStart).trim();
        const referenceIndex = rawContent.indexOf("Ref:");
        const content = referenceIndex >= 0 ? rawContent.slice(0, referenceIndex).trim() : rawContent;
        if (referenceIndex >= 0) {
            reference = rawContent.slice(referenceIndex).trim();
        }
        tiers.push({
            label: marker.slice(0, -1),
            content
        });
    }
    return { tiers, reference, remainder: null };
}
function truncateText(text, maxLength) {
    const normalized = text.trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
function renderListSummary(entry, query) {
    if (entry.tipo !== "habilidad" && entry.tipo !== "poder_mistico") {
        return _jsx("span", { className: "compendium-list-summary", children: renderHighlightedText(entry.resumen, query) });
    }
    const parsed = parseCapabilityTiers(entry.detalle);
    if (parsed.tiers.length === 0) {
        return _jsx("span", { className: "compendium-list-summary", children: renderHighlightedText(entry.resumen, query) });
    }
    return (_jsx("span", { className: "compendium-list-tier-summary", children: parsed.tiers.map((tier) => (_jsxs("span", { className: "compendium-list-tier-row", children: [_jsx("strong", { className: "compendium-list-tier-label", children: tier.label }), _jsx("span", { className: "compendium-list-tier-text", children: renderHighlightedText(truncateText(tier.content, LIST_TIER_PREVIEW_LENGTH), query) })] }, `${entry.id}-${tier.label}`))) }));
}
export function CompendiumView({ onBackToCharacters, initialEntryId = null, initialQuery = "", initialSourceFilter = "all", focusToken = 0 }) {
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [selectedId, setSelectedId] = useState(ALL_ENTRIES[0]?.id ?? "");
    const [linkCopied, setLinkCopied] = useState(false);
    const [historyStack, setHistoryStack] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const suppressHistoryRef = useRef(false);
    const sources = useMemo(() => [
        "all",
        ...new Set(ALL_ENTRIES
            .map((entry) => canonicalizeCompendiumSourceName(entry.fuente))
            .filter((source) => source !== "Reglas UMBRA"))
    ], []);
    useEffect(() => {
        if (!initialEntryId && !initialQuery && initialSourceFilter === "all") {
            return;
        }
        const targetEntry = initialEntryId ? ALL_ENTRIES.find((entry) => entry.id === initialEntryId) ?? null : null;
        if (initialQuery) {
            setQuery(initialQuery);
        }
        if (initialEntryId) {
            suppressHistoryRef.current = true;
            setSelectedId(initialEntryId);
            setHistoryStack([initialEntryId]);
            setHistoryIndex(0);
        }
        setTypeFilter("all");
        setSourceFilter(initialSourceFilter !== "all" && canonicalizeCompendiumSourceName(initialSourceFilter) !== "Reglas UMBRA"
            ? canonicalizeCompendiumSourceName(initialSourceFilter)
            : targetEntry
                ? canonicalizeCompendiumSourceName(targetEntry.fuente) === "Reglas UMBRA"
                    ? "all"
                    : canonicalizeCompendiumSourceName(targetEntry.fuente)
                : "all");
    }, [focusToken, initialEntryId, initialQuery, initialSourceFilter]);
    const filteredEntries = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return ALL_ENTRIES.filter((entry) => {
            if (typeFilter !== "all" && entry.tipo !== typeFilter) {
                return false;
            }
            if (sourceFilter !== "all" && canonicalizeCompendiumSourceName(entry.fuente) !== sourceFilter) {
                return false;
            }
            if (normalizedQuery && !includesQuery(entry, normalizedQuery)) {
                return false;
            }
            return true;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }, [query, typeFilter, sourceFilter]);
    const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null;
    const canonicalSelectedSource = selectedEntry ? canonicalizeCompendiumSourceName(selectedEntry.fuente) : "";
    const sourcePdfUrl = selectedEntry
        ? getCompendiumSourcePdfUrl(selectedEntry.fuente, selectedEntry.pagina, selectedEntry.nombre)
        : null;
    const summaryLink = selectedEntry ? getCompendiumSummaryLink(selectedEntry) : null;
    const parsedCapabilityDetail = selectedEntry && (selectedEntry.tipo === "habilidad" || selectedEntry.tipo === "poder_mistico")
        ? parseCapabilityTiers(selectedEntry.detalle)
        : null;
    useEffect(() => {
        if (!selectedEntry) {
            return;
        }
        if (suppressHistoryRef.current) {
            suppressHistoryRef.current = false;
            return;
        }
        setHistoryStack((prev) => {
            const currentIndex = historyIndex >= 0 ? historyIndex : prev.length - 1;
            const truncated = currentIndex >= 0 ? prev.slice(0, currentIndex + 1) : prev;
            if (truncated[truncated.length - 1] === selectedEntry.id) {
                return truncated;
            }
            const next = [...truncated, selectedEntry.id];
            setHistoryIndex(next.length - 1);
            return next;
        });
    }, [historyIndex, selectedEntry?.id]);
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedEntry) {
            params.set("id", selectedEntry.id);
        }
        if (query.trim()) {
            params.set("q", query.trim());
        }
        if (sourceFilter !== "all") {
            params.set("source", sourceFilter);
        }
        if (typeFilter !== "all") {
            params.set("type", typeFilter);
        }
        const nextHash = params.toString() ? `#compendium?${params.toString()}` : "#compendium";
        if (window.location.hash !== nextHash) {
            window.history.replaceState(null, "", nextHash);
        }
    }, [query, selectedEntry, sourceFilter, typeFilter]);
    function clearFilters() {
        setQuery("");
        setTypeFilter("all");
        setSourceFilter("all");
    }
    async function copyDeepLink() {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
    }
    function goToHistory(direction) {
        const nextIndex = historyIndex + direction;
        if (nextIndex < 0 || nextIndex >= historyStack.length) {
            return;
        }
        const nextId = historyStack[nextIndex];
        suppressHistoryRef.current = true;
        setHistoryIndex(nextIndex);
        setSelectedId(nextId);
    }
    function openSelectedPdf() {
        if (!sourcePdfUrl) {
            return;
        }
        window.open(sourcePdfUrl, "_blank", "noopener,noreferrer");
    }
    function openSummaryDocument() {
        if (!summaryLink) {
            return;
        }
        window.open(summaryLink.url, "_blank", "noopener,noreferrer");
    }
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "panel lore-panel compendium-hero", children: [_jsxs("div", { children: [_jsx("h2", { children: "Compendio Central" }), _jsx("p", { children: "Consulta r\u00E1pida de reglas, rasgos de monstruo, habilidades, poderes m\u00EDsticos, rituales y referencias base de personaje desde un \u00FAnico m\u00F3dulo." })] }), _jsx("div", { className: "toolbar", children: _jsx("button", { onClick: onBackToCharacters, children: "Volver a personajes" }) })] }), _jsx("section", { className: "panel", children: _jsxs("div", { className: "compendium-filters", children: [_jsxs("label", { className: "field compendium-search", children: [_jsx("span", { children: "B\u00FAsqueda global" }), _jsx("input", { placeholder: "Busca nombre, efecto, tradici\u00F3n, regla, libro...", value: query, onChange: (event) => setQuery(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: Object.entries(TYPE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsx("select", { value: sourceFilter, onChange: (event) => setSourceFilter(event.target.value), children: sources.map((source) => (_jsx("option", { value: source, children: source === "all" ? "Todas" : source }, source))) })] })] }) }), _jsxs("section", { className: "compendium-layout", children: [_jsxs("div", { className: "panel compendium-results", children: [_jsxs("div", { className: "row-actions", children: [_jsx("h3", { children: "Resultados" }), _jsxs("span", { className: "meta-text", children: [filteredEntries.length, " coincidencias"] })] }), _jsx("div", { className: "compendium-list", children: filteredEntries.length > 0 ? (filteredEntries.map((entry) => (_jsxs("button", { className: `compendium-list-item app-card-accent app-card-accent--${entry.tipo}${selectedEntry?.id === entry.id ? " is-active" : ""}`, onClick: () => setSelectedId(entry.id), children: [_jsxs("span", { className: "compendium-list-top", children: [_jsx("strong", { children: renderHighlightedText(entry.nombre, query) }), _jsx("span", { className: "compendium-chip", children: TYPE_LABELS[entry.tipo] })] }), _jsxs("span", { className: "meta-text", children: [canonicalizeCompendiumSourceName(entry.fuente), entry.pagina ? `, p.${entry.pagina}` : ""] }), renderListSummary(entry, query)] }, entry.id)))) : (_jsx("p", { className: "section-help", children: "No hay entradas que coincidan con la b\u00FAsqueda actual." })) })] }), _jsx("div", { className: `panel compendium-detail${selectedEntry ? ` app-card-accent app-card-accent--${selectedEntry.tipo}` : ""}`, children: selectedEntry ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "row-actions", children: [_jsxs("div", { children: [_jsx("h3", { children: renderHighlightedText(selectedEntry.nombre, query) }), _jsxs("p", { className: "meta-text", children: [TYPE_LABELS[selectedEntry.tipo], " \u00B7 ", canonicalSelectedSource, selectedEntry.pagina ? ` · p.${selectedEntry.pagina}` : ""] })] }), _jsxs("div", { className: "toolbar", children: [_jsx("button", { className: "subtle-button", disabled: historyIndex <= 0, onClick: () => goToHistory(-1), children: "Anterior" }), _jsx("button", { className: "subtle-button", disabled: historyIndex < 0 || historyIndex >= historyStack.length - 1, onClick: () => goToHistory(1), children: "Siguiente" }), _jsx("button", { className: "subtle-button", onClick: clearFilters, children: "Limpiar filtros" }), _jsx("button", { className: "subtle-button", onClick: () => void copyDeepLink(), children: linkCopied ? "Enlace copiado" : "Copiar enlace" }), sourcePdfUrl ? (_jsx("button", { className: "subtle-button", onClick: openSelectedPdf, children: selectedEntry.pagina ? `Abrir PDF p.${selectedEntry.pagina}` : "Abrir PDF" })) : null, summaryLink ? (_jsx("button", { className: "subtle-button", onClick: openSummaryDocument, children: summaryLink.documentLabel })) : null] })] }), summaryLink ? (_jsxs("p", { className: "meta-text", children: ["Secci\u00F3n en resumen: ", _jsx("strong", { children: summaryLink.sectionLabel })] })) : null, parsedCapabilityDetail && parsedCapabilityDetail.tiers.length > 0 ? (_jsxs("div", { className: "capability-tier-list", children: [parsedCapabilityDetail.tiers.map((tier) => (_jsxs("section", { className: "capability-tier", children: [_jsx("h4", { className: "capability-tier-title", children: tier.label }), _jsx("p", { children: renderHighlightedText(tier.content, query) })] }, `${selectedEntry.id}-${tier.label}`))), parsedCapabilityDetail.reference ? (_jsx("p", { className: "capability-reference", children: renderHighlightedText(parsedCapabilityDetail.reference, query) })) : null] })) : (_jsx("p", { children: renderHighlightedText(selectedEntry.detalle, query) })), selectedEntry.media?.length ? (_jsx("div", { className: "compendium-media-list", children: selectedEntry.media.map((asset) => (_jsxs("figure", { className: "compendium-media-card", children: [_jsx("img", { src: asset.src, alt: asset.alt, className: "compendium-media-image" }), asset.caption ? _jsx("figcaption", { className: "meta-text", children: asset.caption }) : null] }, `${selectedEntry.id}-${asset.src}`))) })) : null, selectedEntry.tags.length > 0 ? (_jsx("div", { className: "compendium-tags", children: selectedEntry.tags.map((tag) => (_jsx("span", { className: "compendium-tag", children: renderHighlightedText(tag, query) }, `${selectedEntry.id}-${tag}`))) })) : null] })) : (_jsx("p", { className: "section-help", children: "Selecciona una entrada del compendio para ver su detalle." })) })] })] }));
}
