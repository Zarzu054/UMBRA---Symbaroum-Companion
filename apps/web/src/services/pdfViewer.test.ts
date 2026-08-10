import { describe, expect, it } from "vitest";
import { buildPdfViewerUrl, getPdfViewerRequest } from "./pdfViewer";

describe("pdfViewer", () => {
  it("conserva la ruta y la página en parámetros compatibles con móvil", () => {
    const url = buildPdfViewerUrl("/books/libro-basico.pdf", 143);
    expect(url).toBe("/?pdf=%2Fbooks%2Flibro-basico.pdf&page=143");
    expect(getPdfViewerRequest(url.slice(1))).toEqual({ source: "/books/libro-basico.pdf", page: 143 });
  });

  it("corrige páginas inválidas y rechaza fuentes externas", () => {
    expect(getPdfViewerRequest("?pdf=%2Fbooks%2Fmanual.pdf&page=0")).toEqual({ source: "/books/manual.pdf", page: 1 });
    expect(getPdfViewerRequest("?pdf=https%3A%2F%2Fejemplo.com%2Fmanual.pdf&page=4")).toBeNull();
  });
});
