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
    expect(stylesheet).toMatch(/button, \.file-trigger\)\[disabled\][\s\S]*?color: var\(--ui-text-muted\) !important/);
    expect(stylesheet).toMatch(/\.campaign-action-roll-button\s*\{[\s\S]*?color: var\(--ui-on-brand\)/);
    expect(stylesheet).toMatch(/\.campaign-action-roll-button > :is\(span, strong\)[\s\S]*?color: inherit !important/);
    expect(stylesheet).toMatch(/\.vital-action\.subtle[\s\S]*?color: var\(--ui-brand-strong\)/);
  });
});
