import { describe, expect, it } from "vitest";
import {
  ALL_ENTRIES,
  CORE_RULES,
  RULE_CATEGORY_LABELS,
  findCompendiumEntryById,
  getCompendiumSummaryLink,
  type RuleCategory
} from "./compendiumEntries";

describe("catálogo de reglas del compendio", () => {
  const rules = ALL_ENTRIES.filter((entry) => entry.tipo === "regla");

  it("clasifica todas las reglas y conserva identificadores únicos", () => {
    expect(rules).toHaveLength(95);
    expect(new Set(rules.map((entry) => entry.id)).size).toBe(rules.length);
    expect(rules.every((entry) => entry.ruleCategory && entry.ruleCategory in RULE_CATEGORY_LABELS)).toBe(true);

    const counts = rules.reduce<Record<RuleCategory, number>>((result, entry) => {
      result[entry.ruleCategory!] += 1;
      return result;
    }, { core: 0, official_optional: 0, homebrew: 0 });
    expect(counts.core + counts.official_optional + counts.homebrew).toBe(rules.length);
    expect(Object.values(counts).every((count) => count > 0)).toBe(true);
  });

  it("distingue reglas básicas, opcionales oficiales y caseras", () => {
    expect(rules.find((entry) => entry.nombre === "Umbral de dolor")?.ruleCategory).toBe("core");
    expect(rules.find((entry) => entry.nombre === "Muerte instantánea")?.ruleCategory).toBe("official_optional");
    expect(rules.find((entry) => entry.nombre === "Carga")?.ruleCategory).toBe("official_optional");
    expect(rules.find((entry) => entry.nombre === "Enfermedad en Symbaroum")?.ruleCategory).toBe("core");
    expect(rules.find((entry) => entry.nombre === "Cambio a las tradiciones")?.ruleCategory).toBe("homebrew");
  });

  it("usa los manuales como fuente oficial y el resumen solo como referencia secundaria", () => {
    const officialRules = rules.filter((entry) => entry.ruleCategory !== "homebrew");
    expect(officialRules.every((entry) => entry.fuente !== "Resumen de Reglas" && Boolean(entry.pagina))).toBe(true);
    expect(rules.filter((entry) => entry.ruleCategory === "homebrew").every((entry) => entry.fuente === "Reglas UMBRA")).toBe(true);

    const instantDeath = rules.find((entry) => entry.nombre === "Muerte instantánea")!;
    expect(instantDeath.fuente).toBe("Libro Básico");
    expect(instantDeath.pagina).toBe(176);
    expect(getCompendiumSummaryLink(instantDeath)?.documentLabel).toBe("Resumen: Reglas");
  });

  it("retira notas técnicas y consolida las subreglas en su ficha principal", () => {
    expect(CORE_RULES.some((entry) => entry.nombre === "Creación inicial de personaje")).toBe(false);
    expect(CORE_RULES.some((entry) => entry.nombre === "Patrones iniciales de habilidades")).toBe(false);
    expect(CORE_RULES.some((entry) => entry.nombre.startsWith("Reglas alternativas:"))).toBe(false);
    expect(CORE_RULES.some((entry) => entry.nombre === "Compra individual de rituales")).toBe(false);

    const feats = rules.find((entry) => entry.nombre === "Hazañas")!;
    expect(rules.some((entry) => entry.nombre === "Hazaña: Resistencia")).toBe(false);
    expect(feats.variants?.map((variant) => variant.label)).toContain("Hazaña: Resistencia");
    expect(findCompendiumEntryById("regla-resumen-45-resistencia")?.id).toBe(feats.id);
  });

  it("agrupa todas las familias relacionadas y conserva su contenido para la búsqueda", () => {
    const expectedFamilies: Array<[string, string[]]> = [
      ["Objetivos vitales", ["Ejemplos de objetivos vitales"]],
      ["Armas alquímicas", ["Tubo de fuego alquímico (portátil)", "Tubo de fuego alquímico (fijo)", "Mina alquímica", "Granada alquímica", "Olla explosiva"]],
      ["Hazañas", ["Golpe limpio", "Sin miedo", "Ignorar la corrupción", "Defensa perfecta", "Golpe rápido", "Hazaña: Resistencia", "Mirada de acero", "Ataque torbellino"]],
      ["Trampas", ["Poner una trampa", "Desactivar una trampa"]],
      ["Maniobras de combate", ["Apuntar con cuidado", "Placaje", "Tomar la iniciativa"]],
      ["Pactos", ["Ventajas del pacto", "Romper un pacto"]],
      ["Daño a edificios", ["Resistencia de edificios", "Fortificación"]],
      ["Golpes localizados", ["Apuntar alto o bajo", "Apuntar a una parte del cuerpo", "Partes de la armadura"]],
      ["Reputación", ["Cambios en la reputación", "Tipo de reputación"]]
    ];

    expectedFamilies.forEach(([parentName, childNames]) => {
      const parent = rules.find((entry) => entry.nombre === parentName)!;
      expect(parent).toBeTruthy();
      childNames.forEach((childName) => {
        expect(rules.some((entry) => entry.nombre === childName)).toBe(false);
        expect(parent.variants?.some((variant) => variant.label === childName)).toBe(true);
      });
    });

    const localizedHits = rules.find((entry) => entry.nombre === "Golpes localizados")!;
    expect(localizedHits.variants?.find((variant) => variant.label === "Apuntar a una parte del cuerpo")?.detail).toContain("no tira 1D10");
    expect(localizedHits.variants?.find((variant) => variant.label === "Localización aleatoria y efectos")?.facts).toHaveLength(6);
  });

  it("incluye las reglas detectadas durante la auditoría", () => {
    expect(rules.map((entry) => entry.nombre)).toEqual(expect.arrayContaining([
      "Tiradas de acción",
      "Retos complejos",
      "Tiempo: escenas, interludios y turnos",
      "Corrupción temporal y permanente",
      "Rasgos monstruosos para personajes jugadores",
      "Jugar con una abominación",
      "Experiencia concreta",
      "Convertirse en muerto viviente en vez de morir",
      "Categorías de marcha",
      "Crónica de monstruos"
    ]));
  });
});
