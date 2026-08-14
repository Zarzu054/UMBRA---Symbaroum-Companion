import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmationDialogProvider, useConfirmationDialog } from "./ConfirmationDialogProvider";

afterEach(cleanup);

function ConfirmationHarness() {
  const confirm = useConfirmationDialog();
  const [result, setResult] = useState("pending");

  return (
    <>
      <button type="button" onClick={async () => {
        const accepted = await confirm({
          title: "Eliminar personaje",
          message: "Esta acción no se puede deshacer.",
          confirmLabel: "Eliminar personaje",
          tone: "danger"
        });
        setResult(accepted ? "confirmed" : "cancelled");
      }}>Abrir confirmación</button>
      <output>{result}</output>
    </>
  );
}

describe("ConfirmationDialogProvider", () => {
  it("renders destructive confirmations with the reroll modal styling", async () => {
    render(<ConfirmationDialogProvider><ConfirmationHarness /></ConfirmationDialogProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));

    const dialog = screen.getByRole("alertdialog", { name: "Eliminar personaje" });
    expect(dialog).toHaveClass("panel", "modal-panel", "character-roll-confirm-modal", "confirmation-dialog");
    expect(dialog).toHaveTextContent("Esta acción no se puede deshacer.");
    expect(screen.getByRole("button", { name: "Eliminar personaje" })).toHaveClass("destructive-button");

    fireEvent.click(screen.getByRole("button", { name: "Eliminar personaje" }));
    await waitFor(() => expect(screen.getByText("confirmed")).toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancels with Escape and returns focus to the trigger", async () => {
    render(<ConfirmationDialogProvider><ConfirmationHarness /></ConfirmationDialogProvider>);
    const trigger = screen.getByRole("button", { name: "Abrir confirmación" });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.getByText("cancelled")).toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
