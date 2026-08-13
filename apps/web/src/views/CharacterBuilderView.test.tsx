import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type Character, type OwnedMysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterBuilderView } from "./CharacterBuilderView";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeArtifact(): OwnedMysticArtifact {
  return {
    id: "artifact-a", scope: "campaign", campaignId: "campaign-a", campaignName: "Davokar", presetSourceId: null,
    name: "Piedra Solar", description: "", kind: "object", sourceTitle: "", bindingCosts: [
      { paymentType: "xp", amount: 1 }, { paymentType: "permanent_corruption", amount: 1 }
    ], ownerType: "character", ownerId: "link-a", ownerName: "Alda", ownerEmail: "alda@example.com",
    isBound: false, boundAt: null, bindingPaymentType: null, bindingPaymentAmount: null,
    abilities: [], resources: [], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
}

it("lets the player choose a configured artifact binding payment", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 5;
  const character: Character = {
    id: "character-a", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, mysticArtifacts: [makeArtifact()], artifactBindingXpSpent: 0,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onBind = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onBindMysticArtifact={onBind} />);
  fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
  expect(screen.getByText("Piedra Solar")).toBeInTheDocument();
  expect(screen.getByText(/capacidades se revelaran/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Vincular por 1 PX" }));

  await waitFor(() => expect(onBind).toHaveBeenCalledWith("artifact-a", "xp"));
});

it("shows all profession goals with live requirement progress and creates an aspiration", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.habilidades = [
    { nombre: "Estudioso", tipo: "Habilidad", efecto: "", nivel: "maestro", fuente: "Libro Básico", pagina: 1, notas: "", acciones: [] },
    { nombre: "Tirador", tipo: "Habilidad", efecto: "", nivel: "principiante", fuente: "Libro Básico", pagina: 1, notas: "", acciones: [] },
    { nombre: "Versado en criaturas", tipo: "Habilidad", efecto: "", nivel: "principiante", fuente: "Libro Básico", pagina: 1, notas: "", acciones: [] },
    { nombre: "Armas de asta", tipo: "Habilidad", efecto: "", nivel: "principiante", fuente: "Libro Básico", pagina: 1, notas: "", acciones: [] }
  ];
  const character: Character = { id: "character-prof", name: "Alda", archetype: "Cazador", race: "Humano", culture: "Ambriano", profession: "", level: 1, sheet, professionMemberships: [], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
  const onAspire = vi.fn().mockResolvedValue(undefined);
  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onAspireProfession={onAspire} />);
  fireEvent.click(screen.getByRole("button", { name: "Profesiones" }));
  expect(screen.getByRole("heading", { name: "Juramentado de hierro" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(17);
  expect(screen.getAllByText("Armas de asta").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: "Marcar como objetivo" })[0]);
  await waitFor(() => expect(onAspire).toHaveBeenCalledWith("juramentado-de-hierro"));
});

it("keeps exclusive benefits visible but locked until their profession is active", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 100;
  const character: Character = { id: "character-lock", name: "Alda", archetype: "Cazador", race: "Humano", culture: "Ambriano", profession: "", level: 1, sheet, professionMemberships: [], createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() };
  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Compras PX" }));
  fireEvent.click(screen.getByRole("button", { name: /Obtener nueva habilidad/ }));
  fireEvent.change(screen.getByPlaceholderText("Escribe para buscar..."), { target: { value: "Danza de batalla" } });
  expect(screen.getByText("Requiere profesión activa")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revisar compra" })).toBeDisabled();
});
