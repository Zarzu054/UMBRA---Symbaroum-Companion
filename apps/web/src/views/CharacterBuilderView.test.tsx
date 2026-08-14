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

it("uses the persisted XP total without adding burden bonuses a second time", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 102;
  sheet.progreso.experienciaGastada = 90;
  sheet.capabilitySelections = [
    { catalogId: "burden-a", name: "Paria", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" },
    { catalogId: "burden-b", name: "Secreto oscuro", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" }
  ];
  const character: Character = {
    id: "character-xp", name: "Urmak", archetype: "Místico", race: "Humano", culture: "Ambriano", profession: "",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);

  const availableCard = screen.getByText("PX disponible").closest("article");
  expect(availableCard).toHaveTextContent("12");
  const persistentControls = screen.getByRole("heading", { name: "Urmak" }).closest(".character-builder-sticky-controls");
  expect(persistentControls).toContainElement(screen.getByRole("button", { name: "Guardar constructor" }));
  expect(persistentControls).toContainElement(screen.getByRole("button", { name: "Compras PX" }));
});

it("keeps historical reroll spending when an artifact binding arrives", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 102;
  sheet.progreso.experienciaGastada = 100;
  sheet.habilidades.push({
    nombre: "Acrobacia", tipo: "Habilidad", efecto: "", nivel: "principiante",
    fuente: "Libro Básico", notas: "", acciones: []
  });
  const baseCharacter: Character = {
    id: "character-binding-xp", name: "Urmak", archetype: "Místico", race: "Humano", culture: "Ambriano", profession: "",
    level: 1, sheet, artifactBindingXpSpent: 0,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const view = render(<CharacterBuilderView character={baseCharacter} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={onSave} />);

  expect(screen.getByText("PX gastada").closest("article")).toHaveTextContent("100");

  view.rerender(
    <CharacterBuilderView
      character={{ ...baseCharacter, artifactBindingXpSpent: 1, updatedAt: new Date(1).toISOString() }}
      onBackToCharacters={vi.fn()}
      onOpenSheet={vi.fn()}
      onSave={onSave}
    />
  );

  expect(screen.getByText("PX gastada").closest("article")).toHaveTextContent("101");
  expect(screen.getByText(/Origen del PX gastado:/).closest("p")).toHaveTextContent("1 en vínculos de artefactos");
  expect(screen.getByText(/Origen del PX gastado:/).closest("p")).toHaveTextContent("90 en repeticiones de dados");
  expect(screen.getByText(/Origen del PX gastado:/).closest("p")).not.toHaveTextContent("ajuste manual");

  fireEvent.click(screen.getByRole("button", { name: "Guardar constructor" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].progreso.experienciaGastada).toBe(101);
  expect(onSave.mock.calls[0][0].progreso.gastosExperiencia).toEqual([
    expect.objectContaining({ tipo: "repeticion_tirada", cantidad: 90 })
  ]);
});

it("reconstructs Urmak's 101 spent XP from the full sheet and the artifact ledger", () => {
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
  const character: Character = {
    id: "character-urmak", name: "Urmak", archetype: "Místico", race: "Humano", culture: "Ambriano", profession: "",
    level: 1, sheet, artifactBindingXpSpent: 1,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);

  expect(screen.getByText("PX gastada").closest("article")).toHaveTextContent("101");
  expect(screen.getByText("PX disponible").closest("article")).toHaveTextContent("1");
  const breakdown = screen.getByText(/Origen del PX gastado:/).closest("p");
  expect(breakdown).toHaveTextContent("90 en capacidades y poderes");
  expect(breakdown).toHaveTextContent("10 en rituales");
  expect(breakdown).toHaveTextContent("1 en vínculos de artefactos");
  expect(breakdown).not.toHaveTextContent("ajuste manual");
});

it("opens an auditable XP expense detail with capabilities, artifacts and dated rerolls", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 30;
  sheet.progreso.experienciaGastada = 12;
  sheet.habilidades = [
    { nombre: "Acrobacia", tipo: "Habilidad", efecto: "", nivel: "principiante", fuente: "Libro Básico", notas: "", acciones: [] }
  ];
  sheet.progreso.gastosExperiencia = [
    { id: "reroll-a", tipo: "repeticion_tirada", cantidad: 1, fecha: "2026-08-14T10:00:00.000Z" }
  ];
  const character: Character = {
    id: "character-xp-details", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, artifactBindingXpSpent: 1,
    artifactBindingXpExpenses: [{
      id: "binding-a", artifactId: "artifact-a", artifactName: "Piedra Solar", amount: 1, boundAt: "2026-08-13T09:00:00.000Z"
    }],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Ver detalle de PX gastada" }));

  const dialog = screen.getByRole("dialog", { name: "Detalle de PX gastada" });
  expect(dialog).toHaveTextContent("Acrobacia");
  expect(dialog).toHaveTextContent("Habilidad · Principiante");
  expect(dialog).toHaveTextContent("Piedra Solar");
  expect(dialog).toHaveTextContent("Repetición de dado");
  expect(dialog).toHaveTextContent("2026");
});

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

it("shows a compact profession list and opens live requirement details on demand", async () => {
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
  const professionButtons = screen.getAllByRole("button", { name: /Ver detalles de/i });
  expect(professionButtons).toHaveLength(17);
  expect(screen.queryByText("Una capacidad requerida en maestro")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Juramentado de hierro" }));
  const dialog = screen.getByRole("dialog", { name: "Juramentado de hierro" });
  expect(dialog).toBeInTheDocument();
  expect(screen.getByText("Una capacidad requerida en maestro")).toBeInTheDocument();
  expect(screen.getAllByText("Armas de asta").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Marcar como objetivo" }));
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
