import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ALL_ENTRIES,
  RULE_CATEGORY_LABELS,
  TYPE_LABELS,
  canonicalizeCompendiumSourceName,
  findCompendiumEntryById,
  getCompendiumSummaryLink,
  getCompendiumSourcePdfUrl,
  type CompendiumEntry,
  type EntryType,
  type RuleCategory
} from "../models/compendiumEntries";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { SourceReferenceLink } from "../components/SourceReferenceLink";
import {
  fetchCompendiumLibrary,
  recordCompendiumView,
  setCompendiumFavorite
} from "../services/compendiumService";

export type CompendiumBrowseMode = "type" | "source";
type CompendiumLibraryModal = "favorites" | "recent";

type Props = {
  onBackToCharacters: () => void;
  ensureAccessToken: () => Promise<string>;
  initialEntryId?: string | null;
  initialQuery?: string;
  initialSourceFilter?: string;
  initialTypeFilter?: "all" | EntryType;
  initialRuleCategory?: "all" | RuleCategory;
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
  ruleCategory?: "all" | RuleCategory;
};

type QuickSearchPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MOBILE_DETAIL_QUERY = "(max-width: 900px)";
const RECENT_ENTRY_LIMIT = 8;
const RULE_CATEGORIES = Object.keys(RULE_CATEGORY_LABELS) as RuleCategory[];

const TYPE_GROUPS: Array<{ label: string; description: string; types: EntryType[] }> = [
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

const SOURCE_GROUP_DEFINITIONS: Array<{ label: string; description: string; sources: string[] }> = [
  {
    label: "Libros",
    description: "Reglamentos y suplementos publicados",
    sources: ["Libro Básico", "Guía Avanzada del Jugador", "Códice de monstruos"]
  },
  {
    label: "Referencias",
    description: "Resúmenes y reglas propias de UMBRA",
    sources: ["Reglas UMBRA"]
  }
];

function getEntryTypeLabel(entry: CompendiumEntry): string {
  if (entry.tipo === "regla" && entry.ruleCategory) return RULE_CATEGORY_LABELS[entry.ruleCategory];
  return TYPE_LABELS[entry.tipo];
}

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
    metadata: normalizeCompendiumText(`${TYPE_LABELS[entry.tipo]} ${getEntryTypeLabel(entry)} ${source} ${entry.tags.join(" ")}`),
    content: normalizeCompendiumText(`${entry.resumen} ${entry.detalle} ${structuredContent}`)
  };
}

function getEntrySources(entry: CompendiumEntry): string[] {
  return [...new Set((entry.references?.length ? entry.references : [{ source: entry.fuente }])
    .map((reference) => canonicalizeCompendiumSourceName(reference.source)))];
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
      if (options.ruleCategory && options.ruleCategory !== "all" && entry.ruleCategory !== options.ruleCategory) return false;
      if (options.source !== "all" && !getEntrySources(entry).includes(options.source)) return false;
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
  const tierRegex = /(Principiante:|Novato:|Adepto:|Maestro:)/g;
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
    const parsedLabel = marker.slice(0, -1);
    tiers.push({
      label: parsedLabel === "Novato" ? "Principiante" : parsedLabel,
      content: referenceIndex >= 0 ? rawContent.slice(0, referenceIndex).trim() : rawContent
    });
  });
  return { tiers, reference, remainder: null };
}

function parseMonsterTraitTiers(text: string): { tiers: CapabilityTier[]; reference: null; remainder: string | null } {
  const tierRegex = /(?:^|\s)(III|II|I)\s*:/g;
  const matches = [...text.matchAll(tierRegex)];
  if (matches.length === 0) return { tiers: [], reference: null, remainder: text.trim() || null };

  return {
    tiers: matches.map((match, index) => {
      const nextStart = matches[index + 1]?.index ?? text.length;
      return {
        label: `Nivel ${match[1]}`,
        content: text.slice((match.index ?? 0) + match[0].length, nextStart).trim()
      };
    }),
    reference: null,
    remainder: text.slice(0, matches[0]?.index ?? 0).trim() || null
  };
}

