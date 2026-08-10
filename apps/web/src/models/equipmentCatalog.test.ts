import { describe, expect, it } from "vitest";
import { WEAPON_QUALITY_OPTIONS } from "@umbra/shared";
import { searchCompendiumEntries } from "../views/CompendiumView";
import { ALL_ENTRIES, SYMBAROUM_EQUIPMENT } from "./compendiumEntries";
import { EQUIPMENT_CATALOG_DEFINITIONS, getEquipmentDefinitionInventoryVariants } from "./equipmentCatalog";
import { ARMOR_QUALITY_OPTIONS, ITEM_CATALOG } from "./itemCatalog";

const EXPECTED_ELIXIRS = [
  "Aceite de protección", "Agua bendita", "Amistad espiritual", "Antídoto", "Bebedizo transmutador",
  "Bestias espinosas", "Bomba de esporas", "Bomba de humo", "Chicle silvestre", "Magia concentrada",
  "Elixir de vida", "Esporas asfixiantes", "Extracto elemental", "Flecha rastreadora", "Granada de trueno",
  "Hierbas curativas", "Homúnculo", "Lágrimas curativas", "Luz reveladora", "Pan de viaje",
  "Pintura de guerra", "Polvo cegador", "Polvo espectral", "Rocío de aturdimiento", "Savia morada",
  "Tinte de sombra", "Tintura crepuscular", "Tintura ígnea", "Vela antídoto", "Vela fantasmal",
  "Vela venenosa", "Veneno", "Virote aturdidor"
];

const EXPECTED_MINOR_ARTIFACTS = [
  "Anillo de mando", "Araña curativa", "Arma trascendental", "Báculo rúnico", "Cabeza de báculo",
  "Capa de marlit", "Códice de ritual", "Corona de hierro", "Foco de ritual", "Foco místico",
  "Máscara animal", "Máscara de corteza", "Máscara de la muerte", "Máscara de la peste", "Máscara solar",
  "Medallón de la Ordo", "Moneda de la suerte", "Mortaja funeraria", "Pergamino de hechizo", "Pie de báculo",
  "Piedra de encuentro", "Piedra de espíritu", "Piedra de ignición", "Prisma mental", "Sapo guardián",
  "Sello de ritual", "Sello místico", "Trenza de bruja"
];

describe("complete equipment catalog", () => {
  it("contains all agreed equipment families with unique entries", () => {
    const ids = SYMBAROUM_EQUIPMENT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of ["arma", "armadura", "cualidad_arma", "cualidad_armadura", "elixir", "artefacto_menor", "trampa", "herramienta", "equipo"] as const) {
      expect(SYMBAROUM_EQUIPMENT.some((entry) => entry.tipo === type), type).toBe(true);
    }
  });

  it("covers every elixir and minor artifact from the basic and advanced equipment chapters", () => {
    const elixirs = new Set(SYMBAROUM_EQUIPMENT.filter((entry) => entry.tipo === "elixir").map((entry) => entry.nombre));
    const artifacts = new Set(SYMBAROUM_EQUIPMENT.filter((entry) => entry.tipo === "artefacto_menor").map((entry) => entry.nombre));
    EXPECTED_ELIXIRS.forEach((name) => expect(elixirs.has(name), `Falta el elixir ${name}`).toBe(true));
    EXPECTED_MINOR_ARTIFACTS.forEach((name) => expect(artifacts.has(name), `Falta el artefacto menor ${name}`).toBe(true));
  });

  it("exposes every weapon and armor quality as an individual related entry", () => {
    WEAPON_QUALITY_OPTIONS.forEach((quality) => {
      expect(SYMBAROUM_EQUIPMENT).toContainEqual(expect.objectContaining({
        id: `equipment-weapon-quality-${quality.id}`,
        tipo: "cualidad_arma",
        nombre: quality.label
      }));
    });
    ARMOR_QUALITY_OPTIONS.forEach((quality) => {
      expect(SYMBAROUM_EQUIPMENT).toContainEqual(expect.objectContaining({
        id: `equipment-armor-quality-${quality.id}`,
        tipo: "cualidad_armadura",
        nombre: quality.label
      }));
    });
    const knownIds = new Set(ALL_ENTRIES.map((entry) => entry.id));
    SYMBAROUM_EQUIPMENT.flatMap((entry) => entry.relations ?? []).forEach((relation) => {
      expect(knownIds.has(relation.entryId), relation.entryId).toBe(true);
    });
  });

  it("keeps grouped variants in the compendium and selectable variants in inventory", () => {
    for (const definition of EQUIPMENT_CATALOG_DEFINITIONS.filter((entry) => entry.variants?.length)) {
      const compendiumEntry = SYMBAROUM_EQUIPMENT.find((entry) => entry.id === definition.id);
      expect(compendiumEntry?.variants).toHaveLength(definition.variants?.length ?? 0);
      for (const variant of getEquipmentDefinitionInventoryVariants(definition)) {
        expect(ITEM_CATALOG.some((item) => item.templateId === variant.templateId), variant.templateId).toBe(true);
      }
    }
  });

  it("preserves important prices, dice and multiple source references", () => {
    expect(SYMBAROUM_EQUIPMENT.find((entry) => entry.nombre === "Arbalesta")?.facts).toContainEqual({ label: "Daño", value: "1d10+1" });
    expect(SYMBAROUM_EQUIPMENT.find((entry) => entry.nombre === "Armadura de placas pansar")?.facts).toContainEqual({ label: "Precio", value: "250 taleros" });
    expect(SYMBAROUM_EQUIPMENT.find((entry) => entry.nombre === "Aceite de protección")?.references).toEqual(expect.arrayContaining([
      { source: "Libro Básico", page: 151 },
      { source: "Guía Avanzada del Jugador", page: 120 }
    ]));
    expect(SYMBAROUM_EQUIPMENT.find((entry) => entry.nombre === "Mina alquímica")?.variants?.[2].detail).toContain("1D12");
    const climbingKits = SYMBAROUM_EQUIPMENT.filter((entry) => entry.nombre === "Equipo de escalada");
    expect(climbingKits).toHaveLength(1);
    expect(climbingKits[0].references).toEqual(expect.arrayContaining([
      { source: "Libro Básico", page: 152 },
      { source: "Guía Avanzada del Jugador", page: 128 }
    ]));
  });

  it("searches structured facts, variants and secondary sources", () => {
    expect(searchCompendiumEntries(ALL_ENTRIES, { query: "1d12", type: "trampa", source: "all" }).map((entry) => entry.nombre)).toContain("Mina alquímica");
    expect(searchCompendiumEntries(ALL_ENTRIES, { query: "250 taleros", type: "armadura", source: "all" }).map((entry) => entry.nombre)).toContain("Armadura de placas pansar");
    expect(searchCompendiumEntries(ALL_ENTRIES, { query: "aceite proteccion", type: "elixir", source: "Libro Básico" }).map((entry) => entry.nombre)).toContain("Aceite de protección");
  });

  it("keeps minor artifacts as ordinary inventory objects rather than managed campaign artifacts", () => {
    const artifactTemplates = ITEM_CATALOG.filter((item) => item.catalogGroup === "minor-artifact");
    expect(artifactTemplates).toHaveLength(EXPECTED_MINOR_ARTIFACTS.length + 3);
    expect(artifactTemplates.every((item) => item.category === "artifact" && !("managedArtifactId" in item))).toBe(true);
  });
});
