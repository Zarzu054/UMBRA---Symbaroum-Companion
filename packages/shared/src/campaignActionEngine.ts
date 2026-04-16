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
import { findWeaponQualityOption, parseWeaponQualities } from "./weaponCatalog.js";

type FormulaBreakdownEntry = NonNullable<CharacterActionDefinition["damageBreakdown"]>[number];

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
    const storedActions = sheet.actions
      .filter((action) => isStoredSheetActionStillLinked(sheet, action))
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
        damageBreakdown: action.damageFormula
          ? [{ label: action.sourceName, formula: normalizeFormula(action.damageFormula ?? "") }]
          : undefined,
        effectSummary: action.effectSummary
      }))
      .filter((action) => isSheetActionAvailableForCharacter(sheet, action));

    const derivedActions = deriveLegacyCharacterActions(sheet);
    const filteredStoredActions = storedActions.filter(
      (action) => !hasDerivedCombatOverride(action, derivedActions)
    );
    const filteredDerivedActions = derivedActions.filter(
      (action) => !hasStoredWeaponEquivalent(action, filteredStoredActions)
    );
    return applyPassiveActionRules(sheet, dedupeActions([...filteredStoredActions, ...filteredDerivedActions]));
  }

  return deriveLegacyCharacterActions(sheet);
}

function isStoredSheetActionStillLinked(sheet: CharacterSheet, action: CharacterSheet["actions"][number]): boolean {
  const inventoryItemIds = new Set(sheet.inventoryItems.map((item) => item.id));
  if (action.linkedItemId) {
    return inventoryItemIds.has(action.linkedItemId);
  }

  if (action.id.startsWith("inventory:")) {
    return inventoryItemIds.has(action.id.slice("inventory:".length));
  }

  if (action.id.startsWith("item:")) {
    const rawItemId = action.id.slice("item:".length).split(":")[0] ?? "";
    return inventoryItemIds.has(rawItemId);
  }

  return true;
}

function hasDerivedCombatOverride(
  action: CharacterActionDefinition,
  derivedActions: CharacterActionDefinition[]
): boolean {
  if (action.sourceType !== "weapon") {
    return false;
  }

  return derivedActions.some((derivedAction) =>
    derivedAction.sourceType === "weapon" &&
    normalizeName(derivedAction.sourceName) === normalizeName(action.sourceName) &&
    normalizeName(derivedAction.label) === normalizeName(action.label) &&
    derivedAction.cost === action.cost &&
    derivedAction.rollAttribute === action.rollAttribute &&
    (derivedAction.fixedTarget ?? null) === (action.fixedTarget ?? null)
  );
}

function hasStoredWeaponEquivalent(
  action: CharacterActionDefinition,
  storedActions: CharacterActionDefinition[]
): boolean {
  if (action.sourceType !== "weapon") {
    return false;
  }

  return storedActions.some((storedAction) =>
    storedAction.sourceType === "weapon" &&
    normalizeName(storedAction.sourceName) === normalizeName(action.sourceName) &&
    normalizeName(storedAction.label) === normalizeName(action.label) &&
    storedAction.cost === action.cost &&
    storedAction.rollAttribute === action.rollAttribute &&
    (storedAction.fixedTarget ?? null) === (action.fixedTarget ?? null)
  );
}

