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
});
