import "@testing-library/jest-dom/vitest";
import type { MysticArtifact } from "@umbra/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  bindingCosts: [{ paymentType: "xp", amount: 1 }],
  weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D6+1D4", tags: ["thrown"], qualities: ["Regreso"], requiresBinding: false },
  abilities: [{
    id: "ability-a", name: "Hoja de lava", description: "El ataque arrojado ignora por completo la armadura.", activation: "active", actionCost: "combat", corruptionFormula: "1D4", requiresBinding: true, perSceneNote: "", rolls: [], requirements: [{ type: "capability", capabilityName: "Herrero", minimumLevel: "principiante", description: "" }], resourceCosts: [], locked: false, lockReason: ""
  }],
  resources: [],
  ownerType: null,
  ownerId: null,
  ownerName: null,
  ownerEmail: null,
  isBound: false,
  boundAt: null,
  bindingPaymentType: null,
  bindingPaymentAmount: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

describe("MysticArtifactDetailsModal", () => {
  afterEach(cleanup);

  it("shows the reviewed rules and offers the GM source reference", () => {
    const onOpenSource = vi.fn().mockResolvedValue(undefined);
    render(<MysticArtifactDetailsModal artifact={artifact} onClose={vi.fn()} onOpenSource={onOpenSource} />);
    expect(screen.getByText(/espíritus de fuego/i)).toBeInTheDocument();
    expect(screen.getByText("Hoja de lava")).toBeInTheDocument();
    expect(screen.getByText("Requisitos: Herrero (Principiante)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir fuente · La corona de cobre p.68" }));
    expect(onOpenSource).toHaveBeenCalledWith(artifact);
  });
});
