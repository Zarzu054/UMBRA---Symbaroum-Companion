const WEAPON_SLOTS = [
    {
        id: "weapon:primary",
        sourceName: (sheet) => sheet.combate.armaPrincipal,
        attribute: (sheet) => normalizeAttribute(sheet.combate.armaPrincipalAtributo),
        damage: (sheet) => sheet.combate.danioPrincipal
    },
    {
        id: "weapon:secondary",
        sourceName: (sheet) => sheet.combate.armaSecundaria,
        attribute: (sheet) => normalizeAttribute(sheet.combate.armaSecundariaAtributo),
        damage: (sheet) => sheet.combate.danioSecundaria
    },
    {
        id: "weapon:tertiary",
        sourceName: (sheet) => sheet.combate.armaTerciaria,
        attribute: (sheet) => normalizeAttribute(sheet.combate.armaTerciariaAtributo),
        damage: (sheet) => sheet.combate.danioTerciaria
    },
    {
        id: "weapon:quaternary",
        sourceName: (sheet) => sheet.combate.armaCuaternaria,
        attribute: (sheet) => normalizeAttribute(sheet.combate.armaCuaternariaAtributo),
        damage: (sheet) => sheet.combate.danioCuaternaria
    }
];
export function deriveCharacterActions(sheet) {
    const actions = [];
    for (const slot of WEAPON_SLOTS) {
        const weaponName = slot.sourceName(sheet).trim();
        if (!weaponName)
            continue;
        actions.push({
            id: slot.id,
            label: `Atacar con ${weaponName}`,
            sourceType: "weapon",
            sourceName: weaponName,
            cost: "combat",
            rollAttribute: slot.attribute(sheet),
            damageFormula: normalizeFormula(slot.damage(sheet)),
            effectSummary: "Tirada de ataque y, si procede, da\u00f1o del arma."
        });
    }
    for (const entry of sheet.habilidades) {
        actions.push(...mapRatedEntryActions("ability", entry.nombre, entry.nivel, entry.acciones, entry.efecto || entry.notas));
    }
    for (const entry of sheet.poderesMisticos) {
        actions.push(...mapRatedEntryActions("power", entry.nombre, entry.nivel, entry.acciones, entry.efecto || entry.notas));
    }
    for (const entry of sheet.rituales) {
        actions.push(...mapRatedEntryActions("ritual", entry.nombre, entry.nivel, entry.acciones, entry.efecto || entry.notas));
    }
    return actions;
}
function mapRatedEntryActions(sourceType, sourceName, entryLevel, configuredActions, fallbackText) {
    if (configuredActions.length > 0) {
        return configuredActions
            .map((action) => ({
            id: `${sourceType}:${sourceName}:${action.id}`,
            label: action.label,
            sourceType,
            sourceName,
            cost: action.cost,
            requiredLevel: action.requiredLevel ?? inferActionLevel(action.id, action.label),
            rollAttribute: action.rollAttribute,
            damageFormula: action.damageFormula,
            effectSummary: action.effectSummary
        }))
            .filter((action) => canUseActionAtLevel(entryLevel, action.requiredLevel));
    }
    const fallbackAction = inferFallbackAction(sourceType, sourceName, fallbackText);
    return fallbackAction && canUseActionAtLevel(entryLevel, fallbackAction.requiredLevel) ? [fallbackAction] : [];
}
function inferFallbackAction(sourceType, sourceName, text) {
    const normalized = text.trim().toLowerCase();
    if (!normalized || normalized.startsWith("pasiva.")) {
        return null;
    }
    if (normalized.startsWith("reaccion.") || normalized.startsWith("reacci\u00f3n.")) {
        return {
            id: `${sourceType}:${sourceName}:fallback`,
            label: `Usar ${sourceName}`,
            sourceType,
            sourceName,
            cost: "reaction",
            requiredLevel: inferActionLevel(sourceName, text),
            effectSummary: text
        };
    }
    if (normalized.startsWith("activa.") || normalized.includes("accion de combate") || normalized.includes("acci\u00f3n de combate")) {
        return {
            id: `${sourceType}:${sourceName}:fallback`,
            label: `Usar ${sourceName}`,
            sourceType,
            sourceName,
            cost: "combat",
            requiredLevel: inferActionLevel(sourceName, text),
            effectSummary: text
        };
    }
    if (normalized.includes("accion de movimiento") || normalized.includes("acci\u00f3n de movimiento")) {
        return {
            id: `${sourceType}:${sourceName}:fallback`,
            label: `Usar ${sourceName}`,
            sourceType,
            sourceName,
            cost: "movement",
            requiredLevel: inferActionLevel(sourceName, text),
            effectSummary: text
        };
    }
    return null;
}
export function buildRollRequest(sheet, characterName, actionId, phase, destination, note = "") {
    const action = deriveCharacterActions(sheet).find((entry) => entry.id === actionId);
    if (!action) {
        throw new Error("Accion no disponible para este personaje");
    }
    if (phase === "attack") {
        if (!action.rollAttribute) {
            throw new Error("Esta accion no tiene tirada de ataque");
        }
        const isWeaponAttack = action.sourceType === "weapon";
        return {
            destination,
            kind: isWeaponAttack ? "attack" : "check",
            phase,
            characterName,
            actionId: action.id,
            actionLabel: action.label,
            sourceName: action.sourceName,
            sourceType: action.sourceType,
            formula: "1d20",
            rollAttribute: action.rollAttribute,
            target: sheet.atributos[action.rollAttribute],
            note: note.trim() || undefined
        };
    }
    if (!action.damageFormula) {
        throw new Error("Esta accion no tiene tirada de da\u00f1o");
    }
    return {
        destination,
        kind: "damage",
        phase,
        characterName,
        actionId: action.id,
        actionLabel: action.label,
        sourceName: action.sourceName,
        sourceType: action.sourceType,
        formula: action.damageFormula,
        note: note.trim() || undefined
    };
}
export function executeCharacterAction(sheet, actionId, phase = "attack") {
    const action = deriveCharacterActions(sheet).find((entry) => entry.id === actionId);
    if (!action) {
        throw new Error("Accion no disponible para este personaje");
    }
    const rolls = [];
    if (phase === "attack") {
        if (!action.rollAttribute) {
            throw new Error("Esta accion no tiene tirada de ataque");
        }
        const die = rollDie(20);
        const target = sheet.atributos[action.rollAttribute];
        const isWeaponAttack = action.sourceType === "weapon";
        rolls.push({
            kind: isWeaponAttack ? "attack_check" : "attribute_check",
            label: isWeaponAttack ? `Ataque (${action.rollAttribute})` : `Prueba (${action.rollAttribute})`,
            dice: [die],
            total: die,
            formula: "1d20",
            target,
            success: die <= target
        });
    }
    else {
        if (!action.damageFormula) {
            throw new Error("Esta accion no tiene tirada de da\u00f1o");
        }
        const damage = rollFormula(action.damageFormula);
        if (damage) {
            rolls.push({
                kind: "damage",
                label: "Da\u00f1o",
                dice: damage.dice,
                total: damage.total,
                formula: damage.formula
            });
        }
    }
    return { action, rolls };
}
function inferActionLevel(...values) {
    const joined = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (joined.includes("maestro"))
        return "maestro";
    if (joined.includes("adepto"))
        return "adepto";
    if (joined.includes("novato"))
        return "novato";
    return undefined;
}
function canUseActionAtLevel(entryLevel, requiredLevel) {
    if (!requiredLevel) {
        return true;
    }
    const levelOrder = {
        novato: 0,
        adepto: 1,
        maestro: 2
    };
    return levelOrder[requiredLevel] <= levelOrder[entryLevel];
}
function normalizeAttribute(value) {
    const normalized = value.trim().toLowerCase();
    switch (normalized) {
        case "agil":
            return "agil";
        case "atento":
            return "atento";
        case "discreto":
            return "discreto";
        case "diestro":
            return "diestro";
        case "fuerte":
            return "fuerte";
        case "inteligente":
            return "inteligente";
        case "persuasivo":
            return "persuasivo";
        case "tenaz":
            return "tenaz";
        default:
            return "diestro";
    }
}
function normalizeFormula(value) {
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : undefined;
}
function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}
function rollFormula(input) {
    const normalized = input.replace(/\s+/g, "").toLowerCase();
    const match = normalized.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) {
        return null;
    }
    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    const modifier = Number(match[3] || 0);
    const dice = Array.from({ length: Math.max(1, count) }, () => rollDie(sides));
    const total = dice.reduce((sum, value) => sum + value, 0) + modifier;
    return {
        formula: normalized,
        dice,
        total
    };
}
