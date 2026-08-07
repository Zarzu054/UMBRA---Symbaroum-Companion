import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_ENTRIES,
  TYPE_LABELS,
  canonicalizeCompendiumSourceName,
  getCompendiumSummaryLink,
  getCompendiumSourcePdfUrl,
  type CompendiumEntry,
  type EntryType
} from "../models/compendiumEntries";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  fetchCompendiumLibrary,
  recordCompendiumView,
  setCompendiumFavorite
} from "../services/compendiumService";

export type CompendiumBrowseMode = "type" | "source";

type Props = {
  onBackToCharacters: () => void;
  ensureAccessToken: () => Promise<string>;
  initialEntryId?: string | null;
  initialQuery?: string;
  initialSourceFilter?: string;
  initialTypeFilter?: "all" | EntryType;
  initialBrowseMode?: CompendiumBrowseMode;
  focusToken?: number;
};

type CapabilityTier = {
  label: string;
  content: string;
};

type SearchOptions = {
  query: string;
  type: "all" | EntryType;
  source: string;
};

const MOBILE_DETAIL_QUERY = "(max-width: 900px)";
const RECENT_ENTRY_LIMIT = 8;

const TYPE_GROUPS: Array<{ label: string; description: string; types: EntryType[] }> = [
  { label: "Reglas", description: "Sistemas y resoluciones de juego", types: ["regla"] },
  {
    label: "Capacidades",
    description: "Opciones activas y conocimiento místico",
    types: ["habilidad", "poder_mistico", "ritual", "tradicion"]
  },
  {
    label: "Personajes",
    description: "Origen, identidad, ventajas y complicaciones",
    types: ["raza", "cultura", "arquetipo", "bendicion", "carga"]
  },
  { label: "Criaturas", description: "Rasgos y recursos de monstruos", types: ["rasgo"] }
];

const SOURCE_GROUP_DEFINITIONS: Array<{ label: string; description: string; sources: string[] }> = [
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

export function normalizeCompendiumText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function getQueryTokens(query: string): string[] {
  return [...new Set(normalizeCompendiumText(query).split(" ").filter(Boolean))];
}

function getSearchFields(entry: CompendiumEntry) {
  const source = canonicalizeCompendiumSourceName(entry.fuente);
  return {
    name: normalizeCompendiumText(entry.nombre),
    metadata: normalizeCompendiumText(`${TYPE_LABELS[entry.tipo]} ${source} ${entry.tags.join(" ")}`),
    content: normalizeCompendiumText(`${entry.resumen} ${entry.detalle}`)
  };
}

export function getEntrySearchRank(entry: CompendiumEntry, query: string): number {
  const normalizedQuery = normalizeCompendiumText(query);
  if (!normalizedQuery) return 5;

  const tokens = getQueryTokens(query);
  const fields = getSearchFields(entry);
  if (fields.name === normalizedQuery) return 0;
  if (fields.name.startsWith(normalizedQuery)) return 1;
  if (tokens.every((token) => fields.name.includes(token))) return 2;
  if (tokens.every((token) => fields.metadata.includes(token))) return 3;
  return 4;
}

export function searchCompendiumEntries(entries: CompendiumEntry[], options: SearchOptions): CompendiumEntry[] {
  const tokens = getQueryTokens(options.query);

  return entries
    .filter((entry) => {
      if (options.type !== "all" && entry.tipo !== options.type) return false;
      if (options.source !== "all" && canonicalizeCompendiumSourceName(entry.fuente) !== options.source) return false;
      if (tokens.length === 0) return true;

      const fields = getSearchFields(entry);
      const haystack = `${fields.name} ${fields.metadata} ${fields.content}`;
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((left, right) => {
      const rankDifference = getEntrySearchRank(left, options.query) - getEntrySearchRank(right, options.query);
      return rankDifference || left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" });
    });
}

function normalizeWithIndexMap(text: string): { normalized: string; indexMap: number[] } {
  let normalized = "";
  const indexMap: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const normalizedCharacter = normalizeCompendiumText(text[index]);
    for (const character of normalizedCharacter) {
      normalized += character;
      indexMap.push(index);
    }
  }

  return { normalized, indexMap };
}

function getHighlightRanges(text: string, query: string): Array<[number, number]> {
  const tokens = getQueryTokens(query);
  if (tokens.length === 0) return [];

  const { normalized, indexMap } = normalizeWithIndexMap(text);
  const ranges: Array<[number, number]> = [];

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
    .reduce<Array<[number, number]>>((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && range[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], range[1]);
      } else {
        merged.push([...range]);
      }
      return merged;
    }, []);
}

