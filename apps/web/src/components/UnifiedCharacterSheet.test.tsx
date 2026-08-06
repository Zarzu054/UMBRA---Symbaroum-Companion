import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";
import { UnifiedCharacterSheet } from "./UnifiedCharacterSheet";

describe("UnifiedCharacterSheet mobile navigation", () => {
  afterEach(cleanup);

  it("starts on Atributos and switches to the action list with visible roll formulas", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.nombrePersonaje = "Arold";
    sheet.atributos.diestro = 13;
    sheet.combate.armaPrincipal = "Espada";
    sheet.combate.armaPrincipalAtributo = "diestro";
    sheet.combate.danioPrincipal = "1d8+1";

    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    const root = container.querySelector(".unified-sheet");
    expect(root).toHaveClass("is-mobile-tab-attributes");
    expect(screen.getByRole("button", { name: "Atributos" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Atributos" })).toHaveAttribute("aria-current", "page");

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    expect(mobileTabs.parentElement).toBe(root);
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Acciones" }));

    expect(root).toHaveClass("is-mobile-tab-actions");
    expect(within(mobileTabs).getByRole("button", { name: "Acciones" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("1d20 ≤ Diestro 13").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1d8+1").length).toBeGreaterThan(0);
  });

  it("muestra una sola vez la descripcion del arma en el detalle de su ataque", () => {
    const sheet = createEmptyCharacterSheet();
    const description = "Descripcion unica del arma para comprobar el detalle.";
    sheet.inventoryItems = [{
      id: "weapon-test-sword",
      name: "Espada de prueba",
      category: "weapon",
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "Precisa",
      description,
      notes: "Nota propia del arma.",
      weight: "Media",
      value: "5 taleros",
      isCustom: false,
      grantedActions: [],
      modifiers: []
    }];
    sheet.equipmentSlots.mainHand = "weapon-test-sword";

    render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Atacar con Espada de prueba" })[0]);

    const modal = screen.getByRole("heading", { name: "Atacar con Espada de prueba" }).closest(".modal-panel");
    expect(modal).not.toBeNull();
    expect(modal?.textContent?.split(description)).toHaveLength(2);
    expect(modal).toHaveTextContent("Tirada de ataque y, si procede");
  });
});
