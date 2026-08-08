import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("modular character sheet layout", () => {
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/modern.css"), "utf8");
  const component = readFileSync(resolve(process.cwd(), "src/components/UnifiedCharacterSheet.tsx"), "utf8");

  it("keeps separated desktop modules and an internally scrolling reader", () => {
    expect(stylesheet).toMatch(/\.character-actions-page > \.unified-sheet\s*\{[\s\S]*?gap: 20px/);
    expect(stylesheet).toMatch(/\.unified-sheet-workspace\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader\.unified-sheet-stage\s*\{[\s\S]*?height: clamp\(620px,[\s\S]*?overflow: hidden/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader \.unified-sheet-tab-content\s*\{[\s\S]*?overflow-y: auto/);
  });

  it("keeps identity compact and distributes sheet actions between identity and experience", () => {
    const heroStart = component.indexOf('<div className="unified-sheet-hero-main">');
    const identityEnd = component.indexOf("</section>", heroStart);
    const experienceStart = component.indexOf("unified-sheet-experience-module");

    expect(component).toContain('<div className="unified-sheet-top-grid">');
    expect(component).not.toContain("unified-sheet-controls-module");
    expect(component.indexOf("CharacterSheetBackgroundPicker", heroStart)).toBeLessThan(identityEnd);
    expect(component.indexOf("unified-sheet-builder-icon", experienceStart)).toBeGreaterThan(experienceStart);
    expect(stylesheet).toMatch(/\.unified-sheet-top-grid\s*\{[\s\S]*?grid-template-columns: minmax\(260px, 320px\) minmax\(200px, 230px\);[\s\S]*?justify-content: space-between/);
    expect(stylesheet).toMatch(/\.unified-sheet-identity-module \.unified-sheet-hero-main\s*\{[\s\S]*?grid-template-columns: 54px minmax\(0, 1fr\) auto/);
    expect(stylesheet).toMatch(/\.unified-sheet-experience-module \.unified-sheet-builder-icon\s*\{[\s\S]*?width: 46px;[\s\S]*?height: 46px/);
  });

  it("gives the content modules and reader sections independent ornamental frames", () => {
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-module\.campaign-sheet-card::before,[\s\S]*?::after\s*\{[\s\S]*?content: ""/);
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-module\.campaign-sheet-card::before\s*\{[\s\S]*?border-top: 3px solid var\(--ui-metal\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-module-title::after\s*\{[\s\S]*?linear-gradient\(90deg, var\(--ui-metal\), transparent\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip::before\s*\{[\s\S]*?rotate\(45deg\)/);
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-reader \.unified-sheet-panel > \.campaign-sheet-card\s*\{[\s\S]*?border: 1px solid[\s\S]*?border-radius: var\(--ui-radius-md\)/);
  });

  it("places resources beside attributes and a single combat row underneath", () => {
    expect(component).toContain('className="unified-sheet-status-grid"');
    expect(component.indexOf("unified-sheet-resources-module")).toBeLessThan(component.indexOf("unified-sheet-attributes-module"));
    expect(component.indexOf("unified-sheet-attributes-module")).toBeLessThan(component.indexOf("unified-sheet-combat-module"));
    expect(component.indexOf("unified-sheet-combat-module")).toBeLessThan(component.indexOf("unified-sheet-conditions-module"));
    expect(component.indexOf("unified-sheet-combat-module")).toBeLessThan(component.indexOf("unified-sheet-workspace"));
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid\s*\{[\s\S]*?"resources \. attributes attributes attributes attributes attributes attributes attributes attributes"[\s\S]*?"resources \. combat combat combat combat combat conditions conditions conditions";[\s\S]*?grid-template-columns: minmax\(260px, 290px\) 0 repeat\(8, minmax\(0, 1fr\)\);[\s\S]*?gap: 20px 10px/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-header-stats\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\s*\{[\s\S]*?min-height: 82px;[\s\S]*?padding: 12px 14px;[\s\S]*?gap: 7px/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-header span\s*\{[\s\S]*?font-size: 0\.68rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-actions\s*\{[\s\S]*?justify-content: space-between/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.vital-action\s*\{[\s\S]*?min-width: 74px;[\s\S]*?min-height: 31px/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-header-stats\s*\{[\s\S]*?height: 100%;[\s\S]*?align-self: stretch/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-rail\s*\{[\s\S]*?grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip\s*\{[\s\S]*?aspect-ratio: 1/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip span\s*\{[\s\S]*?font-size: 0\.68rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip strong\s*\{[\s\S]*?font-size: 1\.55rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-combat-module \.unified-sheet-quick-row\.is-combat-values\s*\{[\s\S]*?width: calc\(100% \+ 13\.5px\);[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-combat-module \.unified-sheet-quick-card\s*\{[\s\S]*?width: calc\(100% - 8px\);[\s\S]*?aspect-ratio: 1;[\s\S]*?justify-self: center/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-conditions-module\s*\{[\s\S]*?grid-area: conditions/);
    expect(component).not.toContain("unified-sheet-combat-derived");
  });

  it("removes only the status-zone frames while preserving an opaque action reader", () => {
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-status-grid > \.unified-sheet-module\.campaign-sheet-card\s*\{[\s\S]*?border: 0;[\s\S]*?box-shadow: none/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\] \.unified-sheet \.unified-sheet-status-grid > \.unified-sheet-module\.campaign-sheet-card\s*\{[\s\S]*?background: transparent/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\]\[data-theme="light"\] \.unified-sheet-persistent,[\s\S]*?\.unified-sheet-stage,[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 93%, transparent\)/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\]\[data-theme="dark"\] \.unified-sheet-status-grid :is\([\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 94%, transparent\)/);
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
