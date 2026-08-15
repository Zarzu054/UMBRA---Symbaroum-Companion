import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  const normalized = value.replace(/^#/, "");
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as Rgb;
}

function luminance([red, green, blue]: Rgb): number {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(parseHex(foreground));
  const second = luminance(parseHex(background));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function token(block: string, name: string): string {
  const value = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`No se encontró ${name}`);
  return value;
}

describe("component contrast contracts", () => {
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/modern.css"), "utf8");
  const lightTokens = stylesheet.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
  const darkTokens = stylesheet.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? "";

  for (const [theme, block] of [["light", lightTokens], ["dark", darkTokens]] as const) {
    it(`${theme} semantic labels remain readable on their soft surfaces`, () => {
      for (const semantic of ["danger", "warning", "success", "info"] as const) {
        expect(contrast(token(block, `--ui-${semantic}`), token(block, `--ui-${semantic}-soft`))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("protects nested button labels and disabled controls from legacy colors", () => {
    expect(stylesheet).toContain("button > :is(span, strong, small)");
    expect(stylesheet).toMatch(/\.campaign-burden-summary-button > strong\s*\{[\s\S]*?color: var\(--ui-brand-strong\) !important/);
    expect(stylesheet).toMatch(/button, \.file-trigger\)\[disabled\][\s\S]*?color: var\(--ui-text-muted\) !important/);
    expect(stylesheet).toMatch(/\.campaign-action-roll-button\s*\{[\s\S]*?color: var\(--ui-on-brand\)/);
    expect(stylesheet).toMatch(/\.campaign-action-roll-button > :is\(span, strong\)[\s\S]*?color: inherit !important/);
    expect(stylesheet).toMatch(/\.vital-action\.subtle[\s\S]*?color: var\(--ui-brand-strong\)/);
  });

  it("keeps the mobile character-sheet back button legible over illustrated backgrounds", () => {
    expect(stylesheet).toMatch(/\.app-context-navigation \.character-sheet-back-button[\s\S]*?color: #fffaf5;[\s\S]*?background: #4d2023/);
    expect(contrast("#fffaf5", "#4d2023")).toBeGreaterThanOrEqual(4.5);
  });

  it("makes the active character-creation step stronger than inactive steps", () => {
    expect(stylesheet).toMatch(/\.actor-wizard__steps button\s*\{[\s\S]*?color: var\(--ui-text-muted\);[\s\S]*?background: var\(--ui-surface\)/);
    expect(stylesheet).toMatch(/\.actor-wizard__steps button\.is-active,[\s\S]*?\.actor-wizard__steps button\.is-active:hover\s*\{[\s\S]*?color: var\(--ui-on-brand\);[\s\S]*?background: var\(--ui-brand\);[\s\S]*?font-weight: 800/);
    for (const palette of ["ambria", "davokar", "corruption"] as const) {
      for (const theme of ["light", "dark"] as const) {
        const block = stylesheet.match(new RegExp(`:root\\[data-palette="${palette}"\\]\\[data-theme="${theme}"\\][^\\{]*\\{([^}]+)\\}`))?.[1] ?? "";
        expect(contrast(token(block, "--ui-on-brand"), token(block, "--ui-brand"))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps compact PX purchases and the current level theme-aware", () => {
    expect(stylesheet).toMatch(/\.character-builder-entry-trigger:hover,[\s\S]*?color: var\(--ui-text\);[\s\S]*?background: var\(--ui-surface-hover\);[\s\S]*?box-shadow: inset 0 0 0 2px var\(--ui-focus\)/);
    expect(stylesheet).toMatch(/\.character-builder-entry-level,[\s\S]*?color: var\(--ui-text-muted\)/);
    expect(stylesheet).toMatch(/\.character-builder-capability-tier\.is-current\s*\{[\s\S]*?border-color: var\(--ui-brand\);[\s\S]*?background: var\(--ui-brand-soft\)/);
  });

  it("keeps wiki references prominent and contrast-safe in notes", () => {
    expect(stylesheet).toMatch(/\.compendium-highlight,[\s\S]*?\.campaign-shared-notes-modal \.compendium-tags \.compendium-chip\s*\{[\s\S]*?color: var\(--ui-brand-strong\);[\s\S]*?background: var\(--ui-brand-soft\)/);
    expect(stylesheet).toMatch(/\.compendium-highlight-button:hover,[\s\S]*?\.compendium-highlight-button:focus-visible,[\s\S]*?color: var\(--ui-on-brand\);[\s\S]*?background: var\(--ui-brand\)/);
  });

  it("keeps inactive monster tabs readable in every theme", () => {
    expect(stylesheet).toMatch(/\.monster-catalog-tabs button\s*\{[\s\S]*?color: var\(--ui-text-muted\);[\s\S]*?background: transparent/);
    expect(stylesheet).toMatch(/\.monster-catalog-tabs button:hover\s*\{[\s\S]*?color: var\(--ui-text\);[\s\S]*?background: var\(--ui-surface-hover\)/);
    expect(stylesheet).toMatch(/\.monster-catalog-tabs button\.is-active\s*\{[\s\S]*?color: var\(--ui-brand-strong\);[\s\S]*?background: var\(--ui-brand-soft\)/);
    expect(stylesheet).toMatch(/\.compendium-mode-switch,\s*\.monster-catalog-tabs\s*\) button \{/);
  });

  it("uses theme-aware, readable colors for every character resource and its track", () => {
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\.is-health \.unified-sheet-vital-header[\s\S]*?color: var\(--ui-success\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module\s*\{[\s\S]*?--sheet-temporary-corruption: #6d3fa3;[\s\S]*?--sheet-permanent-corruption: #171411/);
    expect(stylesheet).toMatch(/:root\[data-theme="dark"\] \.unified-sheet-resources-module\s*\{[\s\S]*?--sheet-temporary-corruption: #d8b9ff;[\s\S]*?--sheet-permanent-corruption: #f4f1ed/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\.is-corruption \.unified-sheet-vital-header[\s\S]*?color: var\(--sheet-temporary-corruption\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-card\.is-corruption-deep \.unified-sheet-vital-header[\s\S]*?color: var\(--sheet-permanent-corruption\)/);
    expect(stylesheet).toMatch(/\.unified-sheet-resources-module \.unified-sheet-vital-track\s*\{[\s\S]*?border: 1px solid var\(--ui-border-strong\)/);
    expect(stylesheet).toMatch(/\.is-corruption-deep \.unified-sheet-vital-track > div[\s\S]*?background: var\(--sheet-permanent-corruption\)/);
    expect(contrast("#6d3fa3", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#171411", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#d8b9ff", "#181614")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#f4f1ed", "#181614")).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the softer corner scale throughout primary surfaces and navigation", () => {
    expect(lightTokens).toContain("--ui-radius-sm: 8px");
    expect(lightTokens).toContain("--ui-radius-md: 14px");
    expect(lightTokens).toContain("--ui-radius-lg: 20px");
    expect(stylesheet).toMatch(/\.app-primary-navigation button\s*\{[\s\S]*?border-radius: var\(--ui-radius-sm\)/);
    expect(stylesheet).toMatch(/\.character-builder-tabs button,[\s\S]*?border-radius: var\(--ui-radius-sm\) var\(--ui-radius-sm\) 0 0/);
  });

  it("keeps compendium entry colors visible on cards, diamonds and results", () => {
    for (const type of ["regla", "habilidad", "poder_mistico", "ritual", "tradicion", "profesion", "raza", "cultura", "arquetipo", "bendicion", "carga", "rasgo"]) {
      expect(stylesheet).toContain(`.compendium-library .app-card-accent--${type}`);
    }
    expect(stylesheet).toMatch(/\.compendium-section-card\.app-card-accent[\s\S]*?border-left: 6px solid var\(--app-card-accent-color\)/);
    expect(stylesheet).toMatch(/\.compendium-section-card\.app-card-accent \.compendium-section-card-ornament[\s\S]*?border: 2px solid var\(--app-card-accent-color\)/);
    expect(stylesheet).toMatch(/\.compendium-result-card\.app-card-accent[\s\S]*?border-left: 6px solid var\(--app-card-accent-color\)/);
  });

  it("keeps compact module controls below the persistent global navigation", () => {
    expect(stylesheet).toMatch(/--app-top-navigation-height: 64px/);
    expect(stylesheet).toMatch(/\.module-sticky-header\s*\{[\s\S]*?position: sticky;[\s\S]*?top: var\(--app-top-navigation-height\);[\s\S]*?z-index: 90/);
    expect(stylesheet).toMatch(/\.character-builder-sticky-controls\s*\{[\s\S]*?position: sticky;[\s\S]*?top: var\(--app-top-navigation-height\);[\s\S]*?z-index: 90/);
    expect(stylesheet).toMatch(/\.character-builder-sticky-controls > \.character-builder-tabs\s*\{[\s\S]*?overflow-x: auto/);
    expect(stylesheet).toMatch(/\.campaign-module-header:not\(\.module-sticky-header--single-row\)[\s\S]*?--campaign-module-header-height/);
    expect(stylesheet).toMatch(/\.campaign-module-header \.campaign-section-nav\s*\{[\s\S]*?overflow-x: auto/);
    expect(stylesheet).toMatch(/@media \(width <= 900px\)[\s\S]*?--app-top-navigation-height: 58px/);
  });

  it("integrates the mobile character archive header without an outer sheet card", () => {
    expect(stylesheet).toMatch(/\.character-directory-page\.unified-sheet\s*\{[\s\S]*?gap: 16px;[\s\S]*?overflow: visible/);
    expect(stylesheet).toMatch(/\.character-directory-header-band\.module-sticky-header\s*\{[\s\S]*?top: var\(--app-top-navigation-height\);[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    expect(stylesheet).toMatch(/\.character-directory-header-actions\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible/);
  });

  it("lets the character action menu escape short directory cards", () => {
    expect(stylesheet).toMatch(/\.module-theme \.character-directory-panel\.campaign-sheet-card,[\s\S]*?\.character-record-grid\s*\{[\s\S]*?overflow: visible/);
    expect(stylesheet).toMatch(/\.character-record-card:only-child\s*\{[\s\S]*?border-radius: var\(--ui-radius-md\)/);
    expect(stylesheet).toMatch(/\.character-record-actions-menu\[open\]\s*\{[\s\S]*?z-index: 50/);
    expect(stylesheet).toMatch(/\.character-record-secondary-actions\s*\{[\s\S]*?position: absolute;[\s\S]*?top: calc\(100% \+ 6px\)/);
  });

  it("lets the global-search dropdown escape its panel and scroll independently", () => {
    expect(stylesheet).toMatch(/\.module-theme \.panel\.compendium-library-hero\s*\{[\s\S]*?overflow: visible/);
    expect(stylesheet).toMatch(/\.compendium-quick-search-results\s*\{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden/);
    expect(stylesheet).toMatch(/\.compendium-quick-search-list\s*\{[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain/);
    expect(stylesheet).toMatch(/\.compendium-quick-search-results\.is-portal\s*\{[\s\S]*?position: fixed/);
    expect(stylesheet).toMatch(/\.compendium-quick-search-results\.is-portal\.has-four-results\s*\{[\s\S]*?min-height: min\(230px/);
  });

  it("keeps modal backdrops above navigation and inside the viewport", () => {
    expect(lightTokens).toContain("--ui-z-modal: 1000");
    expect(stylesheet).toMatch(/\.modal-backdrop,[\s\S]*?z-index: var\(--ui-z-modal\)/);
    expect(stylesheet).toMatch(/\.modal-panel,[\s\S]*?max-height: calc\(100dvh - max\(36px/);
    expect(stylesheet).toMatch(/\.character-sheet-background-backdrop\s*\{[\s\S]*?z-index: var\(--ui-z-modal\)/);
  });

  it("shows the shared illustration in combat without sacrificing card readability", () => {
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\] body\s*\{[\s\S]*?var\(--character-sheet-background-image\)[\s\S]*?cover fixed no-repeat/);
    expect(stylesheet).not.toMatch(/:root\[data-character-sheet-background\] \.campaign-combat\s*\{/);
    expect(stylesheet).toMatch(/:root\[data-character-sheet-background\] \.campaign-combat :is\(\.campaign-combat-toolbar, \.campaign-combat-card, \.campaign-combat-empty\)\s*\{[\s\S]*?background: color-mix\(in srgb, var\(--ui-surface\) 92%, transparent\);[\s\S]*?backdrop-filter: blur/);
    expect(stylesheet).toMatch(/\.campaign-combat-resource-track strong\s*\{[\s\S]*?color: #fff;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;[\s\S]*?text-shadow:/);
    expect(stylesheet).not.toContain("body:has(.module-theme--monsters)");
  });
});
