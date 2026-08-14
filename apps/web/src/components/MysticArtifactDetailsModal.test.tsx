import "@testing-library/jest-dom/vitest";
import type { MysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MysticArtifactDetailsModal } from "./MysticArtifactDetailsModal";

const artifact: MysticArtifact = {
  id: "10000000-0000-4000-8000-000000000001",
  scope: "preset",
  campaignId: null,
  presetSourceId: null,
  name: "Parcabrasa",
  description: "Hacha arrojadiza habitada por espíritus de fuego y ceniza.",
  kind: "weapon",
  sourceTitle: "La corona de cobre",
  sourcePage: 68,
  bindingCosts: [
    { paymentType: "xp", amount: 2 },
    { paymentType: "permanent_corruption", amount: 1 }
  ],
  weapon: {
    attackAttribute: "diestro",
    attackFormula: "1D20",
    damageFormula: "1D6+1D4",
    tags: ["one_handed", "thrown"],
    qualities: ["Regreso"],
    requiresBinding: false
  },
  abilities: [{
    id: "ability-a",
    name: "Hoja de lava",
    description: "El ataque arrojado ignora por completo la armadura.",
    activation: "active",
    actionCost: "combat",
    corruptionFormula: "1D4",
    requiresBinding: true,
    perSceneLimit: 1,
    perSceneNote: "Solo puede emplearse una vez por escena.",
    rolls: [
      { id: "roll-a", kind: "attack", label: "Ataque arrojado", formula: "1D20", actorAttribute: "atento", opponentAttribute: "agil" },
      { id: "roll-b", kind: "damage", label: "Daño de lava", formula: "1D6+1D4", fixedTarget: 12 }
    ],
    requirements: [
      { id: "requirement-a", type: "capability", capabilityName: "Herrero", minimumLevel: "principiante", description: "Debe conocer la forja." },
      { id: "requirement-b", type: "narrative", capabilityName: "", description: "Haber tocado fuego titánico." }
    ],
    resourceCosts: [{ resourceKey: "brasas", amount: 1 }],
    locked: true,
    lockReason: "Falta completar el vínculo."
  }],
  resources: [{ id: "resource-a", key: "brasas", name: "Brasas", suggestedMaxFormula: "Tenaz", maximum: 3, current: 2 }],
  ownerType: null,
  ownerId: null,
  ownerName: null,
  ownerEmail: null,
  isBound: true,
  boundAt: "2026-08-14T10:30:00.000Z",
  bindingPaymentType: "xp",
  bindingPaymentAmount: 2,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

describe("MysticArtifactDetailsModal", () => {
  afterEach(cleanup);

  it("shows every playable weapon detail and offers the GM source reference", () => {
    const onOpenSource = vi.fn().mockResolvedValue(undefined);
    render(<MysticArtifactDetailsModal artifact={artifact} campaignName="Davokar" onClose={vi.fn()} onOpenSource={onOpenSource} />);

    const dialog = screen.getByRole("dialog", { name: "Parcabrasa" });
    expect(dialog).toHaveTextContent("Arma · Davokar");
    expect(dialog).toHaveTextContent(/espíritus de fuego/i);
    expect(dialog).toHaveTextContent("Vinculado");
    expect(dialog).toHaveTextContent("2 PX");
    expect(dialog).toHaveTextContent("1D20 con Diestro");
    expect(dialog).toHaveTextContent("1D6+1D4");
    expect(dialog).toHaveTextContent("Una mano, Arrojadiza");
    expect(dialog).toHaveTextContent("Regreso");
    expect(dialog).toHaveTextContent("Brasas");
    expect(dialog).toHaveTextContent("2/3");
    expect(dialog).toHaveTextContent("Máximo sugerido: Tenaz");
    expect(dialog).toHaveTextContent("Hoja de lava");
    expect(dialog).toHaveTextContent("Bloqueada");
    expect(dialog).toHaveTextContent("Falta completar el vínculo.");
    expect(dialog).toHaveTextContent("1 por escena");
    expect(dialog).toHaveTextContent("Consume1 Brasas");
    expect(dialog).toHaveTextContent("Ataque arrojado");
    expect(dialog).toHaveTextContent("Atributo: Atento");
    expect(dialog).toHaveTextContent("Contra: Ágil");
    expect(dialog).toHaveTextContent("Objetivo fijo: 12");
    expect(dialog).toHaveTextContent("Herrero (Principiante) — Debe conocer la forja.");
    expect(dialog).toHaveTextContent("Haber tocado fuego titánico.");
    expect(dialog).toHaveTextContent("Solo puede emplearse una vez por escena.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir fuente · La corona de cobre p.68" }));
    expect(onOpenSource).toHaveBeenCalledWith(artifact);
  });

  it("renders armor and objects even when optional gameplay data is absent", () => {
    const armor: MysticArtifact = {
      ...artifact,
      id: "armor-a",
      name: "Coraza del alba",
      kind: "armor",
      weapon: undefined,
      armor: { protectionFormula: "1D8", qualities: ["Flexible"], requiresBinding: true },
      abilities: [],
      resources: [],
      sourceTitle: "",
      sourcePage: undefined
    };
    const { rerender } = render(<MysticArtifactDetailsModal artifact={armor} onClose={vi.fn()} />);
    let dialog = screen.getByRole("dialog", { name: "Coraza del alba" });
    expect(dialog).toHaveTextContent("Armadura");
    expect(dialog).toHaveTextContent("Protección1D8");
    expect(dialog).toHaveTextContent("Flexible");
    expect(dialog).toHaveTextContent("Requiere vínculo");
    expect(dialog).toHaveTextContent("no tiene capacidades activables");

    const object: MysticArtifact = {
      ...artifact,
      id: "object-a",
      name: "Espejo silencioso",
      kind: "object",
      weapon: undefined,
      armor: undefined,
      description: "",
      abilities: [],
      resources: [],
      sourceTitle: "",
      sourcePage: undefined
    };
    rerender(<MysticArtifactDetailsModal artifact={object} onClose={vi.fn()} />);
    dialog = screen.getByRole("dialog", { name: "Espejo silencioso" });
    expect(dialog).toHaveTextContent("Objeto");
    expect(dialog).toHaveTextContent("Sin descripción narrativa.");
  });

  it("offers binding inside the modal, disables unaffordable XP and keeps textual source access", () => {
    const onBind = vi.fn().mockResolvedValue(undefined);
    const unbound = {
      ...artifact,
      isBound: false,
      boundAt: null,
      bindingPaymentType: null,
      bindingPaymentAmount: null
    } satisfies MysticArtifact;
    render(<MysticArtifactDetailsModal artifact={unbound} availableExperience={1} onClose={vi.fn()} onBind={onBind} />);

    const dialog = screen.getByRole("dialog", { name: "Parcabrasa" });
    expect(within(dialog).getByRole("button", { name: "Vincular por 2 PX" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Vincular por 1 Corrupción permanente" }));
    expect(onBind).toHaveBeenCalledWith(unbound.id, "permanent_corruption");
    expect(dialog).toHaveTextContent("La corona de cobre · p.68");
    expect(within(dialog).queryByRole("button", { name: /Abrir fuente/ })).not.toBeInTheDocument();
  });

  it("explains when the server conceals protected data before binding", () => {
    const concealed: MysticArtifact = {
      ...artifact,
      isBound: false,
      boundAt: null,
      bindingPaymentType: null,
      bindingPaymentAmount: null,
      description: "",
      weapon: undefined,
      armor: undefined,
      abilities: [],
      resources: []
    };
    render(<MysticArtifactDetailsModal artifact={concealed} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Parcabrasa" })).toHaveTextContent("se revelarán al completar el vínculo");
  });
});
