import { ATTRIBUTE_LABELS } from "@umbra/shared";
function isIntegratedDamageModifier(action) {
    return action.sourceType !== "weapon"
        && !action.rollAttribute
        && String(action.damageFormula ?? "").trim().startsWith("+");
}
export function getCharacterActionRollPresentation(action, sheet) {
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