function deriveLegacyCharacterActions(sheet: CharacterSheet): CharacterActionDefinition[] {
  const actions: CharacterActionDefinition[] = [];

  const inventoryWeapons = sheet.inventoryItems.filter((item) => item.category === "weapon" && item.quantity > 0);
  for (const weapon of inventoryWeapons) {
    const qualitySummary = buildWeaponQualitySummary(weapon.qualities);
    actions.push({
      id: `weapon:${weapon.id}`,
      label: `Atacar con ${weapon.name}`,
      sourceType: "weapon",
      sourceName: weapon.name,
      cost: "combat",
      rollAttribute: weapon.attackAttribute ?? "diestro",
      damageFormula: normalizeFormula(weapon.damageFormula),
      damageBreakdown: normalizeFormula(weapon.damageFormula)
        ? [{ label: weapon.name, formula: normalizeFormula(weapon.damageFormula) }]
        : undefined,
      effectSummary: [weapon.description, qualitySummary, "Tirada de ataque y, si procede, da\u00f1o del arma."].filter(Boolean).join(" ")
    });
    actions.push(...buildWeaponQualityActions(weapon));
  }

  if (inventoryWeapons.length === 0) {
    for (const slot of LEGACY_WEAPON_SLOTS) {
      const weaponName = slot.sourceName(sheet).trim();
      if (!weaponName) continue;
      const normalizedWeaponName = normalizeName(weaponName);
      if (normalizedWeaponName === "natural" || normalizedWeaponName === "arma natural" || normalizedWeaponName === "armas naturales") continue;

      actions.push({
        id: slot.id,
        label: `Atacar con ${weaponName}`,
        sourceType: "weapon",
        sourceName: weaponName,
        cost: "combat",
        rollAttribute: slot.attribute(sheet),
        damageFormula: normalizeFormula(slot.damage(sheet)),
        damageBreakdown: normalizeFormula(slot.damage(sheet))
          ? [{ label: weaponName, formula: normalizeFormula(slot.damage(sheet)) }]
          : undefined,
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

function buildWeaponQualitySummary(rawQualities: string): string {
  const qualities = parseWeaponQualities(rawQualities);
  if (qualities.length === 0) {
    return "";
  }

  return qualities
    .map((quality) => {
      const definition = findWeaponQualityOption(quality);
      if (definition?.grantsAction === "thrown_attack") {
        return "";
      }
      return definition ? `${definition.label}: ${definition.summary}` : quality;
    })
    .filter(Boolean)
    .join(" ");
}

function buildWeaponQualityActions(weapon: CharacterSheet["inventoryItems"][number]): CharacterActionDefinition[] {
  const qualities = parseWeaponQualities(weapon.qualities);
  const actions: CharacterActionDefinition[] = [];

  for (const quality of qualities) {
    const definition = findWeaponQualityOption(quality);
    if (!definition?.grantsAction) {
      continue;
    }

    if (definition.grantsAction === "thrown_attack") {
      actions.push({
        id: `weapon:${weapon.id}:thrown`,
        label: `Lanzar ${weapon.name}`,
        sourceType: "weapon",
        sourceName: weapon.name,
        cost: "combat",
        rollAttribute: weapon.attackAttribute ?? "diestro",
        damageFormula: normalizeFormula(weapon.damageFormula),
        damageBreakdown: normalizeFormula(weapon.damageFormula)
          ? [{ label: `${weapon.name} (lanzada)`, formula: normalizeFormula(weapon.damageFormula) }]
          : undefined,
        effectSummary: `${definition.label}: ${definition.summary}`
      });
      continue;
    }

    if (definition.grantsAction === "reload") {
      actions.push({
        id: `weapon:${weapon.id}:reload`,
        label: `Recargar ${weapon.name}`,
        sourceType: "weapon",
        sourceName: weapon.name,
        cost: "movement",
        effectSummary: `${definition.label}: ${definition.summary}`
      });
    }
  }

  return actions;
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
        fixedTarget: action.fixedTarget,
        damageFormula: action.damageFormula,
        damageBreakdown: action.damageFormula ? [{ label: sourceName, formula: normalizeFormula(action.damageFormula) ?? action.damageFormula }] : undefined,
        effectSummary: action.effectSummary
      }))
      .filter((action) => isActionAvailableForEntryLevel(entryLevel, action.requiredLevel));
  }

  const fallbackAction = inferFallbackAction(sourceType, sourceName, fallbackText);
  return fallbackAction && isActionAvailableForEntryLevel(entryLevel, fallbackAction.requiredLevel) ? [fallbackAction] : [];
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
  note = "",
  selectedDamageModifierIds: string[] = []
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
    formulaBreakdown: damageRoll.breakdown,
    note: buildDamageRollNote(damageRoll, note)
  };
}

