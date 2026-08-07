import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Explorar el archivo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Por fuente" }));
    expect(screen.getByRole("heading", { name: "Libros" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Referencias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Libro Básico.*entradas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resumen de Reglas.*entradas/ })).toBeInTheDocument();
    await waitFor(() => expect(serviceMocks.fetchCompendiumLibrary).toHaveBeenCalledWith("access-token"));
  });

  it("opens a type section and returns to the cover after clearing filters", () => {
    renderCompendium();
    fireEvent.click(screen.getByRole("button", { name: /Habilidades.*entradas/ }));
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo")).toHaveValue("habilidad");
    expect(document.querySelector(".compendium-result-snippet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Volver al compendio" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← Volver al compendio" }));
    expect(screen.getByRole("heading", { name: "Explorar el archivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a personajes" })).toBeInTheDocument();
  });

  it("never renders descriptions in the result list, including text searches", () => {
    renderCompendium();
    fireEvent.change(screen.getByRole("searchbox", { name: "Búsqueda global" }), {
      target: { value: "corrupcion" }
    });
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(document.querySelector(".compendium-result-snippet")).not.toBeInTheDocument();
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
