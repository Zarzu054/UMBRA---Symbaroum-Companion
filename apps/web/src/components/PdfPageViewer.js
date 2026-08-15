import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import "pdfjs-dist/web/pdf_viewer.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AppIcon } from "./AppIcon";
const pdfJsWasmUrl = new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, window.location.origin).href;
const MIN_ZOOM = .75;
const MAX_ZOOM = 2;
const ZOOM_STEP = .25;
const READING_MODE_SCALE = 1.5;
function clampPage(page, pageCount) {
    return Math.min(Math.max(Math.trunc(page) || 1, 1), Math.max(pageCount, 1));
}
export function PdfPageViewer({ source, initialPage, onClose }) {
    const stageRef = useRef(null);
    const pagesRef = useRef(null);
    const closeRef = useRef(null);
    const documentRef = useRef(null);
    const loadingTaskRef = useRef(null);
    const viewerRef = useRef(null);
    const linkServiceRef = useRef(null);
    const eventBusRef = useRef(null);
    const zoomRef = useRef(1);
    const modeZoomRef = useRef({ width: 1, page: 1 });
    const scaleModeRef = useRef("width");
    const pagesReadyRef = useRef(false);
    const pendingInitialPageRef = useRef(null);
    const initialJumpFramesRef = useRef([]);
    const pageInputFocusedRef = useRef(false);
    const [page, setPage] = useState(clampPage(initialPage, Number.MAX_SAFE_INTEGER));
    const [pageDraft, setPageDraft] = useState(String(clampPage(initialPage, Number.MAX_SAFE_INTEGER)));
    const [pageCount, setPageCount] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [scaleMode, setScaleMode] = useState("width");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    function cancelInitialPageJump() {
        for (const frame of initialJumpFramesRef.current)
            window.cancelAnimationFrame(frame);
        initialJumpFramesRef.current = [];
    }
    function scheduleInitialPageJump() {
        const targetPage = pendingInitialPageRef.current;
        const viewer = viewerRef.current;
        const stage = stageRef.current;
        if (!targetPage || !viewer || !stage || stage.clientWidth <= 0 || stage.clientHeight <= 0)
            return;
        cancelInitialPageJump();
        const firstFrame = window.requestAnimationFrame(() => {
            const secondFrame = window.requestAnimationFrame(() => {
                if (pendingInitialPageRef.current !== targetPage || viewerRef.current !== viewer)
                    return;
                viewer.scrollPageIntoView({ pageNumber: targetPage });
                pendingInitialPageRef.current = null;
                initialJumpFramesRef.current = [];
            });
            initialJumpFramesRef.current = [secondFrame];
        });
        initialJumpFramesRef.current = [firstFrame];
    }
    function applyViewerScale(nextZoom, preservePage = true, nextMode = scaleModeRef.current) {
        const viewer = viewerRef.current;
        if (!viewer || !pagesReadyRef.current)
            return;
        const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
        const pageToPreserve = viewer.currentPageNumber;
        viewer.currentScaleValue = nextMode === "width" ? "page-width" : "page-fit";
        const relativeScale = boundedZoom * (nextMode === "page" ? READING_MODE_SCALE : 1);
        if (relativeScale !== 1)
            viewer.currentScale = viewer.currentScale * relativeScale;
        if (preservePage && pendingInitialPageRef.current === null) {
            viewer.scrollPageIntoView({ pageNumber: pageToPreserve });
        }
    }
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const handleResize = () => {
            if (!viewerRef.current || !pagesReadyRef.current)
                return;
            applyViewerScale(zoomRef.current);
            scheduleInitialPageJump();
        };
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", handleResize);
            return () => window.removeEventListener("resize", handleResize);
        }
        const observer = new ResizeObserver(handleResize);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const stage = stageRef.current;
        const pagesElement = pagesRef.current;
        if (!stage || !pagesElement)
            return;
        let disposed = false;
        let eventBus = null;
        let pdfViewer = null;
        let linkService = null;
        const viewerAbortController = new AbortController();
        setIsLoading(true);
        setError(null);
        setPageCount(0);
        zoomRef.current = 1;
        modeZoomRef.current = { width: 1, page: 1 };
        setZoom(1);
        scaleModeRef.current = "width";
        setScaleMode("width");
        pagesReadyRef.current = false;
        pendingInitialPageRef.current = null;
        pagesElement.replaceChildren();
        const handlePageChanging = (event) => {
            const nextPage = clampPage(event.pageNumber, documentRef.current?.numPages ?? 1);
            setPage(nextPage);
            if (!pageInputFocusedRef.current)
                setPageDraft(String(nextPage));
        };
        const handlePagesInit = () => {
            if (disposed || !pdfViewer || !documentRef.current)
                return;
            pagesReadyRef.current = true;
            const targetPage = clampPage(initialPage, documentRef.current.numPages);
            pendingInitialPageRef.current = targetPage;
            setPage(targetPage);
            setPageDraft(String(targetPage));
            applyViewerScale(zoomRef.current, false);
            setIsLoading(false);
            scheduleInitialPageJump();
        };
        void import("pdfjs-dist").then(async ({ getDocument, GlobalWorkerOptions }) => {
            if (disposed)
                return;
            GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            const viewerModule = await import("pdfjs-dist/web/pdf_viewer.mjs");
            if (disposed)
                return;
            eventBus = new viewerModule.EventBus();
            linkService = new viewerModule.PDFLinkService({
                eventBus,
                externalLinkTarget: viewerModule.LinkTarget.BLANK
            });
            const viewerOptions = {
                container: stage,
                viewer: pagesElement,
                eventBus,
                linkService,
                abortSignal: viewerAbortController.signal,
                removePageBorders: true,
                textLayerMode: 1
            };
            pdfViewer = new viewerModule.PDFViewer(viewerOptions);
            linkService.setViewer(pdfViewer);
            eventBus.on("pagechanging", handlePageChanging);
            eventBus.on("pagesinit", handlePagesInit);
            viewerRef.current = pdfViewer;
            linkServiceRef.current = linkService;
            eventBusRef.current = eventBus;
            const loadingTask = getDocument({ url: source, wasmUrl: pdfJsWasmUrl });
            loadingTaskRef.current = loadingTask;
            try {
                const document = await loadingTask.promise;
                if (disposed) {
                    await document.destroy();
                    return;
                }
                documentRef.current = document;
                setPageCount(document.numPages);
                pdfViewer.setDocument(document);
                linkService.setDocument(document);
            }
            catch {
                if (!disposed) {
                    setError("No se pudo cargar el documento PDF.");
                    setIsLoading(false);
                }
            }
        }).catch(() => {
            if (!disposed) {
                setError("No se pudo inicializar el visor PDF.");
                setIsLoading(false);
            }
        });
        return () => {
            disposed = true;
            cancelInitialPageJump();
            pagesReadyRef.current = false;
            pendingInitialPageRef.current = null;
            eventBus?.off("pagechanging", handlePageChanging);
            eventBus?.off("pagesinit", handlePagesInit);
            viewerAbortController.abort();
            pdfViewer?.setDocument(null);
            linkService?.setDocument(null);
            if (viewerRef.current === pdfViewer)
                viewerRef.current = null;
            if (linkServiceRef.current === linkService)
                linkServiceRef.current = null;
            if (eventBusRef.current === eventBus)
                eventBusRef.current = null;
            const document = documentRef.current;
            documentRef.current = null;
            const loadingTask = loadingTaskRef.current;
            loadingTaskRef.current = null;
            if (document)
                void document.destroy();
            else if (loadingTask)
                void loadingTask.destroy();
        };
    }, [initialPage, source]);
    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key !== "Escape")
                return;
            event.preventDefault();
            if (onClose) {
                onClose();
                return;
            }
            if (window.opener)
                window.close();
            else if (window.history.length > 1)
                window.history.back();
            else
                window.location.href = "/";
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);
    function goToDraftPage() {
        goToPage(Number(pageDraft));
    }
    function goToPage(requestedPage) {
        const nextPage = clampPage(requestedPage, pageCount);
        setPage(nextPage);
        setPageDraft(String(nextPage));
        viewerRef.current?.scrollPageIntoView({ pageNumber: nextPage });
    }
    function handlePageInputKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            goToDraftPage();
        }
        else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setPageDraft(String(page));
            event.currentTarget.select();
        }
    }
    function changeZoom(nextZoom) {
        const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
        zoomRef.current = boundedZoom;
        modeZoomRef.current[scaleModeRef.current] = boundedZoom;
        setZoom(boundedZoom);
        applyViewerScale(boundedZoom);
    }
    function changeScaleMode(nextMode) {
        const nextZoom = modeZoomRef.current[nextMode];
        scaleModeRef.current = nextMode;
        zoomRef.current = nextZoom;
        setScaleMode(nextMode);
        setZoom(nextZoom);
        applyViewerScale(nextZoom, true, nextMode);
    }
    function closeViewer() {
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
    }
    return (_jsxs("main", { className: "pdf-page-viewer", children: [_jsxs("header", { className: "pdf-page-viewer__toolbar", children: [_jsx("button", { ref: closeRef, type: "button", className: "subtle-button pdf-page-viewer__close", onClick: closeViewer, children: "Cerrar" }), _jsxs("div", { className: "pdf-page-viewer__page-control", role: "group", "aria-label": "Navegaci\u00F3n del PDF", children: [_jsx("button", { type: "button", disabled: !pageCount || page <= 1 || Boolean(error), "aria-label": "P\u00E1gina anterior", onClick: () => goToPage(page - 1), children: "\u2190" }), _jsxs("label", { children: [_jsx("span", { children: "P\u00E1gina" }), _jsx("input", { type: "number", min: 1, max: pageCount || 1, value: pageDraft, disabled: !pageCount || Boolean(error), "aria-label": "N\u00FAmero de p\u00E1gina", onFocus: (event) => {
                                            pageInputFocusedRef.current = true;
                                            event.currentTarget.select();
                                        }, onChange: (event) => setPageDraft(event.target.value), onBlur: () => {
                                            pageInputFocusedRef.current = false;
                                            goToDraftPage();
                                        }, onKeyDown: handlePageInputKeyDown })] }), _jsxs("strong", { children: ["de ", pageCount || "—"] }), _jsx("button", { type: "button", disabled: !pageCount || page >= pageCount || Boolean(error), "aria-label": "P\u00E1gina siguiente", onClick: () => goToPage(page + 1), children: "\u2192" })] }), _jsx("button", { type: "button", className: "pdf-page-viewer__scale-mode", "aria-label": scaleMode === "width" ? "Cambiar a modo lectura" : "Ajustar al ancho", title: scaleMode === "width" ? "Cambiar a modo lectura" : "Ajustar al ancho", disabled: !pageCount || Boolean(error), onClick: () => changeScaleMode(scaleMode === "width" ? "page" : "width"), children: _jsx(AppIcon, { name: scaleMode === "width" ? "fit-page" : "fit-width", size: 21 }) }), _jsxs("div", { className: "pdf-page-viewer__zoom", "aria-label": "Controles de zoom", children: [_jsx("button", { type: "button", disabled: zoom <= MIN_ZOOM || Boolean(error), onClick: () => changeZoom(zoom - ZOOM_STEP), "aria-label": "Reducir zoom", children: "\u2212" }), _jsxs("span", { children: [Math.round(zoom * 100), "%"] }), _jsx("button", { type: "button", disabled: zoom >= MAX_ZOOM || Boolean(error), onClick: () => changeZoom(zoom + ZOOM_STEP), "aria-label": "Aumentar zoom", children: "+" })] })] }), _jsx("div", { className: "pdf-page-viewer__viewport", children: _jsxs("div", { ref: stageRef, className: "pdf-page-viewer__stage", "aria-busy": isLoading, children: [isLoading ? _jsx("p", { className: "pdf-page-viewer__status", children: "Cargando documento\u2026" }) : null, error ? _jsx("p", { className: "error-banner pdf-page-viewer__status", children: error }) : null, _jsx("div", { ref: pagesRef, className: "pdfViewer pdf-page-viewer__pages", role: "document", "aria-label": "Documento PDF" })] }) })] }));
}
