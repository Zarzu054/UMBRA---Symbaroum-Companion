import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyCharacterSheet } from "@umbra/shared";
import { UnifiedCharacterSheet } from "./UnifiedCharacterSheet";

describe("UnifiedCharacterSheet mobile navigation", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(cleanup);

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

  it("places the background control in identity and the icon-only builder access in experience", () => {
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

    expect(within(identity).getByRole("button", { name: "Fondo" })).toBeInTheDocument();
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

    expect(workspace.children[0]).toBe(narrativeReader);
    expect(workspace.children[1]).toBe(mechanicalReader);
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

  it("tracks manual rerolls through available XP or permanent corruption", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 12;
    sheet.progreso.experienciaGastada = 5;

    const { container } = render(
      <UnifiedCharacterSheet
        title="Arold"
        subtitle="Guerrero"
        sheet={sheet}
        editable
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

  it("charges a reroll on top of experience computed from purchased capabilities", () => {
    const sheet = createEmptyCharacterSheet();
    sheet.progreso.experienciaTotal = 12;
    sheet.progreso.experienciaGastada = 0;
    sheet.rituales = [{
      nombre: "Adivinacion",
      tipo: "Ritual",
      efecto: "",
      nivel: "novato",
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
