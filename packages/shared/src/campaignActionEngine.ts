import type {
  ActionRollResult,
  AttributeKey,
  CharacterActionDefinition,
  CharacterSheet
} from "./index.js";

const WEAPON_SLOTS = [
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
  const actions: CharacterActionDefinition[] = [];

  for (const slot of WEAPON_SLOTS) {
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
      effectSummary: "Tirada de ataque y, si procede, daño del arma."
    });
  }

  for (const entry of sheet.habilidades) {
    actions.push(...mapRatedEntryActions("ability", entry.nombre, entry.acciones, entry.efecto || entry.notas));
  }

  for (const entry of sheet.poderesMisticos) {
    actions.push(...mapRatedEntryActions("power", entry.nombre, entry.acciones, entry.efecto || entry.notas));
  }

  for (const entry of sheet.rituales) {
    actions.push(...mapRatedEntryActions("ritual", entry.nombre, entry.acciones, entry.efecto || entry.notas));
  }

  return actions;
}

function mapRatedEntryActions(
  sourceType: "ability" | "power" | "ritual",
  sourceName: string,
  configuredActions: CharacterSheet["habilidades"][number]["acciones"],
  fallbackText: string
): CharacterActionDefinition[] {
  if (configuredActions.length > 0) {
    return configuredActions.map((action) => ({
      id: `${sourceType}:${sourceName}:${action.id}`,
      label: action.label,
      sourceType,
      sourceName,
      cost: action.cost,
      rollAttribute: action.rollAttribute,
      damageFormula: action.damageFormula,
      effectSummary: action.effectSummary
    }));
  }

  const fallbackAction = inferFallbackAction(sourceType, sourceName, fallbackText);
  return fallbackAction ? [fallbackAction] : [];
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

  if (normalized.startsWith("reaccion.") || normalized.startsWith("reacción.")) {
    return {
      id: `${sourceType}:${sourceName}:fallback`,
      label: `Usar ${sourceName}`,
      sourceType,
      sourceName,
      cost: "reaction",
      effectSummary: text
    };
  }

  if (normalized.startsWith("activa.") || normalized.includes("accion de combate") || normalized.includes("acción de combate")) {
    return {
      id: `${sourceType}:${sourceName}:fallback`,
      label: `Usar ${sourceName}`,
      sourceType,
      sourceName,
      cost: "combat",
      effectSummary: text
    };
  }

  if (normalized.includes("accion de movimiento") || normalized.includes("acción de movimiento")) {
    return {
      id: `${sourceType}:${sourceName}:fallback`,
      label: `Usar ${sourceName}`,
      sourceType,
      sourceName,
      cost: "movement",
      effectSummary: text
    };
  }

  return null;
}

export function executeCharacterAction(
  sheet: CharacterSheet,
  actionId: string
): { action: CharacterActionDefinition; rolls: ActionRollResult[] } {
  const action = deriveCharacterActions(sheet).find((entry) => entry.id === actionId);
  if (!action) {
    throw new Error("Accion no disponible para este personaje");
  }

  const rolls: ActionRollResult[] = [];
  if (action.rollAttribute) {
    const die = rollDie(20);
    const target = sheet.atributos[action.rollAttribute];
    rolls.push({
      kind: "attribute_check",
      label: `Prueba de ${action.rollAttribute}`,
      dice: [die],
      total: die,
      formula: "1d20",
      target,
      success: die <= target
    });
  }

  if (action.damageFormula) {
    const damage = rollFormula(action.damageFormula);
    if (damage) {
      rolls.push({
        kind: "damage",
        label: "Daño",
        dice: damage.dice,
        total: damage.total,
        formula: damage.formula
      });
    }
  }

  return { action, rolls };
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
