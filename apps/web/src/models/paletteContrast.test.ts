import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  const normalized = value.trim().replace(/^#/, "");
  if (normalized.length !== 6) throw new Error(`Color no compatible: ${value}`);
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

function composite(foreground: string, background: string, opacity: number): string {
  const front = parseHex(foreground);
  const back = parseHex(background);
  const mixed = front.map((channel, index) => Math.round(channel * opacity + back[index]! * (1 - opacity)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

describe("palette contrast", () => {
  const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/modern.css"), "utf8");
  const lightSemanticTokens = stylesheet.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
  const darkSemanticTokens = stylesheet.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)?.[1] ?? "";

  for (const palette of ["davokar", "corruption", "ambria"] as const) {
    for (const theme of ["light", "dark"] as const) {
      it(`${palette} ${theme} keeps primary text and controls at WCAG AA`, () => {
        const selector = `:root\\[data-palette="${palette}"\\]\\[data-theme="${theme}"\\]`;
        const block = stylesheet.match(new RegExp(`${selector}[^\\{]*\\{([^}]+)\\}`))?.[1];
        expect(block).toBeDefined();
        const token = (name: string) => {
          const value = block?.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
          if (!value) throw new Error(`No se encontró ${name} para ${palette} ${theme}`);
          return value;
        };

        expect(contrast(token("--ui-text"), token("--ui-surface"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-text"), token("--ui-canvas"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-text-muted"), token("--ui-surface"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-text-muted"), token("--ui-surface-muted"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-on-brand"), token("--ui-brand"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-on-brand-strong"), token("--ui-brand-strong"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-brand-strong"), token("--ui-brand-soft"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-focus"), token("--ui-surface"))).toBeGreaterThanOrEqual(3);

        const semanticBlock = theme === "light" ? lightSemanticTokens : darkSemanticTokens;
        const semanticToken = (name: string) => {
          const value = semanticBlock.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
          if (!value) throw new Error(`No se encontró ${name} para el tema ${theme}`);
          return value;
        };
        expect(contrast(semanticToken("--ui-success"), token("--ui-surface"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(token("--ui-corruption"), token("--ui-surface"))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(semanticToken("--ui-danger"), token("--ui-surface"))).toBeGreaterThanOrEqual(4.5);

        const illustratedPanel = theme === "light"
          ? composite(token("--ui-surface"), "#000000", 0.93)
          : composite(token("--ui-surface"), "#ffffff", 0.9);
        expect(contrast(token("--ui-text"), illustratedPanel)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