function isMobileDetailViewport(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_DETAIL_QUERY).matches
    : false;
}

function MobileCompendiumReaderPortal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled || typeof document === "undefined") return children;
  return createPortal(
    <div className="compendium-mobile-reader-page compendium-library module-theme">
      {children}
    </div>,
    document.body
  );
}

export function CompendiumView({
  onBackToCharacters,
  ensureAccessToken,
  initialEntryId = null,
  initialQuery = "",
  initialSourceFilter = "all",
  initialTypeFilter = "all",
  initialRuleCategory = "all",
  initialBrowseMode = "type",
  focusToken = 0
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [isQueryExplorerOpen, setIsQueryExplorerOpen] = useState(Boolean(initialQuery.trim()));
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>(initialTypeFilter);
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<"all" | RuleCategory>(initialRuleCategory);
  const [sourceFilter, setSourceFilter] = useState(initialSourceFilter);
  const [browseMode, setBrowseMode] = useState<CompendiumBrowseMode>(initialBrowseMode);
  const [selectedId, setSelectedId] = useState(() => initialEntryId ? findCompendiumEntryById(initialEntryId)?.id ?? "" : "");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [savingFavoriteIds, setSavingFavoriteIds] = useState<Set<string>>(new Set());
  const [isMobileDetail, setIsMobileDetail] = useState(isMobileDetailViewport);
  const [libraryModal, setLibraryModal] = useState<CompendiumLibraryModal | null>(null);
  const [quickSearchPosition, setQuickSearchPosition] = useState<QuickSearchPosition | null>(null);
  const lastEntryTriggerRef = useRef<HTMLElement | null>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const libraryModalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const libraryModalCloseRef = useRef<HTMLButtonElement | null>(null);
  const quickSearchAnchorRef = useRef<HTMLDivElement | null>(null);
  const resultListRef = useRef<HTMLDivElement | null>(null);
  const mobileReturnPositionRef = useRef({ canRestore: false, windowX: 0, windowY: 0, resultListY: 0 });

  const sources = useMemo(
    () => [...new Set(ALL_ENTRIES.flatMap(getEntrySources))]
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
      getEntrySources(entry).forEach((source) => counts.set(source, (counts.get(source) ?? 0) + 1));
    });
    return counts;
  }, []);

  const ruleCategoryCounts = useMemo(() => {
    const counts = new Map<RuleCategory, number>();
    ALL_ENTRIES.forEach((entry) => {
      if (entry.tipo === "regla" && entry.ruleCategory) {
        counts.set(entry.ruleCategory, (counts.get(entry.ruleCategory) ?? 0) + 1);
      }
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
    () => searchCompendiumEntries(ALL_ENTRIES, {
      query,
      type: typeFilter,
      source: sourceFilter,
      ruleCategory: ruleCategoryFilter
    }),
    [query, ruleCategoryFilter, sourceFilter, typeFilter]
  );

  const selectedEntry = selectedId ? findCompendiumEntryById(selectedId) : null;
  const visibleEntries = selectedEntry && !query.trim() && typeFilter === "all" && sourceFilter === "all" && ruleCategoryFilter === "all"
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
      .map((id) => findCompendiumEntryById(id))
      .filter((entry): entry is CompendiumEntry => Boolean(entry)),
    [favoriteIds, recentIds]
  );
  const isExplorerOpen = Boolean(isQueryExplorerOpen || typeFilter !== "all" || sourceFilter !== "all" || ruleCategoryFilter !== "all" || selectedEntry);
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
  const parsedCapabilityDetail = selectedEntry
    ? selectedEntry.tipo === "habilidad" || selectedEntry.tipo === "poder_mistico"
      ? parseCapabilityTiers(selectedEntry.detalle)
      : selectedEntry.tipo === "rasgo" && selectedEntry.tags.includes("monstruo")
        ? parseMonsterTraitTiers(selectedEntry.detalle)
        : null
    : null;

  useBodyScrollLock(Boolean(libraryModal || (selectedEntry && isMobileDetail)));

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_DETAIL_QUERY);
    if (!mediaQuery) return;
    const handleChange = (event: MediaQueryListEvent) => setIsMobileDetail(event.matches);
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
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 7;
      const desiredWidth = Math.min(390, window.innerWidth - viewportPadding * 2);
      const width = Math.max(Math.min(rect.width, desiredWidth), desiredWidth);
      const left = Math.min(
        Math.max(viewportPadding, rect.right - width),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
      );
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
    setRuleCategoryFilter(initialRuleCategory);
    setSourceFilter(
      initialSourceFilter === "all" ? "all" : canonicalizeCompendiumSourceName(initialSourceFilter)
    );
    setBrowseMode(initialBrowseMode);
    setSelectedId(initialEntryId ? findCompendiumEntryById(initialEntryId)?.id ?? "" : "");
  }, [focusToken, initialBrowseMode, initialEntryId, initialQuery, initialRuleCategory, initialSourceFilter, initialTypeFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLibraryLoading(true);
    void ensureAccessToken()
      .then(fetchCompendiumLibrary)
      .then((library) => {
        if (cancelled) return;
        const normalizeKnownIds = (ids: string[]) => ids
          .map((id) => findCompendiumEntryById(id)?.id)
          .filter((id): id is string => Boolean(id));
        setFavoriteIds(new Set(normalizeKnownIds(library.favoriteEntryIds)));
        setRecentIds((current) => {
          const merged = [...current, ...normalizeKnownIds(library.recentEntryIds)];
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
    if (ruleCategoryFilter !== "all") params.set("ruleCategory", ruleCategoryFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (selectedEntry) params.set("id", selectedEntry.id);
    const nextHash = `#compendium?${params.toString()}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }, [browseMode, query, ruleCategoryFilter, selectedEntry, sourceFilter, typeFilter]);

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
    if (!selectedEntry || libraryModal) return;
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
  }, [isMobileDetail, libraryModal, selectedEntry]);

  useEffect(() => {
    if (!libraryModal) return;
    window.setTimeout(() => libraryModalCloseRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeLibraryModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [libraryModal]);

  function openEntry(entryId: string, trigger?: HTMLElement): void {
    if (trigger) lastEntryTriggerRef.current = trigger;
    if (isMobileDetail) {
      mobileReturnPositionRef.current = {
        canRestore: true,
        windowX: window.scrollX,
        windowY: window.scrollY,
        resultListY: resultListRef.current?.scrollTop ?? 0
      };
    }
    setSelectedId(entryId);
  }

  function openLibraryModal(kind: CompendiumLibraryModal, trigger: HTMLButtonElement): void {
    libraryModalTriggerRef.current = trigger;
    setLibraryModal(kind);
  }

  function closeLibraryModal(restoreFocus = true): void {
    setLibraryModal(null);
    if (restoreFocus) window.setTimeout(() => libraryModalTriggerRef.current?.focus(), 0);
  }

  function openRelatedEntry(entryId: string, trigger: HTMLElement): void {
    const target = findCompendiumEntryById(entryId);
    if (!target) return;
    lastEntryTriggerRef.current = trigger;
    setQuery("");
    setSourceFilter("all");
    setTypeFilter(target.tipo);
    setRuleCategoryFilter(target.ruleCategory ?? "all");
    setSelectedId(target.id);
  }

  function closeDetail(restoreFocus = true): void {
    const returnPosition = mobileReturnPositionRef.current;
    setSelectedId("");
    if (!restoreFocus) return;

    window.requestAnimationFrame(() => {
      if (isMobileDetail && returnPosition.canRestore) {
        resultListRef.current?.scrollTo?.({ top: returnPosition.resultListY });
        window.scrollTo({ left: returnPosition.windowX, top: returnPosition.windowY, behavior: "auto" });
        mobileReturnPositionRef.current.canRestore = false;
      }
      lastEntryTriggerRef.current?.focus({ preventScroll: true });
    });
  }

  function clearFilters(): void {
    setQuery("");
    setIsQueryExplorerOpen(false);
    setTypeFilter("all");
    setRuleCategoryFilter("all");
    setSourceFilter("all");
    closeDetail(false);
  }

  function selectTypeSection(type: EntryType): void {
    setIsQueryExplorerOpen(false);
    setBrowseMode("type");
    setTypeFilter(type);
    setRuleCategoryFilter("all");
    setSourceFilter("all");
    closeDetail(false);
  }

  function selectRuleCategorySection(ruleCategory: RuleCategory): void {
    setIsQueryExplorerOpen(false);
    setBrowseMode("type");
    setTypeFilter("regla");
    setRuleCategoryFilter(ruleCategory);
    setSourceFilter("all");
    closeDetail(false);
  }

  function selectSourceSection(source: string): void {
    setIsQueryExplorerOpen(false);
    setBrowseMode("source");
    setSourceFilter(source);
    setTypeFilter("all");
    setRuleCategoryFilter("all");
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
      const idsToUpdate = nextFavorite ? [entry.id] : [entry.id, ...(entry.legacyIds ?? [])];
      await Promise.all(idsToUpdate.map((entryId) => setCompendiumFavorite(entryId, { favorite: nextFavorite }, token)));
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

  function renderLibraryEntries(entries: CompendiumEntry[], emptyText: string) {
    if (entries.length === 0) {
      return <p className="compendium-empty-note">{isLibraryLoading ? "Sincronizando biblioteca…" : emptyText}</p>;
    }
    return (
      <div className="compendium-shelf-list">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`compendium-shelf-entry app-card-accent app-card-accent--${entry.tipo}${entry.ruleCategory ? ` rule-category--${entry.ruleCategory}` : ""}`}
            onClick={() => {
              closeLibraryModal(false);
              openEntry(entry.id, libraryModalTriggerRef.current ?? undefined);
            }}
          >
            <span className="compendium-shelf-entry-title">{entry.nombre}</span>
            <span>{getEntryTypeLabel(entry)} · {canonicalizeCompendiumSourceName(entry.fuente)}</span>
          </button>
        ))}
      </div>
    );
  }

  const quickSearchPopover = isQuickSearchOpen && quickSearchPosition && typeof document !== "undefined"
    ? createPortal(
      <div
        className={`compendium-quick-search-results is-portal${quickSearchEntries.length >= 4 ? " has-four-results" : ""}`}
        style={quickSearchPosition}
      >
        <div
          id="compendium-quick-search-results"
          className="compendium-quick-search-list"
          role="listbox"
          aria-label="Resultados de búsqueda global"
        >
          {quickSearchEntries.length > 0 ? quickSearchEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected="false"
              className={`compendium-quick-search-entry app-card-accent app-card-accent--${entry.tipo}${entry.ruleCategory ? ` rule-category--${entry.ruleCategory}` : ""}`}
              onClick={(event) => openEntry(entry.id, event.currentTarget)}
            >
              <strong>{renderHighlightedText(entry.nombre, query)}</strong>
              <span>{getEntryTypeLabel(entry)} · {canonicalizeCompendiumSourceName(entry.fuente)}</span>
            </button>
          )) : <p className="compendium-empty-note">No hay entradas que coincidan.</p>}
        </div>
        {filteredEntries.length > quickSearchEntries.length ? (
          <button
            type="button"
            className="compendium-quick-search-all"
            onClick={() => setIsQueryExplorerOpen(true)}
          >
            Ver los {filteredEntries.length} resultados
          </button>
        ) : null}
      </div>,
      document.body
    )
    : null;

  return (
    <div className="compendium-library">
      <header className="panel lore-panel compendium-library-hero module-sticky-header">
        <div className="compendium-library-hero-copy">
          <span className="compendium-eyebrow">Archivo de consulta</span>
          <h2>Compendio Central</h2>
          <p>Encuentra reglas, capacidades y referencias por el camino que recuerdes: su tipo, su fuente o sus palabras.</p>
        </div>
        <div className="compendium-library-shortcuts" aria-label="Biblioteca personal">
          <button type="button" className="subtle-button" onClick={(event) => openLibraryModal("favorites", event.currentTarget)}>
            <span>Favoritos</span><b>{favoriteEntries.length}</b>
          </button>
          <button type="button" className="subtle-button" onClick={(event) => openLibraryModal("recent", event.currentTarget)}>
            <span>Recientes</span><b>{recentEntries.length}</b>
          </button>
        </div>
        <div className="compendium-library-hero-actions">
          <button
            type="button"
            className="subtle-button compendium-library-back-button"
            onClick={isExplorerOpen ? clearFilters : onBackToCharacters}
          >
            {isExplorerOpen ? "← Volver al compendio" : "Volver a personajes"}
          </button>
          <div ref={quickSearchAnchorRef} className="compendium-hero-search">
            <label className="field compendium-global-search">
              <span>Búsqueda global</span>
              <span className="compendium-search-input-wrap">
                <span aria-hidden="true" className="compendium-search-glyph">⌕</span>
                <input
                  type="search"
                  placeholder="Buscar en el compendio…"
                  value={query}
                  aria-autocomplete="list"
                  aria-controls="compendium-quick-search-results"
                  aria-expanded={Boolean(!isExplorerOpen && query.trim())}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && query.trim()) setIsQueryExplorerOpen(true);
                    if (event.key === "Escape") setQuery("");
                  }}
                />
              </span>
            </label>
          </div>
          {libraryError ? <p className="compendium-library-error" role="alert">{libraryError}</p> : null}
        </div>
      </header>

      {quickSearchPopover}

      {libraryModal ? (
        <div className="modal-backdrop compendium-library-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeLibraryModal(); }}>
          <section className="compendium-library-modal" role="dialog" aria-modal="true" aria-labelledby="compendium-library-modal-title">
            <header>
              <div>
                <span className="compendium-eyebrow">Biblioteca personal</span>
                <h2 id="compendium-library-modal-title">{activeLibraryTitle}</h2>
                <p>{activeLibraryDescription}</p>
              </div>
              <span className="compendium-count-seal">{activeLibraryEntries.length}</span>
              <button ref={libraryModalCloseRef} type="button" className="subtle-button" onClick={() => closeLibraryModal()}>Cerrar</button>
            </header>
            <div className="compendium-library-modal-content">
              {renderLibraryEntries(activeLibraryEntries, activeLibraryEmptyText)}
            </div>
          </section>
        </div>
      ) : null}

      {!isExplorerOpen ? (
        <main className="compendium-library-home">
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
                      {group.types.flatMap((type) => type === "regla"
                        ? RULE_CATEGORIES.map((ruleCategory) => (
                          <button
                            key={ruleCategory}
                            type="button"
                            className={`compendium-section-card app-card-accent app-card-accent--regla rule-category-card--${ruleCategory}`}
                            onClick={() => selectRuleCategorySection(ruleCategory)}
                          >
                            <span className="compendium-section-card-ornament" aria-hidden="true" />
                            <strong>{RULE_CATEGORY_LABELS[ruleCategory]}</strong>
                            <span>{ruleCategoryCounts.get(ruleCategory) ?? 0} entradas</span>
                          </button>
                        ))
                        : [(
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
                        )])}
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
            <nav className="compendium-breadcrumb" aria-label="Ruta del compendio">
              <button type="button" onClick={clearFilters}>Biblioteca</button>
              <span aria-hidden="true">/</span>
              <span>{ruleCategoryFilter !== "all" ? RULE_CATEGORY_LABELS[ruleCategoryFilter] : typeFilter !== "all" ? TYPE_LABELS[typeFilter] : sourceFilter !== "all" ? sourceFilter : "Resultados"}</span>
            </nav>
            <div className="compendium-explorer-controls">
              <label className="field">
                <span>Tipo</span>
                <select value={typeFilter} onChange={(event) => {
                  const nextType = event.target.value as "all" | EntryType;
                  setTypeFilter(nextType);
                  if (nextType !== "regla") setRuleCategoryFilter("all");
                }}>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {typeFilter === "regla" ? (
                <label className="field">
                  <span>Categoría</span>
                  <select value={ruleCategoryFilter} onChange={(event) => setRuleCategoryFilter(event.target.value as "all" | RuleCategory)}>
                    <option value="all">Todas</option>
                    {RULE_CATEGORIES.map((ruleCategory) => (
                      <option key={ruleCategory} value={ruleCategory}>{RULE_CATEGORY_LABELS[ruleCategory]}</option>
                    ))}
                  </select>
                </label>
              ) : null}
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
            <div ref={resultListRef} className="compendium-result-list">
              {visibleEntries.length > 0 ? visibleEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={selectedEntry?.id === entry.id ? "true" : undefined}
                  className={`compendium-result-card app-card-accent app-card-accent--${entry.tipo}${entry.ruleCategory ? ` rule-category--${entry.ruleCategory}` : ""}${selectedEntry?.id === entry.id ? " is-active" : ""}`}
                  onClick={(event) => openEntry(entry.id, event.currentTarget)}
                >
                  <span className="compendium-result-card-top">
                    <strong>{renderHighlightedText(entry.nombre, query)}</strong>
                    <span className="compendium-chip">{getEntryTypeLabel(entry)}</span>
                  </span>
                  <span className="meta-text">{canonicalizeCompendiumSourceName(entry.fuente)}{entry.pagina ? ` · p.${entry.pagina}` : ""}</span>
                </button>
              )) : <p className="compendium-empty-note">No hay entradas que coincidan con esta consulta.</p>}
            </div>
          </section>

          <MobileCompendiumReaderPortal enabled={Boolean(isMobileDetail && selectedEntry)}>
          <aside
            ref={readerRef}
            className={`panel compendium-reader${selectedEntry ? ` is-open app-card-accent app-card-accent--${selectedEntry.tipo}${selectedEntry.ruleCategory ? ` rule-category--${selectedEntry.ruleCategory}` : ""}` : ""}`}
            role={isMobileDetail && selectedEntry ? "dialog" : "region"}
            aria-modal={isMobileDetail && selectedEntry ? "true" : undefined}
            aria-labelledby={selectedEntry ? "compendium-reader-title" : undefined}
            aria-label={selectedEntry ? undefined : "Lector del compendio"}
          >
            {selectedEntry ? (
              <>
                <header className="compendium-reader-header">
                  <div>
                    <span className="compendium-eyebrow">{selectedEntry.tipo === "regla" ? `Reglas · ${getEntryTypeLabel(selectedEntry)}` : TYPE_LABELS[selectedEntry.tipo]}</span>
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
                      <span aria-hidden="true" className="compendium-detail-close-mobile">← Volver</span>
                      <span aria-hidden="true" className="compendium-detail-close-desktop">Cerrar ficha</span>
                    </button>
                  </div>
                </header>

                <div className="compendium-reader-body">
                  {selectedEntry.facts?.length ? (
                    <dl className="compendium-fact-grid" aria-label="Datos de la entrada">
                      {selectedEntry.facts.map((fact) => (
                        <div key={`${selectedEntry.id}-${fact.label}`} className="compendium-fact-card">
                          <dt>{fact.label}</dt>
                          <dd>{renderHighlightedText(fact.value, query)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {selectedEntry.variants?.length ? (
                    <section className="compendium-variant-section" aria-labelledby="compendium-variant-title">
                      <h4 id="compendium-variant-title">{selectedEntry.tipo === "regla" && selectedEntry.legacyIds?.length ? "Reglas incluidas" : "Variantes"}</h4>
                      <div className="compendium-variant-list">
                        {selectedEntry.variants.map((variant) => (
                          <article key={`${selectedEntry.id}-${variant.id}`} className="compendium-variant-card">
                            <h5>{variant.label}</h5>
                            {variant.facts.length ? (
                              <dl>
                                {variant.facts.map((fact) => (
                                  <div key={`${variant.id}-${fact.label}`}><dt>{fact.label}</dt><dd>{renderHighlightedText(fact.value, query)}</dd></div>
                                ))}
                              </dl>
                            ) : null}
                            {variant.detail ? <p>{renderHighlightedText(variant.detail, query)}</p> : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {parsedCapabilityDetail && parsedCapabilityDetail.tiers.length > 0 ? (
                    <div className="capability-tier-list">
                      {parsedCapabilityDetail.remainder ? (
                        <p className="capability-tier-introduction">
                          {renderHighlightedText(parsedCapabilityDetail.remainder, query)}
                        </p>
                      ) : null}
                      {parsedCapabilityDetail.tiers.map((tier) => (
                        <section key={`${selectedEntry.id}-${tier.label}`} className="capability-tier">
                          <h4 className="capability-tier-title">{tier.label}</h4>
                          <p>{renderHighlightedText(tier.content, query)}</p>
                        </section>
                      ))}
                      {parsedCapabilityDetail.reference ? <p className="capability-reference">{renderHighlightedText(parsedCapabilityDetail.reference, query)}</p> : null}
                    </div>
                  ) : (
                    <div className="compendium-reader-copy">
                      {selectedEntry.detalle.split(/\n{2,}/).map((paragraph, index) => (
                        <p key={`${selectedEntry.id}-paragraph-${index}`}>{renderHighlightedText(paragraph, query)}</p>
                      ))}
                    </div>
                  )}

                  {selectedEntry.relations?.length ? (
                    <section className="compendium-related-section" aria-labelledby="compendium-related-title">
                      <h4 id="compendium-related-title">Entradas relacionadas</h4>
                      <div className="compendium-related-list">
                        {selectedEntry.relations.map((relation) => (
                          <button
                            key={`${selectedEntry.id}-${relation.entryId}`}
                            type="button"
                            className="compendium-tag"
                            onClick={(event) => openRelatedEntry(relation.entryId, event.currentTarget)}
                          >{relation.label}</button>
                        ))}
                      </div>
                    </section>
                  ) : null}

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
                      {Array.from(new Set(selectedEntry.tags)).map((tag) => <span key={`${selectedEntry.id}-${tag}`} className="compendium-tag">{renderHighlightedText(tag, query)}</span>)}
                    </div>
                  ) : null}
                </div>

                <footer className="compendium-reader-footer">
                  {selectedReferences.map((reference) => {
                    const url = getCompendiumSourcePdfUrl(reference.source, reference.page, selectedEntry.nombre);
                    return url ? (
                      <SourceReferenceLink
                        key={`${reference.source}-${reference.page ?? ""}`}
                        href={url}
                        source={canonicalizeCompendiumSourceName(reference.source)}
                        page={reference.page}
                        ariaLabel={reference.page
                          ? `${canonicalizeCompendiumSourceName(reference.source)} p.${reference.page}`
                          : canonicalizeCompendiumSourceName(reference.source)}
                      />
                    ) : null;
                  })}
                  {summaryLink ? <SourceReferenceLink href={summaryLink.url} source={summaryLink.documentLabel} eyebrow="Resumen" /> : null}
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
          </MobileCompendiumReaderPortal>
        </main>
      )}
    </div>
  );
}
