import { describe, expect, it } from "vitest";
import { buildCharacterChanges } from "./CharacterAuditModel.js";

describe("buildCharacterChanges", () => {
  it("describes scalar and stable-list changes field by field", () => {
    const before = {
      name: "Alda",
      sheet: { inventario: [{ id: "sword", nombre: "Espada", cantidad: 1 }], corrupcion: { temporal: 0 } }
    };
    const after = {
      name: "Alda la Roja",
      sheet: {
        inventario: [
          { id: "sword", nombre: "Espada", cantidad: 2 },
          { id: "rope", nombre: "Cuerda", cantidad: 1 }
        ],
        corrupcion: { temporal: 1 }
      }
    };

    const changes = buildCharacterChanges(before, after);

    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "name", section: "Identidad", before: "Alda", after: "Alda la Roja" }),
      expect.objectContaining({ path: "sheet.inventario[sword].cantidad", section: "Inventario", before: 1, after: 2 }),
      expect.objectContaining({ path: "sheet.inventario[rope]", operation: "added" }),
      expect.objectContaining({ path: "sheet.corrupcion.temporal", section: "Corrupción", before: 0, after: 1 })
    ]));
  });

  it("does not create events for identical states", () => {
    const state = { name: "Alda", sheet: { notas: "Sin cambios" } };
    expect(buildCharacterChanges(state, structuredClone(state))).toEqual([]);
  });
});
