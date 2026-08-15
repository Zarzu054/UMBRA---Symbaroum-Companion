import { describe, expect, it } from "vitest";
import { STARTER_MONSTER_CODEX } from "@umbra/shared";
import { clampMonsterCatalogSplit, sortMonsterCatalog } from "./MonsterDashboardView";

describe("orden del catálogo de monstruos", () => {
  it("recupera el orden de aparición del Libro Básico seguido del Códice", () => {
    const shuffled = [STARTER_MONSTER_CODEX[90]!, STARTER_MONSTER_CODEX[0]!, STARTER_MONSTER_CODEX[37]!, STARTER_MONSTER_CODEX[36]!];
    expect(sortMonsterCatalog(shuffled, "appearance").map((monster) => monster.id)).toEqual([
      "libro-basico-elfo-vernal",
      "libro-basico-moratumbas",
      "codice-arak-emponzonador",
      STARTER_MONSTER_CODEX[90]!.id
    ]);
  });

  it("ordena alfabéticamente por familia y variante", () => {
    const sample = STARTER_MONSTER_CODEX.filter((monster) => ["Centella", "Arak"].includes(monster.sheet.family));
    const ordered = sortMonsterCatalog(sample.reverse(), "alphabetical");
    expect(ordered[0]?.sheet.family).toBe("Arak");
    expect(ordered.at(-1)?.sheet.family).toBe("Centella");
    expect(ordered.filter((monster) => monster.sheet.family === "Arak").map((monster) => monster.name)).toEqual([
      "Arak, Emponzoñador",
      "Arak, Exaltado"
    ]);
  });
});

describe("división ajustable del catálogo de monstruos", () => {
  it("limita ambas columnas a una proporción mínima de 25/75", () => {
    expect(clampMonsterCatalogSplit(10)).toBe(25);
    expect(clampMonsterCatalogSplit(42.4)).toBe(42);
    expect(clampMonsterCatalogSplit(90)).toBe(75);
  });
});
