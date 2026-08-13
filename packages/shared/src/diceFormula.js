const EFFECT_DIE_SIDES = [4, 6, 8, 10, 12];
function formatSignedInteger(value) {
    return value > 0 ? `+${value}` : value < 0 ? String(value) : "";
}
function addFlatBonus(remainder, bonus) {
    if (bonus === 0)
        return remainder;
    const terms = remainder.match(/[+-](?:\d*d\d+|\d+)/g) ?? [];
    let flatIndex = -1;
    for (let index = terms.length - 1; index >= 0; index -= 1) {
        if (/^[+-]\d+$/.test(terms[index])) {
            flatIndex = index;
            break;
        }
    }
    if (flatIndex < 0) {
        return `${remainder}${formatSignedInteger(bonus)}`;
    }
    const nextValue = Number(terms[flatIndex]) + bonus;
    if (nextValue === 0) {
        terms.splice(flatIndex, 1);
    }
    else {
        terms[flatIndex] = formatSignedInteger(nextValue);
    }
    return terms.join("");
}
/**
 * Raises the primary Symbaroum effect die while preserving every additional
 * die and flat modifier. Improvements beyond d12 become cumulative +1 bonuses.
 */
export function increaseEffectDieFormula(formula, steps = 1) {
    const normalized = String(formula ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const match = /^(\d*)d(4|6|8|10|12)((?:[+-](?:\d*d\d+|\d+))*)$/.exec(normalized);
    if (!match)
        return null;
    const normalizedSteps = Math.max(0, Math.trunc(steps));
    const count = Number(match[1] || 1);
    let sides = Number(match[2]);
    let remainder = match[3] ?? "";
    if (!Number.isFinite(count) || count < 1)
        return null;
    for (let index = 0; index < normalizedSteps; index += 1) {
        const dieIndex = EFFECT_DIE_SIDES.indexOf(sides);
        if (dieIndex < 0)
            return null;
        if (dieIndex === EFFECT_DIE_SIDES.length - 1) {
            remainder = addFlatBonus(remainder, 1);
        }
        else {
            sides = EFFECT_DIE_SIDES[dieIndex + 1];
        }
    }
    return `${count}d${sides}${remainder}`;
}
