import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCharacterSheet, type CampaignItemTemplate } from "@umbra/shared";
import { UnifiedCharacterSheet } from "./UnifiedCharacterSheet";

describe("UnifiedCharacterSheet mobile navigation", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(cleanup);

  it("migrates the persisted legacy Actions filter to Acciones de combate", () => {
    window.localStorage.setItem("umbra:character-sheet-tabs:arold", JSON.stringify({
      activeTab: "actions",
      activeMechanicalTab: "actions",
      activeActionTab: "actions"
    }));

    render(<UnifiedCharacterSheet title="Arold" sheet={createEmptyCharacterSheet()} editable={false} />);

    expect(screen.getByRole("button", { name: "Acciones de combate" })).toHaveClass("is-active");
  });

  it("starts on Atributos and switches to the action list with visible roll formulas", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.nombrePersonaje = "Arold";
    sheet.atributos.diestro = 13;
    sheet.combate.armaPrincipal = "Espada";
    sheet.combate.armaPrincipalAtributo = "diestro";
    sheet.combate.danioPrincipal = "1d8+1";

    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    const root = container.querySelector(".unified-sheet");
    expect(root).toHaveClass("is-mobile-tab-attributes");
    expect(screen.getByRole("button", { name: "Atributos" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "Atributos" })).toHaveAttribute("aria-current", "page");

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    expect(mobileTabs.parentElement).toBe(root);
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Acciones" }));

    expect(root).toHaveClass("is-mobile-tab-actions");
    expect(within(mobileTabs).getByRole("button", { name: "Acciones" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("1d20 ≤ Diestro 13").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1d8+1").length).toBeGreaterThan(0);
  });

  it("usa valores fijos informativos en fichas del DJ sin lanzar dados", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.resolutionMode = "fixed_average";
    sheet.identidad.nombrePersonaje = "Guardia";
    sheet.combate.defensaBase = "12";

    render(
      <UnifiedCharacterSheet title="Guardia" subtitle="PNJ" sheet={sheet} editable={false} />
    );

    fireEvent.click(within(screen.getByRole("navigation", { name: "Secciones de la ficha" })).getByRole("button", { name: "Acciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Daño 1d4" }));

    expect(screen.getByText(/Valor fijo oficial: 2/)).toBeInTheDocument();
  });

  it("renders the sheet modules and two coordinated readers", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.nombrePersonaje = "Arold";

    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    expect(container.querySelectorAll(".unified-sheet-module")).toHaveLength(8);
    expect(container.querySelectorAll(".unified-sheet-reader")).toHaveLength(2);
    expect(container.querySelectorAll(".unified-sheet > .unified-sheet-panel")).toHaveLength(0);
    expect(screen.getByRole("region", { name: "Identidad del personaje" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Experiencia" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recursos" })).toBeInTheDocument();
    const topGrid = container.querySelector(".unified-sheet-top-grid") as HTMLElement;
    const statusGrid = container.querySelector(".unified-sheet-status-grid") as HTMLElement;
    expect(within(topGrid).getByRole("region", { name: "Recursos" })).toBeInTheDocument();
    expect(within(statusGrid).queryByRole("region", { name: "Recursos" })).not.toBeInTheDocument();
    const combat = within(statusGrid).getByRole("region", { name: "Combate" });
    const conditions = within(statusGrid).getByRole("region", { name: "Condiciones" });
    expect(combat).toBeInTheDocument();
    expect(conditions).toBeInTheDocument();
    expect(within(combat).queryByRole("heading", { name: "Valores derivados" })).not.toBeInTheDocument();
    const combatText = combat.textContent ?? "";
    expect(combatText.indexOf("Iniciativa")).toBeLessThan(combatText.indexOf("Defensa"));
    expect(combatText.indexOf("Defensa")).toBeLessThan(combatText.indexOf("Armadura"));
    expect(combatText.indexOf("Armadura")).toBeLessThan(combatText.indexOf("Umbral de dolor"));
    expect(combatText.indexOf("Umbral de dolor")).toBeLessThan(combatText.indexOf("Umbral de corrupcion"));
    const defenseCard = within(combat).getByRole("heading", { name: "Defensa" }).closest(".unified-sheet-quick-card") as HTMLElement;
    const armorCard = within(combat).getByRole("heading", { name: "Armadura" }).closest(".unified-sheet-quick-card") as HTMLElement;
    expect(defenseCard.querySelector(":scope > .unified-sheet-combat-value")).toHaveTextContent("10");
    expect(armorCard.querySelector(":scope > .unified-sheet-combat-value")).toHaveTextContent("-");
    expect(defenseCard.querySelector(":scope > .row-actions")).not.toBeInTheDocument();
    expect(armorCard.querySelector(":scope > .row-actions")).not.toBeInTheDocument();
    expect(container.querySelector(".unified-sheet-summary-column")).not.toBeInTheDocument();
  });

  it("keeps identity compact after moving background controls to personalization", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.nombrePersonaje = "Arold";

    render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable
        backgroundPreferenceScope="user-a"
        onOpenBuilder={() => undefined}
      />
    );

    const identity = screen.getByRole("region", { name: "Identidad del personaje" });
    const experience = screen.getByRole("region", { name: "Experiencia" });
    const builder = within(experience).getByRole("button", { name: "Constructor" });

    expect(within(identity).queryByRole("button", { name: "Fondo" })).not.toBeInTheDocument();
    expect(builder).toHaveClass("unified-sheet-builder-icon");
    expect(builder).toHaveAttribute("title", "Abrir constructor");
    expect(screen.queryByRole("region", { name: "Controles de ficha" })).not.toBeInTheDocument();
  });

  it("shows every manual condition in grey and toggles each one independently", () => {
    const sheet = createEmptyCharacterSheet();
    render(<UnifiedCharacterSheet title="Arold" subtitle="Guerrero" sheet={sheet} editable />);

    const conditions = screen.getByRole("region", { name: "Condiciones" });
    for (const name of ["Ardiendo", "Aturdido", "Cegado", "Derribado", "Envenenado", "Inmovilizado", "Paralizado", "Sangrando"]) {
      expect(within(conditions).getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(within(conditions).queryByText("Moribundo")).not.toBeInTheDocument();
    expect(within(conditions).queryByText("Corrupción")).not.toBeInTheDocument();

    const poisoned = within(conditions).getByRole("button", { name: "Envenenado" });
    const stunned = within(conditions).getByRole("button", { name: "Aturdido" });
    fireEvent.click(poisoned);
    expect(poisoned).toHaveAttribute("aria-pressed", "true");
    expect(poisoned).toHaveClass("is-active", "is-tone-poison");
    expect(stunned).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(stunned);
    expect(poisoned).toHaveAttribute("aria-pressed", "true");
    expect(stunned).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(poisoned);
    expect(poisoned).toHaveAttribute("aria-pressed", "false");
    expect(stunned).toHaveAttribute("aria-pressed", "true");
  });

  it("only shows automatic conditions while they apply and never renders them as toggles", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.corrupcion.temporal = 1;
    sheet.combate.robustezActual = 0;

    render(<UnifiedCharacterSheet title="Arold" subtitle="Guerrero" sheet={sheet} editable />);

    const conditions = screen.getByRole("region", { name: "Condiciones" });
    const corruption = within(conditions).getByText("Corrupción");
    const dying = within(conditions).getByText("Moribundo");

    expect(corruption).toHaveClass("unified-sheet-condition-badge", "is-active", "is-tone-corruption");
    expect(dying).toHaveClass("unified-sheet-condition-badge", "is-active", "is-tone-critical");
    expect(within(conditions).queryByRole("button", { name: "Corrupción" })).not.toBeInTheDocument();
    expect(within(conditions).queryByRole("button", { name: "Moribundo" })).not.toBeInTheDocument();
  });

  it("splits narrative and mechanical desktop sections into left and right readers", () => {
    const sheet = createEmptyCharacterSheet();
    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    const workspace = container.querySelector(".unified-sheet-workspace") as HTMLElement;
    const narrativeReader = workspace.querySelector(".unified-sheet-reader-narrative") as HTMLElement;
    const mechanicalReader = workspace.querySelector(".unified-sheet-reader-mechanical") as HTMLElement;
    const narrativeNavigation = within(narrativeReader).getByRole("navigation", { name: "Trasfondo y notas" });
    const mechanicalNavigation = within(mechanicalReader).getByRole("navigation", { name: "Acciones, inventario y capacidades" });
    const narrativeContent = within(narrativeReader).getByRole("region", { name: "Trasfondo y notas: contenido" });
    const mechanicalContent = within(mechanicalReader).getByRole("region", { name: "Acciones, inventario y capacidades: contenido" });

    expect(workspace.children[0]).toBe(narrativeReader);
    expect(workspace.children[1]).toBe(mechanicalReader);
    expect(narrativeContent).toHaveAttribute("tabindex", "0");
    expect(mechanicalContent).toHaveAttribute("tabindex", "0");
    expect(within(narrativeReader).getByRole("heading", { name: "Trasfondo" })).toBeInTheDocument();
    expect(within(mechanicalReader).getByRole("heading", { name: "Acciones disponibles" })).toBeInTheDocument();
    const actionSubNavigation = within(mechanicalReader).getByRole("navigation", { name: "Filtros de acciones" });
    expect(mechanicalNavigation.nextElementSibling).toBe(actionSubNavigation);
    expect(within(mechanicalReader).queryByRole("navigation", { name: "Secciones del inventario" })).not.toBeInTheDocument();

    fireEvent.click(within(mechanicalNavigation).getByRole("button", { name: "Inventario" }));
    expect(within(mechanicalReader).getByRole("heading", { name: "Inventario y equipo" })).toBeInTheDocument();
    expect(within(narrativeReader).getByRole("heading", { name: "Trasfondo" })).toBeInTheDocument();
    const inventorySubNavigation = within(mechanicalReader).getByRole("navigation", { name: "Secciones del inventario" });
    expect(mechanicalNavigation.nextElementSibling).toBe(inventorySubNavigation);
    expect(within(mechanicalReader).queryByRole("navigation", { name: "Filtros de acciones" })).not.toBeInTheDocument();

    fireEvent.click(within(mechanicalNavigation).getByRole("button", { name: "Capacidades" }));
    const capabilitySubNavigation = within(mechanicalReader).getByRole("navigation", { name: "Tipos de capacidades" });
    expect(mechanicalNavigation.nextElementSibling).toBe(capabilitySubNavigation);
    expect(within(mechanicalReader).queryByRole("navigation", { name: "Secciones del inventario" })).not.toBeInTheDocument();

    fireEvent.click(within(narrativeNavigation).getByRole("button", { name: "Notas" }));
    expect(within(narrativeReader).getByRole("heading", { name: "Notas personales" })).toBeInTheDocument();
    expect(within(mechanicalReader).getByRole("navigation", { name: "Tipos de capacidades" })).toBeInTheDocument();
  });

  it("shows the complete Lanzar a Parcabrasa action name", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems = [{
      id: "managed-artifact:parcabrasa",
      name: "Parcabrasa",
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "Hacha arrojadiza habitada por espíritus de fuego.",
      weight: "",
      value: "",
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1D6+1D4",
      protectionFormula: "",
      qualities: "Arrojadiza, Regreso, Místico",
      notes: "",
      managedArtifactId: "parcabrasa",
      artifactBound: true,
      artifactBindingCostLabel: "1 PX",
      artifactResources: [],
      grantedActions: [],
      modifiers: []
    }];

    render(<UnifiedCharacterSheet title="Parcabrasa" sheet={sheet} editable />);

    expect(screen.getByRole("button", { name: "Lanzar a Parcabrasa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "a Parcabrasa" })).not.toBeInTheDocument();
  });

  it("filters actions by multiple categories and exposes movement actions", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.inventoryItems = [{
      id: "weapon-bow",
      name: "Arco",
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: true,
      slot: "ranged",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "A distancia",
      notes: "",
      grantedActions: [],
      modifiers: []
    }, {
      id: "weapon-crossbow",
      name: "Ballesta",
      category: "weapon",
      quantity: 1,
      stackable: false,
      isCustom: false,
      description: "",
      weight: "",
      value: "",
      equipped: false,
      slot: "none",
      attackAttribute: "diestro",
      damageFormula: "1d10",
      protectionFormula: "",
      qualities: "A distancia, Recarga",
      notes: "",
      grantedActions: [],
      modifiers: []
    }];

    render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable />);
    const filters = screen.getByRole("navigation", { name: "Filtros de acciones" });

    expect(within(filters).getByRole("button", { name: "Acciones de combate" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Acciones de movimiento" })).toBeInTheDocument();
    expect(within(filters).queryByRole("button", { name: "Acciones" })).not.toBeInTheDocument();

    within(filters).getByRole("button", { name: "Todas" }).focus();
    fireEvent.keyDown(filters, { key: "ArrowRight" });
    expect(within(filters).getByRole("button", { name: "Favoritas" })).toHaveFocus();
    fireEvent.keyDown(filters, { key: "End" });
    expect(within(filters).getByRole("button", { name: "Otras" })).toHaveFocus();

    fireEvent.click(within(filters).getByRole("button", { name: "Ataques" }));
    expect(screen.getAllByRole("button", { name: "Atacar con Arco" })).toHaveLength(1);

    fireEvent.click(within(filters).getByRole("button", { name: "Acciones de combate" }));
    expect(screen.getAllByRole("button", { name: "Atacar con Arco" })).toHaveLength(1);
    ["Atacar", "Usar una habilidad activa", "Primeros auxilios", "Acción de movimiento adicional", "Usar/aplicar un elixir"]
      .forEach((label) => expect(screen.getAllByRole("button", { name: label })).toHaveLength(1));

    fireEvent.click(within(filters).getByRole("button", { name: "Acciones de movimiento" }));
    expect(screen.getByRole("button", { name: "Recargar Ballesta" })).toBeInTheDocument();
    [
      "Trabarse en cuerpo a cuerpo",
      "Flanquear",
      "Moverse alrededor de un enemigo",
      "Destrabarse del combate",
      "Línea de visión",
      "Desenvainar un arma",
      "Cambiar de arma",
      "Levantarse",
      "Usar/aplicar un elixir"
    ].forEach((label) => expect(screen.getAllByRole("button", { name: label })).toHaveLength(1));
  });

  it("shows complete informational action families without roll controls and allows favorites", () => {
    const sheet = createEmptyCharacterSheet();
    const { container } = render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable />);
    const filters = screen.getByRole("navigation", { name: "Filtros de acciones" });

    fireEvent.click(within(filters).getByRole("button", { name: "Hazañas" }));
    expect(container.querySelectorAll(".campaign-action-button--row.is-informational")).toHaveLength(8);
    const cleanStrike = screen.getByRole("button", { name: "Golpe limpio" });
    const cleanStrikeRow = cleanStrike.closest(".campaign-action-button--row") as HTMLElement;
    expect(cleanStrikeRow.querySelector(".campaign-action-rolls")).not.toBeInTheDocument();
    fireEvent.click(cleanStrike);
    const featModal = screen.getByRole("heading", { name: "Golpe limpio" }).closest(".modal-panel") as HTMLElement;
    expect(within(featModal).getByText(/Regla opcional/)).toBeInTheDocument();
    expect(featModal).toHaveTextContent("cualquier golpe o golpes con éxito causan el máximo daño");
    expect(featModal).not.toHaveTextContent("Activar una hazaña cuesta");
    expect(featModal).not.toHaveTextContent("personajes se parezcan más a los héroes tradicionales");
    fireEvent.click(within(featModal).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(within(cleanStrikeRow).getByRole("button", { name: "Guardar en favoritas" }));
    fireEvent.click(within(filters).getByRole("button", { name: "Favoritas" }));
    expect(screen.getByRole("button", { name: "Golpe limpio" })).toBeInTheDocument();

    fireEvent.click(within(filters).getByRole("button", { name: "Maniobras de combate" }));
    expect(container.querySelectorAll(".campaign-action-button--row.is-informational")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Apuntar con cuidado" }));
    const maneuverModal = screen.getByRole("heading", { name: "Apuntar con cuidado" }).closest(".modal-panel") as HTMLElement;
    expect(maneuverModal).toHaveTextContent("Apuntar consume una acción de movimiento");
    expect(maneuverModal).not.toHaveTextContent("mucho más complicadas las escenas de combate");
    expect(maneuverModal).not.toHaveTextContent("A continuación hay una lista de maniobras");
    fireEvent.click(within(maneuverModal).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(within(filters).getByRole("button", { name: "Acciones especiales" }));
    expect(container.querySelectorAll(".campaign-action-button--row.is-informational")).toHaveLength(5);
  });

  it("confirms and records a dated XP expense with the feat as its reason", async () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 3;
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <UnifiedCharacterSheet title="Arold" sheet={sheet} editable onSave={onSave} />
    );
    const filters = screen.getByRole("navigation", { name: "Filtros de acciones" });

    fireEvent.click(within(filters).getByRole("button", { name: "Hazañas" }));
    const cleanStrikeRow = screen.getByRole("button", { name: "Golpe limpio" }).closest(".campaign-action-button--row") as HTMLElement;
    const spendButton = within(cleanStrikeRow).getByRole("button", { name: "Gastar 1 PX en Golpe limpio" });
    fireEvent.click(spendButton);

    let confirmation = screen.getByRole("dialog", { name: "Gastar PX en una hazaña" });
    expect(confirmation).toHaveTextContent("Golpe limpio");
    expect(confirmation).toHaveTextContent("fecha y motivo");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog", { name: "Gastar PX en una hazaña" })).not.toBeInTheDocument();

    fireEvent.click(spendButton);
    confirmation = screen.getByRole("dialog", { name: "Gastar PX en una hazaña" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Gastar 1 PX" }));

    const xpCard = container.querySelector(".unified-sheet-xp-card") as HTMLElement;
    expect(xpCard).toHaveTextContent("PX disponible2");
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 2500 });
    const savedExpense = onSave.mock.calls.at(-1)?.[0].progreso.gastosExperiencia[0];
    expect(savedExpense).toEqual(expect.objectContaining({
      tipo: "hazana",
      cantidad: 1,
      motivo: "Golpe limpio"
    }));
    expect(Number.isNaN(Date.parse(savedExpense.fecha))).toBe(false);
  });

  it("opens quick combat guide actions as informational details without creating roll controls", () => {
    const sheet = createEmptyCharacterSheet();
    const { container } = render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable />);
    const filters = screen.getByRole("navigation", { name: "Filtros de acciones" });

    fireEvent.click(within(filters).getByRole("button", { name: "Acciones de movimiento" }));
    const drawWeapon = screen.getByRole("button", { name: "Desenvainar un arma" });
    const row = drawWeapon.closest(".campaign-action-button--row") as HTMLElement;
    expect(row).toHaveClass("is-informational");
    expect(row.querySelector(".campaign-action-rolls")).not.toBeInTheDocument();

    fireEvent.click(drawWeapon);
    const modal = screen.getByRole("heading", { name: "Desenvainar un arma" }).closest(".modal-panel") as HTMLElement;
    expect(modal).toHaveTextContent("Acción de movimiento");
    expect(modal).toHaveTextContent("Libro Básico p. 161");
  });

  it("muestra Principiante como nivel inicial de las capacidades", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.habilidades = [{
      nombre: "Robusto",
      tipo: "Habilidad",
      efecto: "",
      nivel: "principiante",
      fuente: "Códice de monstruos",
      pagina: 1,
      notas: "",
      acciones: []
    }];

    render(<UnifiedCharacterSheet title="Arold" subtitle="Guerrero" sheet={sheet} editable={false} />);
    const mechanicalNavigation = screen.getByRole("navigation", { name: "Acciones, inventario y capacidades" });
    fireEvent.click(within(mechanicalNavigation).getByRole("button", { name: "Capacidades" }));
    const capabilityNavigation = screen.getByRole("navigation", { name: "Tipos de capacidades" });
    fireEvent.click(within(capabilityNavigation).getByRole("button", { name: "Habilidades" }));

    const capability = screen.getByText("Robusto").closest("article") as HTMLElement;
    expect(within(capability).getByText("Principiante")).toBeInTheDocument();
    expect(capability).toHaveTextContent("Códice de monstruos p. 1");
    expect(capability).not.toHaveTextContent(/novato/i);
  });

  it("muestra una sola vez la descripcion del arma en el detalle de su ataque", () => {
    const sheet = createEmptyCharacterSheet();
    const description = "Descripcion unica del arma para comprobar el detalle.";
    sheet.inventoryItems = [{
      id: "weapon-test-sword",
      name: "Espada de prueba",
      category: "weapon",
      quantity: 1,
      stackable: false,
      equipped: true,
      slot: "mainHand",
      attackAttribute: "diestro",
      damageFormula: "1d8",
      protectionFormula: "",
      qualities: "Precisa",
      description,
      notes: "Nota propia del arma.",
      weight: "Media",
      value: "5 taleros",
      isCustom: false,
      grantedActions: [],
      modifiers: []
    }];
    sheet.equipmentSlots.mainHand = "weapon-test-sword";

    render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Atacar con Espada de prueba" })[0]);

    const modal = screen.getByRole("heading", { name: "Atacar con Espada de prueba" }).closest(".modal-panel");
    expect(modal).not.toBeNull();
    expect(modal?.textContent?.split(description)).toHaveLength(2);
    expect(modal).toHaveTextContent("Tirada de ataque y, si procede");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: "Cerrar" }));
    expect(document.body.style.overflow).toBe("");
  });

  it("tracks manual rerolls through available XP or permanent corruption", async () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 12;
    sheet.progreso.experienciaGastada = 5;

    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable
        onSave={onSave}
      />
    );

    const xpCard = container.querySelector(".unified-sheet-xp-card");
    expect(xpCard).not.toBeNull();
    expect(xpCard).toHaveTextContent("PX total12");
    expect(xpCard).not.toHaveTextContent("PX gastada");
    expect(xpCard).toHaveTextContent("PX disponible7");
    const xpReroll = within(xpCard as HTMLElement).getByRole("button", { name: "Gastar 1 PX para repetir un dado" });
    const xpControls = xpReroll.closest(".unified-sheet-xp-controls") as HTMLElement;
    expect(xpControls.children[0]).toHaveTextContent("7");
    expect(xpControls.children[1]).toBe(xpReroll);
    fireEvent.click(xpReroll);
    const confirmation = screen.getByRole("heading", { name: "Gastar PX para repetir" }).closest(".modal-panel") as HTMLElement;
    expect(confirmation).toHaveTextContent("no puede recuperarse");
    expect(xpCard).toHaveTextContent("PX disponible7");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Gastar 1 PX" }));
    expect(xpCard).toHaveTextContent("PX total12");
    expect(xpCard).toHaveTextContent("PX disponible6");
    expect(screen.queryByRole("heading", { name: "Gastar PX para repetir" })).not.toBeInTheDocument();
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 2500 });
    const savedSheet = onSave.mock.calls.at(-1)?.[0];
    expect(savedSheet.progreso.gastosExperiencia).toEqual([
      expect.objectContaining({ tipo: "repeticion_tirada", cantidad: 1 })
    ]);

    const permanentCorruptionCard = container.querySelector(".unified-sheet-vital-card.is-corruption-deep") as HTMLElement;
    expect(within(permanentCorruptionCard).queryByText(/Repetir/i)).not.toBeInTheDocument();
    fireEvent.click(within(permanentCorruptionCard).getByRole("button", { name: "Sumar 1 de Corrupcion permanente" }));
    expect(permanentCorruptionCard).toHaveTextContent("Corrupcion permanente1");
  });

  it("disables the XP reroll when no experience is available", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 5;
    sheet.progreso.experienciaGastada = 5;

    render(<UnifiedCharacterSheet title="Arold" subtitle="Guerrero" sheet={sheet} editable />);

    expect(screen.getByRole("button", { name: "Gastar 1 PX para repetir un dado" })).toBeDisabled();
  });

  it("does not add structured burden bonuses twice to persisted available XP", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 102;
    sheet.progreso.experienciaGastada = 90;
    sheet.capabilitySelections = [
      { catalogId: "burden-a", name: "Paria", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" },
      { catalogId: "burden-b", name: "Secreto oscuro", kind: "carga", origin: "comprada", source: "Guía Avanzada del Jugador" }
    ];

    const { container } = render(<UnifiedCharacterSheet title="Urmak" subtitle="Místico" sheet={sheet} editable />);
    const xpCard = container.querySelector(".unified-sheet-xp-card");

    expect(xpCard).toHaveTextContent("PX total102");
    expect(xpCard).toHaveTextContent("PX disponible12");
  });

  it("charges a reroll on top of experience computed from purchased capabilities", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 12;
    sheet.progreso.experienciaGastada = 0;
    sheet.rituales = [{
      nombre: "Adivinacion",
      tipo: "Ritual",
      efecto: "",
      nivel: "principiante",
      fuente: "Manual",
      notas: "",
      acciones: []
    }];

    const { container } = render(<UnifiedCharacterSheet title="Arold" subtitle="Mistico" sheet={sheet} editable />);
    const xpCard = container.querySelector(".unified-sheet-xp-card") as HTMLElement;
    expect(xpCard).toHaveTextContent("PX disponible2");

    fireEvent.click(within(xpCard).getByRole("button", { name: "Gastar 1 PX para repetir un dado" }));
    const confirmation = screen.getByRole("heading", { name: "Gastar PX para repetir" }).closest(".modal-panel") as HTMLElement;
    fireEvent.click(within(confirmation).getByRole("button", { name: "Gastar 1 PX" }));

    expect(xpCard).toHaveTextContent("PX total12");
    expect(xpCard).toHaveTextContent("PX disponible1");
  });

  it("aplica una robustez maxima minima de 10 aunque Fuerte sea 5", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.atributos.fuerte = 5;
    sheet.combate.robustezMax = 5;
    sheet.combate.robustezActual = 5;

    const { container } = render(
      <UnifiedCharacterSheet
        title="Personaje de prueba"
        subtitle="Guerrero"
        sheet={sheet}
        editable={false}
      />
    );

    const toughnessCard = container.querySelector(".unified-sheet-vital-card.is-health");
    expect(toughnessCard).not.toBeNull();
    expect(toughnessCard).toHaveTextContent("10 / 10");
  });

  it("clears all temporary corruption with one action", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.corrupcion.temporal = 4;

    const { container } = render(<UnifiedCharacterSheet title="Arold" subtitle="Mistico" sheet={sheet} editable />);
    const temporaryCorruptionCard = container.querySelector(".unified-sheet-vital-card.is-corruption") as HTMLElement;
    const clearButton = within(temporaryCorruptionCard).getByRole("button", { name: "Limpiar toda la Corrupcion temporal" });
    expect(temporaryCorruptionCard.querySelector(".unified-sheet-vital-header strong")).toHaveTextContent("4");

    fireEvent.click(clearButton);

    expect(temporaryCorruptionCard.querySelector(".unified-sheet-vital-header strong")).toHaveTextContent("0");
    expect(clearButton).toBeDisabled();
  });
});

