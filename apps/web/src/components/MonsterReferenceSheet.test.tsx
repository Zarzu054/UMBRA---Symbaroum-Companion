import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STARTER_MONSTER_CODEX } from "@umbra/shared";
import { MonsterReferenceSheet } from "./MonsterReferenceSheet";

vi.mock("./CharacterSheetBackgroundPicker", () => ({
  CharacterSheetBackgroundPicker: () => <button type="button">Fondo</button>
}));

afterEach(cleanup);

describe("MonsterReferenceSheet", () => {
  it("separa los datos publicados y enlaza la página fuente", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-arak-emponzonador")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    expect(screen.getByRole("heading", { name: monster.name })).toBeTruthy();
    expect(screen.getByText("Repica feroz con sus mandíbulas")).toBeTruthy();
    expect(screen.getByText(/Mordisco 3/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Códice de monstruos · p.13" }).getAttribute("href")).toBe("/?pdf=%2Fbooks%2Fcodice-de-monstruos.pdf&page=15");
    expect(screen.queryByRole("button", { name: /tirar/i })).toBeNull();
    const descriptionToggle = screen.getByText("Descripción").closest("summary")!;
    const descriptionCard = descriptionToggle.closest("details") as HTMLDetailsElement;
    expect(descriptionCard.open).toBe(true);
    fireEvent.click(descriptionToggle);
    expect(descriptionCard.open).toBe(false);
  });

  it("permite duplicar y cerrar con Escape", () => {
    const monster = STARTER_MONSTER_CODEX[0]!;
    const onClose = vi.fn();
    const onDuplicate = vi.fn();
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={onClose} onDuplicate={onDuplicate} />);

    fireEvent.click(screen.getByRole("button", { name: "Duplicar en Mis monstruos" }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("muestra cada arma del monstruo como un ataque independiente", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-elfo-vernal")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    expect(screen.getByText("Daga")).toBeTruthy();
    expect(screen.getByText("Arco")).toBeTruthy();
    expect(screen.getByText("Daga 3 (Corta)")).toBeTruthy();
    expect(screen.getByText("Arco 4")).toBeTruthy();
    expect(screen.getByText(
      "Los elfos vernales se suelen mantener a distancia del enemigo y disparar con el arco. Otra estrategia es provocar a sus víctimas para que los sigan hacia trampas o emboscadas de varios tipos."
    )).toBeTruthy();
  });

  it("abre las reglas completas y destaca el nivel que posee el monstruo", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-elfo-estival-verde")!;
    const onClose = vi.fn();
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={onClose} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /Tirador.*Adepto/i }));

    const dialog = screen.getByRole("dialog", { name: "Tirador" });
    expect(within(dialog).getByRole("heading", { name: "Principiante" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Adepto" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Maestro" })).toBeTruthy();
    const currentTier = within(dialog).getByRole("heading", { name: "Adepto" }).closest("section");
    expect(currentTier?.classList.contains("is-current")).toBe(true);
    expect(within(currentTier as HTMLElement).getByText("Nivel del monstruo")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tirador" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("incluye las reglas completas de habilidades exclusivas del Códice", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-flagelante")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /Combate con látigo.*Adepto/i }));

    const dialog = screen.getByRole("dialog", { name: "Combate con látigo" });
    expect(within(dialog).getByText(/el látigo obstaculiza al enemigo/i)).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Principiante" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Maestro" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Adepto" }).closest("section")?.classList.contains("is-current")).toBe(true);
  });

  it("abre las reglas de un rasgo y destaca el nivel de la criatura", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-raskaal")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /Garras prensiles.*Nivel II/i }));

    const dialog = screen.getByRole("dialog", { name: "Garras prensiles" });
    expect(within(dialog).getByRole("heading", { name: "Nivel I" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Nivel II" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Nivel III" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Nivel II" }).closest("section")?.classList.contains("is-current")).toBe(true);
  });

  it("enlaza todos los rasgos publicados del catálogo de monstruos", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-anguila-martillo")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /Nadador.*Nivel II/i }));

    const dialog = screen.getByRole("dialog", { name: "Nadador" });
    expect(within(dialog).getByText(/funciona como Tunelador/i)).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Nivel II" }).closest("section")?.classList.contains("is-current")).toBe(true);
  });

  it("separa los rasgos raciales combinados en accesos independientes", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-guia-rural")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    expect(screen.getByRole("button", { name: /Paria.*Ver reglas/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Poco longevo.*Ver reglas/i })).toBeTruthy();
  });

  it("desglosa el ataque sin repetir el resultado final", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-elfo-vernal")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Daga" }));
    let dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Daga" });
    expect(within(dialog).getByText("Atributo de ataque").closest("div")?.textContent).toContain("Diestro 10 (0)");
    expect(within(dialog).getByText("Dado base del arma").closest("div")?.textContent).toContain("1D6 → 3");
    expect(within(dialog).queryByText("Daño final mostrado")).toBeNull();
    expect(within(dialog).queryByText(/Valor final publicado/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Arco" }));
    dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Arco" });
    expect(within(dialog).getByText("Atributo de ataque").closest("div")?.textContent).toContain("Diestro 10 (0)");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Defensa" }));
    dialog = screen.getByRole("dialog", { name: "Cálculo de Defensa" });
    expect(within(dialog).getByText("Atributo para Defensa").closest("div")?.textContent).toContain("Ágil 13");
    expect(within(dialog).getByText("Defensa base").closest("div")?.textContent).toContain("10 − 13 = -3");
    expect(within(dialog).queryByText("Defensa final")).toBeNull();
  });

  it("explica Sexto sentido adepto en ataque a distancia y Defensa", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-manto-negro-veterano")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Ballesta" }));
    let dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Ballesta" });
    expect(within(dialog).getByText("Atributo de ataque").closest("div")?.textContent).toContain("Atento 13 (-3)");
    expect(within(dialog).getByText("Sexto sentido (Adepto)")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Defensa" }));
    dialog = screen.getByRole("dialog", { name: "Cálculo de Defensa" });
    expect(within(dialog).getByText("Atributo para Defensa").closest("div")?.textContent).toContain("Atento 13");
    expect(within(dialog).getByText("Sexto sentido (Adepto)")).toBeTruthy();
  });

  it("muestra la mejora de dado de Tirador con ambos promedios", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-elfo-estival-verde")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Arco" }));
    const dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Arco" });
    expect(within(dialog).getByText("Mejora del dado").closest("div")?.textContent).toContain("1D8 (4) → 1D10 (5)");
    expect(within(dialog).getAllByText("Tirador (Adepto)").length).toBeGreaterThanOrEqual(1);
  });

  it("separa los promedios de Arma natural, Robusto y Berserker", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-troll-saqueador-hambriento")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Zarpas" }));
    const dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Zarpas" });
    expect(within(dialog).getByText("Daño del arma natural").closest("div")?.textContent).toContain("1D6 → 3");
    expect(within(dialog).getByText("Arma natural (I)")).toBeTruthy();
    expect(within(dialog).getByText("Robusto (I)").parentElement?.parentElement?.textContent).toContain("+1D4 → +2");
    expect(within(dialog).getByText("Berserker (Adepto)").parentElement?.parentElement?.textContent).toContain("+1D6 → +3");
    expect(within(dialog).queryByText("Diferencia no atribuida")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Armadura" }));
    const armorDialog = screen.getByRole("dialog", { name: "Cálculo de Armadura" });
    expect(within(armorDialog).getByText("Protección por tamaño").closest("div")?.textContent).toContain("1D4 → 2");
    expect(within(armorDialog).getByText("Protección durante el frenesí").closest("div")?.textContent).toContain("+1D4 → +2");
    expect(within(armorDialog).queryByText("Diferencia no atribuida")).toBeNull();
  });

  it("aplica los niveles Maestro publicados del cacique troll al daño", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-cacique-troll")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Zarpas" }));
    const dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Zarpas" });
    expect(within(dialog).getAllByText("Combate sin armas (Maestro)").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText("Berserker (Maestro)")).toBeTruthy();
    expect(within(dialog).getByText("Robusto (II)")).toBeTruthy();
    expect(within(dialog).queryByText("Diferencia no atribuida")).toBeNull();
    expect(within(dialog).getByText(/Resultado final/i).parentElement?.textContent).toContain("13");
  });

  it("reconstruye ataques naturales sin Arma natural cuando los define Combate sin armas", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-lindorma")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de ataque de Mordisco" }));
    const dialog = screen.getByRole("dialog", { name: "Desglose de ataque: Mordisco" });
    expect(within(dialog).getAllByText("Combate sin armas (Maestro)").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getAllByText("Golpe de hierro (Maestro)").length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).getByText("Robusto (III)")).toBeTruthy();
    expect(within(dialog).queryByText("Diferencia no atribuida")).toBeNull();
  });

  it("avisa cuando los componentes publicados no coinciden con la armadura mostrada", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-trasgo-jefe")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Armadura" }));
    const dialog = screen.getByRole("dialog", { name: "Cálculo de Armadura" });
    expect(within(dialog).getByText(/los componentes escritos en el perfil suman 4, pero la ficha muestra 2/i)).toBeTruthy();
  });
});
