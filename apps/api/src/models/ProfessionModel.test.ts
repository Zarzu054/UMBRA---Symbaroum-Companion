import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";
import { projectActiveProfessionBenefits, validateProfessionBenefitAcquisitionWithMemberships } from "./ProfessionModel.js";

function addAbility(sheet: ReturnType<typeof createEmptyCharacterSheet>, name: string, level: "novato" | "adepto" | "maestro" = "novato") {
  return { ...sheet, habilidades: [...sheet.habilidades, { nombre: name, tipo: "Habilidad", efecto: "", nivel: level, fuente: "Guía Avanzada del Jugador", pagina: 1, notas: "", acciones: [] }] };
}

describe("profession benefit policy", () => {
  it("rejects a newly acquired exclusive benefit without an active eligible profession", () => {
    const before = createEmptyCharacterSheet();
    const after = addAbility(before, "Danza de batalla");
    expect(() => validateProfessionBenefitAcquisitionWithMemberships(before, after, []))
      .toThrow("PROFESSION_BENEFIT_LOCKED:Danza de batalla");
  });

  it("allows the benefit when its active profession still meets continuous requirements", () => {
    let before = createEmptyCharacterSheet();
    before = addAbility(before, "Estudioso", "maestro");
    before = addAbility(before, "Tirador");
    before = addAbility(before, "Versado en criaturas");
    before = addAbility(before, "Armas de asta");
    const after = addAbility(before, "Danza de batalla");
    expect(() => validateProfessionBenefitAcquisitionWithMemberships(before, after, [{ professionId: "juramentado-de-hierro", state: "active" }])).not.toThrow();
  });

  it("requires the base ritual for a superior ritual", () => {
    let before = createEmptyCharacterSheet();
    before = addAbility(before, "Hechicería", "maestro");
    before = addAbility(before, "Aura impía");
    before = addAbility(before, "Rito de profanación");
    before = addAbility(before, "Estudioso");
    const after = { ...before, rituales: [{ nombre: "Siervo demoníaco", tipo: "Ritual", efecto: "", nivel: "novato" as const, fuente: "Guía Avanzada del Jugador", pagina: 1, notas: "", acciones: [] }] };
    expect(() => validateProfessionBenefitAcquisitionWithMemberships(before, after, [{ professionId: "demonologo", state: "active" }])).toThrow("PROFESSION_BASE_RITUAL_REQUIRED:Siervo demoníaco:Invocar demonio");
  });

  it("suspends passive entries and actions without deleting the stored sheet", () => {
    const original = addAbility(createEmptyCharacterSheet(), "Danza de batalla");
    original.habilidades[0].acciones = [{ id: "dance", label: "Danzar", cost: "combat", effectSummary: "" }];
    const projected = projectActiveProfessionBenefits(original, [{ professionId: "juramentado-de-hierro", state: "active" }]);
    expect(projected.habilidades).toHaveLength(0);
    expect(original.habilidades).toHaveLength(1);
    expect(projected.actions.some((action) => action.sourceName === "Danza de batalla")).toBe(false);
  });
});
