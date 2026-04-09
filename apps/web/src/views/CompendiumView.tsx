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

type Props = {
  onBackToCharacters: () => void;
  initialEntryId?: string | null;
  initialQuery?: string;
  initialSourceFilter?: string;
  focusToken?: number;
};

function includesQuery(entry: CompendiumEntry, query: string): boolean {
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

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const safeQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safeQuery})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === normalizedQuery.toLowerCase();
    return isMatch ? (
      <mark key={`${part}-${index}`} className="compendium-highlight">
        {part}
      </mark>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    );
  });
}

type CapabilityTier = {
  label: string;
  content: string;
};

const LIST_TIER_PREVIEW_LENGTH = 90;

function parseCapabilityTiers(text: string): { tiers: CapabilityTier[]; reference: string | null; remainder: string | null } {
  const tierRegex = /(Novato:|Adepto:|Maestro:)/g;
  const matches = [...text.matchAll(tierRegex)];

  if (matches.length === 0) {
    return { tiers: [], reference: null, remainder: text.trim() || null };
  }

  const tiers: CapabilityTier[] = [];
  let reference: string | null = null;

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

function truncateText(text: string, maxLength: number): string {
  const normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function renderListSummary(entry: CompendiumEntry, query: string): React.ReactNode {
  if (entry.tipo !== "habilidad" && entry.tipo !== "poder_mistico") {
    return <span className="compendium-list-summary">{renderHighlightedText(entry.resumen, query)}</span>;
  }

  const parsed = parseCapabilityTiers(entry.detalle);
  if (parsed.tiers.length === 0) {
    return <span className="compendium-list-summary">{renderHighlightedText(entry.resumen, query)}</span>;
  }

  return (
    <span className="compendium-list-tier-summary">
      {parsed.tiers.map((tier) => (
        <span key={`${entry.id}-${tier.label}`} className="compendium-list-tier-row">
          <strong className="compendium-list-tier-label">{tier.label}</strong>
          <span className="compendium-list-tier-text">
            {renderHighlightedText(truncateText(tier.content, LIST_TIER_PREVIEW_LENGTH), query)}
          </span>
        </span>
      ))}
    </span>
  );
}

export function CompendiumView({
  onBackToCharacters,
  initialEntryId = null,
  initialQuery = "",
  initialSourceFilter = "all",
  focusToken = 0
}: Props) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string>(ALL_ENTRIES[0]?.id ?? "");
  const [linkCopied, setLinkCopied] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const suppressHistoryRef = useRef(false);

  const sources = useMemo(
    () => [
      "all",
      ...new Set(
        ALL_ENTRIES
          .map((entry) => canonicalizeCompendiumSourceName(entry.fuente))
          .filter((source) => source !== "Reglas UMBRA")
      )
    ],
    []
  );

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
    setSourceFilter(
      initialSourceFilter !== "all" && canonicalizeCompendiumSourceName(initialSourceFilter) !== "Reglas UMBRA"
        ? canonicalizeCompendiumSourceName(initialSourceFilter)
        : targetEntry
          ? canonicalizeCompendiumSourceName(targetEntry.fuente) === "Reglas UMBRA"
            ? "all"
            : canonicalizeCompendiumSourceName(targetEntry.fuente)
          : "all"
    );
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
  const parsedCapabilityDetail =
    selectedEntry && (selectedEntry.tipo === "habilidad" || selectedEntry.tipo === "poder_mistico")
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

  function clearFilters(): void {
    setQuery("");
    setTypeFilter("all");
    setSourceFilter("all");
  }

  async function copyDeepLink(): Promise<void> {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1500);
  }

  function goToHistory(direction: -1 | 1): void {
    const nextIndex = historyIndex + direction;
    if (nextIndex < 0 || nextIndex >= historyStack.length) {
      return;
    }

    const nextId = historyStack[nextIndex];
    suppressHistoryRef.current = true;
    setHistoryIndex(nextIndex);
    setSelectedId(nextId);
  }

  function openSelectedPdf(): void {
    if (!sourcePdfUrl) {
      return;
    }

    window.open(sourcePdfUrl, "_blank", "noopener,noreferrer");
  }

  function openSummaryDocument(): void {
    if (!summaryLink) {
      return;
    }

    window.open(summaryLink.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <section className="panel lore-panel compendium-hero">
        <div>
          <h2>Compendio Central</h2>
          <p>
            Consulta rápida de reglas, rasgos de monstruo, habilidades, poderes místicos, rituales y referencias base
            de personaje desde un único módulo.
          </p>
        </div>
        <div className="toolbar">
          <button onClick={onBackToCharacters}>Volver a personajes</button>
        </div>
      </section>

      <section className="panel">
        <div className="compendium-filters">
          <label className="field compendium-search">
            <span>Búsqueda global</span>
            <input
              placeholder="Busca nombre, efecto, tradición, regla, libro..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | EntryType)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fuente</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source === "all" ? "Todas" : source}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="compendium-layout">
        <div className="panel compendium-results">
          <div className="row-actions">
            <h3>Resultados</h3>
            <span className="meta-text">{filteredEntries.length} coincidencias</span>
          </div>
          <div className="compendium-list">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  className={`compendium-list-item${selectedEntry?.id === entry.id ? " is-active" : ""}`}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className="compendium-list-top">
                    <strong>{renderHighlightedText(entry.nombre, query)}</strong>
                    <span className="compendium-chip">{TYPE_LABELS[entry.tipo]}</span>
                  </span>
                  <span className="meta-text">
                    {canonicalizeCompendiumSourceName(entry.fuente)}
                    {entry.pagina ? `, p.${entry.pagina}` : ""}
                  </span>
                  {renderListSummary(entry, query)}
                </button>
              ))
            ) : (
              <p className="section-help">No hay entradas que coincidan con la búsqueda actual.</p>
            )}
          </div>
        </div>

        <div className="panel compendium-detail">
          {selectedEntry ? (
            <>
              <div className="row-actions">
                <div>
                  <h3>{renderHighlightedText(selectedEntry.nombre, query)}</h3>
                  <p className="meta-text">
                    {TYPE_LABELS[selectedEntry.tipo]} · {canonicalSelectedSource}
                    {selectedEntry.pagina ? ` · p.${selectedEntry.pagina}` : ""}
                  </p>
                </div>
                <div className="toolbar">
                  <button className="subtle-button" disabled={historyIndex <= 0} onClick={() => goToHistory(-1)}>
                    Anterior
                  </button>
                  <button
                    className="subtle-button"
                    disabled={historyIndex < 0 || historyIndex >= historyStack.length - 1}
                    onClick={() => goToHistory(1)}
                  >
                    Siguiente
                  </button>
                  <button className="subtle-button" onClick={clearFilters}>Limpiar filtros</button>
                  <button className="subtle-button" onClick={() => void copyDeepLink()}>
                    {linkCopied ? "Enlace copiado" : "Copiar enlace"}
                  </button>
                  {sourcePdfUrl ? (
                    <button className="subtle-button" onClick={openSelectedPdf}>
                      {selectedEntry.pagina ? `Abrir PDF p.${selectedEntry.pagina}` : "Abrir PDF"}
                    </button>
                  ) : null}
                  {summaryLink ? (
                    <button className="subtle-button" onClick={openSummaryDocument}>
                      {summaryLink.documentLabel}
                    </button>
                  ) : null}
                </div>
              </div>
              {summaryLink ? (
                <p className="meta-text">
                  Sección en resumen: <strong>{summaryLink.sectionLabel}</strong>
                </p>
              ) : null}
              {parsedCapabilityDetail && parsedCapabilityDetail.tiers.length > 0 ? (
                <div className="capability-tier-list">
                  {parsedCapabilityDetail.tiers.map((tier) => (
                    <section key={`${selectedEntry.id}-${tier.label}`} className="capability-tier">
                      <h4 className="capability-tier-title">{tier.label}</h4>
                      <p>{renderHighlightedText(tier.content, query)}</p>
                    </section>
                  ))}
                  {parsedCapabilityDetail.reference ? (
                    <p className="capability-reference">{renderHighlightedText(parsedCapabilityDetail.reference, query)}</p>
                  ) : null}
                </div>
              ) : (
                <p>{renderHighlightedText(selectedEntry.detalle, query)}</p>
              )}
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
                <div className="compendium-tags">
                  {selectedEntry.tags.map((tag) => (
                    <span key={`${selectedEntry.id}-${tag}`} className="compendium-tag">
                      {renderHighlightedText(tag, query)}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="section-help">Selecciona una entrada del compendio para ver su detalle.</p>
          )}
        </div>
      </section>
    </>
  );
}
