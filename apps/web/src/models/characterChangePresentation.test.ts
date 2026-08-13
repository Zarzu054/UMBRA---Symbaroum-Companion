import { describe, expect, it } from "vitest";
import type { CharacterChangeDiff } from "@umbra/shared";
import { presentCharacterChanges } from "./characterChangePresentation";

describe("presentCharacterChanges", () => {
  it("oculta diferencias que solo conservan la terminología antigua de nivel", () => {
    expect(presentCharacterChanges([{
      path: "actions[cambiaformas].label",
      section: "Ficha",
      label: "Label",
      operation: "changed",
      before: "Usar Cambiaformas (novato)",
      after: "Usar Cambiaformas (principiante)"
    }])).toEqual([]);
  });

  it("agrupa los campos técnicos de una acción en una sola frase", () => {
    const changes: CharacterChangeDiff[] = [
      { path: "actions[cambiaformas].notes", section: "Ficha", label: "Notes", operation: "changed", before: "Texto anterior", after: "Texto nuevo" },
      { path: "actions[cambiaformas].effectSummary", section: "Ficha", label: "Effect Summary", operation: "changed", before: "Efecto anterior", after: "Efecto nuevo" }
    ];

    const presented = presentCharacterChanges(changes);
    expect(presented).toEqual([expect.objectContaining({
      section: "Acciones",
      title: "Acción «Cambiaformas» actualizada",
      description: "Se modificó notas y efecto."
    })]);
    expect(presented[0]).not.toHaveProperty("before");
    expect(presented[0]).not.toHaveProperty("after");
  });

  it("resume las altas completas sin mostrar los nombres de sus campos internos", () => {
    expect(presentCharacterChanges([{
      path: "inventoryItems[antorcha]",
      section: "Ficha",
      label: "Inventory items",
      operation: "added",
      after: { name: "Antorcha", quantity: 1, notes: "Ilumina una zona" }
    }])).toEqual([expect.objectContaining({
      section: "Inventario",
      title: "Objeto «Antorcha» añadido"
    })]);
  });

  it("traduce identificadores internos de condiciones", () => {
    expect(presentCharacterChanges([{
      path: "conditions[condition-burning].active",
      section: "Ficha",
      label: "Condition-burning",
      operation: "changed",
      before: false,
      after: true
    }])).toEqual([expect.objectContaining({
      section: "Condiciones",
      title: "Condición «Ardiendo» activada"
    })]);
  });

  it("conserva los valores breves que explican un cambio de recursos", () => {
    expect(presentCharacterChanges([{
      path: "sheet.corrupcion.temporal",
      section: "Corrupción",
      label: "Corrupción temporal",
      operation: "changed",
      before: 0,
      after: 1
    }])).toEqual([expect.objectContaining({
      section: "Corrupción",
      title: "Corrupción temporal",
      before: "0",
      after: "1"
    })]);
  });
});
