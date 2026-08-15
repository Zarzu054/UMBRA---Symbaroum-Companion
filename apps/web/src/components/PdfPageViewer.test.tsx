import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfPageViewer } from "./PdfPageViewer";

const pdfJsMocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  globalWorkerOptions: { workerSrc: "" }
}));

const viewerMocks = vi.hoisted(() => ({
  eventBuses: [] as Array<{ dispatch: (name: string, data: object) => void }>,
  viewers: [] as Array<{
    currentPageNumber: number;
    currentScale: number;
    currentScaleValue: string;
    setDocument: ReturnType<typeof vi.fn>;
    scrollPageIntoView: ReturnType<typeof vi.fn>;
  }>,
  linkServices: [] as Array<{
    setDocument: ReturnType<typeof vi.fn>;
    setViewer: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: pdfJsMocks.globalWorkerOptions,
  getDocument: pdfJsMocks.getDocument
}));

vi.mock("pdfjs-dist/web/pdf_viewer.mjs", () => {
  if (!pdfJsMocks.globalWorkerOptions.workerSrc) {
    throw new Error("El visor web se importó antes de inicializar el núcleo de PDF.js");
  }

  class EventBusMock {
    private listeners = new Map<string, Set<(data: object) => void>>();

    constructor() {
      viewerMocks.eventBuses.push(this);
    }

    on(name: string, listener: (data: object) => void) {
      const listeners = this.listeners.get(name) ?? new Set();
      listeners.add(listener);
      this.listeners.set(name, listeners);
    }

    off(name: string, listener: (data: object) => void) {
      this.listeners.get(name)?.delete(listener);
    }

    dispatch(name: string, data: object) {
      this.listeners.get(name)?.forEach((listener) => listener(data));
    }
  }

  class PDFViewerMock {
    currentPageNumber = 1;
    currentScale = 1;
    private scaleValue = "page-width";
    setDocument = vi.fn((document: { numPages?: number } | null) => {
      if (document) queueMicrotask(() => this.eventBus.dispatch("pagesinit", { source: this }));
    });
    scrollPageIntoView = vi.fn(({ pageNumber }: { pageNumber: number }) => {
      const previous = this.currentPageNumber;
      this.currentPageNumber = pageNumber;
      this.eventBus.dispatch("pagechanging", { source: this, pageNumber, previous });
    });

    constructor(private readonly options: { eventBus: EventBusMock; container: HTMLDivElement; viewer: HTMLDivElement }) {
      viewerMocks.viewers.push(this);
    }

    private get eventBus() {
      return this.options.eventBus;
    }

    set currentScaleValue(value: string) {
      this.scaleValue = value;
      if (value === "page-width" || value === "page-fit") this.currentScale = 1;
    }

    get currentScaleValue() {
      return this.scaleValue;
    }
  }

  class PDFLinkServiceMock {
    setDocument = vi.fn();
    setViewer = vi.fn();

    constructor() {
      viewerMocks.linkServices.push(this);
    }
  }

  return {
    EventBus: EventBusMock,
    PDFViewer: PDFViewerMock,
    PDFLinkService: PDFLinkServiceMock,
    LinkTarget: { BLANK: 2 }
  };
});

function createLoadingTask({ reject = false } = {}) {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const document = {
    numPages: 4,
    destroy: vi.fn().mockResolvedValue(undefined)
  };
  return {
    document,
    task: {
      promise: reject ? Promise.reject(new Error("PDF inválido")) : Promise.resolve(document),
      destroy
    }
  };
}

class ResizeObserverMock {
  static callbacks: ResizeObserverCallback[] = [];
  static clientWidth = 800;
  static clientHeight = 600;

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.callbacks.push(callback);
  }

  observe(target: Element) {
    Object.defineProperties(target, {
      clientWidth: { configurable: true, value: ResizeObserverMock.clientWidth },
      clientHeight: { configurable: true, value: ResizeObserverMock.clientHeight }
    });
    this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }

  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  pdfJsMocks.getDocument.mockReset();
  viewerMocks.eventBuses.length = 0;
  viewerMocks.viewers.length = 0;
  viewerMocks.linkServices.length = 0;
  ResizeObserverMock.callbacks.length = 0;
  ResizeObserverMock.clientWidth = 800;
  ResizeObserverMock.clientHeight = 600;
  pdfJsMocks.getDocument.mockReturnValue(createLoadingTask().task);
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PdfPageViewer", () => {
  it("construye el visor continuo y salta a la página enlazada tras preparar un layout móvil", async () => {
    ResizeObserverMock.clientWidth = 390;
    ResizeObserverMock.clientHeight = 700;
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={254} onClose={() => undefined} />);

    const pageInput = await screen.findByRole("spinbutton", { name: "Número de página" });
    await waitFor(() => expect(pageInput).toHaveValue(4));
    expect(screen.getByText("de 4")).toBeInTheDocument();
    expect(screen.getByRole("document", { name: "Documento PDF" })).toHaveClass("pdfViewer");
    expect(viewerMocks.viewers).toHaveLength(1);
    expect(viewerMocks.viewers[0]!.setDocument).toHaveBeenCalledWith(expect.objectContaining({ numPages: 4 }));
    expect(viewerMocks.viewers[0]!.scrollPageIntoView).toHaveBeenCalledWith({ pageNumber: 4 });
    expect(pdfJsMocks.getDocument).toHaveBeenCalledWith({
      url: "/books/libro-basico.pdf",
      wasmUrl: expect.stringMatching(/\/pdfjs\/wasm\/$/)
    });
    expect(pdfJsMocks.globalWorkerOptions.workerSrc).toContain("pdf.worker.min");
  });

  it("sincroniza la página visible y permite saltar con el campo numérico", async () => {
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={2} onClose={() => undefined} />);
    const pageInput = await screen.findByRole("spinbutton", { name: "Número de página" });
    await waitFor(() => expect(pageInput).toHaveValue(2));
    const viewer = viewerMocks.viewers[0]!;
    const eventBus = viewerMocks.eventBuses[0]!;

    eventBus.dispatch("pagechanging", { pageNumber: 3 });
    await waitFor(() => expect(pageInput).toHaveValue(3));

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(viewer.scrollPageIntoView).toHaveBeenLastCalledWith({ pageNumber: 4 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(viewer.scrollPageIntoView).toHaveBeenLastCalledWith({ pageNumber: 3 });

    fireEvent.focus(pageInput);
    fireEvent.change(pageInput, { target: { value: "99" } });
    fireEvent.keyDown(pageInput, { key: "Enter" });
    expect(viewer.scrollPageIntoView).toHaveBeenLastCalledWith({ pageNumber: 4 });
    await waitFor(() => expect(pageInput).toHaveValue(4));

    fireEvent.focus(pageInput);
    fireEvent.change(pageInput, { target: { value: "1" } });
    fireEvent.keyDown(pageInput, { key: "Escape" });
    expect(pageInput).toHaveValue(4);
  });

  it("alterna entre ancho y lectura ampliada manteniendo el zoom y la página visible", async () => {
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={2} onClose={() => undefined} />);
    await screen.findByDisplayValue("2");
    const viewer = viewerMocks.viewers[0]!;

    const scaleModeToggle = screen.getByRole("button", { name: "Cambiar a modo lectura" });
    const widthModeIcon = scaleModeToggle.innerHTML;
    expect(scaleModeToggle).not.toHaveTextContent(/\S/);
    fireEvent.click(scaleModeToggle);
    expect(scaleModeToggle).toHaveAccessibleName("Ajustar al ancho");
    expect(scaleModeToggle).toHaveAttribute("title", "Ajustar al ancho");
    expect(scaleModeToggle.innerHTML).not.toBe(widthModeIcon);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(viewer.currentScaleValue).toBe("page-fit");
    expect(viewer.currentScale).toBe(1.5);
    expect(viewer.scrollPageIntoView).toHaveBeenLastCalledWith({ pageNumber: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(viewer.currentScale).toBeCloseTo(1.875);
    expect(viewer.currentScaleValue).toBe("page-fit");
    expect(viewer.scrollPageIntoView).toHaveBeenLastCalledWith({ pageNumber: 2 });

    ResizeObserverMock.callbacks[0]?.([], {} as ResizeObserver);
    expect(viewer.currentScale).toBeCloseTo(1.875);
    expect(viewer.currentScaleValue).toBe("page-fit");

    fireEvent.click(scaleModeToggle);
    expect(scaleModeToggle).toHaveAccessibleName("Cambiar a modo lectura");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(viewer.currentScaleValue).toBe("page-width");
    expect(viewer.currentScale).toBe(1);

    fireEvent.click(scaleModeToggle);
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(viewer.currentScaleValue).toBe("page-fit");
    expect(viewer.currentScale).toBeCloseTo(1.875);
  });

  it("muestra errores de carga y libera el documento al desmontar", async () => {
    const successful = createLoadingTask();
    pdfJsMocks.getDocument.mockReturnValueOnce(successful.task);
    const { unmount } = render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={1} onClose={() => undefined} />);
    await screen.findByDisplayValue("1");
    unmount();
    expect(successful.document.destroy).toHaveBeenCalledOnce();

    pdfJsMocks.getDocument.mockReturnValueOnce(createLoadingTask({ reject: true }).task);
    render(<PdfPageViewer source="/books/roto.pdf" initialPage={1} onClose={() => undefined} />);
    expect(await screen.findByText("No se pudo cargar el documento PDF.")).toBeInTheDocument();
  });

  it("cierra el visor incrustado con Escape", async () => {
    const onClose = vi.fn();
    render(<PdfPageViewer source="/books/libro-basico.pdf" initialPage={1} onClose={onClose} />);
    await screen.findByDisplayValue("1");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
