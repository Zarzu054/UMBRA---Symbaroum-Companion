import { describe, expect, it } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";
import { getCharacterExperienceSummary } from "./characterExperience";


describe("character ritual experience", () => {
  it("charges 10 XP for every individually purchased ritual", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 40;
    sheet.rituales = [
      {
        nombre: "Adivinación",
        tipo: "Ritual",
        efecto: "",
        nivel: "novato",
        fuente: "Guía Avanzada del Jugador",
        notas: "",
        acciones: []
      },
      {
        nombre: "Exorcismo",
        tipo: "Ritual",
        efecto: "",
        nivel: "maestro",
        fuente: "Guía Avanzada del Jugador",
        notas: "",
        acciones: []
      }
    ];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.spentFromRituals).toBe(20);
    expect(experience.computedSpent).toBe(20);
    expect(experience.effectiveAvailable).toBe(20);
  });

  it("adds five spendable XP for every burden", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 10;
    sheet.cargas = ["Acosado"];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.extraFromBurdens).toBe(5);
    expect(experience.effectiveTotal).toBe(15);
    expect(experience.effectiveAvailable).toBe(15);
  });

  it("uses structured costs, free racial blessings and cumulative levels", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.capabilitySelections = [
      { catalogId: "blessing", name: "Memoria absoluta", kind: "bendicion", origin: "racial", source: "Guía Avanzada del Jugador" },
      { catalogId: "ability", name: "Berserker", kind: "habilidad", level: "adepto", origin: "comprada", source: "Libro Básico" },
      { catalogId: "ritual", name: "Exorcismo", kind: "ritual", origin: "comprada", source: "Libro Básico" },
      { catalogId: "burden", name: "Paria", kind: "carga", origin: "racial", source: "Libro Básico" }
    ];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.computedSpent).toBe(40);
    expect(experience.effectiveTotal).toBe(55);
    expect(experience.effectiveAvailable).toBe(15);
  });
});
