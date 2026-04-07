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
    return sheet.actions.map((action) => ({
      id: action.id,
      label: action.label,
      sourceType: action.sourceType === "utility" ? "ability" : action.sourceType,
      sourceName: action.sourceName,
      cost: action.cost,
      requiredLevel: action.requiredLevel,
      rollAttribute: action.rollAttribute,
      damageFormula: normalizeFormula(action.damageFormula ?? ""),
      effectSummary: action.effectSummary
    }));
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

  return dedupeActions(actions);
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
