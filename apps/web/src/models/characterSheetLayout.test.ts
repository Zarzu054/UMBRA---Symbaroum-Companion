import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("modular character sheet layout", () => {
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/modern.css"), "utf8");

  it("keeps separated desktop modules and an internally scrolling reader", () => {
    expect(stylesheet).toMatch(/\.character-actions-page > \.unified-sheet\s*\{[\s\S]*?gap: 14px/);
    expect(stylesheet).toMatch(/\.unified-sheet-workspace\s*\{[\s\S]*?grid-template-columns: minmax\(300px, 34%\) minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader\.unified-sheet-stage\s*\{[\s\S]*?height: clamp\(620px,[\s\S]*?overflow: hidden/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader \.unified-sheet-tab-content\s*\{[\s\S]*?overflow-y: auto/);
  });

  it("returns the reader to natural page flow on mobile", () => {
    const mobileStart = stylesheet.lastIndexOf("@media (max-width: 900px)");
    const mobileEnd = stylesheet.indexOf("@media (max-width: 600px)", mobileStart);
    const mobileRules = stylesheet.slice(mobileStart, mobileEnd);
    expect(mobileRules).toContain(".unified-sheet-reader.unified-sheet-stage");
    expect(mobileRules).toMatch(/height: auto;[\s\S]*?overflow: visible/);
    expect(mobileRules).toContain(".unified-sheet.is-mobile-tab-attributes .unified-sheet-reader");
  });
});
