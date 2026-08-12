import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ALL_ENTRIES, TYPE_LABELS, canonicalizeCompendiumSourceName, getCompendiumSummaryLink, getCompendiumSourcePdfUrl } from "../models/compendiumEntries";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { SourceReferenceLink } from "../components/SourceReferenceLink";
import { fetchCompendiumLibrary, recordCompendiumView, setCompendiumFavorite } from "../services/compendiumService";
const MOBILE_DETAIL_QUERY = "(max-width: 900px)";
const RECENT_ENTRY_LIMIT = 8;
const TYPE_GROUPS = [
    { label: "Reglas", description: "Sistemas y resoluciones de juego", types: ["regla"] },
    {
        label: "Capacidades",
        description: "Opciones activas y conocimiento místico",
        types: ["habilidad", "poder_mistico", "ritual", "tradicion", "profesion"]
    },
    {
        label: "Personajes",
        description: "Origen, identidad, ventajas y complicaciones",
        types: ["raza", "cultura", "arquetipo", "bendicion", "carga"]
    },
    {
        label: "Equipo",
        description: "Armas, protecciones, consumibles y herramientas",
        types: ["arma", "armadura", "cualidad_arma", "cualidad_armadura", "elixir", "artefacto_menor", "trampa", "herramienta", "equipo"]
    },
    { label: "Criaturas", description: "Rasgos y recursos de monstruos", types: ["rasgo"] }
];
const SOURCE_GROUP_DEFINITIONS = [
    {
        label: "Libros",
        description: "Reglamentos y suplementos publicados",
        sources: ["Libro Básico", "Guía Avanzada del Jugador", "Códice de monstruos"]
    },
    {
        label: "Referencias",
        description: "Resúmenes y reglas propias de UMBRA",
        sources: ["Resumen de Reglas", "Reglas UMBRA"]
    }
];
export function normalizeCompendiumText(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es")
        .replace(/\s+/g, " ")
        .trim();
}
function getQueryTokens(query) {
    return [...new Set(normalizeCompendiumText(query).split(" ").filter(Boolean))];
}
function getSearchFields(entry) {
    const source = canonicalizeCompendiumSourceName(entry.fuente);
    const structuredContent = [
        ...(entry.facts ?? []).flatMap((fact) => [fact.label, fact.value]),
        ...(entry.variants ?? []).flatMap((variant) => [
            variant.label,
            variant.detail ?? "",
            ...variant.facts.flatMap((fact) => [fact.label, fact.value])
        ]),
        ...(entry.relations ?? []).map((relation) => relation.label),
        ...(entry.references ?? []).flatMap((reference) => [reference.source, String(reference.page ?? "")])
    ].join(" ");
    return {
        name: normalizeCompendiumText(entry.nombre),
        metadata: normalizeCompendiumText(`${TYPE_LABELS[entry.tipo]} ${source} ${entry.tags.join(" ")}`),
        content: normalizeCompendiumText(`${entry.resumen} ${entry.detalle} ${structuredContent}`)
    };
}
function getEntrySources(entry) {
    return [...new Set((entry.references?.length ? entry.references : [{ source: entry.fuente }])
            .map((reference) => canonicalizeCompendiumSourceName(reference.source)))];
}
export function getEntrySearchRank(entry, query) {
    const normalizedQuery = normalizeCompendiumText(query);
    if (!normalizedQuery)
        return 5;
    const tokens = getQueryTokens(query);
    const fields = getSearchFields(entry);
    if (fields.name === normalizedQuery)
        return 0;
    if (fields.name.startsWith(normalizedQuery))
        return 1;
    if (tokens.every((token) => fields.name.includes(token)))
        return 2;
    if (tokens.every((token) => fields.metadata.includes(token)))
        return 3;
    return 4;
}
export function searchCompendiumEntries(entries, options) {
    const tokens = getQueryTokens(options.query);
    return entries
        .filter((entry) => {
        if (options.type !== "all" && entry.tipo !== options.type)
            return false;
        if (options.source !== "all" && !getEntrySources(entry).includes(options.source))
            return false;
        if (tokens.length === 0)
            return true;
        const fields = getSearchFields(entry);
        const haystack = `${fields.name} ${fields.metadata} ${fields.content}`;
        return tokens.every((token) => haystack.includes(token));
    })
        .sort((left, right) => {
        const rankDifference = getEntrySearchRank(left, options.query) - getEntrySearchRank(right, options.query);
        return rankDifference || left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" });
    });
}
function normalizeWithIndexMap(text) {
    let normalized = "";
    const indexMap = [];
    for (let index = 0; index < text.length; index += 1) {
        const normalizedCharacter = normalizeCompendiumText(text[index]);
        for (const character of normalizedCharacter) {
            normalized += character;
            indexMap.push(index);
        }
    }
    return { normalized, indexMap };
}
function getHighlightRanges(text, query) {
    const tokens = getQueryTokens(query);
    if (tokens.length === 0)
        return [];
    const { normalized, indexMap } = normalizeWithIndexMap(text);
    const ranges = [];
    tokens.forEach((token) => {
        let start = normalized.indexOf(token);
        while (start >= 0) {
            const originalStart = indexMap[start];
            const originalEnd = (indexMap[start + token.length - 1] ?? originalStart) + 1;
            ranges.push([originalStart, originalEnd]);
            start = normalized.indexOf(token, start + token.length);
        }
    });
    return ranges
        .sort((left, right) => left[0] - right[0])
        .reduce((merged, range) => {
        const previous = merged[merged.length - 1];
        if (previous && range[0] <= previous[1]) {
            previous[1] = Math.max(previous[1], range[1]);
        }
        else {
            merged.push([...range]);
        }
        return merged;
    }, []);
}
export function renderHighlightedText(text, query) {
    const ranges = getHighlightRanges(text, query);
    if (ranges.length === 0)
        return text;
    const parts = [];
    let cursor = 0;
    ranges.forEach(([start, end], index) => {
        if (start > cursor)
            parts.push(_jsx(Fragment, { children: text.slice(cursor, start) }, `text-${index}`));
        parts.push(_jsx("mark", { className: "compendium-highlight", children: text.slice(start, end) }, `match-${index}`));
        cursor = end;
    });
    if (cursor < text.length)
        parts.push(_jsx(Fragment, { children: text.slice(cursor) }, "text-end"));
    return parts;
}
function parseCapabilityTiers(text) {
    const tierRegex = /(Principiante:|Novato:|Adepto:|Maestro:)/g;
    const matches = [...text.matchAll(tierRegex)];
    if (matches.length === 0)
        return { tiers: [], reference: null, remainder: text.trim() || null };
    const tiers = [];
    let reference = null;
    matches.forEach((match, index) => {
        const nextStart = matches[index + 1]?.index ?? text.length;
        const marker = match[0];
        const rawContent = text.slice((match.index ?? 0) + marker.length, nextStart).trim();
        const referenceIndex = rawContent.indexOf("Ref:");
        if (referenceIndex >= 0)
            reference = rawContent.slice(referenceIndex).trim();
        const parsedLabel = marker.slice(0, -1);
        tiers.push({
            label: parsedLabel === "Novato" ? "Principiante" : parsedLabel,
            content: referenceIndex >= 0 ? rawContent.slice(0, referenceIndex).trim() : rawContent
        });
    });
    return { tiers, reference, remainder: null };
}
function isMobileDetailViewport() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(MOBILE_DETAIL_QUERY).matches
        : false;
}
export function CompendiumView({ onBackToCharacters, ensureAccessToken, initialEntryId = null, initialQuery = "", initialSourceFilter = "all", initialTypeFilter = "all", initialBrowseMode = "type", focusToken = 0 }) {
    const [query, setQuery] = useState(initialQuery);
    const [isQueryExplorerOpen, setIsQueryExplorerOpen] = useState(Boolean(initialQuery.trim()));
    const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
    const [sourceFilter, setSourceFilter] = useState(initialSourceFilter);
    const [browseMode, setBrowseMode] = useState(initialBrowseMode);
    const [selectedId, setSelectedId] = useState(initialEntryId ?? "");
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [recentIds, setRecentIds] = useState([]);
    const [isLibraryLoading, setIsLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState(null);
    const [savingFavoriteIds, setSavingFavoriteIds] = useState(new Set());
    const [linkCopied, setLinkCopied] = useState(false);
    const [isMobileDetail, setIsMobileDetail] = useState(isMobileDetailViewport);
    const [libraryModal, setLibraryModal] = useState(null);
    const [quickSearchPosition, setQuickSearchPosition] = useState(null);
    const lastEntryTriggerRef = useRef(null);
    const detailHeadingRef = useRef(null);
    const readerRef = useRef(null);
    const libraryModalTriggerRef = useRef(null);
    const libraryModalCloseRef = useRef(null);
    const quickSearchAnchorRef = useRef(null);
    const sources = useMemo(() => [...new Set(ALL_ENTRIES.flatMap(getEntrySources))]
        .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })), []);
    const typeCounts = useMemo(() => {
        const counts = new Map();
        ALL_ENTRIES.forEach((entry) => counts.set(entry.tipo, (counts.get(entry.tipo) ?? 0) + 1));
        return counts;
    }, []);
    const sourceCounts = useMemo(() => {
        const counts = new Map();
        ALL_ENTRIES.forEach((entry) => {
            getEntrySources(entry).forEach((source) => counts.set(source, (counts.get(source) ?? 0) + 1));
        });
        return counts;
    }, []);
    const sourceGroups = useMemo(() => {
        const assignedSources = new Set(SOURCE_GROUP_DEFINITIONS.flatMap((group) => group.sources));
        const groups = SOURCE_GROUP_DEFINITIONS.map((group) => ({
            ...group,
            sources: group.sources.filter((source) => sourceCounts.has(source))
        })).filter((group) => group.sources.length > 0);
        const otherSources = sources.filter((source) => !assignedSources.has(source));
        if (otherSources.length > 0) {
            groups.push({
                label: "Otras fuentes",
                description: "Material adicional incorporado al archivo",
                sources: otherSources
            });
        }
        return groups;
    }, [sourceCounts, sources]);
    const filteredEntries = useMemo(() => searchCompendiumEntries(ALL_ENTRIES, { query, type: typeFilter, source: sourceFilter }), [query, sourceFilter, typeFilter]);
    const selectedEntry = ALL_ENTRIES.find((entry) => entry.id === selectedId) ?? null;
    const visibleEntries = selectedEntry && !query.trim() && typeFilter === "all" && sourceFilter === "all"
        ? [selectedEntry]
        : filteredEntries;
    const favoriteEntries = useMemo(() => ALL_ENTRIES.filter((entry) => favoriteIds.has(entry.id))
        .sort((left, right) => left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" })), [favoriteIds]);
    const recentEntries = useMemo(() => recentIds
        .filter((id) => !favoriteIds.has(id))
        .map((id) => ALL_ENTRIES.find((entry) => entry.id === id))
        .filter((entry) => Boolean(entry)), [favoriteIds, recentIds]);
    const isExplorerOpen = Boolean(isQueryExplorerOpen || typeFilter !== "all" || sourceFilter !== "all" || selectedEntry);
    const quickSearchEntries = !isExplorerOpen && query.trim() ? filteredEntries.slice(0, 7) : [];
    const isQuickSearchOpen = Boolean(!isExplorerOpen && query.trim());
    const activeLibraryEntries = libraryModal === "favorites" ? favoriteEntries : recentEntries;
    const activeLibraryTitle = libraryModal === "favorites" ? "Favoritos" : "Consultado recientemente";
    const activeLibraryDescription = libraryModal === "favorites"
        ? "Tus referencias guardadas, disponibles en cualquier dispositivo."
        : "Las últimas ocho entradas abiertas.";
    const activeLibraryEmptyText = libraryModal === "favorites"
        ? "Todavía no has guardado ninguna entrada."
        : "Las entradas que abras aparecerán aquí.";
    const canonicalSelectedSource = selectedEntry ? canonicalizeCompendiumSourceName(selectedEntry.fuente) : "";
    const selectedReferences = selectedEntry
        ? selectedEntry.references?.length
            ? selectedEntry.references
            : [{ source: selectedEntry.fuente, page: selectedEntry.pagina }]
        : [];
    const summaryLink = selectedEntry ? getCompendiumSummaryLink(selectedEntry) : null;
    const parsedCapabilityDetail = selectedEntry && (selectedEntry.tipo === "habilidad" || selectedEntry.tipo === "poder_mistico")
        ? parseCapabilityTiers(selectedEntry.detalle)
        : null;
    useBodyScrollLock(Boolean(libraryModal || (selectedEntry && isMobileDetail)));
    useEffect(() => {
        const mediaQuery = window.matchMedia?.(MOBILE_DETAIL_QUERY);
        if (!mediaQuery)
            return;
        const handleChange = (event) => setIsMobileDetail(event.matches);
        setIsMobileDetail(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);
    useEffect(() => {
        if (!isQuickSearchOpen || !quickSearchAnchorRef.current) {
            setQuickSearchPosition(null);
            return;
        }
        const updatePosition = () => {
            const anchor = quickSearchAnchorRef.current;
            if (!anchor)
                return;
            const rect = anchor.getBoundingClientRect();
            const viewportPadding = 12;
            const gap = 7;
            const desiredWidth = Math.min(390, window.innerWidth - viewportPadding * 2);
            const width = Math.max(Math.min(rect.width, desiredWidth), desiredWidth);
            const left = Math.min(Math.max(viewportPadding, rect.right - width), Math.max(viewportPadding, window.innerWidth - width - viewportPadding));
            const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
            const availableAbove = rect.top - gap - viewportPadding;
            const openAbove = availableBelow < 240 && availableAbove > availableBelow;
            const availableHeight = Math.max(160, openAbove ? availableAbove : availableBelow);
            setQuickSearchPosition({
                ...(openAbove
                    ? { bottom: window.innerHeight - rect.top + gap }
                    : { top: rect.bottom + gap }),
                left,
                width,
                maxHeight: Math.min(430, availableHeight)
            });
        };
        updatePosition();
        const resizeObserver = typeof ResizeObserver === "function"
            ? new ResizeObserver(updatePosition)
            : null;
        resizeObserver?.observe(quickSearchAnchorRef.current);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [isQuickSearchOpen]);
    useEffect(() => {
        setQuery(initialQuery);
        setIsQueryExplorerOpen(Boolean(initialQuery.trim()));
        setTypeFilter(initialTypeFilter);
        setSourceFilter(initialSourceFilter === "all" ? "all" : canonicalizeCompendiumSourceName(initialSourceFilter));
        setBrowseMode(initialBrowseMode);
        setSelectedId(initialEntryId && ALL_ENTRIES.some((entry) => entry.id === initialEntryId) ? initialEntryId : "");
    }, [focusToken, initialBrowseMode, initialEntryId, initialQuery, initialSourceFilter, initialTypeFilter]);
    useEffect(() => {
        let cancelled = false;
        setIsLibraryLoading(true);
        void ensureAccessToken()
            .then(fetchCompendiumLibrary)
            .then((library) => {
            if (cancelled)
                return;
            const knownIds = new Set(ALL_ENTRIES.map((entry) => entry.id));
            setFavoriteIds(new Set(library.favoriteEntryIds.filter((id) => knownIds.has(id))));
            setRecentIds((current) => {
                const merged = [...current, ...library.recentEntryIds.filter((id) => knownIds.has(id))];
                return [...new Set(merged)].slice(0, RECENT_ENTRY_LIMIT);
            });
            setLibraryError(null);
        })
            .catch((error) => {
            if (!cancelled)
                setLibraryError(error instanceof Error ? error.message : "No se pudo sincronizar tu biblioteca.");
        })
            .finally(() => {
            if (!cancelled)
                setIsLibraryLoading(false);
        });
        return () => { cancelled = true; };
    }, [ensureAccessToken]);
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("mode", browseMode);
        if (query.trim())
            params.set("q", query.trim());
        if (typeFilter !== "all")
            params.set("type", typeFilter);
        if (sourceFilter !== "all")
            params.set("source", sourceFilter);
        if (selectedEntry)
            params.set("id", selectedEntry.id);
        const nextHash = `#compendium?${params.toString()}`;
        if (window.location.hash !== nextHash)
            window.history.replaceState(null, "", nextHash);
    }, [browseMode, query, selectedEntry, sourceFilter, typeFilter]);
    useEffect(() => {
        if (!selectedEntry)
            return;
        setRecentIds((current) => [selectedEntry.id, ...current.filter((id) => id !== selectedEntry.id)].slice(0, RECENT_ENTRY_LIMIT));
        void ensureAccessToken()
            .then((token) => recordCompendiumView(selectedEntry.id, token))
            .catch(() => undefined);
        window.setTimeout(() => detailHeadingRef.current?.focus(), 0);
    }, [ensureAccessToken, selectedEntry?.id]);
    useEffect(() => {
        if (selectedEntry && !filteredEntries.some((entry) => entry.id === selectedEntry.id))
            setSelectedId("");
    }, [filteredEntries, selectedEntry]);
    useEffect(() => {
        if (!selectedEntry || libraryModal)
            return;
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                closeDetail();
                return;
            }
            if (event.key !== "Tab" || !isMobileDetail || !readerRef.current)
                return;
            const focusable = [...readerRef.current.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
            if (focusable.length === 0)
                return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === detailHeadingRef.current)) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isMobileDetail, libraryModal, selectedEntry]);
    useEffect(() => {
        if (!libraryModal)
            return;
        window.setTimeout(() => libraryModalCloseRef.current?.focus(), 0);
        const closeOnEscape = (event) => {
            if (event.key !== "Escape")
                return;
            event.preventDefault();
            closeLibraryModal();
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [libraryModal]);
    function openEntry(entryId, trigger) {
        if (trigger)
            lastEntryTriggerRef.current = trigger;
        setSelectedId(entryId);
    }
    function openLibraryModal(kind, trigger) {
        libraryModalTriggerRef.current = trigger;
        setLibraryModal(kind);
    }
    function closeLibraryModal(restoreFocus = true) {
        setLibraryModal(null);
        if (restoreFocus)
            window.setTimeout(() => libraryModalTriggerRef.current?.focus(), 0);
    }
    function openRelatedEntry(entryId, trigger) {
        const target = ALL_ENTRIES.find((entry) => entry.id === entryId);
        if (!target)
            return;
        lastEntryTriggerRef.current = trigger;
        setQuery("");
        setSourceFilter("all");
        setTypeFilter(target.tipo);
        setSelectedId(target.id);
    }
    function closeDetail(restoreFocus = true) {
        setSelectedId("");
        if (restoreFocus)
            window.setTimeout(() => lastEntryTriggerRef.current?.focus(), 0);
    }
    function clearFilters() {
        setQuery("");
        setIsQueryExplorerOpen(false);
        setTypeFilter("all");
        setSourceFilter("all");
        closeDetail(false);
    }
    function selectTypeSection(type) {
        setIsQueryExplorerOpen(false);
        setBrowseMode("type");
        setTypeFilter(type);
        setSourceFilter("all");
        closeDetail(false);
    }
    function selectSourceSection(source) {
        setIsQueryExplorerOpen(false);
        setBrowseMode("source");
        setSourceFilter(source);
        setTypeFilter("all");
        closeDetail(false);
    }
    async function toggleFavorite(entry) {
        if (savingFavoriteIds.has(entry.id))
            return;
        const nextFavorite = !favoriteIds.has(entry.id);
        setLibraryError(null);
        setFavoriteIds((current) => {
            const next = new Set(current);
            if (nextFavorite)
                next.add(entry.id);
            else
                next.delete(entry.id);
            return next;
        });
        setSavingFavoriteIds((current) => new Set(current).add(entry.id));
        try {
            const token = await ensureAccessToken();
            await setCompendiumFavorite(entry.id, { favorite: nextFavorite }, token);
        }
        catch (error) {
            setFavoriteIds((current) => {
                const next = new Set(current);
                if (nextFavorite)
                    next.delete(entry.id);
                else
                    next.add(entry.id);
                return next;
            });
            setLibraryError(error instanceof Error ? error.message : "No se pudo guardar el favorito.");
        }
        finally {
            setSavingFavoriteIds((current) => {
                const next = new Set(current);
                next.delete(entry.id);
                return next;
            });
        }
    }
    async function copyDeepLink() {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1500);
    }
    function renderLibraryEntries(entries, emptyText) {
        if (entries.length === 0) {
            return _jsx("p", { className: "compendium-empty-note", children: isLibraryLoading ? "Sincronizando biblioteca…" : emptyText });
        }
        return (_jsx("div", { className: "compendium-shelf-list", children: entries.map((entry) => (_jsxs("button", { type: "button", className: `compendium-shelf-entry app-card-accent app-card-accent--${entry.tipo}`, onClick: () => {
                    closeLibraryModal(false);
                    openEntry(entry.id, libraryModalTriggerRef.current ?? undefined);
                }, children: [_jsx("span", { className: "compendium-shelf-entry-title", children: entry.nombre }), _jsxs("span", { children: [TYPE_LABELS[entry.tipo], " \u00B7 ", canonicalizeCompendiumSourceName(entry.fuente)] })] }, entry.id))) }));
    }
    const quickSearchPopover = isQuickSearchOpen && quickSearchPosition && typeof document !== "undefined"
        ? createPortal(_jsxs("div", { className: `compendium-quick-search-results is-portal${quickSearchEntries.length >= 4 ? " has-four-results" : ""}`, style: quickSearchPosition, children: [_jsx("div", { id: "compendium-quick-search-results", className: "compendium-quick-search-list", role: "listbox", "aria-label": "Resultados de b\u00FAsqueda global", children: quickSearchEntries.length > 0 ? quickSearchEntries.map((entry) => (_jsxs("button", { type: "button", role: "option", "aria-selected": "false", className: `compendium-quick-search-entry app-card-accent app-card-accent--${entry.tipo}`, onClick: (event) => openEntry(entry.id, event.currentTarget), children: [_jsx("strong", { children: renderHighlightedText(entry.nombre, query) }), _jsxs("span", { children: [TYPE_LABELS[entry.tipo], " \u00B7 ", canonicalizeCompendiumSourceName(entry.fuente)] })] }, entry.id))) : _jsx("p", { className: "compendium-empty-note", children: "No hay entradas que coincidan." }) }), filteredEntries.length > quickSearchEntries.length ? (_jsxs("button", { type: "button", className: "compendium-quick-search-all", onClick: () => setIsQueryExplorerOpen(true), children: ["Ver los ", filteredEntries.length, " resultados"] })) : null] }), document.body)
        : null;
    return (_jsxs("div", { className: "compendium-library", children: [_jsxs("header", { className: "panel lore-panel compendium-library-hero module-sticky-header", children: [_jsxs("div", { className: "compendium-library-hero-copy", children: [_jsx("span", { className: "compendium-eyebrow", children: "Archivo de consulta" }), _jsx("h2", { children: "Compendio Central" }), _jsx("p", { children: "Encuentra reglas, capacidades y referencias por el camino que recuerdes: su tipo, su fuente o sus palabras." })] }), _jsxs("div", { className: "compendium-library-shortcuts", "aria-label": "Biblioteca personal", children: [_jsxs("button", { type: "button", className: "subtle-button", onClick: (event) => openLibraryModal("favorites", event.currentTarget), children: [_jsx("span", { children: "Favoritos" }), _jsx("b", { children: favoriteEntries.length })] }), _jsxs("button", { type: "button", className: "subtle-button", onClick: (event) => openLibraryModal("recent", event.currentTarget), children: [_jsx("span", { children: "Recientes" }), _jsx("b", { children: recentEntries.length })] })] }), _jsxs("div", { className: "compendium-library-hero-actions", children: [_jsx("button", { type: "button", className: "subtle-button compendium-library-back-button", onClick: isExplorerOpen ? clearFilters : onBackToCharacters, children: isExplorerOpen ? "← Volver al compendio" : "Volver a personajes" }), _jsx("div", { ref: quickSearchAnchorRef, className: "compendium-hero-search", children: _jsxs("label", { className: "field compendium-global-search", children: [_jsx("span", { children: "B\u00FAsqueda global" }), _jsxs("span", { className: "compendium-search-input-wrap", children: [_jsx("span", { "aria-hidden": "true", className: "compendium-search-glyph", children: "\u2315" }), _jsx("input", { type: "search", placeholder: "Buscar en el compendio\u2026", value: query, "aria-autocomplete": "list", "aria-controls": "compendium-quick-search-results", "aria-expanded": Boolean(!isExplorerOpen && query.trim()), onChange: (event) => setQuery(event.target.value), onKeyDown: (event) => {
                                                        if (event.key === "Enter" && query.trim())
                                                            setIsQueryExplorerOpen(true);
                                                        if (event.key === "Escape")
                                                            setQuery("");
                                                    } })] })] }) }), libraryError ? _jsx("p", { className: "compendium-library-error", role: "alert", children: libraryError }) : null] })] }), quickSearchPopover, libraryModal ? (_jsx("div", { className: "modal-backdrop compendium-library-modal-backdrop", onMouseDown: (event) => { if (event.target === event.currentTarget)
                    closeLibraryModal(); }, children: _jsxs("section", { className: "compendium-library-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "compendium-library-modal-title", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Biblioteca personal" }), _jsx("h2", { id: "compendium-library-modal-title", children: activeLibraryTitle }), _jsx("p", { children: activeLibraryDescription })] }), _jsx("span", { className: "compendium-count-seal", children: activeLibraryEntries.length }), _jsx("button", { ref: libraryModalCloseRef, type: "button", className: "subtle-button", onClick: () => closeLibraryModal(), children: "Cerrar" })] }), _jsx("div", { className: "compendium-library-modal-content", children: renderLibraryEntries(activeLibraryEntries, activeLibraryEmptyText) })] }) })) : null, !isExplorerOpen ? (_jsx("main", { className: "compendium-library-home", children: _jsxs("section", { className: "panel compendium-catalogue", children: [_jsxs("div", { className: "compendium-catalogue-header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Cat\u00E1logo" }), _jsx("h3", { children: "Explorar el archivo" })] }), _jsxs("div", { className: "compendium-mode-switch", role: "tablist", "aria-label": "Forma de explorar", children: [_jsx("button", { type: "button", role: "tab", id: "compendium-mode-type", "aria-controls": "compendium-type-catalogue", "aria-selected": browseMode === "type", className: browseMode === "type" ? "is-active" : "", onClick: () => setBrowseMode("type"), children: "Por tipo" }), _jsx("button", { type: "button", role: "tab", id: "compendium-mode-source", "aria-controls": "compendium-source-catalogue", "aria-selected": browseMode === "source", className: browseMode === "source" ? "is-active" : "", onClick: () => setBrowseMode("source"), children: "Por fuente" })] })] }), browseMode === "type" ? (_jsx("div", { id: "compendium-type-catalogue", className: "compendium-type-groups", role: "tabpanel", "aria-labelledby": "compendium-mode-type", children: TYPE_GROUPS.map((group) => (_jsxs("section", { className: "compendium-type-group", children: [_jsxs("div", { className: "compendium-type-group-heading", children: [_jsx("h4", { children: group.label }), _jsx("p", { children: group.description })] }), _jsx("div", { className: "compendium-section-grid", children: group.types.map((type) => (_jsxs("button", { type: "button", className: `compendium-section-card app-card-accent app-card-accent--${type}`, onClick: () => selectTypeSection(type), children: [_jsx("span", { className: "compendium-section-card-ornament", "aria-hidden": "true" }), _jsx("strong", { children: TYPE_LABELS[type] }), _jsxs("span", { children: [typeCounts.get(type) ?? 0, " entradas"] })] }, type))) })] }, group.label))) })) : (_jsx("div", { id: "compendium-source-catalogue", className: "compendium-type-groups", role: "tabpanel", "aria-labelledby": "compendium-mode-source", children: sourceGroups.map((group) => (_jsxs("section", { className: "compendium-type-group", children: [_jsxs("div", { className: "compendium-type-group-heading", children: [_jsx("h4", { children: group.label }), _jsx("p", { children: group.description })] }), _jsx("div", { className: "compendium-section-grid compendium-source-section-grid", children: group.sources.map((source) => (_jsxs("button", { type: "button", className: "compendium-section-card compendium-source-section-card", onClick: () => selectSourceSection(source), children: [_jsx("span", { className: "compendium-section-card-ornament", "aria-hidden": "true" }), _jsx("strong", { children: source }), _jsxs("span", { children: [sourceCounts.get(source) ?? 0, " entradas"] })] }, source))) })] }, group.label))) }))] }) })) : (_jsxs("main", { className: `compendium-explorer${selectedEntry ? " has-selection" : ""}`, children: [_jsxs("section", { className: "panel compendium-results-panel", "aria-label": "Resultados del compendio", children: [_jsxs("nav", { className: "compendium-breadcrumb", "aria-label": "Ruta del compendio", children: [_jsx("button", { type: "button", onClick: clearFilters, children: "Biblioteca" }), _jsx("span", { "aria-hidden": "true", children: "/" }), _jsx("span", { children: typeFilter !== "all" ? TYPE_LABELS[typeFilter] : sourceFilter !== "all" ? sourceFilter : "Resultados" })] }), _jsxs("div", { className: "compendium-explorer-controls", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Tipo" }), _jsx("select", { value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: Object.entries(TYPE_LABELS).map(([value, label]) => _jsx("option", { value: value, children: label }, value)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fuente" }), _jsxs("select", { value: sourceFilter, onChange: (event) => setSourceFilter(event.target.value), children: [_jsx("option", { value: "all", children: "Todas" }), sources.map((source) => _jsx("option", { value: source, children: source }, source))] })] }), _jsx("button", { type: "button", className: "subtle-button compendium-clear-button", onClick: clearFilters, children: "Limpiar" })] }), _jsxs("div", { className: "compendium-results-heading", children: [_jsx("h3", { children: "Resultados" }), _jsxs("span", { className: "meta-text", "aria-live": "polite", children: [visibleEntries.length, " coincidencias"] })] }), _jsx("div", { className: "compendium-result-list", children: visibleEntries.length > 0 ? visibleEntries.map((entry) => (_jsxs("button", { type: "button", "aria-current": selectedEntry?.id === entry.id ? "true" : undefined, className: `compendium-result-card app-card-accent app-card-accent--${entry.tipo}${selectedEntry?.id === entry.id ? " is-active" : ""}`, onClick: (event) => openEntry(entry.id, event.currentTarget), children: [_jsxs("span", { className: "compendium-result-card-top", children: [_jsx("strong", { children: renderHighlightedText(entry.nombre, query) }), _jsx("span", { className: "compendium-chip", children: TYPE_LABELS[entry.tipo] })] }), _jsxs("span", { className: "meta-text", children: [canonicalizeCompendiumSourceName(entry.fuente), entry.pagina ? ` · p.${entry.pagina}` : ""] })] }, entry.id))) : _jsx("p", { className: "compendium-empty-note", children: "No hay entradas que coincidan con esta consulta." }) })] }), _jsx("aside", { ref: readerRef, className: `panel compendium-reader${selectedEntry ? ` is-open app-card-accent app-card-accent--${selectedEntry.tipo}` : ""}`, role: isMobileDetail && selectedEntry ? "dialog" : "region", "aria-modal": isMobileDetail && selectedEntry ? "true" : undefined, "aria-labelledby": selectedEntry ? "compendium-reader-title" : undefined, "aria-label": selectedEntry ? undefined : "Lector del compendio", children: selectedEntry ? (_jsxs(_Fragment, { children: [_jsxs("header", { className: "compendium-reader-header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: TYPE_LABELS[selectedEntry.tipo] }), _jsx("h3", { id: "compendium-reader-title", ref: detailHeadingRef, tabIndex: -1, children: renderHighlightedText(selectedEntry.nombre, query) }), _jsxs("p", { children: [canonicalSelectedSource, selectedEntry.pagina ? ` · p.${selectedEntry.pagina}` : ""] })] }), _jsxs("div", { className: "compendium-reader-header-actions", children: [_jsx("button", { type: "button", className: `compendium-favorite-button${favoriteIds.has(selectedEntry.id) ? " is-favorite" : ""}`, "aria-pressed": favoriteIds.has(selectedEntry.id), "aria-label": favoriteIds.has(selectedEntry.id) ? "Quitar de favoritos" : "Añadir a favoritos", disabled: isLibraryLoading || savingFavoriteIds.has(selectedEntry.id), onClick: () => void toggleFavorite(selectedEntry), children: _jsx("span", { "aria-hidden": "true", children: favoriteIds.has(selectedEntry.id) ? "★" : "☆" }) }), _jsxs("button", { type: "button", className: "subtle-button compendium-reader-close", "aria-label": isMobileDetail ? "Volver a resultados" : "Cerrar ficha", onClick: () => closeDetail(), children: [_jsx("span", { "aria-hidden": "true", className: "compendium-detail-close-mobile", children: "Volver a resultados" }), _jsx("span", { "aria-hidden": "true", className: "compendium-detail-close-desktop", children: "Cerrar ficha" })] })] })] }), _jsxs("div", { className: "compendium-reader-body", children: [selectedEntry.facts?.length ? (_jsx("dl", { className: "compendium-fact-grid", "aria-label": "Datos de la entrada", children: selectedEntry.facts.map((fact) => (_jsxs("div", { className: "compendium-fact-card", children: [_jsx("dt", { children: fact.label }), _jsx("dd", { children: renderHighlightedText(fact.value, query) })] }, `${selectedEntry.id}-${fact.label}`))) })) : null, selectedEntry.variants?.length ? (_jsxs("section", { className: "compendium-variant-section", "aria-labelledby": "compendium-variant-title", children: [_jsx("h4", { id: "compendium-variant-title", children: "Variantes" }), _jsx("div", { className: "compendium-variant-list", children: selectedEntry.variants.map((variant) => (_jsxs("article", { className: "compendium-variant-card", children: [_jsx("h5", { children: variant.label }), _jsx("dl", { children: variant.facts.map((fact) => (_jsxs("div", { children: [_jsx("dt", { children: fact.label }), _jsx("dd", { children: renderHighlightedText(fact.value, query) })] }, `${variant.id}-${fact.label}`))) }), variant.detail ? _jsx("p", { children: renderHighlightedText(variant.detail, query) }) : null] }, `${selectedEntry.id}-${variant.id}`))) })] })) : null, parsedCapabilityDetail && parsedCapabilityDetail.tiers.length > 0 ? (_jsxs("div", { className: "capability-tier-list", children: [parsedCapabilityDetail.tiers.map((tier) => (_jsxs("section", { className: "capability-tier", children: [_jsx("h4", { className: "capability-tier-title", children: tier.label }), _jsx("p", { children: renderHighlightedText(tier.content, query) })] }, `${selectedEntry.id}-${tier.label}`))), parsedCapabilityDetail.reference ? _jsx("p", { className: "capability-reference", children: renderHighlightedText(parsedCapabilityDetail.reference, query) }) : null] })) : (_jsx("div", { className: "compendium-reader-copy", children: selectedEntry.detalle.split(/\n{2,}/).map((paragraph, index) => (_jsx("p", { children: renderHighlightedText(paragraph, query) }, `${selectedEntry.id}-paragraph-${index}`))) })), selectedEntry.relations?.length ? (_jsxs("section", { className: "compendium-related-section", "aria-labelledby": "compendium-related-title", children: [_jsx("h4", { id: "compendium-related-title", children: "Cualidades relacionadas" }), _jsx("div", { className: "compendium-related-list", children: selectedEntry.relations.map((relation) => (_jsx("button", { type: "button", className: "compendium-tag", onClick: (event) => openRelatedEntry(relation.entryId, event.currentTarget), children: relation.label }, `${selectedEntry.id}-${relation.entryId}`))) })] })) : null, selectedEntry.media?.length ? (_jsx("div", { className: "compendium-media-list", children: selectedEntry.media.map((asset) => (_jsxs("figure", { className: "compendium-media-card", children: [_jsx("img", { src: asset.src, alt: asset.alt, className: "compendium-media-image" }), asset.caption ? _jsx("figcaption", { className: "meta-text", children: asset.caption }) : null] }, `${selectedEntry.id}-${asset.src}`))) })) : null, selectedEntry.tags.length > 0 ? (_jsx("div", { className: "compendium-tags", "aria-label": "Etiquetas", children: Array.from(new Set(selectedEntry.tags)).map((tag) => _jsx("span", { className: "compendium-tag", children: renderHighlightedText(tag, query) }, `${selectedEntry.id}-${tag}`)) })) : null] }), _jsxs("footer", { className: "compendium-reader-footer", children: [selectedReferences.map((reference) => {
                                            const url = getCompendiumSourcePdfUrl(reference.source, reference.page, selectedEntry.nombre);
                                            return url ? (_jsx(SourceReferenceLink, { href: url, source: canonicalizeCompendiumSourceName(reference.source), page: reference.page, ariaLabel: reference.page
                                                    ? `${canonicalizeCompendiumSourceName(reference.source)} p.${reference.page}`
                                                    : canonicalizeCompendiumSourceName(reference.source) }, `${reference.source}-${reference.page ?? ""}`)) : null;
                                        }), summaryLink ? _jsx(SourceReferenceLink, { href: summaryLink.url, source: summaryLink.documentLabel, eyebrow: "Resumen" }) : null, _jsx("button", { type: "button", className: "subtle-button", onClick: () => void copyDeepLink(), children: linkCopied ? "Enlace copiado" : "Copiar enlace" })] })] })) : (_jsxs("div", { className: "compendium-reader-empty", children: [_jsx("span", { "aria-hidden": "true", children: "\u2726" }), _jsx("h3", { children: "Selecciona una entrada" }), _jsx("p", { children: "La referencia completa aparecer\u00E1 aqu\u00ED sin perder de vista los resultados." })] })) })] }))] }));
}
