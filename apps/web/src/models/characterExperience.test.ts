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
        nivel: "principiante",
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

  it("does not add burden XP again when it is already consolidated in the stored total", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 10;
    sheet.cargas = ["Acosado"];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.extraFromBurdens).toBe(5);
    expect(experience.effectiveTotal).toBe(10);
    expect(experience.effectiveAvailable).toBe(10);
  });

  it("adds burden XP once while calculating initial character creation", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 10;
    sheet.cargas = ["Acosado"];

    const experience = getCharacterExperienceSummary(sheet, { includeBurdenBonus: true });

    expect(experience.extraFromBurdens).toBe(5);
    expect(experience.effectiveTotal).toBe(15);
    expect(experience.effectiveAvailable).toBe(15);
  });

  it("calculates persisted available XP from the stored total without duplicating structured burdens", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 102;
    sheet.progreso.experienciaGastada = 90;
    sheet.capabilitySelections = [
      { catalogId: "burden-a", name: "Paria", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" },
      { catalogId: "burden-b", name: "Secreto oscuro", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" }
    ];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.extraFromBurdens).toBe(10);
    expect(experience.effectiveTotal).toBe(102);
    expect(experience.effectiveAvailable).toBe(12);
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
    expect(experience.effectiveTotal).toBe(50);
    expect(experience.effectiveAvailable).toBe(10);
  });

  it("fills an incomplete structured selection list from the actual sheet capabilities", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 102;
    sheet.progreso.experienciaGastada = 100;
    sheet.capabilitySelections = [
      { catalogId: "steel-wind", name: "Viento de acero", kind: "habilidad", level: "principiante", origin: "comprada", source: "Libro Básico" }
    ];
    sheet.habilidades = [
      { nombre: "Sexto sentido", tipo: "Habilidad", efecto: "", nivel: "adepto", fuente: "Libro Básico", notas: "", acciones: [] },
      { nombre: "Viento de acero", tipo: "Habilidad", efecto: "", nivel: "principiante", fuente: "Libro Básico", notas: "", acciones: [] }
    ];
    sheet.poderesMisticos = [
      { nombre: "Brujería", tipo: "Poder místico", efecto: "", nivel: "adepto", fuente: "Libro Básico", notas: "", acciones: [] },
      { nombre: "Tormenta de flechas", tipo: "Poder místico", efecto: "", nivel: "principiante", fuente: "Libro Básico", notas: "", acciones: [] },
      { nombre: "Cambiaformas", tipo: "Poder místico", efecto: "", nivel: "principiante", fuente: "Libro Básico", notas: "", acciones: [] }
    ];
    sheet.rituales = [
      { nombre: "Familiar", tipo: "Ritual", efecto: "", nivel: "principiante", fuente: "Libro Básico", notas: "", acciones: [] }
    ];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.spentFromCapabilities).toBe(90);
    expect(experience.spentFromRituals).toBe(10);
    expect(experience.computedSpent).toBe(100);
    expect(experience.effectiveAvailable).toBe(2);
  });

  it("accounts for every recorded XP reroll", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 12;
    sheet.progreso.experienciaGastada = 3;
    sheet.progreso.gastosExperiencia = [
      { id: "reroll-a", tipo: "repeticion_tirada", cantidad: 1, fecha: "2026-08-14T10:00:00.000Z" },
      { id: "reroll-b", tipo: "repeticion_tirada", cantidad: 2, fecha: "2026-08-14T11:00:00.000Z" }
    ];

    const experience = getCharacterExperienceSummary(sheet);

    expect(experience.spentFromRerolls).toBe(3);
    expect(experience.computedSpent).toBe(3);
    expect(experience.effectiveAvailable).toBe(9);
  });
});
