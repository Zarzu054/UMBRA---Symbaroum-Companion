import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { buildPdfViewerUrl } from "./services/pdfViewer";

vi.mock("./controllers/authController", () => ({
  useAuthController: () => ({ isBootstrapping: true })
}));

vi.mock("./components/PdfPageViewer", () => ({
  PdfPageViewer: ({ source, initialPage, onClose }: { source: string; initialPage: number; onClose?: () => void }) => (
    <section data-testid="pdf-viewer-mock">
      <span>{source} · {initialPage}</span>
      <button type="button" onClick={onClose}>Cerrar referencia</button>
    </section>
  )
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/monsters");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("visor PDF integrado", () => {
  it("mantiene montada la página de origen mientras se consulta y se cierra una referencia", async () => {
    const { container } = render(<App />);
    const originalPage = screen.getByText("Cargando sesión...").closest("main")!;
    const reference = document.createElement("a");
    reference.href = buildPdfViewerUrl("/books/codice-de-monstruos.pdf", 72);
    reference.target = "_blank";
    reference.textContent = "Abrir referencia";
    container.append(reference);

    fireEvent.click(reference);
    expect(await screen.findByTestId("pdf-viewer-mock")).toBeTruthy();
    expect(screen.getByText("Cargando sesión...").closest("main")).toBe(originalPage);
    expect(screen.getByText("/books/codice-de-monstruos.pdf · 72")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar referencia" }));
    await waitFor(() => expect(screen.queryByTestId("pdf-viewer-mock")).toBeNull());
    expect(screen.getByText("Cargando sesión...").closest("main")).toBe(originalPage);
  });
});
