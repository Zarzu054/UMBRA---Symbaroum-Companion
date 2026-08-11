import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPageViewer } from "./PdfPageViewer";

const renderPromise = Promise.resolve();
const pdfJsMocks = vi.hoisted(() => ({
  getDocument: vi.fn()
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: pdfJsMocks.getDocument
}));

function createLoadingTask() {
  return {
    promise: Promise.resolve({
      numPages: 4,
      destroy: vi.fn().mockResolvedValue(undefined),
      getPage: vi.fn().mockResolvedValue({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }),
        render: () => ({ promise: renderPromise, cancel: vi.fn() })
      })
    })
  };
}

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    Object.defineProperty(target, "clientWidth", { configurable: true, value: 800 });
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  pdfJsMocks.getDocument.mockReset();
  pdfJsMocks.getDocument.mockReturnValue(createLoadingTask());
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PdfPageViewer", () => {
  it("configura los decodificadores WASM necesarios para las imágenes JPEG2000", async () => {
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={254} onClose={() => undefined} />);

    await screen.findByText("Página 4 de 4");
    expect(pdfJsMocks.getDocument).toHaveBeenCalledWith({
      url: "/books/libro-basico.pdf",
      wasmUrl: expect.stringMatching(/\/pdfjs\/wasm\/$/)
    });
  });

  it("usa la rueda con scroll natural y cambia de página solamente al alcanzar un borde", async () => {
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={2} onClose={() => undefined} />);
    await screen.findByText("Página 2 de 4");
    const stage = screen.getByRole("img", { name: "Página 2 del documento PDF" }).parentElement!;
    Object.defineProperties(stage, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1200 }
    });

    stage.scrollTop = 300;
    fireEvent.wheel(stage, { deltaY: 100 });
    expect(screen.getByText("Página 2 de 4")).toBeTruthy();

    stage.scrollTop = 700;
    fireEvent.wheel(stage, { deltaY: 100 });
    await screen.findByText("Página 3 de 4");
    await waitFor(() => expect(stage.scrollTop).toBe(0));

    fireEvent.wheel(stage, { deltaY: -100 });
    await screen.findByText("Página 2 de 4");
    await waitFor(() => expect(stage.scrollTop).toBe(1200));
  });

  it("cierra el visor incrustado con Escape", async () => {
    const onClose = vi.fn();
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={1} onClose={onClose} />);
    await screen.findByText("Página 1 de 4");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
