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

  it("does not let a stale edit absorb already-spent non-capability XP", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 102;
    current.progreso.experienciaGastada = 101;
    addNoviceAbility(current, "Acrobacia");
    const requested = structuredClone(current);
    requested.progreso.experienciaGastada = 100;

    const protectedSheet = protectGrantedCharacterExperience(current, requested);

    expect(protectedSheet.progreso.experienciaGastada).toBe(101);
  });

  it("still refunds the computed cost of a removed capability", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 102;
    current.progreso.experienciaGastada = 101;
    addNoviceAbility(current, "Acrobacia");
    const requested = structuredClone(current);
    requested.habilidades = [];
    requested.progreso.experienciaGastada = 91;

    const protectedSheet = protectGrantedCharacterExperience(current, requested);

    expect(protectedSheet.progreso.experienciaGastada).toBe(91);
  });

  it("can classify historical spending as rerolls without charging it twice", () => {
    const current = createEmptyCharacterSheet();
    current.progreso.experienciaTotal = 10;
    current.progreso.experienciaGastada = 5;
    const requested = structuredClone(current);
    requested.progreso.gastosExperiencia = [
      { id: "historical-rerolls", tipo: "repeticion_tirada", cantidad: 5, fecha: "" }
    ];

    const protectedSheet = protectGrantedCharacterExperience(current, requested);

    expect(protectedSheet.progreso.experienciaGastada).toBe(5);
  });
});
