import "@testing-library/jest-dom/vitest";
import { createEmptyCharacterSheet, type CharacterSheet } from "@umbra/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterCreationWizard } from "./ActorCreationWizard";
import { ConfirmationDialogProvider } from "./ConfirmationDialogProvider";

function CharacterWizardHarness({ submit = vi.fn().mockResolvedValue(true), onCancel = vi.fn() }) {
  const [form, setForm] = useState({
    name: "",
    archetype: "Guerrero",
    race: "Humano",
    culture: "Ambriano",
    profession: "",
    level: 1 as const,
    sheet: createEmptyCharacterSheet()
  });

  function updateSheet(path: string, value: string | number | boolean) {
    setForm((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let cursor = next.sheet as unknown as Record<string, unknown>;
      for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]] as Record<string, unknown>;
      cursor[parts.at(-1)!] = value;
      return next;
    });
  }

  const controller = {
    form,
    setForm,
    updateSheet,
    submit,
    isEditing: false,
    isSaving: false,
    error: null
  };

  return <CharacterCreationWizard controller={controller as never} onCancel={onCancel} />;
}

describe("ActorCreationWizard", () => {
  afterEach(cleanup);

  it("impide saltar fases si la identidad actual no es válida", () => {
    render(<CharacterWizardHarness />);

    const activeStep = screen.getByRole("button", { name: /1 Identidad/ });
    expect(activeStep).toHaveClass("is-active");
    expect(activeStep).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: /5 Trasfondo/ }));

    expect(screen.getByText("El personaje necesita un nombre de al menos dos caracteres.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identidad" })).toBeInTheDocument();
  });

  it("muestra la bolsa especial de 20 PX para familiares", () => {
    render(<CharacterWizardHarness />);

    fireEvent.click(screen.getByLabelText("Es familiar (20 PX iniciales)"));

    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent === "PX inicial 20")).toBeInTheDocument();
  });

  it("confirma con el diálogo tematizado antes de descartar cambios", async () => {
    const onCancel = vi.fn();
    render(<ConfirmationDialogProvider><CharacterWizardHarness onCancel={onCancel} /></ConfirmationDialogProvider>);

    fireEvent.change(screen.getByLabelText("Nombre del personaje"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.getByRole("alertdialog", { name: "Descartar cambios" })).toHaveClass("character-roll-confirm-modal");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sin guardar" }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it("aplica Atributo excepcional después del reparto base y permite elegir atributos distintos", () => {
    render(<CharacterWizardHarness />);

    fireEvent.change(screen.getByLabelText("Nombre del personaje"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.change(screen.getByLabelText("Agil"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Atento"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Persuasivo"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Tenaz"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    fireEvent.change(screen.getByPlaceholderText("Buscar capacidad..."), { target: { value: "Atributo excepcional" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));

    expect(screen.getAllByLabelText("Atributo para Atributo excepcional")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Agil · final 16 (+1)")).toBeInTheDocument();
    expect(screen.getByText("Atento · final 15 (+1)")).toBeInTheDocument();
    expect(screen.getByText("80 / 80")).toBeInTheDocument();
  });

  it("recorre las cinco fases, exige equipo y entrega el estado final al guardar", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<CharacterWizardHarness submit={submit} />);

    fireEvent.change(screen.getByLabelText("Nombre del personaje"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("80 / 80")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Capacidades" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Equipo inicial" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Daga + Arma pesada" }));

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("heading", { name: "Trasfondo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const payload = submit.mock.calls[0][0] as { sheet: CharacterSheet };
    expect(payload.sheet.identidad.nombrePersonaje).toBe("Ada");
    expect(payload.sheet.inventoryItems.some((entry) => entry.name === "Arma pesada")).toBe(true);
    expect(payload.sheet.progreso.experienciaTotal).toBe(50);
  });
});
