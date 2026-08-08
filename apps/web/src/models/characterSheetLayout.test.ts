import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("modular character sheet layout", () => {
  const baseStylesheet = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/modern.css"), "utf8");
  const component = readFileSync(resolve(process.cwd(), "src/components/UnifiedCharacterSheet.tsx"), "utf8");

  it("keeps separated desktop modules and an internally scrolling reader that chains at its edges", () => {
    expect(stylesheet).toMatch(/\.character-actions-page > \.unified-sheet\s*\{[\s\S]*?gap: 20px/);
    expect(stylesheet).toMatch(/\.unified-sheet-workspace\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader\.unified-sheet-stage\s*\{[\s\S]*?height: clamp\(620px,[\s\S]*?overflow: hidden/);
    expect(stylesheet).toMatch(/\.unified-sheet-reader \.unified-sheet-tab-content\s*\{[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: auto/);
  });

  it("keeps identity compact and places resources between identity and experience", () => {
    const heroStart = component.indexOf('<div className="unified-sheet-hero-main">');
    const identityEnd = component.indexOf("</section>", heroStart);
    const experienceStart = component.indexOf("unified-sheet-experience-module");

    expect(component).toContain('<div className="unified-sheet-top-grid">');
    expect(component).not.toContain("unified-sheet-controls-module");
    expect(component.indexOf("CharacterSheetBackgroundPicker", heroStart)).toBeLessThan(identityEnd);
    expect(component.indexOf("unified-sheet-builder-icon", experienceStart)).toBeGreaterThan(experienceStart);
    expect(stylesheet).toMatch(/\.unified-sheet-top-grid\s*\{[\s\S]*?grid-template-columns: minmax\(220px, 0\.8fr\) minmax\(0, 1\.7fr\) minmax\(190px, 0\.7fr\);[\s\S]*?justify-content: stretch/);
    expect(component).not.toContain('className="unified-sheet-portrait"');
    expect(stylesheet).toMatch(/\.unified-sheet-identity-module\s*\{[\s\S]*?min-height: 86px;[\s\S]*?align-self: start/);
    expect(stylesheet).toMatch(/\.unified-sheet-identity-module \.unified-sheet-hero-main\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
    expect(stylesheet).toMatch(/\.unified-sheet-experience-module \.unified-sheet-builder-icon\s*\{[\s\S]*?width: 46px;[\s\S]*?height: 46px/);
    expect(baseStylesheet).toMatch(/\.unified-sheet-xp-controls\s*\{[\s\S]*?flex-direction: column;[\s\S]*?align-items: flex-end/);
  });

  it("gives the content modules and reader sections independent ornamental frames", () => {
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-module\.campaign-sheet-card::before,[\s\S]*?::after\s*\{[\s\S]*?content: ""/);
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-module\.campaign-sheet-card::before\s*\{[\s\S]*?border-top: 3px solid var\(--ui-metal\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-module-title::after\s*\{[\s\S]*?linear-gradient\(90deg, var\(--ui-metal\), transparent\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip::before\s*\{[\s\S]*?rotate\(45deg\)/);
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-reader \.unified-sheet-panel > \.campaign-sheet-card\s*\{[\s\S]*?border: 1px solid[\s\S]*?border-radius: var\(--ui-radius-md\)/);
  });

  it("places resources in the header, attributes full-width and conditions beside combat", () => {
    const topGridStart = component.indexOf('className="unified-sheet-top-grid"');
    const resourcesStart = component.indexOf("unified-sheet-resources-module", topGridStart);
    const experienceStart = component.indexOf("unified-sheet-experience-module", topGridStart);
    const statusGridStart = component.indexOf('className="unified-sheet-status-grid"');

    expect(component).toContain('className="unified-sheet-status-grid"');
    expect(resourcesStart).toBeGreaterThan(topGridStart);
    expect(resourcesStart).toBeLessThan(experienceStart);
    expect(resourcesStart).toBeLessThan(statusGridStart);
    expect(component.indexOf("unified-sheet-attributes-module")).toBeLessThan(component.indexOf("unified-sheet-combat-module"));
    expect(component.indexOf("unified-sheet-combat-module")).toBeLessThan(component.indexOf("unified-sheet-conditions-module"));
    expect(component.indexOf("unified-sheet-combat-module")).toBeLessThan(component.indexOf("unified-sheet-workspace"));
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid\s*\{[\s\S]*?"attributes attributes attributes attributes attributes attributes attributes attributes"[\s\S]*?"combat combat combat combat combat conditions conditions conditions";[\s\S]*?grid-template-columns: repeat\(8, minmax\(0, 1fr\)\);[\s\S]*?gap: 20px 10px/);
    expect(stylesheet).toMatch(/@media \(max-width: 1300px\) and \(min-width: 901px\)[\s\S]*?"attributes attributes"[\s\S]*?"combat conditions";[\s\S]*?grid-template-columns: minmax\(0, 5fr\) minmax\(0, 3fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-top-grid > \.unified-sheet-resources-module \.unified-sheet-header-stats\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-header-stats\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\s*\{[\s\S]*?min-height: 82px;[\s\S]*?padding: 12px 14px;[\s\S]*?gap: 7px/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\s*\{[\s\S]*?linear-gradient\(180deg, color-mix\(in srgb, var\(--ui-metal-soft\) 46%, transparent\), transparent 42%\),[\s\S]*?var\(--ui-surface-muted\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-header span\s*\{[\s\S]*?font-size: 0\.68rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-actions\s*\{[\s\S]*?justify-content: space-between/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.vital-action\s*\{[\s\S]*?min-width: 74px;[\s\S]*?min-height: 31px/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-header-stats\s*\{[\s\S]*?height: 100%;[\s\S]*?align-self: stretch/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-rail\s*\{[\s\S]*?grid-template-columns: repeat\(8, minmax\(0, 1fr\)\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip\s*\{[\s\S]*?min-height: 106px;[\s\S]*?width: calc\(100% - 12px\);[\s\S]*?height: 106px;[\s\S]*?aspect-ratio: auto;[\s\S]*?justify-self: center/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip span\s*\{[\s\S]*?font-size: 0\.68rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip strong\s*\{[\s\S]*?font-size: 1\.55rem/);
    expect(stylesheet).toMatch(/\.unified-sheet-attributes-module \.unified-sheet-attribute-chip button\s*\{[\s\S]*?min-width: 58px;[\s\S]*?min-height: 32px/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-combat-module \.unified-sheet-quick-row\.is-combat-values\s*\{[\s\S]*?width: calc\(100% \+ 13\.5px\);[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?grid-template-rows: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/@media \(max-width: 1300px\) and \(min-width: 901px\)[\s\S]*?\.unified-sheet-status-grid \.unified-sheet-combat-module \.unified-sheet-quick-row\.is-combat-values\s*\{[\s\S]*?width: calc\(100% \+ 22\.25px\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-combat-module \.unified-sheet-quick-card\s*\{[\s\S]*?min-height: 106px;[\s\S]*?width: calc\(100% - 12px\);[\s\S]*?height: 106px;[\s\S]*?aspect-ratio: auto;[\s\S]*?justify-self: center/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-combat-module \.vital-action\s*\{[\s\S]*?min-width: 70px;[\s\S]*?min-height: 32px/);
    expect(stylesheet).toMatch(/\.unified-sheet-status-grid \.unified-sheet-conditions-module\s*\{[\s\S]*?grid-area: conditions/);
    expect(component).not.toContain("unified-sheet-combat-derived");
  });

  it("removes the status and resources frames while preserving an opaque action reader", () => {
    expect(stylesheet).toMatch(/\.unified-sheet \.unified-sheet-status-grid > \.unified-sheet-module\.campaign-sheet-card\s*\{[\s\S]*?border: 0;[\s\S]*?box-shadow: none/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\] \.unified-sheet \.unified-sheet-status-grid > \.unified-sheet-module\.campaign-sheet-card\s*\{[\s\S]*?background: transparent/);
    expect(stylesheet).toMatch(/:root \.unified-sheet \.unified-sheet-top-grid > \.unified-sheet-resources-module\.campaign-sheet-card\s*\{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module\.campaign-sheet-card::before,[\s\S]*?\.unified-sheet-resources-module\.campaign-sheet-card::after\s*\{[\s\S]*?display: none/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\]\[data-theme="light"\] \.unified-sheet-persistent,[\s\S]*?\.unified-sheet-stage,[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 93%, transparent\)/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\]\[data-theme="light"\] \.unified-sheet-resources-module \.unified-sheet-vital-card\s*\{[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 96%, transparent\)/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\]\[data-theme="dark"\] \.unified-sheet-resources-module \.unified-sheet-vital-card\s*\{[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 94%, transparent\)/);
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

  it("differentiates the secondary navigation without moving it away from the main tabs", () => {
    expect(component).toMatch(/<nav className="unified-sheet-tabs"[\s\S]*?stageActiveTab === "actions"[\s\S]*?unified-sheet-stage-subtabs is-actions/);
    expect(stylesheet).toMatch(/> \.unified-sheet-stage-subtabs\s*\{[\s\S]*?padding: 6px;[\s\S]*?border: 1px solid var\(--ui-border\);[\s\S]*?border-radius: var\(--ui-radius-md\);[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface-muted\)/);
    expect(stylesheet).toMatch(/> \.unified-sheet-stage-subtabs button\s*\{[\s\S]*?border-radius: 999px;[\s\S]*?background: var\(--ui-surface\)/);
    expect(stylesheet).toMatch(/> \.unified-sheet-stage-subtabs button\.is-active\s*\{[\s\S]*?color: var\(--ui-on-brand\);[\s\S]*?background: var\(--ui-brand\)/);
  });
});
