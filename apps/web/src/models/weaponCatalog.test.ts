import { describe, expect, it } from "vitest";
import {
  WEAPON_TEMPLATES,
  createEmptyCharacterSheet,
  deriveCharacterActions,
  findWeaponQualityOption,
  parseWeaponQualities
} from "@umbra/shared";
import { createInventoryItemFromTemplate, ITEM_CATALOG } from "./itemCatalog";
import { computeDerivedStats } from "./rulesEngine";

describe("weapon catalog", () => {
  it("contains every basic and advanced personal weapon with recognized qualities", () => {
    const expectedWeapons = [
      "Arma de una mano", "Arma corta", "Arma larga", "Arma pesada", "Arma a distancia", "Arma arrojadiza",
      "Daga de parada", "Hoja de asesino", "Estilete", "Garras de batalla", "Hoja de esgrima", "Estoque",
      "Pico de cuervo", "Mangual", "Espada bastarda (1 mano)", "Espada bastarda (2 manos)", "Hacha de doble filo",
      "Mayal de guerra", "Hacha del verdugo", "Martillo de guerra", "Martillo largo (1 mano)",
      "Martillo largo (2 manos)", "Espada del verdugo", "Mangual pesado", "Hacha de abordaje", "Lanza",
      "Alabarda", "Pica", "Vara", "Vara mangual", "Lanza de caballeria", "Lanza de caballeria (2 manos)",
      "Latigo largo", "Arco", "Arco largo", "Arco largo de jinete", "Arco compuesto", "Honda", "Ballesta",
      "Arbalesta", "Ballesta de mano", "Ballesta de repeticion", "Cerbatana", "Tubo de fuego alquimico (portatil)",
      "Cuchillo arrojadizo", "Jabalina", "Granada alquimica", "Bolas", "Ala arrojadiza", "Lanzadardos"
    ];
    const names = new Set(WEAPON_TEMPLATES.map((weapon) => weapon.name));
    expectedWeapons.forEach((weapon) => expect(names.has(weapon), `${weapon} no esta en el catalogo`).toBe(true));

    const ids = WEAPON_TEMPLATES.map((weapon) => weapon.templateId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const weapon of WEAPON_TEMPLATES) {
      for (const quality of weapon.qualities) {
        expect(findWeaponQualityOption(quality), `${weapon.name}: cualidad desconocida ${quality}`).toBeDefined();
      }
      const mappedTemplate = ITEM_CATALOG.find((item) => item.templateId === weapon.templateId);
      expect(mappedTemplate, `${weapon.name} no se exporta al catalogo de inventario`).toBeDefined();
      expect(parseWeaponQualities(mappedTemplate?.qualities ?? "")).toEqual(weapon.qualities);
    }
  });

  it("accepts legacy quality names but stores the official definitions", () => {
    expect(findWeaponQualityOption("Perforante")?.label).toBe("Impacto agravado");
    expect(findWeaponQualityOption("Masiva")?.label).toBe("Gigantesca");
    expect(findWeaponQualityOption("Torpe")?.label).toBe("Engorrosa");
    expect(findWeaponQualityOption("Oculta")?.label).toBe("Ocultable");
    expect(findWeaponQualityOption("Enredadora")?.label).toBe("Presa");
  });

  it("applies Precisa to attacks and Equilibrada to defense when equipped", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.atributos.diestro = 12;
    sheet.atributos.agil = 11;
    const preciseTemplate = ITEM_CATALOG.find((item) => item.templateId === "weapon-long-bow");
    const balancedTemplate = ITEM_CATALOG.find((item) => item.templateId === "weapon-parrying-dagger");
    expect(preciseTemplate).toBeDefined();
    expect(balancedTemplate).toBeDefined();

    const precise = createInventoryItemFromTemplate(preciseTemplate!);
    const balanced = { ...createInventoryItemFromTemplate(balancedTemplate!), equipped: true };
    sheet.inventoryItems = [precise, balanced];
    sheet.equipmentSlots.offHand = balanced.id;

    const attack = deriveCharacterActions(sheet).find((action) => action.id === `weapon:${precise.id}`);
    expect(attack?.fixedTarget).toBe(13);
    expect(attack?.effectSummary).toContain("ya aplicado");
    expect(computeDerivedStats(sheet).defensaTotal).toBe(12);
    expect(computeDerivedStats(sheet).defensaArmaduraDetalle).toContain("Daga de parada: +1");
  });

  it("lists shields as weapons and applies their defense bonus", () => {
    const shieldTemplates = ITEM_CATALOG.filter((item) => parseWeaponQualities(item.qualities).includes("Escudo"));
    expect(shieldTemplates.map((item) => item.name)).toEqual(["Escudo", "Escudo de acero", "Rodela"]);
    expect(shieldTemplates.every((item) => item.category === "weapon" && item.protectionFormula === "")).toBe(true);

    const sheet = createEmptyCharacterSheet();
    sheet.atributos.agil = 10;
    const shield = { ...createInventoryItemFromTemplate(shieldTemplates[0]), equipped: true };
    sheet.inventoryItems = [shield];
    sheet.equipmentSlots.offHand = shield.id;
    expect(computeDerivedStats(sheet).defensaTotal).toBe(11);
    expect(computeDerivedStats(sheet).defensaArmaduraDetalle).toContain("Escudo: +1");

    const steelShield = { ...createInventoryItemFromTemplate(shieldTemplates[1]), equipped: true };
    sheet.inventoryItems = [steelShield];
    sheet.equipmentSlots.offHand = steelShield.id;
    expect(computeDerivedStats(sheet).defensaTotal).toBe(12);
  });
});
