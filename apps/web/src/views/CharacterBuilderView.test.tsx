import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type Character, type OwnedMysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterBuilderView } from "./CharacterBuilderView";
import { ConfirmationDialogProvider } from "../components/ConfirmationDialogProvider";

const originalMatchMedia = window.matchMedia;

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 900px)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
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

function makeRevealedArtifact(): OwnedMysticArtifact {
  return {
    ...makeArtifact(),
    description: "Una piedra cálida que almacena la luz del amanecer.",
    kind: "weapon",
    sourceTitle: "Artefactos de Davokar",
    sourcePage: 41,
    weapon: {
      attackAttribute: "atento",
      attackFormula: "1D20",
      damageFormula: "1D8",
      tags: ["ranged"],
      qualities: ["Precisa"],
      requiresBinding: true
    },
    abilities: [{
      id: "ability-solar",
      name: "Destello solar",
      description: "Ciega al objetivo durante un turno.",
      activation: "active",
      actionCost: "combat",
      corruptionFormula: "1D4",
      requiresBinding: true,
      perSceneLimit: 1,
      perSceneNote: "Solo una vez por escena.",
      rolls: [{ id: "roll-solar", kind: "attack", label: "Impacto luminoso", formula: "1D20", actorAttribute: "atento", opponentAttribute: "agil" }],
      requirements: [{ id: "requirement-solar", type: "narrative", capabilityName: "", description: "Estar bajo la luz del sol." }],
      resourceCosts: [{ resourceKey: "luz", amount: 1 }],
      locked: false,
      lockReason: ""
    }],
    resources: [{ id: "resource-solar", key: "luz", name: "Cargas de luz", suggestedMaxFormula: "Atento", maximum: 3, current: 2 }],
    isBound: true,
    boundAt: "2026-08-14T12:00:00.000Z",
    bindingPaymentType: "xp",
    bindingPaymentAmount: 1
  };
}

