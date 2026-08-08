import { mysticArtifactDefinitionInputSchema } from "@umbra/shared";
import { describe, expect, it } from "vitest";
import { isUntouchedLegacyArtifactCopy, MYSTIC_ARTIFACT_CATALOG_VERSION, MYSTIC_ARTIFACT_PRESETS } from "./mysticArtifactPresets.js";

describe("mystic artifact preset catalog", () => {
  it("uses a versioned set of stable unique identifiers suitable for idempotent upserts", () => {
    expect(MYSTIC_ARTIFACT_CATALOG_VERSION).toBeGreaterThan(0);
    expect(MYSTIC_ARTIFACT_PRESETS.length).toBeGreaterThan(40);
    expect(new Set(MYSTIC_ARTIFACT_PRESETS.map((entry) => entry.id)).size).toBe(MYSTIC_ARTIFACT_PRESETS.length);
    expect(new Set(MYSTIC_ARTIFACT_PRESETS.map((entry) => entry.slug)).size).toBe(MYSTIC_ARTIFACT_PRESETS.length);
  });

  it("validates every deeply cloneable artifact definition", () => {
    for (const preset of MYSTIC_ARTIFACT_PRESETS) {
      expect(() => mysticArtifactDefinitionInputSchema.parse(preset.artifact), preset.slug).not.toThrow();
    }
  });

  it("contains complete descriptions instead of source-reference placeholders", () => {
    for (const preset of MYSTIC_ARTIFACT_PRESETS) {
      expect(preset.artifact.description.trim().length, preset.slug).toBeGreaterThan(40);
      expect(preset.artifact.description, preset.slug).not.toMatch(/descrit[oa] en .*página/i);
      for (const ability of preset.artifact.abilities) {
        expect(ability.description.trim().length, `${preset.slug}/${ability.name}`).toBeGreaterThan(30);
        expect(ability.description, `${preset.slug}/${ability.name}`).not.toMatch(/^Capacidad de /i);
      }
    }
  });

  it("keeps every compact catalog ability aligned with its reviewed description", () => {
    const incomplete = MYSTIC_ARTIFACT_PRESETS.filter((preset) => preset.artifact.abilities.some((ability) => !ability.description));
    expect(incomplete).toEqual([]);
  });

  it("only refreshes campaign copies whose artifact and abilities still contain legacy placeholders", () => {
    expect(isUntouchedLegacyArtifactCopy(
      "Artefacto místico vinculable descrito en La corona de cobre, página 68.",
      ["Capacidad de Parcabrasa descrita en La corona de cobre, página 68."]
    )).toBe(true);
    expect(isUntouchedLegacyArtifactCopy(
      "Descripción personalizada por el DJ.",
      ["Capacidad de Parcabrasa descrita en La corona de cobre, página 68."]
    )).toBe(false);
    expect(isUntouchedLegacyArtifactCopy(
      "Artefacto místico vinculable descrito en La corona de cobre, página 68.",
      ["Habilidad personalizada por el DJ."]
    )).toBe(false);
  });
});
