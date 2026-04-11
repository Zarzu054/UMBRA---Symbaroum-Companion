const LEGACY_WEAPON_SLOTS = [
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
    if (sheet.actions.length > 0) {
        const storedActions = sheet.actions
            .map((action) => ({
            id: action.id,
            label: action.label,
            sourceType: action.sourceType === "utility" ? "ability" : action.sourceType,
            sourceName: action.sourceName,
            cost: action.cost,
            requiredLevel: action.requiredLevel ?? inferActionLevel(action.id, action.label, action.sourceName),
            rollAttribute: action.rollAttribute,
            fixedTarget: action.fixedTarget,
            damageFormula: normalizeFormula(action.damageFormula ?? ""),
            effectSummary: action.effectSummary
        }))
            .filter((action) => isSheetActionAvailableForCharacter(sheet, action));
        const derivedActions = deriveLegacyCharacterActions(sheet);
        return applyPassiveActionRules(sheet, dedupeActions([...storedActions, ...derivedActions]));
    }
    return deriveLegacyCharacterActions(sheet);
}
function deriveLegacyCharacterActions(sheet) {
    const actions = [];
    const equippedWeapons = sheet.inventoryItems.filter((item) => item.category === "weapon" && item.equipped);
    for (const weapon of equippedWeapons) {
        actions.push({
            id: `weapon:${weapon.id}`,
            label: `Atacar con ${weapon.name}`,
            sourceType: "weapon",
            sourceName: weapon.name,
            cost: "combat",
            rollAttribute: weapon.attackAttribute ?? "diestro",
            damageFormula: normalizeFormula(weapon.damageFormula),
            effectSummary: weapon.qualities || weapon.description || "Tirada de ataque y, si procede, da\u00f1o del arma."
        });
    }
    if (equippedWeapons.length === 0) {
        for (const slot of LEGACY_WEAPON_SLOTS) {
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
    return applyPassiveActionRules(sheet, dedupeActions(actions));
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
            fixedTarget: action.fixedTarget,
            damageFormula: action.damageFormula,
            effectSummary: action.effectSummary
        }))
            .filter((action) => isActionAvailableForEntryLevel(entryLevel, action.requiredLevel));
    }
    const fallbackAction = inferFallbackAction(sourceType, sourceName, fallbackText);
    return fallbackAction && isActionAvailableForEntryLevel(entryLevel, fallbackAction.requiredLevel) ? [fallbackAction] : [];
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
export function buildRollRequest(sheet, characterName, actionId, phase, destination, note = "", selectedDamageModifierIds = []) {
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
            target: action.fixedTarget ?? sheet.atributos[action.rollAttribute],
            note: note.trim() || undefined
        };
    }
    const damageRoll = resolveDamageRoll(action, selectedDamageModifierIds);
    if (!damageRoll) {
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
        formula: damageRoll.formula,
        selectedDamageModifierIds: damageRoll.selectedModifierIds,
        note: buildDamageRollNote(damageRoll, note)
    };
}
export function executeCharacterAction(sheet, actionId, phase = "attack", selectedDamageModifierIds = []) {
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
        const target = action.fixedTarget ?? sheet.atributos[action.rollAttribute];
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
        const damageRoll = resolveDamageRoll(action, selectedDamageModifierIds);
        if (!damageRoll) {
            throw new Error("Esta accion no tiene tirada de da\u00f1o");
        }
        const damage = rollFormula(damageRoll.formula);
        if (damage) {
            rolls.push({
                kind: "damage",
                label: damageRoll.label,
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
function isActionAvailableForEntryLevel(entryLevel, requiredLevel) {
    if (!requiredLevel) {
        return true;
    }
    return entryLevel === requiredLevel;
}
function isSheetActionAvailableForCharacter(sheet, action) {
    if (action.sourceType !== "ability" &&
        action.sourceType !== "power" &&
        action.sourceType !== "ritual") {
        return true;
    }
    const entryLevel = getSourceEntryLevel(sheet, action.sourceType, action.sourceName);
    if (!entryLevel) {
        return true;
    }
    return isActionAvailableForEntryLevel(entryLevel, action.requiredLevel);
}
function getSourceEntryLevel(sheet, sourceType, sourceName) {
    const target = normalizeName(sourceName);
    const entries = sourceType === "ability"
        ? sheet.habilidades
        : sourceType === "power"
            ? sheet.poderesMisticos
            : sheet.rituales;
    return entries.find((entry) => normalizeName(entry.nombre) === target)?.nivel;
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
function applyPassiveActionRules(sheet, actions) {
    const filteredActions = actions.filter((action) => !shouldSuppressStandaloneStyleAction(action));
    const styleAdjustedActions = applyIntegratedCombatStyles(sheet, filteredActions);
    ensureBerserkerDefenseAction(sheet, styleAdjustedActions);
    applyConditionalDamageVariants(sheet, styleAdjustedActions);
    const visibleActions = styleAdjustedActions;
    const unarmedCombatLevel = getRatedEntryLevel(sheet, "Combate sin armas");
    const hasUnarmedAction = visibleActions.some((action) => action.id === "ability:combate-sin-armas:base");
    if (!hasUnarmedAction) {
        visibleActions.push(createUnarmedAttackAction(sheet, unarmedCombatLevel));
    }
    return dedupeActions(visibleActions);
}
function applyConditionalDamageVariants(sheet, actions) {
    const bonuses = collectConditionalDamageBonuses(sheet, actions);
    if (bonuses.length === 0) {
        return;
    }
    for (const action of actions) {
        if (action.sourceType !== "weapon" || !action.damageFormula) {
            continue;
        }
        const applicableBonuses = bonuses.filter((bonus) => doesBonusApplyToWeaponAction(bonus, action));
        if (applicableBonuses.length === 0) {
            continue;
        }
        action.damageModifiers = applicableBonuses
            .map((bonus) => ({
            id: bonus.id,
            label: bonus.label,
            formula: bonus.formula
        }))
            .filter((modifier, index, modifiers) => modifiers.findIndex((entry) => entry.id === modifier.id) === index);
    }
}
function collectConditionalDamageBonuses(sheet, actions) {
    const bonuses = [];
    const robustBonus = getRobustDamageBonus(sheet);
    if (robustBonus) {
        bonuses.push(robustBonus);
    }
    for (const action of actions) {
        if (action.sourceType === "weapon" || !action.damageFormula) {
            continue;
        }
        const normalizedDamage = normalizeFormula(action.damageFormula);
        if (!normalizedDamage?.startsWith("+")) {
            continue;
        }
        const normalizedText = normalizeName(`${action.label} ${action.effectSummary}`);
        bonuses.push({
            id: action.id,
            label: action.sourceName,
            formula: normalizedDamage,
            appliesTo: inferConditionalBonusApplicability(normalizedText)
        });
    }
    return bonuses.filter((bonus, index, entries) => entries.findIndex((entry) => entry.id === bonus.id) === index);
}
function getRobustDamageBonus(sheet) {
    const robustLevel = getRobustLevel(sheet);
    if (robustLevel <= 0) {
        return null;
    }
    const flatBonus = robustLevel === 1 ? 2 : robustLevel === 2 ? 3 : 4;
    const formula = convertMonsterFlatBonusToPlayerRoll(flatBonus);
    return {
        id: `trait:robusto:${robustLevel}`,
        label: "Robusto",
        formula,
        appliesTo: "melee"
    };
}
function getNaturalWeaponDamageBonus(sheet) {
    const naturalWeaponLevel = getTraitLevel(sheet, "arma natural");
    if (naturalWeaponLevel <= 0) {
        return null;
    }
    return {
        id: `trait:arma-natural:${naturalWeaponLevel}`,
        label: "Arma natural",
        formula: convertMonsterFlatBonusToPlayerRoll(naturalWeaponLevel),
        appliesTo: "melee"
    };
}
function getRobustLevel(sheet) {
    return getTraitLevel(sheet, "robusto");
}
function getTraitLevel(sheet, traitName) {
    const target = normalizeName(traitName);
    const traitSources = [
        ...sheet.rasgos,
        ...String(sheet.noteSections?.traits ?? "")
            .split(/[,\n;]/)
            .map((entry) => entry.trim())
            .filter(Boolean)
    ];
    for (const rawTrait of traitSources) {
        const normalized = normalizeName(rawTrait);
        if (!normalized.startsWith(target)) {
            continue;
        }
        if (/\bmaestro\b/.test(normalized))
            return 3;
        if (/\badepto\b/.test(normalized))
            return 2;
        if (/\bnovato\b/.test(normalized))
            return 1;
        if (/\biii\b|\b3\b/.test(normalized))
            return 3;
        if (/\bii\b|\b2\b/.test(normalized))
            return 2;
        return 1;
    }
    return 0;
}
function convertMonsterFlatBonusToPlayerRoll(value) {
    switch (value) {
        case 2:
            return "+1d4";
        case 3:
            return "+1d6";
        case 4:
            return "+1d8";
        case 5:
            return "+1d10";
        case 6:
            return "+1d12";
        default:
            return value >= 0 ? `+${value}` : String(value);
    }
}
function inferConditionalBonusApplicability(text) {
    if (/(combate cuerpo a cuerpo|cuerpo a cuerpo|ataque cuerpo a cuerpo)/.test(text)) {
        return "melee";
    }
    if (/(ataque a distancia|disparo|proyectil|arco|ballesta)/.test(text)) {
        return "ranged";
    }
    return "any";
}
function doesBonusApplyToWeaponAction(bonus, action) {
    if (bonus.appliesTo === "any") {
        return true;
    }
    if (bonus.appliesTo === "melee") {
        return !isBowOrCrossbowAction(action) && !isThrownWeaponAction(action);
    }
    return isBowOrCrossbowAction(action) || isThrownWeaponAction(action);
}
function combineDamageFormulas(base, bonus) {
    const normalizedBase = normalizeFormula(base) ?? base.trim().toLowerCase();
    const normalizedBonus = normalizeFormula(bonus) ?? bonus.trim().toLowerCase();
    if (!normalizedBonus) {
        return normalizedBase;
    }
    return normalizedBonus.startsWith("+") || normalizedBonus.startsWith("-")
        ? `${normalizedBase}${normalizedBonus}`
        : `${normalizedBase}+${normalizedBonus}`;
}
function resolveDamageRoll(action, selectedDamageModifierIds = []) {
    const baseFormula = action.damageFormula;
    if (!baseFormula) {
        return null;
    }
    const modifiers = action.damageModifiers ?? [];
    const selectedModifiers = modifiers.filter((modifier) => selectedDamageModifierIds.includes(modifier.id));
    const formula = selectedModifiers.reduce((currentFormula, modifier) => combineDamageFormulas(currentFormula, modifier.formula), baseFormula);
    const selectedModifierLabels = selectedModifiers.map((modifier) => modifier.label);
    return {
        label: selectedModifierLabels.length > 0 ? `Danio (${selectedModifierLabels.join(", ")})` : "Danio",
        formula,
        selectedModifierIds: selectedModifiers.map((modifier) => modifier.id),
        selectedModifierLabels
    };
}
function buildDamageRollNote(damageRoll, note) {
    const parts = [];
    if (damageRoll.selectedModifierLabels.length > 0) {
        parts.push(`Modificadores: ${damageRoll.selectedModifierLabels.join(", ")}`);
    }
    if (note.trim()) {
        parts.push(note.trim());
    }
    return parts.length > 0 ? parts.join(" | ") : undefined;
}
function shouldSuppressStandaloneStyleAction(action) {
    if (action.sourceType !== "ability") {
        return false;
    }
    const actionName = normalizeName(action.sourceName);
    return INTEGRATED_COMBAT_STYLE_ABILITIES.has(actionName);
}
function getRatedEntryLevel(sheet, name) {
    const target = normalizeName(name);
    return sheet.habilidades.find((entry) => normalizeName(entry.nombre) === target)?.nivel;
}
function createUnarmedAttackAction(sheet, level) {
    const naturalWeaponBonus = getNaturalWeaponDamageBonus(sheet);
    const baseDamage = !level ? "1d4" : level === "maestro" ? "2d6" : "1d6";
    return {
        id: "ability:combate-sin-armas:base",
        label: "Ataque desarmado",
        sourceType: "weapon",
        sourceName: level ? "Combate sin armas" : "Ataque basico",
        cost: "combat",
        rollAttribute: "fuerte",
        damageFormula: naturalWeaponBonus ? combineDamageFormulas(baseDamage, naturalWeaponBonus.formula) : baseDamage,
        effectSummary: !level
            ? "Ataque desarmado basico disponible para cualquier personaje."
            : level === "adepto"
                ? "Ataque desarmado base. Combate sin armas permite resolver por separado un segundo ataque contra el mismo objetivo."
                : level === "maestro"
                    ? "Ataque desarmado base mejorado por Combate sin armas. Los ataques desarmados infligen 2d6."
                    : "Ataque desarmado base de Combate sin armas."
    };
}
function ensureBerserkerDefenseAction(sheet, actions) {
    const berserkerLevel = getRatedEntryLevel(sheet, "Berserker");
    if (!berserkerLevel || berserkerLevel === "maestro") {
        return;
    }
    const defenseId = `ability:Berserker:${berserkerLevel}-berserker-defensa`;
    const hasDefenseAction = actions.some((action) => action.id === defenseId || (action.sourceName === "Berserker" && action.fixedTarget === 5));
    if (hasDefenseAction) {
        return;
    }
    actions.push({
        id: defenseId,
        label: `Defender con Berserker (${capitalizeSkillLevel(berserkerLevel)})`,
        sourceType: "ability",
        sourceName: "Berserker",
        cost: "reaction",
        requiredLevel: berserkerLevel,
        rollAttribute: "agil",
        fixedTarget: 5,
        effectSummary: "Mientras estés en frenesí, tu Defensa se resuelve como si tuvieras Ágil 5."
    });
}
function capitalizeSkillLevel(level) {
    switch (level) {
        case "maestro":
            return "Maestro";
        case "adepto":
            return "Adepto";
        case "novato":
        default:
            return "Novato";
    }
}
const INTEGRATED_COMBAT_STYLE_ABILITIES = new Set([
    "armas a dos manos",
    "armas de asta",
    "armas de presa",
    "arco veloz",
    "combate con arma larga",
    "combate con escudo",
    "combate con armas de cadena",
    "combate sin armas",
    "cuchillo rapido",
    "golpe de hierro",
    "sexto sentido",
    "tirador",
    "viento de acero"
]);
function applyIntegratedCombatStyles(sheet, actions) {
    return actions.map((action) => {
        if (action.sourceType !== "weapon") {
            return action;
        }
        let next = { ...action };
        const twoHandedLevel = getRatedEntryLevel(sheet, "Armas a dos manos");
        if (twoHandedLevel && isHeavyWeaponAction(next)) {
            if (next.damageFormula) {
                next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
            }
            next.effectSummary = appendSummary(next.effectSummary, buildTwoHandedSummary(twoHandedLevel));
        }
        const polearmLevel = getRatedEntryLevel(sheet, "Armas de asta");
        if (polearmLevel && isPolearmAction(next)) {
            if (next.damageFormula) {
                next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
            }
            next.effectSummary = appendSummary(next.effectSummary, buildPolearmSummary(polearmLevel));
        }
        const preyLevel = getRatedEntryLevel(sheet, "Armas de presa");
        if (preyLevel && isPreyWeaponAction(next)) {
            next.effectSummary = appendSummary(next.effectSummary, buildPreySummary(preyLevel));
        }
        const longWeaponLevel = getRatedEntryLevel(sheet, "Combate con arma larga");
        if (longWeaponLevel && isLongWeaponAction(next)) {
            next.effectSummary = appendSummary(next.effectSummary, buildLongWeaponSummary(longWeaponLevel));
        }
        const shieldLevel = getRatedEntryLevel(sheet, "Combate con escudo");
        if (shieldLevel && hasEquippedShield(sheet) && isMeleeWeaponAction(next)) {
            next.effectSummary = appendSummary(next.effectSummary, buildShieldSummary(shieldLevel));
        }
        const ironFistLevel = getRatedEntryLevel(sheet, "Golpe de hierro");
        if (ironFistLevel && isMeleeWeaponAction(next)) {
            if (isAttributeEligibleForIronFist(next.rollAttribute)) {
                next.rollAttribute = "fuerte";
            }
            next.effectSummary = appendSummary(next.effectSummary, buildIronFistSummary(ironFistLevel));
        }
        const chainLevel = getRatedEntryLevel(sheet, "Combate con armas de cadena");
        if (chainLevel && isChainWeaponAction(next)) {
            next.effectSummary = appendSummary(next.effectSummary, buildChainSummary(chainLevel));
        }
        const quickKnifeLevel = getRatedEntryLevel(sheet, "Cuchillo rápido");
        if (quickKnifeLevel && isKnifeWeaponAction(next)) {
            if (isAttributeEligibleForAgileKnife(next.rollAttribute)) {
                next.rollAttribute = "agil";
            }
            next.effectSummary = appendSummary(next.effectSummary, buildQuickKnifeSummary(quickKnifeLevel));
        }
        const fastBowLevel = getRatedEntryLevel(sheet, "Arco veloz");
        if (fastBowLevel && isBowWeaponAction(next)) {
            next.effectSummary = appendSummary(next.effectSummary, buildFastBowSummary(fastBowLevel));
        }
        const marksmanLevel = getRatedEntryLevel(sheet, "Tirador");
        if (marksmanLevel && isBowOrCrossbowAction(next)) {
            if (next.damageFormula) {
                next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
            }
            next.effectSummary = appendSummary(next.effectSummary, buildMarksmanSummary(marksmanLevel));
        }
        const sixthSenseLevel = getRatedEntryLevel(sheet, "Sexto sentido");
        if (sixthSenseLevel && isRangedWeaponAction(next)) {
            if (!next.rollAttribute || next.rollAttribute === "diestro") {
                next.rollAttribute = "atento";
            }
            next.effectSummary = appendSummary(next.effectSummary, buildSixthSenseSummary(sixthSenseLevel));
        }
        const steelWindLevel = getRatedEntryLevel(sheet, "Viento de acero");
        if (steelWindLevel && isThrownWeaponAction(next)) {
            if (next.damageFormula) {
                next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
            }
            next.effectSummary = appendSummary(next.effectSummary, buildSteelWindSummary(steelWindLevel));
        }
        return next;
    });
}
function appendSummary(base, extra) {
    const trimmedBase = base.trim();
    const trimmedExtra = extra.trim();
    if (!trimmedExtra)
        return trimmedBase;
    if (!trimmedBase)
        return trimmedExtra;
    if (normalizeName(trimmedBase).includes(normalizeName(trimmedExtra))) {
        return trimmedBase;
    }
    return `${trimmedBase} ${trimmedExtra}`;
}
function increaseDamageDie(formula) {
    const normalized = formula.trim().toLowerCase();
    const match = normalized.match(/^(\d+)d(4|6|8|10|12)([+-]\d+)?$/);
    if (!match)
        return null;
    const count = Number(match[1]);
    const sides = Number(match[2]);
    const modifier = Number(match[3] ?? 0);
    if (sides >= 12) {
        if (count === 1) {
            const nextModifier = modifier + 1;
            return `1d12${nextModifier > 0 ? `+${nextModifier}` : nextModifier < 0 ? String(nextModifier) : ""}`;
        }
        return `${count}d12${modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ""}`;
    }
    const nextSides = sides === 4 ? 6 : sides === 6 ? 8 : sides === 8 ? 10 : 12;
    return `${count}d${nextSides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ""}`;
}
function isAttributeEligibleForAgileKnife(attribute) {
    return !attribute || attribute === "diestro" || attribute === "agil";
}
function isAttributeEligibleForIronFist(attribute) {
    return !attribute || attribute === "diestro";
}
function hasEquippedShield(sheet) {
    const inventoryShield = sheet.inventoryItems.some((item) => item.equipped && /escudo/.test(normalizeName(`${item.name} ${item.qualities}`)));
    if (inventoryShield) {
        return true;
    }
    const legacyShieldText = `${sheet.combate.armaPrincipal} ${sheet.combate.armaSecundaria} ${sheet.combate.armadura}`;
    return /escudo/.test(normalizeName(legacyShieldText));
}
function buildTwoHandedSummary(level) {
    if (level === "maestro")
        return "Armas a dos manos: el ataque ignora la armadura del objetivo y conservas el reataque del nivel adepto.";
    if (level === "adepto")
        return "Armas a dos manos: cuando fallas, puedes intentar un segundo ataque de regreso contra el mismo objetivo.";
    return "Armas a dos manos: el dano del arma pesada aumenta un nivel.";
}
function buildPolearmSummary(level) {
    if (level === "maestro")
        return "Armas de asta: si aciertas con el ataque gratuito, puedes mantener al enemigo a raya fuera de alcance.";
    if (level === "adepto")
        return "Armas de asta: obtienes un ataque gratuito cuando un enemigo entra en tu alcance cuerpo a cuerpo.";
    return "Armas de asta: el dano del arma larga aumenta un nivel.";
}
function buildPreySummary(level) {
    if (level === "maestro")
        return "Armas de presa: los ataques estrangulan e infligen 1d6 por turno ignorando armadura.";
    if (level === "adepto")
        return "Armas de presa: ganas una segunda oportunidad para inmovilizar y derribar al objetivo atrapado.";
    return "Armas de presa: ganas una segunda oportunidad para inmovilizar al objetivo.";
}
function buildLongWeaponSummary(level) {
    if (level === "maestro")
        return "Combate con arma larga: puedes derribar al objetivo y encadenar un ataque gratuito con ventaja.";
    if (level === "adepto")
        return "Combate con arma larga: si el rival se defiende o si usas vara/baculo tras una Defensa exitosa, obtienes un ataque gratuito.";
    return "Combate con arma larga: la tecnica mejora tu defensa con armas largas.";
}
function buildShieldSummary(level) {
    if (level === "maestro")
        return "Combate con escudo: tras impactar, puedes seguir con un golpe de escudo de 1d8 y derribo con [Fuerte<-Fuerte].";
    if (level === "adepto")
        return "Combate con escudo: tras impactar, puedes seguir con un golpe de escudo de 1d4 y derribo con [Fuerte<-Fuerte].";
    return "Combate con escudo: mientras lleves escudo mejoras la defensa y el dano de armas compatibles.";
}
function buildIronFistSummary(level) {
    if (level === "maestro")
        return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro y el bono de dano se resuelve desde el modal de dano.";
    if (level === "adepto")
        return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro y pueden beneficiarse del bono de dano de la habilidad.";
    return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro.";
}
function buildChainSummary(level) {
    if (level === "maestro")
        return "Combate con armas de cadena: puedes barrer y atacar a todos los oponentes a tu alcance.";
    if (level === "adepto")
        return "Combate con armas de cadena: el golpe secundario del arma de cadena inflige 1d8.";
    return "Combate con armas de cadena: el arma gana la cualidad Presa.";
}
function buildQuickKnifeSummary(level) {
    if (level === "maestro")
        return "Cuchillo rapido: luchas pegado al objetivo; al herir con cuchillo dificultas sus ataques y su retirada.";
    if (level === "adepto")
        return "Cuchillo rapido: cada accion de combate permite dos ataques separados con cuchillo al mismo objetivo.";
    return "Cuchillo rapido: puedes atacar con Agil en vez de Diestro cuando uses cuchillos.";
}
function buildFastBowSummary(level) {
    if (level === "maestro")
        return "Arco veloz: puedes resolver hasta tres disparos con una sola accion.";
    if (level === "adepto")
        return "Arco veloz: puedes disparar dos flechas con una sola accion de combate.";
    return "Arco veloz: puedes sacrificar el movimiento para disparar una segunda flecha.";
}
function buildMarksmanSummary(level) {
    if (level === "maestro")
        return "Tirador: el ataque a distancia puede ignorar completamente la armadura.";
    if (level === "adepto")
        return "Tirador: si hieres al objetivo, puedes inmovilizar su movimiento con [Diestro<-Fuerte].";
    return "Tirador: el dano de arcos y ballestas aumenta un nivel.";
}
function buildSixthSenseSummary(level) {
    if (level === "maestro")
        return "Sexto sentido: puedes combatir a distancia guiandote por otros sentidos incluso en oscuridad o ceguera.";
    if (level === "adepto")
        return "Sexto sentido: tu intuicion mejora tambien la iniciativa y la Defensa.";
    return "Sexto sentido: tus ataques a distancia usan Atento en vez de Diestro.";
}
function buildSteelWindSummary(level) {
    if (level === "maestro")
        return "Viento de acero: puedes lanzar hasta tres armas arrojadizas con una sola accion.";
    if (level === "adepto")
        return "Viento de acero: puedes lanzar dos armas arrojadizas con una sola accion.";
    return "Viento de acero: el dano de las armas arrojadizas aumenta a 1d8.";
}
function isWeaponTextMatch(action, pattern) {
    return pattern.test(normalizeName(`${action.label} ${action.sourceName} ${action.effectSummary}`));
}
function isHeavyWeaponAction(action) {
    return isWeaponTextMatch(action, /(pesad|mandoble|gran hacha|hacha a dos manos|martillo de guerra|arma pesada|maza pesada)/);
}
function isPolearmAction(action) {
    return isWeaponTextMatch(action, /(lanza|alabarda|vara|baculo|baston|asta)/);
}
function isPreyWeaponAction(action) {
    return isWeaponTextMatch(action, /(presa)/);
}
function isLongWeaponAction(action) {
    return isWeaponTextMatch(action, /(larga|lanza|alabarda|vara|baculo|baston|asta)/);
}
function isMeleeWeaponAction(action) {
    return !isRangedWeaponAction(action);
}
function isRangedWeaponAction(action) {
    return isBowOrCrossbowAction(action) || isThrownWeaponAction(action) || isWeaponTextMatch(action, /(honda|tirachinas|onda)/);
}
function isChainWeaponAction(action) {
    return isWeaponTextMatch(action, /(cadena|latigo|mayal|flail)/);
}
function isKnifeWeaponAction(action) {
    return isWeaponTextMatch(action, /(cuchillo|daga|punal|punal|estilete|kris)/);
}
function isBowWeaponAction(action) {
    return isWeaponTextMatch(action, /(arco)/);
}
function isBowOrCrossbowAction(action) {
    return isWeaponTextMatch(action, /(arco|ballesta)/);
}
function isThrownWeaponAction(action) {
    return isWeaponTextMatch(action, /(arrojadiz|jabalina|venablo|hacha arrojadiza|cuchillo arrojadizo)/);
}
function isNaturalWeaponAction(action) {
    if (action.sourceType !== "weapon")
        return false;
    const haystack = `${action.label} ${action.sourceName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /(arma natural|garras|garra|colmillos|colmillo|mordisco|cuernos|cuerno|zarpazo|pico)/.test(haystack);
}
function normalizeName(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}
function dedupeActions(actions) {
    const seen = new Set();
    return actions.filter((action) => {
        if (seen.has(action.id)) {
            return false;
        }
        seen.add(action.id);
        return true;
    });
}
function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}
function rollFormula(input) {
    const normalized = input.replace(/\s+/g, "").toLowerCase();
    const terms = normalized.match(/[+-]?[^+-]+/g);
    if (!terms || terms.length === 0 || terms.join("") !== normalized) {
        return null;
    }
    const dice = [];
    let total = 0;
    for (const term of terms) {
        const sign = term.startsWith("-") ? -1 : 1;
        const body = term.replace(/^[+-]/, "");
        const diceMatch = body.match(/^(\d*)d(\d+)$/);
        if (diceMatch) {
            const count = Number(diceMatch[1] || 1);
            const sides = Number(diceMatch[2]);
            const rolls = Array.from({ length: Math.max(1, count) }, () => rollDie(sides));
            for (const die of rolls) {
                dice.push(sign * die);
                total += sign * die;
            }
            continue;
        }
        const flatValue = Number(body);
        if (!Number.isFinite(flatValue)) {
            return null;
        }
        total += sign * flatValue;
    }
    return {
        formula: normalized,
        dice,
        total
    };
}
