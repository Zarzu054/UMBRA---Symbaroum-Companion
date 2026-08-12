import { describe, expect, it } from "vitest";
import { ALL_ENTRIES } from "./compendiumEntries";
import {
  MONSTER_TRAIT_CATALOG,
  UNLEVELLED_MONSTER_TRAIT_NAMES,
  formatMonsterTraitDetail
} from "./monsterTraitCatalog";

describe("catálogo de rasgos de monstruo", () => {
  it("contiene los 56 rasgos oficiales sin duplicados", () => {
    expect(MONSTER_TRAIT_CATALOG).toHaveLength(56);
    expect(new Set(MONSTER_TRAIT_CATALOG.map((entry) => entry.nombre)).size).toBe(56);
    expect(MONSTER_TRAIT_CATALOG.filter((entry) => entry.fuente === "Libro Básico")).toHaveLength(19);
    expect(MONSTER_TRAIT_CATALOG.filter((entry) => entry.fuente === "Códice de monstruos")).toHaveLength(37);
  });

  it("separa los tres niveles siempre que el rasgo tenga progresión", () => {
    const tiered = MONSTER_TRAIT_CATALOG.filter((entry) => entry.niveles);
    expect(tiered).toHaveLength(49);

    for (const entry of tiered) {
      expect(Object.keys(entry.niveles ?? {})).toEqual(["I", "II", "III"]);
      expect(formatMonsterTraitDetail(entry)).toMatch(/ I: .+ II: .+ III: /s);
      expect(formatMonsterTraitDetail(entry)).not.toMatch(/I\/II\/III:/);
    }
  });

  it("mantiene sin niveles únicamente los siete rasgos que no los tienen en el Códice", () => {
    expect([...UNLEVELLED_MONSTER_TRAIT_NAMES].sort()).toEqual([
      "Anfibio",
      "Diminuto",
      "Espíritu libre",
      "Lengua apresadora",
      "Observador",
      "Poder colectivo",
      "Visión nocturna"
    ]);
  });

  it("proyecta las reglas canónicas completas al compendio", () => {
    const compendiumTraits = ALL_ENTRIES.filter(
      (entry) => entry.tipo === "rasgo" && entry.tags.includes("monstruo")
    );
    expect(compendiumTraits).toHaveLength(56);

    for (const catalogEntry of MONSTER_TRAIT_CATALOG) {
      const compendiumEntry = compendiumTraits.find((entry) => entry.nombre === catalogEntry.nombre);
      expect(compendiumEntry?.fuente).toBe(catalogEntry.fuente);
      expect(compendiumEntry?.pagina).toBe(catalogEntry.pagina);
      expect(compendiumEntry?.detalle).toBe(formatMonsterTraitDetail(catalogEntry));
    }
  });

  it("conserva completas las diferencias mecánicas representativas", () => {
    const swarm = MONSTER_TRAIT_CATALOG.find((entry) => entry.nombre === "Enjambre")!;
    expect(swarm.niveles?.I).toContain("mitad de su Resistencia");
    expect(swarm.niveles?.II).toContain("Umbral de dolor");
    expect(swarm.niveles?.III).toContain("cuarta parte del daño");

    const shell = MONSTER_TRAIT_CATALOG.find((entry) => entry.nombre === "Caparazón")!;
    expect(shell.niveles?.I).toContain("no puede realizar acciones activas");
    expect(shell.niveles?.II).toContain("ataques gratuitos");
    expect(shell.niveles?.III).toContain("repetir una tirada exitosa");
  });
});
