import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AppError } from "./AppError.js";

type SourceDefinition = {
  relativePath: string;
  toPdfPage: (printedPage: number) => number;
};

const SOURCE_DEFINITIONS: Record<string, SourceDefinition> = {
  "Guía del Director de Juego": { relativePath: "Rule books/Guía DM.pdf", toPdfPage: (page) => page - 162 },
  "Libro Básico": { relativePath: "Libro Basico.pdf", toPdfPage: (page) => page + 1 },
  "Aventuras 1": { relativePath: "Adventure books/Aventuras 1.pdf", toPdfPage: (page) => page + 1 },
  "Fuerte Espina": { relativePath: "Adventure books/Symbaroum - TdE1_Fuerte Espina.pdf", toPdfPage: (page) => page + 2 },
  "Karvosti": { relativePath: "Adventure books/Symbaroum - TdE2_Karvosti.pdf", toPdfPage: (page) => page + 2 },
  "Yndaros": { relativePath: "Adventure books/Symbaroum - TdE3_Yndaros.pdf", toPdfPage: (page) => page + 2 },
  "Symbar": { relativePath: "Adventure books/Symbaroum - TdE4_Symbar.pdf", toPdfPage: (page) => page + 2 },
  "La corona de cobre": { relativePath: "Adventure books/La corona de cobre.pdf", toPdfPage: (page) => page + 2 },
  "Localizaciones de aventura": { relativePath: "Adventure books/Localizaciones de aventura.pdf", toPdfPage: (page) => page + 1 }
};

function resolveDocsRoot(): string {
  const candidates = [resolve(process.cwd(), "docs"), resolve(process.cwd(), "../../docs")];
  const root = candidates.find((candidate) => existsSync(candidate));
  if (!root) throw new AppError("ARTIFACT_SOURCE_UNAVAILABLE", "Los libros de referencia no están disponibles en el servidor", 404);
  return root;
}

export function resolveMysticArtifactSource(sourceTitle: string, sourcePage: number | null) {
  const definition = SOURCE_DEFINITIONS[sourceTitle];
  if (!definition || !sourcePage) throw new AppError("ARTIFACT_SOURCE_UNAVAILABLE", "Este artefacto no tiene una fuente local enlazada", 404);
  const absolutePath = resolve(resolveDocsRoot(), definition.relativePath);
  if (!existsSync(absolutePath)) throw new AppError("ARTIFACT_SOURCE_UNAVAILABLE", "El libro de referencia no está disponible en el servidor", 404);
  return {
    absolutePath,
    pdfPage: definition.toPdfPage(sourcePage),
    fileName: definition.relativePath.split("/").at(-1) ?? "fuente.pdf"
  };
}

