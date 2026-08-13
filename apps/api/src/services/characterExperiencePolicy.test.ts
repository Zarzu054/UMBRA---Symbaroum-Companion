import { createEmptyCharacterSheet, type CharacterSheet } from "@umbra/shared";
import { describe, expect, it } from "vitest";
import {
  getEffectiveCharacterExperienceSpent,
  protectGrantedCharacterExperience
} from "./characterExperiencePolicy.js";

function addNoviceAbility(sheet: CharacterSheet, name: string): void {
  sheet.habilidades.push({
    nombre: name,
    tipo: "Habilidad",
    efecto: "",
    nivel: "principiante",
    fuente: "Libro Basico",
    notas: "",
    acciones: []
  });
}

describe("character experience policy", () => {
  it("preserves the GM-granted total and canonicalizes valid spending", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 20;
    const requested = structuredClone(current);
    requested.progreso.experienciaTotal = 999;
    addNoviceAbility(requested, "Acrobacia");

    const protectedSheet = protectGrantedCharacterExperience(current, requested);

    expect(protectedSheet.progreso.experienciaTotal).toBe(20);
    expect(protectedSheet.progreso.experienciaGastada).toBe(10);
    expect(getEffectiveCharacterExperienceSpent(protectedSheet)).toBe(10);
  });

  it("rejects a purchase that exceeds the granted total", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 10;
    const requested = structuredClone(current);
    addNoviceAbility(requested, "Acrobacia");
    addNoviceAbility(requested, "Alquimia");

    expect(() => protectGrantedCharacterExperience(current, requested)).toThrow("solo tiene 10 PX concedidos");
  });

  it("does not block unrelated edits on a pre-existing over-budget sheet", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 10;
    addNoviceAbility(current, "Acrobacia");
    addNoviceAbility(current, "Alquimia");
    const requested = structuredClone(current);
    requested.identidad.apariencia = "Una cicatriz reciente";
    requested.progreso.experienciaTotal = 500;

    const protectedSheet = protectGrantedCharacterExperience(current, requested);

    expect(protectedSheet.progreso.experienciaTotal).toBe(10);
    expect(protectedSheet.identidad.apariencia).toBe("Una cicatriz reciente");
  });
});
