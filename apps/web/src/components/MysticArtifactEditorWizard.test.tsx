import "@testing-library/jest-dom/vitest";
import type { MysticArtifactDefinitionInput } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MysticArtifactEditorWizard } from "./MysticArtifactEditorWizard";

const initialArtifact: MysticArtifactDefinitionInput = {
  name: "Reliquia de prueba",
  description: "Una pieza de historia de la campaña.",
  kind: "object",
  sourceTitle: "Creación de campaña",
  bindingCosts: [{ paymentType: "xp", amount: 1 }],
  resources: [],
  abilities: []
};

describe("MysticArtifactEditorWizard", () => {
  afterEach(cleanup);

  it("edita el artefacto por pasos sin exponer JSON", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <MysticArtifactEditorWizard
        title="Crear artefacto personalizado"
        initialValue={initialArtifact}
        onCancel={vi.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getByText("Paso 1 de 4: Narrativa")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue("Reliquia de prueba");
    expect(screen.queryByText("Definición JSON")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo/), { target: { value: "weapon" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente: Funcionamiento" }));

    expect(screen.getByRole("heading", { name: "Perfil de arma" })).toBeInTheDocument();
    expect(screen.getByLabelText("Daño")).toHaveValue("1D8");

    fireEvent.click(screen.getByRole("button", { name: "Siguiente: Recursos" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir recurso" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Gotas de sol" } });
    expect(screen.queryByText("Identificador interno")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente: Capacidades" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir capacidad" }));
    expect(screen.getByDisplayValue("Nueva capacidad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar artefacto" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      kind: "weapon",
      weapon: expect.objectContaining({ damageFormula: "1D8" }),
      resources: [expect.objectContaining({ key: "gotas_de_sol", name: "Gotas de sol", maximum: 1, current: 1 })],
      abilities: [expect.objectContaining({ name: "Nueva capacidad", corruptionFormula: "1D4" })]
    }));
  });

  it("mantiene al DJ en narrativa cuando falta un nombre válido", () => {
    render(
      <MysticArtifactEditorWizard
        title="Crear artefacto personalizado"
        initialValue={{ ...initialArtifact, name: "" }}
        onCancel={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Siguiente: Funcionamiento" }));

    expect(screen.getByText("El nombre debe tener al menos 2 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4: Narrativa")).toBeInTheDocument();
  });
});
