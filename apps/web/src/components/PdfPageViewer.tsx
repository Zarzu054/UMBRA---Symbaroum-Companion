import { useEffect, useRef, useState } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const pdfJsWasmUrl = new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, window.location.origin).href;

type Props = {
  source: string;
  initialPage: number;
  onClose?: () => void;
};

export function PdfPageViewer({ source, initialPage, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const renderRef = useRef<RenderTask | null>(null);
  const pendingScrollRef = useRef<"top" | "bottom" | null>(null);
  const wheelNavigationLockRef = useRef(false);
  const [page, setPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [stageWidth, setStageWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateWidth = () => setStageWidth(stage.clientWidth);
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    setIsLoading(true);
    setError(null);
    setZoom(1);

    void import("pdfjs-dist").then(async ({ getDocument, GlobalWorkerOptions }) => {
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const loadingTask = getDocument({
        url: source,
        wasmUrl: pdfJsWasmUrl
      });
      try {
        const document = await loadingTask.promise;
        if (disposed) {
          await document.destroy();
          return;
        }
        documentRef.current = document;
        setPageCount(document.numPages);
        setPage(Math.min(Math.max(initialPage, 1), document.numPages));
      } catch {
        if (!disposed) setError("No se pudo cargar el documento PDF.");
      } finally {
        if (!disposed) setIsLoading(false);
      }
    });

    return () => {
      disposed = true;
      renderRef.current?.cancel();
      renderRef.current = null;
      const document = documentRef.current;
      documentRef.current = null;
      if (document) void document.destroy();
    };
  }, [initialPage, source]);

  useEffect(() => {
    const document = documentRef.current;
    const canvas = canvasRef.current;
    if (!document || !canvas || !stageWidth || page < 1 || page > document.numPages) return;

    let disposed = false;
    renderRef.current?.cancel();

    void document.getPage(page).then((pdfPage) => {
      if (disposed) return;
      const naturalViewport = pdfPage.getViewport({ scale: 1 });
      const availableWidth = Math.max(280, stageWidth - 32);
      const fittedScale = Math.min(availableWidth / naturalViewport.width, 2);
      const viewport = pdfPage.getViewport({ scale: fittedScale * zoom });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas no disponible");

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const task = pdfPage.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0]
      });
      renderRef.current = task;
      return task.promise.then(() => {
        if (disposed) return;
        const pendingScroll = pendingScrollRef.current;
        const stage = stageRef.current;
        if (pendingScroll && stage) {
          window.requestAnimationFrame(() => {
            stage.scrollTop = pendingScroll === "bottom" ? stage.scrollHeight : 0;
            pendingScrollRef.current = null;
            wheelNavigationLockRef.current = false;
          });
        } else {
          wheelNavigationLockRef.current = false;
        }
      });
    }).catch((reason: unknown) => {
      wheelNavigationLockRef.current = false;
      if (!disposed && !(reason instanceof Error && reason.name === "RenderingCancelledException")) {
        setError("No se pudo mostrar la página solicitada.");
      }
    });

    return () => {
      disposed = true;
      renderRef.current?.cancel();
    };
  }, [page, pageCount, stageWidth, zoom]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (onClose) {
        onClose();
        return;
      }
      if (window.opener) window.close();
      else if (window.history.length > 1) window.history.back();
      else window.location.href = "/";
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const moveToPage = (nextPage: number, scrollTo: "top" | "bottom" = "top") => {
    const boundedPage = Math.min(Math.max(nextPage, 1), pageCount || 1);
    if (boundedPage === page) return;
    pendingScrollRef.current = scrollTo;
    wheelNavigationLockRef.current = true;
    setPage(boundedPage);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || !pageCount || wheelNavigationLockRef.current) return;
    const stage = stageRef.current;
    if (!stage || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    const atTop = stage.scrollTop <= 2;
    const atBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;

    if (event.deltaY > 0 && atBottom && page < pageCount) {
      event.preventDefault();
      moveToPage(page + 1, "top");
    } else if (event.deltaY < 0 && atTop && page > 1) {
      event.preventDefault();
      moveToPage(page - 1, "bottom");
    }
  };

  const closeViewer = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (window.opener) {
      window.close();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/";
  };

  return (
    <main className="pdf-page-viewer">
      <header className="pdf-page-viewer__toolbar">
        <button ref={closeRef} type="button" className="subtle-button" onClick={closeViewer}>Cerrar</button>
        <nav aria-label="Navegación del PDF">
          <button type="button" disabled={page <= 1} onClick={() => moveToPage(page - 1)} aria-label="Página anterior">←</button>
          <strong>Página {page}{pageCount ? ` de ${pageCount}` : ""}</strong>
          <button type="button" disabled={!pageCount || page >= pageCount} onClick={() => moveToPage(page + 1)} aria-label="Página siguiente">→</button>
        </nav>
        <div className="pdf-page-viewer__zoom" aria-label="Controles de zoom">
          <button type="button" disabled={zoom <= 0.75} onClick={() => setZoom((current) => Math.max(0.75, current - 0.25))} aria-label="Reducir zoom">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" disabled={zoom >= 2} onClick={() => setZoom((current) => Math.min(2, current + 0.25))} aria-label="Aumentar zoom">+</button>
        </div>
      </header>

      <div ref={stageRef} className="pdf-page-viewer__stage" aria-busy={isLoading} onWheel={handleWheel}>
        {isLoading ? <p className="pdf-page-viewer__status">Cargando documento…</p> : null}
        {error ? <p className="error-banner pdf-page-viewer__status">{error}</p> : null}
        <canvas ref={canvasRef} role="img" aria-label={`Página ${page} del documento PDF`} hidden={isLoading || Boolean(error)} />
      </div>
    </main>
  );
}