describe("UnifiedCharacterSheet weapon catalog", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(cleanup);

  it("uses icon filters and a text-searchable weapon selector", () => {
    const sheet = createEmptyCharacterSheet();
    render(<UnifiedCharacterSheet title="Inventario" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Armas" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar arma" }));

    const modal = screen.getByRole("heading", { name: "Agregar arma" }).closest(".modal-panel") as HTMLElement;
    const typePicker = within(modal).getByRole("group", { name: "Tipo de arma" });
    expect(within(typePicker).getAllByRole("button")).toHaveLength(8);
    expect(within(typePicker).getByRole("button", { name: "A distancia" })).toHaveAttribute("aria-pressed", "false");
    expect(within(typePicker).getByRole("button", { name: "Escudos" })).toHaveAttribute("aria-pressed", "false");
    expect(within(modal).queryByLabelText("Tipo")).not.toBeInTheDocument();

    const search = within(modal).getByRole("combobox", { name: "Buscar arma" });
    fireEvent.change(search, { target: { value: "ballesta de mano" } });
    const options = within(modal).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Ballesta de mano");
    fireEvent.click(options[0]);
    expect(within(modal).getAllByText("Ocultable").length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(within(typePicker).getByRole("button", { name: "Escudos" }));
    expect(within(modal).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Escudo1d4",
      "Escudo de acero1d4",
      "Rodela1d4"
    ]);
  });

  it("shows unique campaign pieces as informative and reserves custom editors for the DJ", () => {
    const sheet = createEmptyCharacterSheet();
    const campaignItem: CampaignItemTemplate = {
      id: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      kind: "weapon",
      definition: {
        name: "Espada de la Reina",
        category: "weapon",
        stackable: false,
        description: "Una hoja con nombre propio.",
        weight: "1",
        value: "Incalculable",
        defaultQuantity: 1,
        defaultSlot: "mainHand",
        attackAttribute: "diestro",
        damageFormula: "1d10",
        protectionFormula: "",
        qualities: "Precisa",
        notes: "",
        grantedActions: [],
        modifiers: []
      },
      isUnique: true,
      ownerType: "character",
      ownerId: "33333333-3333-4333-8333-333333333333",
      ownerName: "Arold",
      archivedAt: null,
      createdAt: "2026-08-15T12:00:00.000Z",
      updatedAt: "2026-08-15T12:00:00.000Z"
    };
    const { unmount } = render(
      <UnifiedCharacterSheet title="Inventario" sheet={sheet} editable campaignItems={[campaignItem]} />
    );

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Armas" }));
    expect(screen.queryByRole("button", { name: "Arma personalizada" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar arma" }));
    const modal = screen.getByRole("heading", { name: "Agregar arma" }).closest(".modal-panel") as HTMLElement;
    fireEvent.change(within(modal).getByRole("combobox", { name: "Buscar arma" }), { target: { value: "Espada de la Reina" } });
    fireEvent.click(within(modal).getByRole("option", { name: /Espada de la Reina/ }));
    expect(within(modal).getByText("Pieza única")).toBeInTheDocument();
    expect(within(modal).getByText("Poseedor: Arold")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Solo el DJ puede asignarlo" })).toBeDisabled();

    unmount();
    render(
      <UnifiedCharacterSheet title="Inventario DJ" sheet={sheet} editable campaignItems={[campaignItem]} canManageCampaignItems />
    );
    fireEvent.click(within(screen.getByRole("navigation", { name: "Secciones de la ficha" })).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Armas" }));
    expect(screen.getByRole("button", { name: "Arma personalizada" })).toBeInTheDocument();
  });

  it("uses icon filters and a text-searchable armor selector with the full catalog", () => {
    const sheet = createEmptyCharacterSheet();
    render(<UnifiedCharacterSheet title="Inventario" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Armaduras" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar armadura" }));

    const modal = screen.getByRole("heading", { name: "Agregar armadura" }).closest(".modal-panel") as HTMLElement;
    const typePicker = within(modal).getByRole("group", { name: "Tipo de armadura" });
    expect(within(typePicker).getAllByRole("button")).toHaveLength(4);
    expect(within(modal).queryByLabelText("Tipo")).not.toBeInTheDocument();

    const search = within(modal).getByRole("combobox", { name: "Buscar armadura" });
    expect(within(modal).getAllByRole("option")).toHaveLength(20);
    fireEvent.change(search, { target: { value: "pansar" } });
    const options = within(modal).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Armadura de placas pansar");
    expect(options[0]).toHaveTextContent("1d8+1");
    fireEvent.click(options[0]);
    expect(within(modal).getAllByText("Reforzada").length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "escudo" } });
    expect(within(modal).queryAllByRole("option")).toHaveLength(0);
  });

  it("searches the expanded object catalog and keeps minor artifacts outside the DJ artifact tab", () => {
    const sheet = createEmptyCharacterSheet();
    render(<UnifiedCharacterSheet title="Inventario" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Objetos" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar objeto" }));

    let modal = screen.getByRole("heading", { name: "Agregar objeto" }).closest(".modal-panel") as HTMLElement;
    fireEvent.change(within(modal).getByLabelText("Tipo"), { target: { value: "elixir" } });
    const search = within(modal).getByRole("combobox", { name: "Buscar objeto" });
    fireEvent.change(search, { target: { value: "veneno potente" } });
    const poison = within(modal).getByRole("option", { name: /^Veneno \(potente\)/ });
    expect(poison).toHaveTextContent("Veneno (potente)");
    expect(poison).toHaveTextContent("6 táleros");
    fireEvent.click(poison);
    fireEvent.click(within(modal).getByRole("button", { name: "Agregar" }));
    expect(screen.getByText("Veneno (potente)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agregar objeto" }));
    modal = screen.getByRole("heading", { name: "Agregar objeto" }).closest(".modal-panel") as HTMLElement;
    fireEvent.change(within(modal).getByLabelText("Tipo"), { target: { value: "minor-artifact" } });
    fireEvent.change(within(modal).getByRole("combobox", { name: "Buscar objeto" }), { target: { value: "araña curativa" } });
    fireEvent.click(within(modal).getByRole("option", { name: /Araña curativa/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Agregar" }));
    expect(screen.getByText("Araña curativa")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Artefactos" }));
    expect(screen.getByText("El DJ todavia no ha entregado artefactos a este personaje.")).toBeInTheDocument();
    expect(screen.queryByText("Araña curativa")).not.toBeInTheDocument();
  });

  it("places large money controls on both sides of each coin", () => {
    const sheet = createEmptyCharacterSheet();
    render(<UnifiedCharacterSheet title="Inventario" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Inventario" }));
    fireEvent.click(screen.getByRole("button", { name: "Dinero" }));
    const talerosCard = screen.getByText("Taleros").closest(".unified-sheet-money-card") as HTMLElement;
    const row = talerosCard.querySelector(".unified-sheet-money-control-row") as HTMLElement;
    const controls = within(row).getAllByRole("button");

    expect(controls).toHaveLength(2);
    expect(controls[0]).toHaveAccessibleName("Restar Taleros");
    expect(controls[1]).toHaveAccessibleName("Sumar Taleros");
    expect(row.children[0]).toBe(controls[0]);
    expect(row.children[1]).toHaveClass("unified-sheet-money-coin");
    expect(row.children[2]).toBe(controls[1]);
    expect(controls[0]).toHaveClass("unified-sheet-money-button");

    fireEvent.click(controls[1]);
    expect(talerosCard).toHaveTextContent("x1");
    fireEvent.click(controls[0]);
    expect(talerosCard).toHaveTextContent("x0");
  });
});

describe("UnifiedCharacterSheet background and notes reading views", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(cleanup);

  it("renders background as read-only Markdown until Edit is pressed", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.identidad.sombra = "Verde con motas doradas";
    sheet.identidad.apariencia = "Capa oscura y una cicatriz en la mejilla.";
    sheet.noteSections.background = "# El juramento\n\n- Proteger al grupo\n- Encontrar la ruina";
    render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Trasfondo" }));
    const background = screen.getByRole("heading", { name: "Trasfondo" }).closest(".campaign-sheet-card") as HTMLElement;

    expect(background.querySelector("input, textarea")).not.toBeInTheDocument();
    const backgroundMeta = background.querySelector(".unified-sheet-background-meta-grid") as HTMLElement;
    expect(backgroundMeta.children).toHaveLength(5);
    expect(backgroundMeta.children[0]).toHaveTextContent("Sombra");
    expect(backgroundMeta.children[1]).toHaveTextContent("Cita");
    expect(backgroundMeta.children[2]).toHaveTextContent("Edad");
    expect(backgroundMeta.children[3]).toHaveTextContent("Altura");
    expect(backgroundMeta.children[4]).toHaveTextContent("Peso");
    expect(within(background).getByText("Verde con motas doradas")).toBeInTheDocument();
    expect(within(background).getByRole("heading", { name: "El juramento" })).toBeInTheDocument();
    expect(within(background).getByText("Proteger al grupo")).toBeInTheDocument();

    fireEvent.click(within(background).getByRole("button", { name: "Editar trasfondo" }));
    expect(background.querySelector(".form-grid.unified-sheet-background-meta-grid")).toBeInTheDocument();
    expect(within(background).getByRole("textbox", { name: "Sombra" })).toHaveValue("Verde con motas doradas");
    expect(within(background).getByRole("textbox", { name: "Historia (Markdown)" })).toHaveValue(sheet.noteSections.background);
  });

  it("allows NPC histories to be collapsed without truncating their content", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.noteSections.background = "Una historia extensa que debe conservarse completa.";
    const { container } = render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable collapsibleHistory />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Secciones de la ficha" })).getByRole("button", { name: "Trasfondo" }));
    const historyCard = container.querySelector("details.unified-sheet-read-section") as HTMLDetailsElement;
    expect(historyCard.open).toBe(true);
    expect(historyCard).toHaveTextContent("Una historia extensa que debe conservarse completa.");
    fireEvent.click(historyCard.querySelector("summary")!);
    expect(historyCard.open).toBe(false);
  });

  it("shows context without fields and renders note details as Markdown", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.grupo.nombre = "Compañía del Ocaso";
    sheet.grupo.objetivo = "Recuperar la corona perdida";
    sheet.contactosHoja[0] = { nombre: "Elia", raza: "Humana", ocupacion: "Erudita", jugador: "DJ" };
    sheet.personalNotes = [{
      id: "note-clue",
      title: "Pista del santuario",
      content: "## Señales\n\n1. Seguir las runas\n2. Evitar el pozo\n\n> No encender fuego",
      category: "campaign",
      createdAt: "2026-08-08",
      updatedAt: "2026-08-08"
    }];
    render(<UnifiedCharacterSheet title="Arold" sheet={sheet} editable />);

    const mobileTabs = screen.getByRole("navigation", { name: "Secciones de la ficha" });
    fireEvent.click(within(mobileTabs).getByRole("button", { name: "Notas" }));
    const notesPanel = screen.getByRole("heading", { name: "Notas personales" }).closest(".unified-sheet-panel") as HTMLElement;

    expect(notesPanel.querySelector("input, textarea")).not.toBeInTheDocument();
    expect(within(notesPanel).getByText("Compañía del Ocaso")).toBeInTheDocument();
    expect(within(notesPanel).getByText("Elia")).toBeInTheDocument();
    expect(within(notesPanel).queryByRole("button", { name: "Nueva nota" })).not.toBeInTheDocument();

    fireEvent.click(within(notesPanel).getByRole("button", { name: "Ver nota" }));
    const detail = screen.getByRole("heading", { name: "Pista del santuario" }).closest(".modal-panel") as HTMLElement;
    expect(within(detail).getByRole("heading", { name: "Señales" })).toBeInTheDocument();
    expect(within(detail).getByText("Seguir las runas")).toBeInTheDocument();
    expect(within(detail).getByText("No encender fuego").closest("blockquote")).not.toBeNull();
    fireEvent.click(within(detail).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(within(notesPanel).getByRole("button", { name: "Editar notas del personaje" }));
    expect(within(notesPanel).getByRole("textbox", { name: "Grupo" })).toHaveValue("Compañía del Ocaso");
    expect(within(notesPanel).getByRole("button", { name: "Nueva nota" })).toBeInTheDocument();
  });
});