export function executeCharacterAction(
  sheet: CharacterSheet,
  actionId: string,
  phase: CharacterActionPhase = "attack",
  selectedDamageModifierIds: string[] = []
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
  } else {
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

function inferActionLevel(...values: string[]): SkillLevel | undefined {
  const joined = values.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (joined.includes("maestro")) return "maestro";
  if (joined.includes("adepto")) return "adepto";
  if (joined.includes("novato")) return "novato";
  return undefined;
}

function isActionAvailableForEntryLevel(entryLevel: SkillLevel, requiredLevel?: SkillLevel): boolean {
  if (!requiredLevel) {
    return true;
  }
  return entryLevel === requiredLevel;
}

function isSheetActionAvailableForCharacter(
  sheet: CharacterSheet,
  action: CharacterActionDefinition
): boolean {
  if (
    action.sourceType !== "ability" &&
    action.sourceType !== "power" &&
    action.sourceType !== "ritual"
  ) {
    return true;
  }

  const entryLevel = getSourceEntryLevel(sheet, action.sourceType, action.sourceName);
  if (!entryLevel) {
    return true;
  }

  return isActionAvailableForEntryLevel(entryLevel, action.requiredLevel);
}

function getSourceEntryLevel(
  sheet: CharacterSheet,
  sourceType: "ability" | "power" | "ritual",
  sourceName: string
): SkillLevel | undefined {
  const target = normalizeName(sourceName);
  const entries = sourceType === "ability"
    ? sheet.habilidades
    : sourceType === "power"
      ? sheet.poderesMisticos
      : sheet.rituales;

  return entries.find((entry) => normalizeName(entry.nombre) === target)?.nivel;
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
  ensureBerserkerDefenseAction(sheet, styleAdjustedActions);
  const visibleActions = styleAdjustedActions;
  const unarmedCombatLevel = getRatedEntryLevel(sheet, "Combate sin armas");
  const hasUnarmedAction = visibleActions.some((action) => action.id === "ability:combate-sin-armas:base");
  if (!hasUnarmedAction) {
    const [unarmedAction] = applyIntegratedCombatStyles(sheet, [createUnarmedAttackAction(sheet, unarmedCombatLevel)]);
    visibleActions.push(unarmedAction);
  }
  const naturalWeaponAction = createNaturalWeaponAttackAction(sheet);
  if (naturalWeaponAction && !visibleActions.some((action) => action.id === naturalWeaponAction.id)) {
    const [styledNaturalWeaponAction] = applyIntegratedCombatStyles(sheet, [naturalWeaponAction]);
    visibleActions.push(styledNaturalWeaponAction);
  }

  applyConditionalDamageVariants(sheet, visibleActions);
  return dedupeActions(visibleActions);
}

function applyConditionalDamageVariants(sheet: CharacterSheet, actions: CharacterActionDefinition[]): void {
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

type ConditionalDamageBonus = {
  id: string;
  label: string;
  formula: string;
  appliesTo: "melee" | "ranged" | "any";
};

function collectConditionalDamageBonuses(sheet: CharacterSheet, actions: CharacterActionDefinition[]): ConditionalDamageBonus[] {
  const bonuses: ConditionalDamageBonus[] = [];
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

function getRobustDamageBonus(sheet: CharacterSheet): ConditionalDamageBonus | null {
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

function getNaturalWeaponDamageBonus(sheet: CharacterSheet): ConditionalDamageBonus | null {
  const naturalWeaponLevel = getTraitLevel(sheet, ["arma natural", "armas naturales"]);
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

function getRobustLevel(sheet: CharacterSheet): number {
  return getTraitLevel(sheet, ["robusto", "robusta"]);
}

function getTraitLevel(sheet: CharacterSheet, traitNames: string | string[]): number {
  const aliases = (Array.isArray(traitNames) ? traitNames : [traitNames]).map((entry) => normalizeName(entry));
  const ratedAbilityLevel = getRatedAbilityLevelByAliases(sheet, aliases);
  if (ratedAbilityLevel > 0) {
    return ratedAbilityLevel;
  }

  const traitSources = [
    ...sheet.rasgos,
    ...String(sheet.noteSections?.traits ?? "")
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  ];

  for (const rawTrait of traitSources) {
    const normalized = normalizeName(rawTrait);
    if (!aliases.some((alias) => normalized.startsWith(alias))) {
      continue;
    }

    if (/\bmaestro\b/.test(normalized)) return 3;
    if (/\badepto\b/.test(normalized)) return 2;
    if (/\bnovato\b/.test(normalized)) return 1;
    if (/\biii\b|\b3\b/.test(normalized)) return 3;
    if (/\bii\b|\b2\b/.test(normalized)) return 2;
    return 1;
  }

  return 0;
}

function getRatedAbilityLevelByAliases(sheet: CharacterSheet, aliases: string[]): number {
  let highest = 0;

  for (const entry of sheet.habilidades) {
    const normalized = normalizeName(entry.nombre);
    if (!aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `) || normalized.startsWith(`${alias} (`))) {
      continue;
    }

    highest = Math.max(highest, skillLevelToNumber(entry.nivel));
  }

  return highest;
}

function skillLevelToNumber(level?: SkillLevel): number {
  switch (level) {
    case "maestro":
      return 3;
    case "adepto":
      return 2;
    case "novato":
      return 1;
    default:
      return 0;
  }
}

function convertMonsterFlatBonusToPlayerRoll(value: number): string {
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

function inferConditionalBonusApplicability(text: string): "melee" | "ranged" | "any" {
  if (/(combate cuerpo a cuerpo|cuerpo a cuerpo|ataque cuerpo a cuerpo)/.test(text)) {
    return "melee";
  }
  if (/(ataque a distancia|disparo|proyectil|arco|ballesta)/.test(text)) {
    return "ranged";
  }
  return "any";
}

function doesBonusApplyToWeaponAction(bonus: ConditionalDamageBonus, action: CharacterActionDefinition): boolean {
  if (bonus.appliesTo === "any") {
    return true;
  }
  if (bonus.appliesTo === "melee") {
    return !isBowOrCrossbowAction(action) && !isThrownWeaponAction(action);
  }
  return isBowOrCrossbowAction(action) || isThrownWeaponAction(action);
}

function combineDamageFormulas(base: string, bonus: string): string {
  const normalizedBase = normalizeFormula(base) ?? base.trim().toLowerCase();
  const normalizedBonus = normalizeFormula(bonus) ?? bonus.trim().toLowerCase();
  if (!normalizedBonus) {
    return normalizedBase;
  }
  return normalizedBonus.startsWith("+") || normalizedBonus.startsWith("-")
    ? `${normalizedBase}${normalizedBonus}`
    : `${normalizedBase}+${normalizedBonus}`;
}

function resolveDamageRoll(
  action: CharacterActionDefinition,
  selectedDamageModifierIds: string[] = []
): { label: string; formula: string; selectedModifierIds: string[]; selectedModifierLabels: string[]; breakdown: FormulaBreakdownEntry[] } | null {
  const baseFormula = action.damageFormula;
  if (!baseFormula) {
    return null;
  }

  const modifiers = action.damageModifiers ?? [];
  const selectedModifiers = modifiers.filter((modifier) => selectedDamageModifierIds.includes(modifier.id));
  const formula = selectedModifiers.reduce((currentFormula, modifier) => combineDamageFormulas(currentFormula, modifier.formula), baseFormula);
  const selectedModifierLabels = selectedModifiers.map((modifier) => modifier.label);
  const breakdown = [...(action.damageBreakdown ?? [{ label: action.sourceName, formula: baseFormula }])];

  for (const modifier of selectedModifiers) {
    breakdown.push({
      label: modifier.label,
      formula: modifier.formula
    });
  }

  return {
    label: selectedModifierLabels.length > 0 ? `Danio (${selectedModifierLabels.join(", ")})` : "Danio",
    formula,
    selectedModifierIds: selectedModifiers.map((modifier) => modifier.id),
    selectedModifierLabels,
    breakdown
  };
}

function buildDamageRollNote(
  damageRoll: { selectedModifierLabels: string[] },
  note: string
): string | undefined {
  const parts = [];
  if (damageRoll.selectedModifierLabels.length > 0) {
    parts.push(`Modificadores: ${damageRoll.selectedModifierLabels.join(", ")}`);
  }
  if (note.trim()) {
    parts.push(note.trim());
  }
  return parts.length > 0 ? parts.join(" | ") : undefined;
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

function createUnarmedAttackAction(sheet: CharacterSheet, level?: SkillLevel): CharacterActionDefinition {
  const baseDamage = !level ? "1d4" : level === "maestro" ? "2d6" : "1d6";
  return {
    id: "ability:combate-sin-armas:base",
    label: "Ataque desarmado",
    sourceType: "weapon",
    sourceName: level ? "Combate sin armas" : "Ataque basico",
    cost: "combat",
    rollAttribute: "diestro",
    damageFormula: baseDamage,
    damageBreakdown: [{ label: level ? "Combate sin armas" : "Ataque basico", formula: baseDamage }],
    effectSummary: !level
      ? "Ataque desarmado basico disponible para cualquier personaje."
      : level === "adepto"
        ? "Ataque desarmado base. Combate sin armas permite resolver por separado un segundo ataque contra el mismo objetivo."
        : level === "maestro"
          ? "Ataque desarmado base mejorado por Combate sin armas. Los ataques desarmados infligen 2d6."
          : "Ataque desarmado base de Combate sin armas."
  };
}

function getNaturalWeaponDamageFormula(sheet: CharacterSheet, naturalWeaponLevel: number): string {
  const baseDamage = naturalWeaponLevel === 3 ? "1d10" : naturalWeaponLevel === 2 ? "1d8" : "1d6";
  const unarmedCombatLevel = getRatedEntryLevel(sheet, "Combate sin armas");
  return unarmedCombatLevel ? (increaseDamageDie(baseDamage) ?? baseDamage) : baseDamage;
}

function createNaturalWeaponAttackAction(sheet: CharacterSheet): CharacterActionDefinition | null {
  const naturalWeaponLevel = getTraitLevel(sheet, ["arma natural", "armas naturales"]);
  if (naturalWeaponLevel <= 0) {
    return null;
  }

  const baseDamage = naturalWeaponLevel === 3 ? "1d10" : naturalWeaponLevel === 2 ? "1d8" : "1d6";
  const unarmedCombatLevel = getRatedEntryLevel(sheet, "Combate sin armas");
  const damageFormula = unarmedCombatLevel ? (increaseDamageDie(baseDamage) ?? baseDamage) : baseDamage;
  const damageBreakdown: FormulaBreakdownEntry[] = unarmedCombatLevel
    ? [
        { label: "Arma natural", formula: baseDamage },
        { label: "Combate sin armas", detail: `Mejora el dado base (${capitalizeSkillLevel(unarmedCombatLevel)}).` }
      ]
    : [{ label: "Arma natural", formula: baseDamage }];
  return {
    id: `trait:arma-natural:${naturalWeaponLevel}`,
    label: "Ataque con Arma natural",
    sourceType: "weapon",
    sourceName: "Arma natural",
    cost: "combat",
    rollAttribute: "diestro",
    damageFormula,
    damageBreakdown,
    effectSummary: "Ataque cuerpo a cuerpo realizado con las armas naturales del personaje."
  };
}

function ensureBerserkerDefenseAction(sheet: CharacterSheet, actions: CharacterActionDefinition[]): void {
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

function capitalizeSkillLevel(level: SkillLevel): "Novato" | "Adepto" | "Maestro" {
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

function applyIntegratedCombatStyles(sheet: CharacterSheet, actions: CharacterActionDefinition[]): CharacterActionDefinition[] {
  return actions.map((action) => {
    if (action.sourceType !== "weapon") {
      return action;
    }

    let next = {
      ...action,
      damageBreakdown: action.damageBreakdown
        ? [...action.damageBreakdown]
        : action.damageFormula
          ? [{ label: action.sourceName, formula: action.damageFormula }]
          : undefined
    };
    const twoHandedLevel = getRatedEntryLevel(sheet, "Armas a dos manos");
    if (twoHandedLevel && isHeavyWeaponAction(next)) {
      if (next.damageFormula) {
        next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
        appendDamageBreakdownDetail(next, "Armas a dos manos", `Mejora el dado base (${capitalizeSkillLevel(twoHandedLevel)}).`);
      }
      next.effectSummary = appendSummary(next.effectSummary, buildTwoHandedSummary(twoHandedLevel));
    }

    const polearmLevel = getRatedEntryLevel(sheet, "Armas de asta");
    if (polearmLevel && isPolearmAction(next)) {
      if (next.damageFormula) {
        next.damageFormula = normalizeFormula(increaseDamageDie(next.damageFormula) ?? next.damageFormula);
        appendDamageBreakdownDetail(next, "Armas de asta", `Mejora el dado base (${capitalizeSkillLevel(polearmLevel)}).`);
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
        appendDamageBreakdownDetail(next, "Tirador", `Mejora el dado base (${capitalizeSkillLevel(marksmanLevel)}).`);
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
        appendDamageBreakdownDetail(next, "Viento de acero", `Mejora el dado base (${capitalizeSkillLevel(steelWindLevel)}).`);
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
  const match = normalized.match(/^(\d+)d(4|6|8|10|12)([+-]\d+)?$/);
  if (!match) return null;

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

function appendDamageBreakdownDetail(action: CharacterActionDefinition, label: string, detail: string): void {
  if (!action.damageBreakdown) {
    action.damageBreakdown = [];
  }

  if (action.damageBreakdown.some((entry) => normalizeName(entry.label) === normalizeName(label) && normalizeName(entry.detail ?? "") === normalizeName(detail))) {
    return;
  }

  action.damageBreakdown.push({ label, detail });
}

function isAttributeEligibleForAgileKnife(attribute: AttributeKey | undefined): boolean {
  return !attribute || attribute === "diestro" || attribute === "agil";
}

function isAttributeEligibleForIronFist(attribute: AttributeKey | undefined): boolean {
  return !attribute || attribute === "diestro";
}

function hasEquippedShield(sheet: CharacterSheet): boolean {
  const inventoryShield = sheet.inventoryItems.some(
    (item) => item.quantity > 0 && /escudo/.test(normalizeName(`${item.name} ${item.qualities}`))
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

function buildIronFistSummary(level: SkillLevel): string {
  if (level === "maestro") return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro y el bono de dano se resuelve desde el modal de dano.";
  if (level === "adepto") return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro y pueden beneficiarse del bono de dano de la habilidad.";
  return "Golpe de hierro: tus ataques cuerpo a cuerpo usan Fuerte en vez de Diestro.";
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

function buildSixthSenseSummary(level: SkillLevel): string {
  if (level === "maestro") return "Sexto sentido: puedes combatir a distancia guiandote por otros sentidos incluso en oscuridad o ceguera.";
  if (level === "adepto") return "Sexto sentido: tu intuicion mejora tambien la iniciativa y la Defensa.";
  return "Sexto sentido: tus ataques a distancia usan Atento en vez de Diestro.";
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
  return !isRangedWeaponAction(action);
}

function isRangedWeaponAction(action: CharacterActionDefinition): boolean {
  return isBowOrCrossbowAction(action) || isThrownWeaponAction(action) || isWeaponTextMatch(action, /(honda|tirachinas|onda)/);
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
    const signature = buildActionDedupeSignature(action);
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function buildActionDedupeSignature(action: CharacterActionDefinition): string {
  return [
    action.sourceType,
    normalizeName(action.sourceName),
    normalizeName(action.label),
    action.cost,
    action.requiredLevel ?? "",
    action.rollAttribute ?? "",
    action.fixedTarget ?? "",
    normalizeFormula(action.damageFormula ?? "") ?? "",
    normalizeName(action.effectSummary ?? "")
  ].join("|");
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function rollFormula(input: string): { formula: string; dice: number[]; total: number } | null {
  const normalized = input.replace(/\s+/g, "").toLowerCase();
  const terms = normalized.match(/[+-]?[^+-]+/g);
  if (!terms || terms.length === 0 || terms.join("") !== normalized) {
    return null;
  }

  const dice: number[] = [];
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
