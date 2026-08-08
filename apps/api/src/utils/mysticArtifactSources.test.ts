import { describe, expect, it } from "vitest";
import { resolveMysticArtifactSource } from "./mysticArtifactSources.js";

describe("mystic artifact PDF sources", () => {
  it("maps printed pages to the real page inside each local PDF", () => {
    expect(resolveMysticArtifactSource("Guía del Director de Juego", 184).pdfPage).toBe(22);
    expect(resolveMysticArtifactSource("Libro Básico", 255).pdfPage).toBe(256);
    expect(resolveMysticArtifactSource("Symbar", 99).pdfPage).toBe(101);
    expect(resolveMysticArtifactSource("La corona de cobre", 68).pdfPage).toBe(70);
  });

  it("rejects custom or unknown source labels", () => {
    expect(() => resolveMysticArtifactSource("Creación de campaña", 1)).toThrowError(/fuente local enlazada/i);
  });
});