it("hides only the main builder back action on mobile and keeps the two controls aligned", () => {
  installMatchMedia(true);
  const character: Character = {
    id: "character-mobile", name: "Urmak", archetype: "Guerrero", race: "Humano", culture: "Ambriano", profession: "",
    level: 1, sheet: createEmptyCharacterSheet(), createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  const view = render(
    <CharacterBuilderView
      character={character}
      hideBackActionOnMobile
      onBackToCharacters={vi.fn()}
      onOpenSheet={vi.fn()}
      onSave={vi.fn()}
    />
  );

  expect(screen.queryByRole("button", { name: "Volver a personajes" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir hoja" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar constructor" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir hoja" }).closest(".character-builder-toolbar")).toHaveClass("is-mobile-two-actions");
  expect(document.querySelector(".character-builder-tabs")).toBeInTheDocument();

  view.unmount();
  installMatchMedia(false);
  render(
    <CharacterBuilderView
      character={character}
      hideBackActionOnMobile
      onBackToCharacters={vi.fn()}
      onOpenSheet={vi.fn()}
      onSave={vi.fn()}
    />
  );
  expect(screen.getByRole("button", { name: "Volver a personajes" })).toBeInTheDocument();
});

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

it("shows compact PX purchases and manages levels from a persistent detail modal", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 200;
  sheet.habilidades = [
    {
      nombre: "Disciplina de prueba",
      tipo: "Habilidad",
      efecto: "Principiante: Efecto inicial breve. Adepto: Efecto intermedio claro. Maestro: Efecto maestro definitivo.",
      nivel: "principiante",
      fuente: "Manual de pruebas",
      pagina: 42,
      notas: "",
      acciones: []
    },
    { nombre: "Regeneración", tipo: "Rasgo monstruoso", efecto: "Texto extenso del rasgo que no debe aparecer en la fila.", nivel: "maestro", fuente: "Códice de Monstruos", pagina: 10, notas: "", acciones: [] }
  ];
  sheet.poderesMisticos = [
    { nombre: "Poder heredado", tipo: "Poder místico", efecto: "Descripción heredada sin niveles separados.", nivel: "adepto", fuente: "Crónica antigua", pagina: 7, notas: "", acciones: [] }
  ];
  sheet.rituales = [
    { nombre: "Ritual de prueba", tipo: "Ritual", efecto: "Descripción completa del ritual de prueba.", nivel: "principiante", fuente: "Libro ritual", pagina: 9, notas: "", acciones: [] }
  ];
  const character: Character = {
    id: "character-purchases", name: "Alda", archetype: "Mística", race: "Humana", culture: "Ambriana", profession: "",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  render(<ConfirmationDialogProvider><CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} /></ConfirmationDialogProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Compras PX" }));

  const abilityRow = screen.getByRole("button", { name: "Ver detalles de Disciplina de prueba" });
  expect(abilityRow).toHaveTextContent("Nivel Principiante");
  expect(abilityRow).toHaveTextContent("10 PX");
  expect(abilityRow).toHaveTextContent("Adepto · 20 PX");
  expect(screen.getByRole("button", { name: "Ver detalles de Poder heredado" })).toHaveTextContent("Maestro · 30 PX");
  expect(screen.getByRole("button", { name: "Ver detalles de Regeneración" })).toHaveTextContent("Nivel máximo");
  expect(screen.getByRole("button", { name: "Ver detalles de Ritual de prueba" })).toHaveTextContent("Nivel único");
  expect(screen.queryByText("Efecto inicial breve.")).not.toBeInTheDocument();
  expect(screen.queryByText("Texto extenso del rasgo que no debe aparecer en la fila.")).not.toBeInTheDocument();

  fireEvent.click(abilityRow);
  let dialog = screen.getByRole("dialog", { name: "Disciplina de prueba" });
  expect(dialog).toHaveTextContent("Manual de pruebas p. 42");
  expect(dialog).toHaveTextContent("Efecto inicial breve.");
  expect(dialog).toHaveTextContent("Efecto intermedio claro.");
  expect(dialog).toHaveTextContent("Efecto maestro definitivo.");
  expect(dialog.querySelector(".character-builder-capability-tier.is-current")).toHaveTextContent("Principiante");

  fireEvent.click(within(dialog).getByRole("button", { name: "Subir a Adepto · 20 PX" }));
  const upgradeConfirmation = screen.getByRole("heading", { name: "Confirmar mejora" }).closest(".modal-panel") as HTMLElement;
  fireEvent.click(within(upgradeConfirmation).getByRole("button", { name: "Gastar 20 PX" }));
  dialog = screen.getByRole("dialog", { name: "Disciplina de prueba" });
  expect(dialog).toHaveTextContent("Nivel actualAdepto");
  expect(dialog).toHaveTextContent("PX invertidos30 PX");

  fireEvent.click(within(dialog).getByRole("button", { name: "Bajar a Principiante · liberar 20 PX" }));
  const downgradeConfirmation = screen.getByRole("heading", { name: "Confirmar bajada" }).closest(".modal-panel") as HTMLElement;
  expect(downgradeConfirmation).toHaveTextContent("Liberar 20 PX");
  fireEvent.click(within(downgradeConfirmation).getByRole("button", { name: "Confirmar bajada a Principiante" }));
  expect(screen.getByRole("dialog", { name: "Disciplina de prueba" })).toHaveTextContent("Nivel actualPrincipiante");

  fireEvent.click(within(screen.getByRole("dialog", { name: "Disciplina de prueba" })).getByRole("button", { name: "Quitar · liberar 10 PX" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("dialog", { name: "Disciplina de prueba" })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Disciplina de prueba" })).getByRole("button", { name: "Quitar · liberar 10 PX" }));
  fireEvent.click(screen.getByRole("button", { name: "Quitar y liberar 10 PX" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Disciplina de prueba" })).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Ver detalles de Disciplina de prueba" })).not.toBeInTheDocument();
});

it("uses full-description fallback, disables unaffordable upgrades and keeps rituals level-less", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 50;
  sheet.habilidades = [
    { nombre: "Capacidad sin grados", tipo: "Habilidad", efecto: "Descripción antigua sin estructura por niveles.", nivel: "adepto", fuente: "Legado", notas: "", acciones: [] }
  ];
  sheet.rituales = [
    { nombre: "Ritual sin grados", tipo: "Ritual", efecto: "Un ritual conserva una única descripción.", nivel: "principiante", fuente: "Legado", notas: "", acciones: [] }
  ];
  const character: Character = {
    id: "character-purchase-fallback", name: "Alda", archetype: "Mística", race: "Humana", culture: "Ambriana", profession: "",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };

  render(<ConfirmationDialogProvider><CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} /></ConfirmationDialogProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Compras PX" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Capacidad sin grados" }));
  const abilityDialog = screen.getByRole("dialog", { name: "Capacidad sin grados" });
  expect(abilityDialog).toHaveTextContent("Descripción antigua sin estructura por niveles.");
  expect(within(abilityDialog).getByRole("button", { name: "Subir a Maestro · 30 PX" })).toBeDisabled();
  fireEvent.click(within(abilityDialog).getAllByRole("button", { name: "Cerrar" })[0]);

  fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Ritual sin grados" }));
  const ritualDialog = screen.getByRole("dialog", { name: "Ritual sin grados" });
  expect(ritualDialog).toHaveTextContent("Nivel único");
  expect(ritualDialog).toHaveTextContent("Un ritual conserva una única descripción.");
  expect(within(ritualDialog).queryByRole("button", { name: /Subir|Bajar/ })).not.toBeInTheDocument();
  expect(within(ritualDialog).getByRole("button", { name: "Quitar · liberar 10 PX" })).toBeInTheDocument();
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
    { id: "reroll-a", tipo: "repeticion_tirada", cantidad: 1, fecha: "2026-08-14T10:00:00.000Z" },
    { id: "feat-a", tipo: "hazana", cantidad: 1, fecha: "2026-08-14T11:00:00.000Z", motivo: "Golpe limpio" }
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
  expect(dialog).toHaveTextContent("Hazañas");
  expect(dialog).toHaveTextContent("Golpe limpio");
  expect(dialog).toHaveTextContent("Hazaña ·");
  expect(dialog).toHaveTextContent("2026");
});

it("organizes identity and preserves the creation-only familiar marker when saving", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.identidad.esFamiliar = true;
  sheet.identidad.nombrePersonaje = "Urmak";
  sheet.identidad.nombreJugador = "Carlos";
  sheet.identidad.edad = "18";
  sheet.identidad.profesion = "Cazatesoros";
  sheet.identidad.raza = "Humano";
  sheet.identidad.cultura = "Ambriano";
  sheet.identidad.arquetipo = "Místico";
  const character: Character = {
    id: "character-identity", name: "Urmak", archetype: "Místico", race: "Humano", culture: "Ambriano", profession: "Cazatesoros",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onSave = vi.fn().mockResolvedValue(undefined);

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: "Identidad" }));

  const personal = screen.getByRole("region", { name: "Datos personales" });
  const origin = screen.getByRole("region", { name: "Origen" });
  const description = screen.getByRole("region", { name: "Descripción" });
  expect(within(personal).getByLabelText("Nombre del personaje")).toHaveValue("Urmak");
  expect(within(personal).getByLabelText("Nombre del jugador")).toHaveValue("Carlos");
  expect(within(personal).getByLabelText("Edad")).toHaveValue("18");
  expect(within(personal).getByLabelText("Ocupación descriptiva")).toHaveValue("Cazatesoros");
  expect(within(origin).getByLabelText("Raza")).toHaveValue("Humano");
  expect(within(origin).getByLabelText("Cultura")).toHaveValue("Ambriano");
  expect(within(origin).getByLabelText("Arquetipo")).toHaveValue("Místico");
  expect(within(description).getByLabelText("Apariencia")).toBeInTheDocument();
  expect(within(description).getByLabelText("Objetivo personal")).toBeInTheDocument();
  expect(within(description).getByLabelText("Trasfondo")).toBeInTheDocument();
  expect(screen.queryByText(/Es familiar/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Objetivos profesionales")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Nueva aspiración")).not.toBeInTheDocument();

  fireEvent.change(within(personal).getByLabelText("Edad"), { target: { value: "19" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar constructor" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].identidad.edad).toBe("19");
  expect(onSave.mock.calls[0][0].identidad.esFamiliar).toBe(true);
});

it("manages blessings, burdens and character traits only through official catalog modals", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 20;
  sheet.bendiciones = ["Contactos", "Bendición histórica"];
  sheet.cargas = ["Paria", "Carga histórica"];
  sheet.rasgos = ["Longevo", "Rasgo histórico"];
  const character: Character = {
    id: "character-simple-catalogs", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <ConfirmationDialogProvider>
      <CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={onSave} />
    </ConfirmationDialogProvider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Rasgos y cargas" }));

  const blessings = screen.getByRole("heading", { name: "Bendiciones" }).closest("article") as HTMLElement;
  const burdens = screen.getByRole("heading", { name: "Cargas" }).closest("article") as HTMLElement;
  const traits = screen.getByRole("heading", { name: "Rasgos" }).closest("article") as HTMLElement;
  expect(blessings).toHaveTextContent("Contactos");
  expect(blessings).toHaveTextContent("Bendición histórica");
  expect(blessings).toHaveTextContent("Entrada histórica fuera del catálogo actual");
  expect(burdens).toHaveTextContent("Paria");
  expect(traits).toHaveTextContent("Longevo");
  expect(screen.queryByText("Personalizada")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: "Añadir" })).not.toBeInTheDocument();

  fireEvent.click(within(blessings).getByRole("button", { name: "Añadir bendición" }));
  let dialog = screen.getByRole("dialog", { name: "Añadir bendición" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Buscar en el catálogo" }), { target: { value: "Montés" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Montés/ }));
  expect(dialog).toHaveTextContent("Libro Básico · p. 108");
  expect(dialog).toHaveTextContent("5 PX");
  fireEvent.click(within(dialog).getByRole("button", { name: "Comprar por 5 PX" }));
  const purchaseConfirmation = screen.getByRole("heading", { name: "Comprar Montés" }).closest(".modal-panel") as HTMLElement;
  fireEvent.click(within(purchaseConfirmation).getByRole("button", { name: "Gastar 5 PX" }));
  await waitFor(() => expect(within(blessings).getByText("Montés")).toBeInTheDocument());

  fireEvent.click(within(burdens).getByRole("button", { name: "Añadir carga" }));
  dialog = screen.getByRole("dialog", { name: "Añadir carga" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Buscar en el catálogo" }), { target: { value: "Secreto oscuro" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Secreto oscuro/ }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Añadir carga" }));
  expect(within(burdens).getByText("Secreto oscuro")).toBeInTheDocument();

  fireEvent.click(within(traits).getByRole("button", { name: "Añadir rasgo" }));
  dialog = screen.getByRole("dialog", { name: "Añadir rasgo" });
  expect(within(dialog).queryByRole("button", { name: /LongevoLibro/ })).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Buscar en el catálogo" }), { target: { value: "Poco longevo" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Poco longevo/ }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Añadir rasgo" }));
  expect(within(traits).getByText("Poco longevo")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Guardar constructor" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].bendiciones).toEqual(["Contactos", "Bendición histórica", "Montés"]);
  expect(onSave.mock.calls[0][0].cargas).toEqual(["Paria", "Carga histórica", "Secreto oscuro"]);
  expect(onSave.mock.calls[0][0].rasgos).toEqual(["Longevo", "Rasgo histórico", "Poco longevo"]);
  expect(onSave.mock.calls[0][0].capabilitySelections).toEqual(expect.arrayContaining([
    expect.objectContaining({ catalogId: "bendicion-montes", name: "Montés", kind: "bendicion", origin: "comprada" }),
    expect.objectContaining({ catalogId: "carga-secreto-oscuro", name: "Secreto oscuro", kind: "carga", origin: "comprada" }),
    expect.objectContaining({ catalogId: "rasgo-personaje-poco-longevo", name: "Poco longevo", kind: "rasgo_personaje", origin: "comprada" })
  ]));
});