export function renderHighlightedText(text: string, query: string): React.ReactNode {
  const ranges = getHighlightRanges(text, query);
  if (ranges.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(<Fragment key={`text-${index}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(
      <mark key={`match-${index}`} className="compendium-highlight">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<Fragment key="text-end">{text.slice(cursor)}</Fragment>);
  return parts;
}

function parseCapabilityTiers(text: string): { tiers: CapabilityTier[]; reference: string | null; remainder: string | null } {
  const tierRegex = /(Novato:|Adepto:|Maestro:)/g;
  const matches = [...text.matchAll(tierRegex)];
  if (matches.length === 0) return { tiers: [], reference: null, remainder: text.trim() || null };

  const tiers: CapabilityTier[] = [];
  let reference: string | null = null;
  matches.forEach((match, index) => {
    const nextStart = matches[index + 1]?.index ?? text.length;
    const marker = match[0];
    const rawContent = text.slice((match.index ?? 0) + marker.length, nextStart).trim();
    const referenceIndex = rawContent.indexOf("Ref:");
    if (referenceIndex >= 0) reference = rawContent.slice(referenceIndex).trim();
    tiers.push({
      label: marker.slice(0, -1),
      content: referenceIndex >= 0 ? rawContent.slice(0, referenceIndex).trim() : rawContent
    });
  });
  return { tiers, reference, remainder: null };
}

function isMobileDetailViewport(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_DETAIL_QUERY).matches
    : false;
}

export function CompendiumView({
  onBackToCharacters,
  ensureAccessToken,
  initialEntryId = null,
  initialQuery = "",
  initialSourceFilter = "all",
  initialTypeFilter = "all",
  initialBrowseMode = "type",
  focusToken = 0
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>(initialTypeFilter);
  const [sourceFilter, setSourceFilter] = useState(initialSourceFilter);
  const [browseMode, setBrowseMode] = useState<CompendiumBrowseMode>(initialBrowseMode);
  const [selectedId, setSelectedId] = useState(initialEntryId ?? "");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [savingFavoriteIds, setSavingFavoriteIds] = useState<Set<string>>(new Set());
  const [linkCopied, setLinkCopied] = useState(false);
  const [isMobileDetail, setIsMobileDetail] = useState(isMobileDetailViewport);
  const lastEntryTriggerRef = useRef<HTMLElement | null>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);

  const sources = useMemo(
    () => [...new Set(ALL_ENTRIES.map((entry) => canonicalizeCompendiumSourceName(entry.fuente)))]
      .sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" })),
    []
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<EntryType, number>();
    ALL_ENTRIES.forEach((entry) => counts.set(entry.tipo, (counts.get(entry.tipo) ?? 0) + 1));
    return counts;
  }, []);

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    ALL_ENTRIES.forEach((entry) => {
      const source = canonicalizeCompendiumSourceName(entry.fuente);
      counts.set(source, (counts.get(source) ?? 0) + 1);
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

  const filteredEntries = useMemo(
    () => searchCompendiumEntries(ALL_ENTRIES, { query, type: typeFilter, source: sourceFilter }),
    [query, sourceFilter, typeFilter]
  );

  const selectedEntry = ALL_ENTRIES.find((entry) => entry.id === selectedId) ?? null;
  const visibleEntries = selectedEntry && !query.trim() && typeFilter === "all" && sourceFilter === "all"
    ? [selectedEntry]
    : filteredEntries;
  const favoriteEntries = useMemo(
    () => ALL_ENTRIES.filter((entry) => favoriteIds.has(entry.id))
      .sort((left, right) => left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" })),
    [favoriteIds]
  );
  const recentEntries = useMemo(
    () => recentIds
      .filter((id) => !favoriteIds.has(id))
      .map((id) => ALL_ENTRIES.find((entry) => entry.id === id))
      .filter((entry): entry is CompendiumEntry => Boolean(entry)),
    [favoriteIds, recentIds]
  );
  const isExplorerOpen = Boolean(query.trim() || typeFilter !== "all" || sourceFilter !== "all" || selectedEntry);

  const canonicalSelectedSource = selectedEntry ? canonicalizeCompendiumSourceName(selectedEntry.fuente) : "";
  const sourcePdfUrl = selectedEntry
    ? getCompendiumSourcePdfUrl(selectedEntry.fuente, selectedEntry.pagina, selectedEntry.nombre)
    : null;
  const summaryLink = selectedEntry ? getCompendiumSummaryLink(selectedEntry) : null;
  const parsedCapabilityDetail = selectedEntry && (selectedEntry.tipo === "habilidad" || selectedEntry.tipo === "poder_mistico")
    ? parseCapabilityTiers(selectedEntry.detalle)
    : null;

  useBodyScrollLock(Boolean(selectedEntry && isMobileDetail));

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_DETAIL_QUERY);
    if (!mediaQuery) return;
    const handleChange = (event: MediaQueryListEvent) => setIsMobileDetail(event.matches);
    setIsMobileDetail(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    setTypeFilter(initialTypeFilter);
    setSourceFilter(
      initialSourceFilter === "all" ? "all" : canonicalizeCompendiumSourceName(initialSourceFilter)
    );
    setBrowseMode(initialBrowseMode);
    setSelectedId(initialEntryId && ALL_ENTRIES.some((entry) => entry.id === initialEntryId) ? initialEntryId : "");
  }, [focusToken, initialBrowseMode, initialEntryId, initialQuery, initialSourceFilter, initialTypeFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLibraryLoading(true);
    void ensureAccessToken()
      .then(fetchCompendiumLibrary)
      .then((library) => {
        if (cancelled) return;
        const knownIds = new Set(ALL_ENTRIES.map((entry) => entry.id));
        setFavoriteIds(new Set(library.favoriteEntryIds.filter((id) => knownIds.has(id))));
        setRecentIds((current) => {
          const merged = [...current, ...library.recentEntryIds.filter((id) => knownIds.has(id))];
          return [...new Set(merged)].slice(0, RECENT_ENTRY_LIMIT);
        });
        setLibraryError(null);
      })
      .catch((error) => {
        if (!cancelled) setLibraryError(error instanceof Error ? error.message : "No se pudo sincronizar tu biblioteca.");
      })
      .finally(() => {
        if (!cancelled) setIsLibraryLoading(false);
      });
    return () => { cancelled = true; };
  }, [ensureAccessToken]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("mode", browseMode);
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (selectedEntry) params.set("id", selectedEntry.id);
    const nextHash = `#compendium?${params.toString()}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }, [browseMode, query, selectedEntry, sourceFilter, typeFilter]);

  useEffect(() => {
    if (!selectedEntry) return;
    setRecentIds((current) => [selectedEntry.id, ...current.filter((id) => id !== selectedEntry.id)].slice(0, RECENT_ENTRY_LIMIT));
    void ensureAccessToken()
      .then((token) => recordCompendiumView(selectedEntry.id, token))
      .catch(() => undefined);
    window.setTimeout(() => detailHeadingRef.current?.focus(), 0);
  }, [ensureAccessToken, selectedEntry?.id]);

  useEffect(() => {
    if (selectedEntry && !filteredEntries.some((entry) => entry.id === selectedEntry.id)) setSelectedId("");
  }, [filteredEntries, selectedEntry]);

  useEffect(() => {
    if (!selectedEntry) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDetail();
        return;
      }
      if (event.key !== "Tab" || !isMobileDetail || !readerRef.current) return;

      const focusable = [...readerRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === detailHeadingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMobileDetail, selectedEntry]);

  function openEntry(entryId: string, trigger?: HTMLElement): void {
    if (trigger) lastEntryTriggerRef.current = trigger;
    setSelectedId(entryId);
  }

  function closeDetail(restoreFocus = true): void {
    setSelectedId("");
    if (restoreFocus) window.setTimeout(() => lastEntryTriggerRef.current?.focus(), 0);
  }

  function clearFilters(): void {
    setQuery("");
    setTypeFilter("all");
    setSourceFilter("all");
    closeDetail(false);
  }

  function selectTypeSection(type: EntryType): void {
    setBrowseMode("type");
    setTypeFilter(type);
    setSourceFilter("all");
    closeDetail(false);
  }

  function selectSourceSection(source: string): void {
    setBrowseMode("source");
    setSourceFilter(source);
    setTypeFilter("all");
    closeDetail(false);
  }

  async function toggleFavorite(entry: CompendiumEntry): Promise<void> {
    if (savingFavoriteIds.has(entry.id)) return;
    const nextFavorite = !favoriteIds.has(entry.id);
    setLibraryError(null);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (nextFavorite) next.add(entry.id); else next.delete(entry.id);
      return next;
    });
    setSavingFavoriteIds((current) => new Set(current).add(entry.id));

    try {
      const token = await ensureAccessToken();
      await setCompendiumFavorite(entry.id, { favorite: nextFavorite }, token);
    } catch (error) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (nextFavorite) next.delete(entry.id); else next.add(entry.id);
        return next;
      });
      setLibraryError(error instanceof Error ? error.message : "No se pudo guardar el favorito.");
    } finally {
      setSavingFavoriteIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
    }
  }

  async function copyDeepLink(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1500);
  }

  function renderShelf(title: string, description: string, entries: CompendiumEntry[], emptyText: string) {
    return (
      <section className="compendium-shelf" aria-labelledby={`shelf-${normalizeCompendiumText(title).replace(/\s/g, "-")}`}>
        <div className="compendium-section-heading">
          <div>
            <h3 id={`shelf-${normalizeCompendiumText(title).replace(/\s/g, "-")}`}>{title}</h3>
            <p>{description}</p>
          </div>
          <span className="compendium-count-seal">{entries.length}</span>
        </div>
        {entries.length > 0 ? (
          <div className="compendium-shelf-list">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`compendium-shelf-entry app-card-accent app-card-accent--${entry.tipo}`}
                onClick={(event) => openEntry(entry.id, event.currentTarget)}
              >
                <span className="compendium-shelf-entry-title">{entry.nombre}</span>
                <span>{TYPE_LABELS[entry.tipo]} · {canonicalizeCompendiumSourceName(entry.fuente)}</span>
              </button>
            ))}
          </div>
        ) : <p className="compendium-empty-note">{isLibraryLoading ? "Sincronizando biblioteca…" : emptyText}</p>}
      </section>
    );
  }

  return (
    <div className="compendium-library">
      <section className="panel lore-panel compendium-library-hero">
        <div>
          <span className="compendium-eyebrow">Archivo de consulta</span>
          <h2>Compendio Central</h2>
          <p>Encuentra reglas, capacidades y referencias por el camino que recuerdes: su tipo, su fuente o sus palabras.</p>
        </div>
        <button
          type="button"
          className="subtle-button"
          onClick={isExplorerOpen ? clearFilters : onBackToCharacters}
        >
          {isExplorerOpen ? "← Volver al compendio" : "Volver a personajes"}
        </button>
      </section>

      <section className="panel compendium-search-panel">
        {isExplorerOpen ? (
          <nav className="compendium-breadcrumb" aria-label="Ruta del compendio">
            <button type="button" onClick={clearFilters}>Biblioteca</button>
            <span aria-hidden="true">/</span>
            <span>{typeFilter !== "all" ? TYPE_LABELS[typeFilter] : sourceFilter !== "all" ? sourceFilter : "Resultados"}</span>
          </nav>
        ) : null}
        <label className="field compendium-global-search">
          <span>Búsqueda global</span>
          <span className="compendium-search-input-wrap">
            <span aria-hidden="true" className="compendium-search-glyph">⌕</span>
            <input
              type="search"
              placeholder="Busca una regla, poder, tradición, libro…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        {libraryError ? <p className="compendium-library-error" role="alert">{libraryError}</p> : null}
      </section>

      {!isExplorerOpen ? (
        <main className="compendium-library-home">
          {renderShelf("Favoritos", "Tus referencias guardadas, disponibles en cualquier dispositivo.", favoriteEntries, "Todavía no has guardado ninguna entrada.")}
          {renderShelf("Consultado recientemente", "Las últimas ocho entradas abiertas.", recentEntries, "Las entradas que abras aparecerán aquí.")}

          <section className="panel compendium-catalogue">
            <div className="compendium-catalogue-header">
              <div>
                <span className="compendium-eyebrow">Catálogo</span>
                <h3>Explorar el archivo</h3>
              </div>
              <div className="compendium-mode-switch" role="tablist" aria-label="Forma de explorar">
                <button
                  type="button"
                  role="tab"
                  id="compendium-mode-type"
                  aria-controls="compendium-type-catalogue"
                  aria-selected={browseMode === "type"}
                  className={browseMode === "type" ? "is-active" : ""}
                  onClick={() => setBrowseMode("type")}
                >Por tipo</button>
                <button
                  type="button"
                  role="tab"
                  id="compendium-mode-source"
                  aria-controls="compendium-source-catalogue"
                  aria-selected={browseMode === "source"}
                  className={browseMode === "source" ? "is-active" : ""}
                  onClick={() => setBrowseMode("source")}
                >Por fuente</button>
              </div>
            </div>

            {browseMode === "type" ? (
              <div id="compendium-type-catalogue" className="compendium-type-groups" role="tabpanel" aria-labelledby="compendium-mode-type">
                {TYPE_GROUPS.map((group) => (
                  <section key={group.label} className="compendium-type-group">
                    <div className="compendium-type-group-heading">
                      <h4>{group.label}</h4>
                      <p>{group.description}</p>
                    </div>
                    <div className="compendium-section-grid">
                      {group.types.map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`compendium-section-card app-card-accent app-card-accent--${type}`}
                          onClick={() => selectTypeSection(type)}
                        >
                          <span className="compendium-section-card-ornament" aria-hidden="true" />
                          <strong>{TYPE_LABELS[type]}</strong>
                          <span>{typeCounts.get(type) ?? 0} entradas</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div id="compendium-source-catalogue" className="compendium-type-groups" role="tabpanel" aria-labelledby="compendium-mode-source">
                {sourceGroups.map((group) => (
                  <section key={group.label} className="compendium-type-group">
                    <div className="compendium-type-group-heading">
                      <h4>{group.label}</h4>
                      <p>{group.description}</p>
                    </div>
                    <div className="compendium-section-grid compendium-source-section-grid">
                      {group.sources.map((source) => (
                        <button
                          key={source}
                          type="button"
                          className="compendium-section-card compendium-source-section-card"
                          onClick={() => selectSourceSection(source)}
                        >
                          <span className="compendium-section-card-ornament" aria-hidden="true" />
                          <strong>{source}</strong>
                          <span>{sourceCounts.get(source) ?? 0} entradas</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className={`compendium-explorer${selectedEntry ? " has-selection" : ""}`}>
          <section className="panel compendium-results-panel" aria-label="Resultados del compendio">
            <div className="compendium-explorer-controls">
              <label className="field">
                <span>Tipo</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | EntryType)}>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Fuente</span>
                <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  <option value="all">Todas</option>
                  {sources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </label>
              <button type="button" className="subtle-button compendium-clear-button" onClick={clearFilters}>Limpiar</button>
            </div>
            <div className="compendium-results-heading">
              <h3>Resultados</h3>
              <span className="meta-text" aria-live="polite">{visibleEntries.length} coincidencias</span>
            </div>
            <div className="compendium-result-list">
              {visibleEntries.length > 0 ? visibleEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={selectedEntry?.id === entry.id ? "true" : undefined}
                  className={`compendium-result-card app-card-accent app-card-accent--${entry.tipo}${selectedEntry?.id === entry.id ? " is-active" : ""}`}
                  onClick={(event) => openEntry(entry.id, event.currentTarget)}
                >
                  <span className="compendium-result-card-top">
                    <strong>{renderHighlightedText(entry.nombre, query)}</strong>
                    <span className="compendium-chip">{TYPE_LABELS[entry.tipo]}</span>
                  </span>
                  <span className="meta-text">{canonicalizeCompendiumSourceName(entry.fuente)}{entry.pagina ? ` · p.${entry.pagina}` : ""}</span>
                </button>
              )) : <p className="compendium-empty-note">No hay entradas que coincidan con esta consulta.</p>}
            </div>
          </section>

          <aside
            ref={readerRef}
            className={`panel compendium-reader${selectedEntry ? " is-open" : ""}`}
            role={isMobileDetail && selectedEntry ? "dialog" : "region"}
            aria-modal={isMobileDetail && selectedEntry ? "true" : undefined}
            aria-labelledby={selectedEntry ? "compendium-reader-title" : undefined}
            aria-label={selectedEntry ? undefined : "Lector del compendio"}
          >
            {selectedEntry ? (
              <>
                <header className="compendium-reader-header">
                  <div>
                    <span className="compendium-eyebrow">{TYPE_LABELS[selectedEntry.tipo]}</span>
                    <h3 id="compendium-reader-title" ref={detailHeadingRef} tabIndex={-1}>{renderHighlightedText(selectedEntry.nombre, query)}</h3>
                    <p>{canonicalSelectedSource}{selectedEntry.pagina ? ` · p.${selectedEntry.pagina}` : ""}</p>
                  </div>
                  <div className="compendium-reader-header-actions">
                    <button
                      type="button"
                      className={`compendium-favorite-button${favoriteIds.has(selectedEntry.id) ? " is-favorite" : ""}`}
                      aria-pressed={favoriteIds.has(selectedEntry.id)}
                      aria-label={favoriteIds.has(selectedEntry.id) ? "Quitar de favoritos" : "Añadir a favoritos"}
                      disabled={isLibraryLoading || savingFavoriteIds.has(selectedEntry.id)}
                      onClick={() => void toggleFavorite(selectedEntry)}
                    >
                      <span aria-hidden="true">{favoriteIds.has(selectedEntry.id) ? "★" : "☆"}</span>
                    </button>
                    <button
                      type="button"
                      className="subtle-button compendium-reader-close"
                      aria-label={isMobileDetail ? "Volver a resultados" : "Cerrar ficha"}
                      onClick={() => closeDetail()}
                    >
                      <span aria-hidden="true" className="compendium-detail-close-mobile">Volver a resultados</span>
                      <span aria-hidden="true" className="compendium-detail-close-desktop">Cerrar ficha</span>
                    </button>
                  </div>
                </header>

                <div className="compendium-reader-body">
                  {parsedCapabilityDetail && parsedCapabilityDetail.tiers.length > 0 ? (
                    <div className="capability-tier-list">
                      {parsedCapabilityDetail.tiers.map((tier) => (
                        <section key={`${selectedEntry.id}-${tier.label}`} className="capability-tier">
                          <h4 className="capability-tier-title">{tier.label}</h4>
                          <p>{renderHighlightedText(tier.content, query)}</p>
                        </section>
                      ))}
                      {parsedCapabilityDetail.reference ? <p className="capability-reference">{renderHighlightedText(parsedCapabilityDetail.reference, query)}</p> : null}
                    </div>
                  ) : <p className="compendium-reader-copy">{renderHighlightedText(selectedEntry.detalle, query)}</p>}

                  {selectedEntry.media?.length ? (
                    <div className="compendium-media-list">
                      {selectedEntry.media.map((asset) => (
                        <figure key={`${selectedEntry.id}-${asset.src}`} className="compendium-media-card">
                          <img src={asset.src} alt={asset.alt} className="compendium-media-image" />
                          {asset.caption ? <figcaption className="meta-text">{asset.caption}</figcaption> : null}
                        </figure>
                      ))}
                    </div>
                  ) : null}

                  {selectedEntry.tags.length > 0 ? (
                    <div className="compendium-tags" aria-label="Etiquetas">
                      {selectedEntry.tags.map((tag) => <span key={`${selectedEntry.id}-${tag}`} className="compendium-tag">{renderHighlightedText(tag, query)}</span>)}
                    </div>
                  ) : null}
                </div>

                <footer className="compendium-reader-footer">
                  {sourcePdfUrl ? <a className="subtle-button" href={sourcePdfUrl} target="_blank" rel="noreferrer">{selectedEntry.pagina ? `Abrir PDF p.${selectedEntry.pagina}` : "Abrir PDF"}</a> : null}
                  {summaryLink ? <a className="subtle-button" href={summaryLink.url} target="_blank" rel="noreferrer">{summaryLink.documentLabel}</a> : null}
                  <button type="button" className="subtle-button" onClick={() => void copyDeepLink()}>{linkCopied ? "Enlace copiado" : "Copiar enlace"}</button>
                </footer>
              </>
            ) : (
              <div className="compendium-reader-empty">
                <span aria-hidden="true">✦</span>
                <h3>Selecciona una entrada</h3>
                <p>La referencia completa aparecerá aquí sin perder de vista los resultados.</p>
              </div>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
