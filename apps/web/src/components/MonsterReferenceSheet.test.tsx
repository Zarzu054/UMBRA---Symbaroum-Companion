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
    expect(within(dialog).getByRole("heading", { name: "Novato" })).toBeTruthy();
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
    expect(within(dialog).getByRole("heading", { name: "Novato" })).toBeTruthy();
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

  it("explica el daño y los valores derivados desde sus botones de información", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "libro-basico-elfo-vernal")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de daño de Daga" }));
    let dialog = screen.getByRole("dialog", { name: "Cálculo de daño: Daga" });
    expect(within(dialog).getByText("Valor final publicado: 3")).toBeTruthy();
    expect(within(dialog).getByText("Daño final mostrado").parentElement?.textContent).toContain("3");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Defensa" }));
    dialog = screen.getByRole("dialog", { name: "Cálculo de Defensa" });
    expect(within(dialog).getByText("Base").parentElement?.textContent).toContain("-3");
    expect(within(dialog).getByText("Defensa final").parentElement?.textContent).toContain("-3");
  });

  it("avisa cuando los componentes publicados no coinciden con la armadura mostrada", () => {
    const monster = STARTER_MONSTER_CODEX.find((entry) => entry.id === "codice-trasgo-jefe")!;
    render(<MonsterReferenceSheet monster={monster} official backgroundPreferenceScope="gm:monsters" onClose={() => undefined} onDuplicate={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver cálculo de Armadura" }));
    const dialog = screen.getByRole("dialog", { name: "Cálculo de Armadura" });
    expect(within(dialog).getByText(/los componentes publicados suman 4, pero la ficha muestra 2/i)).toBeTruthy();
  });
});
