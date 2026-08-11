import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_ENTRIES, canonicalizeCompendiumSourceName, type CompendiumEntry } from "../models/compendiumEntries";

const serviceMocks = vi.hoisted(() => ({
  fetchCompendiumLibrary: vi.fn(),
  recordCompendiumView: vi.fn(),
  setCompendiumFavorite: vi.fn()
}));

vi.mock("../services/compendiumService", () => serviceMocks);

import {
  CompendiumView,
  getEntrySearchRank,
  searchCompendiumEntries
} from "./CompendiumView";

const ensureAccessToken = vi.fn().mockResolvedValue("access-token");

function entry(overrides: Partial<CompendiumEntry>): CompendiumEntry {
  return {
    id: "regla-prueba",
    tipo: "regla",
    nombre: "Regla de prueba",
    resumen: "Una referencia breve.",
    detalle: "Contenido detallado.",
    fuente: "Libro Básico",
    pagina: 10,
    tags: [],
    ...overrides
  };
}

function renderCompendium(props: Partial<React.ComponentProps<typeof CompendiumView>> = {}) {
  return render(
    <CompendiumView
      onBackToCharacters={vi.fn()}
      ensureAccessToken={ensureAccessToken}
      {...props}
    />
  );
}

describe("compendium search", () => {
  it("does not expose Poder místico as a generic purchasable ability", () => {
    expect(ALL_ENTRIES.some((candidate) => candidate.tipo === "habilidad" && candidate.nombre === "Poder místico")).toBe(false);
  });

  it("exposes rituals individually with their complete descriptions", () => {
    const rituals = ALL_ENTRIES.filter((candidate) => candidate.tipo === "ritual");

    expect(ALL_ENTRIES.some((candidate) => candidate.tipo === "habilidad" && candidate.nombre === "Rituales")).toBe(false);
    expect(rituals).toHaveLength(66);
    expect(rituals.every((ritual) => ritual.detalle.length > 100 && !ritual.detalle.startsWith("Consulta "))).toBe(true);
    expect(rituals.find((ritual) => ritual.nombre === "Grilletes rúnicos")?.detalle).toContain("hacer una misión");
    expect(ALL_ENTRIES.find((candidate) => candidate.nombre === "Talento místico superior")?.detalle).not.toContain("habilidad Rituales");
    expect(ALL_ENTRIES.find((candidate) => candidate.nombre === "Compra individual de rituales")?.detalle).toContain("10 puntos de experiencia");
  });

  it("includes useful race and archetype information with corrected source pages", () => {
    const races = ALL_ENTRIES.filter((candidate) => candidate.tipo === "raza");
    const archetypes = ALL_ENTRIES.filter((candidate) => candidate.tipo === "arquetipo");

    expect(races).toHaveLength(9);
    expect(archetypes).toHaveLength(4);
    expect([...races, ...archetypes].every((entry) => entry.detalle.length > 250 && !entry.detalle.includes("Consulta la sección"))).toBe(true);
    expect(races.find((race) => race.nombre === "Troll")?.pagina).toBe(44);
    expect(races.find((race) => race.nombre === "Muerto viviente")?.detalle).toContain("Muerto viviente (I)");
    expect(archetypes.find((archetype) => archetype.nombre === "Místico")?.pagina).toBe(86);
    expect(archetypes.find((archetype) => archetype.nombre === "Cazador")?.pagina).toBe(10);
  });

  it("includes useful cultural and faction backgrounds with precise references", () => {
    const cultures = ALL_ENTRIES.filter((candidate) => candidate.tipo === "cultura");

    expect(cultures).toHaveLength(6);
    expect(cultures.every((entry) => entry.detalle.length > 400 && !entry.detalle.includes("Consulta la secci\u00f3n"))).toBe(true);
    expect(cultures.find((culture) => culture.nombre === "Pueblo libre")?.pagina).toBe(18);
    expect(cultures.find((culture) => culture.nombre === "Clan goblin")?.detalle).toContain("comunidad o tribu trasga");
    expect(cultures.find((culture) => culture.nombre === "Ordo M\u00e1gica")?.pagina).toBe(27);
    expect(cultures.find((culture) => culture.nombre === "Templo de Prios")?.detalle).toContain("Los tres brazos de la Iglesia");
  });

  it("matches accents and multiple unordered tokens, then ranks names before content", () => {
    const nameMatch = entry({ id: "name", nombre: "Poder místico protector", detalle: "Defensa" });
    const contentMatch = entry({ id: "content", nombre: "Escudo", detalle: "Este poder protector es místico." });
    const unrelated = entry({ id: "other", nombre: "Combate", detalle: "Ataques físicos." });

    const results = searchCompendiumEntries([contentMatch, unrelated, nameMatch], {
      query: "protector mistico",
      type: "all",
      source: "all"
    });

    expect(results.map((result) => result.id)).toEqual(["name", "content"]);
    expect(getEntrySearchRank(nameMatch, "poder mistico")).toBeLessThan(getEntrySearchRank(contentMatch, "poder mistico"));
  });

  it("separates mystical traditions from professions", () => {
    const traditions = ALL_ENTRIES.filter((candidate) => candidate.tipo === "tradicion");
    const professions = ALL_ENTRIES.filter((candidate) => candidate.tipo === "profesion");

    expect(traditions).toHaveLength(7);
    expect(professions).toHaveLength(17);
    expect(traditions.map((candidate) => candidate.nombre)).toContain("Magia del b\u00e1culo");
    expect(traditions.map((candidate) => candidate.nombre)).not.toContain("Demon\u00f3logo");
    expect(traditions.map((candidate) => candidate.nombre)).not.toContain("Mago del b\u00e1culo");
    expect(professions.map((candidate) => candidate.nombre)).toContain("Demon\u00f3logo");
    expect(professions.map((candidate) => candidate.nombre)).toContain("Tejedora verde");
    expect(professions.map((candidate) => candidate.nombre)).toEqual(expect.arrayContaining([
      "Juramentado de hierro",
      "Templario",
      "Guardia de la Furia",
      "Artesano de artefactos",
      "Mago del b\u00e1culo",
      "Esp\u00eda de la reina",
      "Ladr\u00f3n de guante blanco"
    ]));
    expect(professions.find((candidate) => candidate.nombre === "Juramentado de hierro")?.pagina).toBe(12);
    expect(professions.find((candidate) => candidate.nombre === "Juramentado de hierro")?.facts).toEqual(expect.arrayContaining([
      { label: "Habilidad o don exclusivo", value: "Danza de batalla" }
    ]));
    expect(professions.every((candidate) => candidate.detalle.includes("al menos una de las capacidades requeridas a nivel maestro"))).toBe(true);
    expect(professions.every((candidate) => candidate.facts?.some((fact) => fact.label === "Requisitos"))).toBe(true);
  });

  it("combines type and source filters", () => {
    const results = searchCompendiumEntries([
      entry({ id: "basic-rule" }),
      entry({ id: "advanced-rule", fuente: "Guía Avanzada del Jugador" }),
      entry({ id: "basic-power", tipo: "poder_mistico" })
    ], { query: "", type: "regla", source: "Libro Básico" });
    expect(results.map((result) => result.id)).toEqual(["basic-rule"]);
  });

  it("canonicalizes the mojibake source alias", () => {
    expect(canonicalizeCompendiumSourceName("GuÃ­a Avanzada del Jugador")).toBe("Guía Avanzada del Jugador");
  });
});

