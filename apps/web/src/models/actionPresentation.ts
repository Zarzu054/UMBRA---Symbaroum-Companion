import { ATTRIBUTE_LABELS, type CharacterActionDefinition, type CharacterSheet } from "@umbra/shared";

export type CharacterActionRollPresentation = {
  attackFormula?: string;
  damageFormula?: string;
  hasDamageModifiers: boolean;
  hasRoll: boolean;
};

function isIntegratedDamageModifier(action: CharacterActionDefinition): boolean {
  return action.sourceType !== "weapon"
    && !action.rollAttribute
    && String(action.damageFormula ?? "").trim().startsWith("+");
}

export function getCharacterActionRollPresentation(
  action: CharacterActionDefinition,
  sheet: CharacterSheet
): CharacterActionRollPresentation {
  const attackFormula = action.rollAttribute
    ? `1d20 ≤ ${ATTRIBUTE_LABELS[action.rollAttribute]} ${action.fixedTarget ?? sheet.atributos[action.rollAttribute]}`
    : undefined;
  const damageFormula = action.damageFormula && !isIntegratedDamageModifier(action)
    ? action.damageFormula
    : undefined;

  return {
    attackFormula,
    damageFormula,
    hasDamageModifiers: Boolean(action.damageModifiers?.length),
    hasRoll: Boolean(attackFormula || damageFormula)
  };
}
