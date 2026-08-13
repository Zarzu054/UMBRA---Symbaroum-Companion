const TRAIT_LEVEL_REGEX = /(?:\(|\b)(i{1,3}|1|2|3)(?:\)|\b)/i;
function normalizeTraitName(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function extractTraitLevel(value) {
    const normalizedValue = normalizeTraitName(value);
    if (/\bmaestro\b/.test(normalizedValue))
        return 3;
    if (/\badepto\b/.test(normalizedValue))
        return 2;
    if (/\b(?:principiante)\b/.test(normalizedValue))
        return 1;
    const match = String(value ?? "").match(TRAIT_LEVEL_REGEX);
    const raw = normalizeTraitName(match?.[1] ?? "");
    if (raw === "iii" || raw === "3")
        return 3;
    if (raw === "ii" || raw === "2")
        return 2;
    if (raw === "i" || raw === "1")
        return 1;
    return 1;
}
function getTraitAliasMatches(normalized, aliases) {
    return aliases.some((alias) => normalized.startsWith(alias));
}
export function getMonsterTraitLevel(traits, aliases) {
    let highest = 0;
    for (const trait of traits) {
        const normalized = normalizeTraitName(trait);
        if (!getTraitAliasMatches(normalized, aliases))
            continue;
        highest = Math.max(highest, extractTraitLevel(trait));
    }
    return highest;
}
function getCharacterTraitSources(sheet) {
    return [
        ...(sheet.habilidades ?? []).map((entry) => `${entry.nombre} ${entry.nivel ?? ""}`.trim()),
        ...(sheet.rasgos ?? []),
        ...String(sheet.noteSections?.traits ?? "")
            .split(/[,\n;]/)
            .map((entry) => entry.trim())
            .filter(Boolean)
    ];
}
function getRecioMultiplier(level) {
    switch (level) {
        case 3:
            return 3;
        case 2:
            return 2;
        case 1:
            return 1.5;
        default:
            return 1;
    }
}
function getDuroCharacterArmor(level) {
    switch (level) {
        case 3:
            return "1d8";
        case 2:
            return "1d6";
        case 1:
            return "1d4";
        default:
            return "";
    }
}
function getRobustoCharacterArmor(level) {
    switch (level) {
        case 3:
            return "1d8";
        case 2:
            return "1d6";
        case 1:
            return "1d4";
        default:
            return "";
    }
}
function combineArmorFormulas(...formulas) {
    return formulas.map((formula) => String(formula ?? "").trim()).filter(Boolean).join("+");
}
function getDuroMonsterArmor(level) {
    switch (level) {
        case 3:
            return "4";
        case 2:
            return "3";
        case 1:
            return "2";
        default:
            return "";
    }
}
function getRobustoDefensePenalty(level) {
    switch (level) {
        case 3:
            return 4;
        case 2:
            return 3;
        case 1:
            return 2;
        default:
            return 0;
    }
}
function formatSignedNumber(value) {
    if (value > 0)
        return `+${value}`;
    return String(value);
}
function parseSignedNumber(value) {
    const normalized = String(value ?? "").trim().replace(/[−–—]/g, "-");
    if (!/^[+-]?\d+$/.test(normalized))
        return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
export function getCharacterMonsterTraitEffects(sheet) {
    const traits = getCharacterTraitSources(sheet);
    const recioLevel = getMonsterTraitLevel(traits, ["recio"]);
    const duroLevel = getMonsterTraitLevel(traits, ["duro"]);
    const robustoLevel = getMonsterTraitLevel(traits, ["robusto", "robusta"]);
    const robustezBase = Number(sheet.atributos?.fuerte ?? 0);
    const robustezMaxima = Math.max(10, Math.floor(robustezBase * getRecioMultiplier(recioLevel)));
    return {
        recioLevel,
        duroLevel,
        robustoLevel,
        robustezBase,
        robustezMaxima,
        armorFormula: combineArmorFormulas(getDuroCharacterArmor(duroLevel), getRobustoCharacterArmor(robustoLevel)),
        defenseModifier: getRobustoDefensePenalty(robustoLevel)
    };
}
export function getDerivedMonsterSheetStats(sheet) {
    const recioLevel = getMonsterTraitLevel(sheet.traits ?? [], ["recio"]);
    const duroLevel = getMonsterTraitLevel(sheet.traits ?? [], ["duro"]);
    const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
    const strong = Number(sheet.attributes?.strong ?? 0);
    const quick = Number(sheet.attributes?.quick ?? 0);
    const explicitToughness = parseSignedNumber(sheet.toughness);
    const explicitArmor = parseSignedNumber(sheet.armor);
    const derivedToughness = Math.max(0, Math.floor(strong * getRecioMultiplier(recioLevel) || strong));
    const derivedArmor = duroLevel > 0 ? getDuroMonsterArmor(duroLevel) : sheet.armor;
    const derivedDefense = formatSignedNumber(10 - quick + getRobustoDefensePenalty(robustoLevel));
    return {
        toughness: recioLevel > 0 ? String(derivedToughness) : (explicitToughness == null && !String(sheet.toughness ?? "").trim() ? String(strong) : sheet.toughness),
        painThreshold: sheet.painThreshold,
        armor: duroLevel > 0 ? derivedArmor : (explicitArmor == null && !String(sheet.armor ?? "").trim() ? "0" : sheet.armor),
        defense: robustoLevel > 0 ? derivedDefense : (!String(sheet.defense ?? "").trim() ? formatSignedNumber(10 - quick) : sheet.defense)
    };
}