describe("CompendiumView library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureAccessToken.mockResolvedValue("access-token");
    serviceMocks.fetchCompendiumLibrary.mockResolvedValue({ favoriteEntryIds: [], recentEntryIds: [] });
    serviceMocks.recordCompendiumView.mockResolvedValue(undefined);
    serviceMocks.setCompendiumFavorite.mockResolvedValue(undefined);
    window.history.replaceState(null, "", "#compendium");
  });

  afterEach(cleanup);

  it("starts on the section cover and switches between type and source catalogues", async () => {
    renderCompendium();
    const hero = screen.getByRole("heading", { name: "Compendio Central" }).closest(".compendium-library-hero") as HTMLElement;
    expect(within(hero).getByRole("searchbox", { name: "Búsqueda global" })).toBeInTheDocument();
    expect(document.querySelector(".compendium-search-panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Favoritos" })).not.toBeInTheDocument();
    fireEvent.click(within(hero).getByRole("button", { name: /Favoritos/ }));
    const favoritesDialog = screen.getByRole("dialog", { name: "Favoritos" });
    expect(await within(favoritesDialog).findByText("Todavía no has guardado ninguna entrada.")).toBeInTheDocument();
    fireEvent.click(within(favoritesDialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Favoritos" })).not.toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: /Recientes/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explorar el archivo" })).toBeInTheDocument();
    const abilityCategory = screen.getByRole("button", { name: /Habilidades.*entradas/ });
    expect(abilityCategory).toHaveClass("app-card-accent--habilidad");
    expect(abilityCategory.querySelector(".compendium-section-card-ornament")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tradiciones.*7 entradas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Profesiones.*17 entradas/ })).toHaveClass("app-card-accent--profesion");

    fireEvent.click(screen.getByRole("tab", { name: "Por fuente" }));
    expect(screen.getByRole("heading", { name: "Libros" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Referencias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Libro Básico.*entradas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resumen de Reglas.*entradas/ })).toBeInTheDocument();
    await waitFor(() => expect(serviceMocks.fetchCompendiumLibrary).toHaveBeenCalledWith("access-token"));
  });

  it("shows the equipment group and renders structured facts, variants and source links", async () => {
    const antidote = ALL_ENTRIES.find((candidate) => candidate.tipo === "elixir" && candidate.nombre === "Antídoto")!;
    renderCompendium({ initialEntryId: antidote.id });

    expect(await screen.findByRole("heading", { name: "Antídoto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Datos de la entrada")).toHaveTextContent("PrecioDesde 1 tálero");
    expect(screen.getByRole("heading", { name: "Variantes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Débil" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Libro Básico p.151" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Guía Avanzada del Jugador p.120" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Volver al compendio" }));
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Elixires.*entradas/ })).toHaveClass("app-card-accent--elixir");
    expect(screen.getByRole("button", { name: /Artefactos menores.*entradas/ })).toBeInTheDocument();
  });

  it("opens related weapon qualities as individual compendium entries", async () => {
    const longBow = ALL_ENTRIES.find((candidate) => candidate.tipo === "arma" && candidate.nombre === "Arco largo")!;
    renderCompendium({ initialEntryId: longBow.id, initialTypeFilter: "arma" });

    const related = await screen.findByRole("button", { name: "Precisa" });
    fireEvent.click(related);
    expect(await screen.findByRole("heading", { name: "Precisa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo")).toHaveValue("cualidad_arma");
  });

  it("opens a type section and returns to the cover after clearing filters", () => {
    renderCompendium();
    fireEvent.click(screen.getByRole("button", { name: /Habilidades.*entradas/ }));
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo")).toHaveValue("habilidad");
    expect(document.querySelector(".compendium-result-card.app-card-accent--habilidad")).toBeInTheDocument();
    expect(document.querySelector(".compendium-result-snippet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Volver al compendio" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Volver al compendio" }));
    expect(screen.getByRole("heading", { name: "Explorar el archivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a personajes" })).toBeInTheDocument();
  });

  it("keeps global search on the cover with quick results and opens the complete result view on demand", () => {
    renderCompendium();
    fireEvent.change(screen.getByRole("searchbox", { name: "Búsqueda global" }), {
      target: { value: "corrupcion" }
    });

    const quickResults = screen.getByRole("listbox", { name: "Resultados de búsqueda global" });
    expect(within(quickResults).getAllByRole("option").length).toBeGreaterThan(0);
    expect(quickResults.parentElement).toHaveClass("is-portal");
    expect(quickResults.closest(".compendium-library-hero")).toBeNull();
    expect(screen.getByRole("heading", { name: "Explorar el archivo" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resultados" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver los \d+ resultados/ }));
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(document.querySelector(".compendium-result-snippet")).not.toBeInTheDocument();
  });

  it("opens an entry directly from the cover search dropdown", async () => {
    renderCompendium();
    fireEvent.change(screen.getByRole("searchbox", { name: "Búsqueda global" }), {
      target: { value: "antidoto" }
    });

    const quickResults = screen.getByRole("listbox", { name: "Resultados de búsqueda global" });
    fireEvent.click(within(quickResults).getByRole("option", { name: /^Antídoto/ }));
    expect(await screen.findByRole("heading", { name: "Antídoto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Volver al compendio" })).toBeInTheDocument();
  });

  it("opens a deep-linked entry, records it and serializes all hash fields", async () => {
    const target = ALL_ENTRIES.find((item) => item.tipo === "habilidad")!;
    renderCompendium({
      initialEntryId: target.id,
      initialQuery: target.nombre,
      initialTypeFilter: "habilidad",
      initialSourceFilter: canonicalizeCompendiumSourceName(target.fuente),
      initialBrowseMode: "source"
    });

    expect(await screen.findByRole("heading", { name: target.nombre })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: target.nombre })).toHaveClass(`app-card-accent--${target.tipo}`);
    await waitFor(() => expect(serviceMocks.recordCompendiumView).toHaveBeenCalledWith(target.id, "access-token"));
    expect(window.location.hash).toContain("mode=source");
    expect(window.location.hash).toContain("type=habilidad");
    expect(window.location.hash).toContain(`id=${target.id}`);
  });

  it("updates favorites optimistically and rolls back a failed sync", async () => {
    const target = ALL_ENTRIES[0];
    serviceMocks.fetchCompendiumLibrary.mockResolvedValue({ favoriteEntryIds: [target.id], recentEntryIds: [] });
    serviceMocks.setCompendiumFavorite.mockRejectedValue(new Error("Sin conexión"));
    renderCompendium({ initialEntryId: target.id });

    const favoriteButton = await screen.findByRole("button", { name: "Quitar de favoritos" });
    await waitFor(() => expect(favoriteButton).not.toBeDisabled());
    fireEvent.click(favoriteButton);
    await waitFor(() => expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
  });

  it("uses an accessible full-screen reader on mobile and closes it with Escape", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
    const target = ALL_ENTRIES[0];

    renderCompendium({ initialEntryId: target.id });
    expect(await screen.findByRole("dialog", { name: target.nombre })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Volver a resultados" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: target.nombre })).not.toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  });
});
