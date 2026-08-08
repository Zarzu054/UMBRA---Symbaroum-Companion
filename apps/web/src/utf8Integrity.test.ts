import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceRoots = [
  join(workspaceRoot, "apps/web/src"),
  join(workspaceRoot, "packages/shared/src")
];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name))) return [];
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) return [];
    return [path];
  });
}

describe("integridad UTF-8 de los textos de la app", () => {
  const sourceFiles = sourceRoots.flatMap(collectSourceFiles);

  it("no contiene mojibake ni caracteres de reemplazo", () => {
    const invalidFiles = sourceFiles.filter((path) => /Ã|Â|�/.test(readFileSync(path, "utf8")));
    expect(invalidFiles).toEqual([]);
  });

  it("no recupera las grafias visibles sin ñ ya corregidas", () => {
    const damagedVisibleWords = /\b(?:Danios?|Danos?|Campanas?|Anadir|Anade|Companias|Senales|Senas)\b/;
    const invalidFiles = sourceFiles.filter((path) => damagedVisibleWords.test(readFileSync(path, "utf8")));
    expect(invalidFiles).toEqual([]);
  });
});
