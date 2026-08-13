import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSkillLevelLabel,
  replaceLegacySkillLevelTerminology,
  skillLevelSchema
} from "../dist/index.js";

test("usa Principiante como nivel canónico y visible", () => {
  assert.equal(formatSkillLevelLabel("principiante"), "Principiante");
  assert.equal(formatSkillLevelLabel("adepto"), "Adepto");
  assert.equal(formatSkillLevelLabel("maestro"), "Maestro");
  assert.equal(skillLevelSchema.parse("principiante"), "principiante");
});

test("normaliza datos de clientes antiguos durante la transición", () => {
  assert.equal(skillLevelSchema.parse("novato"), "principiante");
  assert.equal(
    replaceLegacySkillLevelTerminology("Nivel novato; dos novatas y tres novatos"),
    "Nivel Principiante; dos Principiantes y tres Principiantes"
  );
});
