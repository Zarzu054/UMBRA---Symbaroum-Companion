import type {
  ActionRollResult,
  AttributeKey,
  CharacterActionDefinition,
  CharacterActionPhase,
  CharacterSheet,
  RollDestination,
  RollRequest,
  SkillLevel
} from "./index.js";

const LEGACY_WEAPON_SLOTS = [
  {
    id: "weapon:primary",
    sourceName: (sheet: CharacterSheet) => sheet.combate.armaPrincipal,
    attribute: (sheet: CharacterSheet) => normalizeAttribute(sheet.combate.armaPrincipalAtributo),
    damage: (sheet: CharacterSheet) => sheet.combate.danioPrincipal
  },
  {
    id: "weapon:secondary",
    sourceName: (sheet: CharacterSheet) => sheet.combate.armaSecundaria,
    attribute: (sheet: CharacterSheet) => normalizeAttribute(sheet.combate.armaSecundariaAtributo),
    damage: (sheet: CharacterSheet) => sheet.combate.danioSecundaria
  },
  {
    id: "weapon:tertiary",
    sourceName: (sheet: CharacterSheet) => sheet.combate.armaTerciaria,
    attribute: (sheet: CharacterSheet) => normalizeAttribute(sheet.combate.armaTerciariaAtributo),
    damage: (sheet: CharacterSheet) => sheet.combate.danioTerciaria
  },
  {
    id: "weapon:quaternary",
    sourceName: (sheet: CharacterSheet) => sheet.combate.armaCuaternaria,
    attribute: (sheet: CharacterSheet) => normalizeAttribute(sheet.combate.armaCuaternariaAtributo),
    damage: (sheet: CharacterSheet) => sheet.combate.danioCuaternaria
  }
] as const;

export function deriveCharacterActions(sheet: CharacterSheet): CharacterActionDefinition[] {
  if (sheet.actions.length > 0) {
    return applyPassiveActionRules(
      sheet,
      sheet.actions.map((action) => ({
      id: action.id,
      label: action.label,
      sourceType: action.sourceType === "utility" ? "ability" : action.sourceType,
      sourceName: action.sourceName,
      cost: action.cost,
      requiredLevel: action.requiredLevel,
      rollAttribute: action.rollAttribute,
      damageFormula: normalizeFormula(action.damageFormula ?? ""),
      effectSummary: action.effectSummary
      }))
    );
  }

  return deriveLegacyCharacterActions(sheet);
}