it("disables catalog blessing purchases when the character lacks XP", () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 0;
  const character: Character = {
    id: "character-no-blessing-xp", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rasgos y cargas" }));
  fireEvent.click(screen.getByRole("button", { name: "Añadir bendición" }));
  const dialog = screen.getByRole("dialog", { name: "Añadir bendición" });
  expect(within(dialog).getByRole("button", { name: "Comprar por 5 PX" })).toBeDisabled();
  expect(within(dialog).queryByText("Personalizada")).not.toBeInTheDocument();
});

it("keeps artifacts compact and updates the open detail after binding", async () => {
  const sheet = createEmptyCharacterSheet();
  sheet.progreso.experienciaTotal = 5;
  const character: Character = {
    id: "character-a", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, mysticArtifacts: [makeArtifact()], artifactBindingXpSpent: 0,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onBind = vi.fn().mockResolvedValue(undefined);

  const renderBuilder = (currentCharacter: Character) => (
    <ConfirmationDialogProvider>
      <CharacterBuilderView
        character={currentCharacter}
        onBackToCharacters={vi.fn()}
        onOpenSheet={vi.fn()}
        onSave={vi.fn()}
        onBindMysticArtifact={onBind}
      />
    </ConfirmationDialogProvider>
  );
  const view = render(renderBuilder(character));
  fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));

  const artifactRow = screen.getByRole("button", { name: "Ver detalles de Piedra Solar" });
  expect(artifactRow).toHaveTextContent("Piedra Solar");
  expect(artifactRow).toHaveTextContent("Objeto · Davokar");
  expect(artifactRow).toHaveTextContent("Sin vincular");
  expect(artifactRow).toHaveTextContent("1 PX o 1 Corrupción permanente");
  expect(screen.queryByText(/capacidades protegidas se revelarán/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Vincular por 1 PX" })).not.toBeInTheDocument();

  artifactRow.focus();
  fireEvent.keyDown(artifactRow, { key: "Enter" });
  fireEvent.click(artifactRow);
  let dialog = screen.getByRole("dialog", { name: "Piedra Solar" });
  expect(dialog).toHaveTextContent(/detalles protegidos.*revelarán/i);

  fireEvent.click(within(dialog).getByRole("button", { name: "Vincular por 1 PX" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onBind).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Piedra Solar" })).toBeInTheDocument();

  fireEvent.click(within(screen.getByRole("dialog", { name: "Piedra Solar" })).getByRole("button", { name: "Vincular por 1 PX" }));
  fireEvent.click(screen.getByRole("button", { name: "Vincular artefacto" }));
  await waitFor(() => expect(onBind).toHaveBeenCalledWith("artifact-a", "xp"));

  view.rerender(renderBuilder({ ...character, mysticArtifacts: [makeRevealedArtifact()], artifactBindingXpSpent: 1 }));
  dialog = screen.getByRole("dialog", { name: "Piedra Solar" });
  expect(dialog).toHaveTextContent("Vinculado");
  expect(dialog).toHaveTextContent("Una piedra cálida que almacena la luz del amanecer.");
  expect(dialog).toHaveTextContent("Destello solar");
  expect(dialog).toHaveTextContent("Cargas de luz");
  expect(dialog).toHaveTextContent("1D20 con Atento");
  expect(within(dialog).queryByRole("button", { name: /Vincular por/ })).not.toBeInTheDocument();
});

it("keeps descriptions, resources, abilities and binding controls out of artifact rows", () => {
  const sheet = createEmptyCharacterSheet();
  const character: Character = {
    id: "character-artifact-list", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, mysticArtifacts: [makeRevealedArtifact()],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));

  const artifactRow = screen.getByRole("button", { name: "Ver detalles de Piedra Solar" });
  expect(artifactRow.tagName).toBe("BUTTON");
  expect(artifactRow).toHaveTextContent("Arma · Davokar");
  expect(artifactRow).toHaveTextContent("Vinculado");
  expect(screen.queryByText("Una piedra cálida que almacena la luz del amanecer.")).not.toBeInTheDocument();
  expect(screen.queryByText("Destello solar")).not.toBeInTheDocument();
  expect(screen.queryByText("Cargas de luz")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Vincular por/ })).not.toBeInTheDocument();

  artifactRow.focus();
  expect(artifactRow).toHaveFocus();
  fireEvent.click(artifactRow);
  const dialog = screen.getByRole("dialog", { name: "Piedra Solar" });
  expect(dialog).toHaveTextContent("Una piedra cálida que almacena la luz del amanecer.");
  expect(dialog).toHaveTextContent("Destello solar");
  expect(dialog).toHaveTextContent("Cargas de luz");
});

