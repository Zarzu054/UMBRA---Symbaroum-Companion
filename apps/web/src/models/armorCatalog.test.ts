import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet, parseCharacterSheet } from "@umbra/shared";
import { createInventoryItemFromTemplate, ITEM_CATALOG } from "./itemCatalog";
import { computeDerivedStats } from "./rulesEngine";

const EXPECTED_ARMORS = [
  ["Armadura ligera", "Ligera", "1d4", "Incómoda", "2 taleros"],
  ["Armadura oculta", "Ligera", "1d4", "Oculta, Flexible", "50 taleros"],
  ["Capa de la Ordo", "Ligera", "1d4", "Flexible", "10 taleros"],
  ["Coraza de escaldo", "Ligera", "1d4+1", "Reforzada, Flexible", "50 taleros"],
  ["Cuero tachonado", "Ligera", "1d4+1", "Reforzada", "10 taleros"],
  ["Hilo de seda", "Ligera", "1d4", "Flexible", "10 taleros"],
  ["Piel de lobo", "Ligera", "1d4", "Aparatosa", "1 talero"],
  ["Ropajes de bruja", "Ligera", "1d4", "Flexible", "10 taleros"],
  ["Túnica bendita", "Ligera", "1d4", "Flexible", "10 taleros"],
  ["Armadura media", "Media", "1d6", "Incómoda", "5 taleros"],
  ["Armadura de cuervo", "Media", "1d6", "Aparatosa", "2 taleros"],
  ["Armadura lamelar", "Media", "1d6+1", "Reforzada", "25 taleros"],
  ["Coraza de seda lacada", "Media", "1d6", "Flexible", "25 taleros"],
  ["Cota de malla de doble", "Media", "1d6+1", "Reforzada, Flexible", "125 taleros"],
  ["Armadura pesada", "Pesada", "1d8", "Incómoda", "10 taleros"],
  ["Armadura completa", "Pesada", "1d8", "Flexible", "50 taleros"],
  ["Armadura completa de templario", "Pesada", "1d8+1", "Sagrada", "100 taleros"],
  ["Armadura de la furia", "Pesada", "1d8", "Retributiva", "100 taleros"],
  ["Armadura de placas", "Pesada", "1d8+1", "Reforzada", "50 taleros"],
  ["Armadura de placas pansar", "Pesada", "1d8+1", "Reforzada, Flexible", "250 taleros"]
] as const;

describe("armor catalog", () => {
  it("matches the complete armor table without shields", () => {
    const armors = ITEM_CATALOG.filter((item) => item.category === "armor");
    expect(armors).toHaveLength(EXPECTED_ARMORS.length);
    expect(armors.map((item) => item.name)).toEqual(EXPECTED_ARMORS.map(([name]) => name));
    for (const [name, weight, protectionFormula, qualities, value] of EXPECTED_ARMORS) {
      const armor = armors.find((item) => item.name === name);
      expect(armor, `${name} no esta en el catalogo`).toMatchObject({
        weight,
        protectionFormula,
        qualities,
        value
      });
    }
    expect(armors.some((item) => item.name.toLowerCase().includes("escudo"))).toBe(false);
  });

  it("applies Incomoda, Flexible and Aparatosa to Defense", () => {
    const cases = [
      ["armor-light", 8],
      ["armor-wolfskin", 7],
      ["armor-medium", 7],
      ["armor-lacquered-silk", 9],
      ["armor-heavy", 6],
      ["armor-full-plate", 8]
    ] as const;

    for (const [templateId, expectedDefense] of cases) {
      const template = ITEM_CATALOG.find((item) => item.templateId === templateId)!;
      const armor = { ...createInventoryItemFromTemplate(template), equipped: true };
      const sheet = createEmptyCharacterSheet();
      sheet.atributos.agil = 10;
      sheet.inventoryItems = [armor];
      sheet.equipmentSlots.armor = armor.id;
      expect(computeDerivedStats(sheet).defensaTotal, template.name).toBe(expectedDefense);
    }
  });

  it("keeps the conditional mystical armor effects visible", () => {
    const sacred = ITEM_CATALOG.find((item) => item.templateId === "armor-templar-full")!;
    const retributive = ITEM_CATALOG.find((item) => item.templateId === "armor-fury")!;
    expect(sacred.notes).toContain("+1d4 de proteccion adicional");
    expect(retributive.notes).toContain("1d4 de daño por acido durante 1d4 turnos");
  });

  it("shows the effective protection from Combate con armadura for custom formulas", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems = [{
      ...createInventoryItemFromTemplate(ITEM_CATALOG.find((item) => item.templateId === "armor-heavy")!),
      id: "custom-armor",
      name: "Armadura personalizada",
      isCustom: true,
      equipped: true,
      protectionFormula: "1d8+1d4"
    }];
    sheet.equipmentSlots.armor = "custom-armor";
    sheet.habilidades = [{
      nombre: "Combate con armadura",
      tipo: "Habilidad",
      nivel: "principiante",
      efecto: "",
      fuente: "Libro Básico",
      notas: "",
      acciones: []
    }];

    expect(computeDerivedStats(sheet).armaduraActiva).toBe("1d10+1d4");
  });

  it("migrates existing armor shields into weapons", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems = [{
      ...createInventoryItemFromTemplate(ITEM_CATALOG.find((item) => item.templateId === "armor-light")!),
      id: "legacy-shield",
      name: "Escudo",
      category: "armor",
      slot: "offHand",
      qualities: "Escudo",
      protectionFormula: ""
    }];
    const parsed = parseCharacterSheet(sheet);
    expect(parsed.inventoryItems[0]).toMatchObject({ category: "weapon", damageFormula: "1d4" });
    expect(parsed.inventoryItems[0].modifiers).toContainEqual(expect.objectContaining({ modifierType: "defense", value: "+1" }));
  });
});