function deriveLegacyCharacterActions(sheet: CharacterSheet): CharacterActionDefinition[] {
  const actions: CharacterActionDefinition[] = [];

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
      if (!weaponName) continue;

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

function mapRatedEntryActions(
  sourceType: "ability" | "power" | "ritual",
  sourceName: string,
  entryLevel: SkillLevel,
  configuredActions: CharacterSheet["habilidades"][number]["acciones"],
  fallbackText: string
): CharacterActionDefinition[] {
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

function inferFallbackAction(
  sourceType: "ability" | "power" | "ritual",
  sourceName: string,
  text: string
): CharacterActionDefinition | null {
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

export function buildRollRequest(
  sheet: CharacterSheet,
  characterName: string,
  actionId: string,
  phase: CharacterActionPhase,
  destination: RollDestination,
  note = ""
): RollRequest {
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

export function executeCharacterAction(
  sheet: CharacterSheet,
  actionId: string,
  phase: CharacterActionPhase = "attack"
): { action: CharacterActionDefinition; rolls: ActionRollResult[] } {
  const action = deriveCharacterActions(sheet).find((entry) => entry.id === actionId);
  if (!action) {
    throw new Error("Accion no disponible para este personaje");
  }

  const rolls: ActionRollResult[] = [];
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
  } else {
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

function inferActionLevel(...values: string[]): SkillLevel | undefined {
  const joined = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (joined.includes("maestro")) return "maestro";
  if (joined.includes("adepto")) return "adepto";
  if (joined.includes("novato")) return "novato";
  return undefined;
}

function canUseActionAtLevel(entryLevel: SkillLevel, requiredLevel?: SkillLevel): boolean {
  if (!requiredLevel) {
    return true;
  }

  const levelOrder: Record<SkillLevel, number> = {
    novato: 0,
    adepto: 1,
    maestro: 2
  };

  return levelOrder[requiredLevel] <= levelOrder[entryLevel];
}

function normalizeAttribute(value: string): AttributeKey | undefined {
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

function normalizeFormula(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function applyPassiveActionRules(sheet: CharacterSheet, actions: CharacterActionDefinition[]): CharacterActionDefinition[] {
  const filteredActions = actions.filter((action) => !shouldSuppressStandaloneStyleAction(action));
  const styleAdjustedActions = applyIntegratedCombatStyles(sheet, filteredActions);
  const unarmedCombatLevel = getRatedEntryLevel(sheet, "Combate sin armas");
  if (!unarmedCombatLevel) {
    return dedupeActions(styleAdjustedActions);
  }

  if (styleAdjustedActions.some((action) => isNaturalWeaponAction(action))) {
    return dedupeActions(styleAdjustedActions);
  }

  const hasUnarmedAction = styleAdjustedActions.some((action) => action.id === "ability:combate-sin-armas:base");
  if (!hasUnarmedAction) {
    styleAdjustedActions.push(createUnarmedAttackAction(unarmedCombatLevel));
  }

  return dedupeActions(styleAdjustedActions);
}

function shouldSuppressStandaloneStyleAction(action: CharacterActionDefinition): boolean {
  if (action.sourceType !== "ability") {
    return false;
  }

  const actionName = normalizeName(action.sourceName);
  return INTEGRATED_COMBAT_STYLE_ABILITIES.has(actionName);
}

function getRatedEntryLevel(sheet: CharacterSheet, name: string): SkillLevel | undefined {
  const target = normalizeName(name);
  return sheet.habilidades.find((entry) => normalizeName(entry.nombre) === target)?.nivel;
}

function createUnarmedAttackAction(level: SkillLevel): CharacterActionDefinition {
  return {
    id: "ability:combate-sin-armas:base",
    label: "Ataque desarmado",
    sourceType: "weapon",
    sourceName: "Combate sin armas",
    cost: "combat",
    rollAttribute: "fuerte",
    damageFormula: level === "maestro" ? "2d6" : "1d6",
    effectSummary: level === "adepto"
      ? "Ataque desarmado base. Combate sin armas permite resolver por separado un segundo ataque contra el mismo objetivo."
      : level === "maestro"
        ? "Ataque desarmado base mejorado por Combate sin armas. Los ataques desarmados infligen 2d6."
        : "Ataque desarmado base de Combate sin armas."
  };
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
  "tirador",
  "viento de acero"
]);

function applyIntegratedCombatStyles(sheet: CharacterSheet, actions: CharacterActionDefinition[]): CharacterActionDefinition[] {
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

function appendSummary(base: string, extra: string): string {
  const trimmedBase = base.trim();
  const trimmedExtra = extra.trim();
  if (!trimmedExtra) return trimmedBase;
  if (!trimmedBase) return trimmedExtra;
  if (normalizeName(trimmedBase).includes(normalizeName(trimmedExtra))) {
    return trimmedBase;
  }
  return `${trimmedBase} ${trimmedExtra}`;
}

function increaseDamageDie(formula: string): string | null {
  const normalized = formula.trim().toLowerCase();
  const match = normalized.match(/^(\d+)d(4|6|8|10)([+-]\d+)?$/);
  if (!match) return null;

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = match[3] ?? "";
  const nextSides = sides === 4 ? 6 : sides === 6 ? 8 : sides === 8 ? 10 : 12;
  return `${count}d${nextSides}${modifier}`;
}

function isAttributeEligibleForAgileKnife(attribute: AttributeKey | undefined): boolean {
  return !attribute || attribute === "diestro" || attribute === "agil";
}

function hasEquippedShield(sheet: CharacterSheet): boolean {
  const inventoryShield = sheet.inventoryItems.some(
    (item) => item.equipped && /escudo/.test(normalizeName(`${item.name} ${item.qualities}`))
  );
  if (inventoryShield) {
    return true;
  }

  const legacyShieldText = `${sheet.combate.armaPrincipal} ${sheet.combate.armaSecundaria} ${sheet.combate.armadura}`;
  return /escudo/.test(normalizeName(legacyShieldText));
}

function buildTwoHandedSummary(level: SkillLevel): string {
  if (level === "maestro") return "Armas a dos manos: el ataque ignora la armadura del objetivo y conservas el reataque del nivel adepto.";
  if (level === "adepto") return "Armas a dos manos: cuando fallas, puedes intentar un segundo ataque de regreso contra el mismo objetivo.";
  return "Armas a dos manos: el dano del arma pesada aumenta un nivel.";
}

function buildPolearmSummary(level: SkillLevel): string {
  if (level === "maestro") return "Armas de asta: si aciertas con el ataque gratuito, puedes mantener al enemigo a raya fuera de alcance.";
  if (level === "adepto") return "Armas de asta: obtienes un ataque gratuito cuando un enemigo entra en tu alcance cuerpo a cuerpo.";
  return "Armas de asta: el dano del arma larga aumenta un nivel.";
}

function buildPreySummary(level: SkillLevel): string {
  if (level === "maestro") return "Armas de presa: los ataques estrangulan e infligen 1d6 por turno ignorando armadura.";
  if (level === "adepto") return "Armas de presa: ganas una segunda oportunidad para inmovilizar y derribar al objetivo atrapado.";
  return "Armas de presa: ganas una segunda oportunidad para inmovilizar al objetivo.";
}

function buildLongWeaponSummary(level: SkillLevel): string {
  if (level === "maestro") return "Combate con arma larga: puedes derribar al objetivo y encadenar un ataque gratuito con ventaja.";
  if (level === "adepto") return "Combate con arma larga: si el rival se defiende o si usas vara/baculo tras una Defensa exitosa, obtienes un ataque gratuito.";
  return "Combate con arma larga: la tecnica mejora tu defensa con armas largas.";
}

function buildShieldSummary(level: SkillLevel): string {
  if (level === "maestro") return "Combate con escudo: tras impactar, puedes seguir con un golpe de escudo de 1d8 y derribo con [Fuerte<-Fuerte].";
  if (level === "adepto") return "Combate con escudo: tras impactar, puedes seguir con un golpe de escudo de 1d4 y derribo con [Fuerte<-Fuerte].";
  return "Combate con escudo: mientras lleves escudo mejoras la defensa y el dano de armas compatibles.";
}

function buildChainSummary(level: SkillLevel): string {
  if (level === "maestro") return "Combate con armas de cadena: puedes barrer y atacar a todos los oponentes a tu alcance.";
  if (level === "adepto") return "Combate con armas de cadena: el golpe secundario del arma de cadena inflige 1d8.";
  return "Combate con armas de cadena: el arma gana la cualidad Presa.";
}

function buildQuickKnifeSummary(level: SkillLevel): string {
  if (level === "maestro") return "Cuchillo rapido: luchas pegado al objetivo; al herir con cuchillo dificultas sus ataques y su retirada.";
  if (level === "adepto") return "Cuchillo rapido: cada accion de combate permite dos ataques separados con cuchillo al mismo objetivo.";
  return "Cuchillo rapido: puedes atacar con Agil en vez de Diestro cuando uses cuchillos.";
}

function buildFastBowSummary(level: SkillLevel): string {
  if (level === "maestro") return "Arco veloz: puedes resolver hasta tres disparos con una sola accion.";
  if (level === "adepto") return "Arco veloz: puedes disparar dos flechas con una sola accion de combate.";
  return "Arco veloz: puedes sacrificar el movimiento para disparar una segunda flecha.";
}

function buildMarksmanSummary(level: SkillLevel): string {
  if (level === "maestro") return "Tirador: el ataque a distancia puede ignorar completamente la armadura.";
  if (level === "adepto") return "Tirador: si hieres al objetivo, puedes inmovilizar su movimiento con [Diestro<-Fuerte].";
  return "Tirador: el dano de arcos y ballestas aumenta un nivel.";
}

function buildSteelWindSummary(level: SkillLevel): string {
  if (level === "maestro") return "Viento de acero: puedes lanzar hasta tres armas arrojadizas con una sola accion.";
  if (level === "adepto") return "Viento de acero: puedes lanzar dos armas arrojadizas con una sola accion.";
  return "Viento de acero: el dano de las armas arrojadizas aumenta a 1d8.";
}

function isWeaponTextMatch(action: CharacterActionDefinition, pattern: RegExp): boolean {
  return pattern.test(normalizeName(`${action.label} ${action.sourceName} ${action.effectSummary}`));
}

function isHeavyWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(pesad|mandoble|gran hacha|hacha a dos manos|martillo de guerra|arma pesada|maza pesada)/);
}

function isPolearmAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(lanza|alabarda|vara|baculo|baston|asta)/);
}

function isPreyWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(presa)/);
}

function isLongWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(larga|lanza|alabarda|vara|baculo|baston|asta)/);
}

function isMeleeWeaponAction(action: CharacterActionDefinition): boolean {
  return !isBowOrCrossbowAction(action) && !isThrownWeaponAction(action) && !isNaturalWeaponAction(action);
}

function isChainWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(cadena|latigo|mayal|flail)/);
}

function isKnifeWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(cuchillo|daga|punal|punal|estilete|kris)/);
}

function isBowWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(arco)/);
}

function isBowOrCrossbowAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(arco|ballesta)/);
}

function isThrownWeaponAction(action: CharacterActionDefinition): boolean {
  return isWeaponTextMatch(action, /(arrojadiz|jabalina|venablo|hacha arrojadiza|cuchillo arrojadizo)/);
}

function isNaturalWeaponAction(action: CharacterActionDefinition): boolean {
  if (action.sourceType !== "weapon") return false;
  const haystack = `${action.label} ${action.sourceName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /(arma natural|garras|garra|colmillos|colmillo|mordisco|cuernos|cuerno|zarpazo|pico)/.test(haystack);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dedupeActions(actions: CharacterActionDefinition[]): CharacterActionDefinition[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) {
      return false;
    }
    seen.add(action.id);
    return true;
  });
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollFormula(input: string): { formula: string; dice: number[]; total: number } | null {
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