it("removes the artifact detail if its assignment disappears", () => {
  const sheet = createEmptyCharacterSheet();
  const character: Character = {
    id: "character-artifact-removal", name: "Alda", archetype: "Guerrera", race: "Humana", culture: "Ambria", profession: "",
    level: 1, sheet, mysticArtifacts: [makeRevealedArtifact()],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const props = { onBackToCharacters: vi.fn(), onOpenSheet: vi.fn(), onSave: vi.fn() };
  const view = render(<CharacterBuilderView character={character} {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Piedra Solar" }));
  expect(screen.getByRole("dialog", { name: "Piedra Solar" })).toBeInTheDocument();

  view.rerender(<CharacterBuilderView character={{ ...character, mysticArtifacts: [] }} {...props} />);
  expect(screen.queryByRole("dialog", { name: "Piedra Solar" })).not.toBeInTheDocument();

  view.rerender(<CharacterBuilderView character={character} {...props} />);
  expect(screen.queryByRole("dialog", { name: "Piedra Solar" })).not.toBeInTheDocument();
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
  expect(screen.getByText(/Abre una profesión para consultar sus requisitos/i)).toBeInTheDocument();
  expect(screen.queryByLabelText("Nueva aspiración")).not.toBeInTheDocument();
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

it("removes an aspiration from the profession detail instead of a duplicate identity selector", async () => {
  const sheet = createEmptyCharacterSheet();
  const character: Character = {
    id: "character-prof-remove", name: "Alda", archetype: "Cazador", race: "Humano", culture: "Ambriano", profession: "", level: 1, sheet,
    professionMemberships: [{
      id: "membership-a",
      characterId: "character-prof-remove",
      professionId: "juramentado-de-hierro",
      professionName: "Juramentado de hierro",
      state: "aspiration",
      effectiveState: "aspiration"
    } as never],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString()
  };
  const onRemove = vi.fn().mockResolvedValue(undefined);

  render(<CharacterBuilderView character={character} onBackToCharacters={vi.fn()} onOpenSheet={vi.fn()} onSave={vi.fn()} onRemoveProfessionAspiration={onRemove} />);
  fireEvent.click(screen.getByRole("button", { name: "Profesiones" }));
  expect(screen.queryByLabelText("Nueva aspiración")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Juramentado de hierro" }));
  fireEvent.click(screen.getByRole("button", { name: "Retirar objetivo" }));

  await waitFor(() => expect(onRemove).toHaveBeenCalledWith("juramentado-de-hierro"));
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
