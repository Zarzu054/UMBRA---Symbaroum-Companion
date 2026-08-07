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
});
