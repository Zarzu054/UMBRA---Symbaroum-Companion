import type { CharacterChangeDiff, CharacterChangeOperation } from "@umbra/shared";

export type PresentedCharacterChange = {
  key: string;
  section: string;
  title: string;
  description?: string;
  operation: CharacterChangeOperation;
  before?: string;
  after?: string;
};

type CollectionInfo = {
  section: string;
  singular: string;
  gender: "f" | "m";
};

const COLLECTIONS: Record<string, CollectionInfo> = {
  actions: { section: "Acciones", singular: "Acción", gender: "f" },
  inventoryItems: { section: "Inventario", singular: "Objeto", gender: "m" },
  inventario: { section: "Inventario", singular: "Objeto", gender: "m" },
  conditions: { section: "Condiciones", singular: "Condición", gender: "f" },
  condiciones: { section: "Condiciones", singular: "Condición", gender: "f" },
  habilidades: { section: "Capacidades", singular: "Habilidad", gender: "f" },
  poderesMisticos: { section: "Capacidades", singular: "Poder", gender: "m" },
  rituales: { section: "Capacidades", singular: "Ritual", gender: "m" },
  rasgos: { section: "Capacidades", singular: "Rasgo", gender: "m" },
  rasgosMonstruosos: { section: "Capacidades", singular: "Rasgo", gender: "m" },
  bendiciones: { section: "Capacidades", singular: "Bendición", gender: "f" },
  cargas: { section: "Capacidades", singular: "Carga", gender: "f" },
  capabilitySelections: { section: "Capacidades", singular: "Capacidad", gender: "f" },
  personalNotes: { section: "Notas", singular: "Nota", gender: "f" },
  noteSections: { section: "Notas", singular: "Nota", gender: "f" },
  artefactos: { section: "Artefactos", singular: "Artefacto", gender: "m" }
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  nombre: "Nombre",
  label: "Nombre",
  title: "Título",
  titulo: "Título",
  level: "Nivel",
  nivel: "Nivel",
  notes: "Notas",
  notas: "Notas",
  description: "Descripción",
  descripcion: "Descripción",
  effectSummary: "Efecto",
  quantity: "Cantidad",
  cantidad: "Cantidad",
  active: "Estado",
  activa: "Estado",
  enabled: "Estado",
  equipped: "Equipado",
  current: "Valor actual",
  maximum: "Valor máximo",
  max: "Valor máximo",
  temporal: "Corrupción temporal",
  permanente: "Corrupción permanente",
  experienciaTotal: "PX total",
  experienciaGastada: "PX gastada",
  taleros: "Táleros",
  chelines: "Chelines",
  ortegs: "Ortegs"
};

const SECTION_LABELS: Record<string, string> = {
  sheet: "Ficha",
  identidad: "Identidad",
  atributos: "Atributos",
  combate: "Combate",
  robustez: "Recursos",
  corrupcion: "Corrupción",
  progreso: "Progreso",
  trasfondo: "Trasfondo",
  campaign: "Campaña",
  professionMemberships: "Profesiones"
};

const CONDITION_LABELS: Record<string, string> = {
  burning: "Ardiendo",
  stunned: "Aturdido",
  blind: "Cegado",
  blinded: "Cegado",
  prone: "Derribado",
  poisoned: "Envenenado",
  immobilized: "Inmovilizado",
  paralyzed: "Paralizado",
  bleeding: "Sangrando",
  dying: "Moribundo",
  corrupted: "Corrompido"
};

const LEVEL_WORD = /\b(?:novato|principiante|adepto|maestro|nivel\s+[ivx]+)\b/iu;
const GENERIC_ID_PARTS = new Set(["ability", "action", "condition", "item", "trait", "power", "ritual", "skill", "custom"]);
const LONG_TEXT_FIELDS = new Set(["notes", "notas", "content", "contenido", "description", "descripcion", "effectSummary", "historia", "history", "apariencia", "appearance"]);

function rootPath(path: string): string {
  return path.replace(/^sheet\./, "");
}

function rootName(path: string): string {
  return rootPath(path).split(/[.[]/, 1)[0] ?? "";
}

function lastField(path: string): string {
  return rootPath(path).split(".").at(-1)?.replace(/\]$/, "") ?? path;
}

function collectionKey(path: string): string | null {
  const normalized = rootPath(path);
  const match = normalized.match(/^([^.[\]]+)\[([^\]]+)\]/);
  return match ? `${match[1]}[${match[2]}]` : null;
}

function collectionIdentifier(path: string): string {
  const match = rootPath(path).match(/^[^.[\]]+\[([^\]]+)\]/);
  return match?.[1] ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.replace(/\bnovato\b/giu, "principiante").trim();
}

function normalizedValue(value: unknown): unknown {
  if (typeof value === "string") return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalizedValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizedValue(entry)]));
  return value;
}

function valuesEqual(before: unknown, after: unknown): boolean {
  return JSON.stringify(normalizedValue(before)) === JSON.stringify(normalizedValue(after));
}

function displayValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return "Sin especificar";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized.length <= 90 && !normalized.includes("\n") ? normalized : undefined;
  }
  return undefined;
}

function titleFromRecord(value: unknown): string | null {
  if (!isRecord(value)) return null;
  for (const key of ["name", "nombre", "label", "title", "titulo"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return normalizeText(candidate).replace(/\s*\([^)]*\)\s*$/u, "");
  }
  return null;
}

function humanIdentifier(identifier: string): string {
  const conditionId = identifier.toLocaleLowerCase("es").replace(/^condition[-_:]/u, "");
  if (CONDITION_LABELS[conditionId]) return CONDITION_LABELS[conditionId];

  const parts = identifier
    .split(/[:|]/u)
    .map((part) => part.trim())
    .filter((part) => part && !GENERIC_ID_PARTS.has(part.toLocaleLowerCase("es")) && !LEVEL_WORD.test(part));
  const selected = parts.find((part) => /[a-záéíóúñ]/iu.test(part) && !/^[a-f\d-]{12,}$/iu.test(part)) ?? identifier;
  return normalizeText(selected)
    .replace(/^condition[-_]/iu, "")
    .replace(/[-_]+/gu, " ")
    .replace(/^./u, (letter) => letter.toLocaleUpperCase("es"));
}

function itemName(changes: CharacterChangeDiff[], identifier: string): string {
  for (const change of changes) {
    const fromRecord = titleFromRecord(change.after) ?? titleFromRecord(change.before);
    if (fromRecord) return fromRecord;
  }
  for (const change of changes) {
    if (["name", "nombre", "label", "title", "titulo"].includes(lastField(change.path))) {
      const scalar = displayValue(change.after) ?? displayValue(change.before);
      if (scalar) return scalar.replace(/\s*\([^)]*\)\s*$/u, "");
    }
  }
  return humanIdentifier(identifier);
}

function humanField(path: string, fallback: string): string {
  const key = collectionKey(path);
  if (key && rootPath(path) === key) return "Contenido";
  const field = lastField(path);
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  if (fallback && !/^(label|notes|effect summary|condition[-_])/iu.test(fallback)) return fallback;
  return field
    .replace(/([a-záéíóúñ])([A-Z])/gu, "$1 $2")
    .replace(/[-_]+/gu, " ")
    .replace(/^./u, (letter) => letter.toLocaleUpperCase("es"));
}

function humanSection(change: CharacterChangeDiff): string {
  const root = rootName(change.path);
  return COLLECTIONS[root]?.section ?? SECTION_LABELS[root] ?? (change.section === "Ficha" ? "Datos del personaje" : change.section);
}

function operationAdjective(operation: CharacterChangeOperation, gender: CollectionInfo["gender"]): string {
  if (operation === "added") return gender === "f" ? "añadida" : "añadido";
  if (operation === "removed") return gender === "f" ? "eliminada" : "eliminado";
  return gender === "f" ? "actualizada" : "actualizado";
}

function conciseFields(changes: CharacterChangeDiff[]): string[] {
  return [...new Set(changes
    .map((change) => humanField(change.path, change.label))
    .filter((field) => field !== "Nombre" && field !== "Contenido"))];
}

function mayShowValues(change: CharacterChangeDiff): boolean {
  return !LONG_TEXT_FIELDS.has(lastField(change.path));
}

function presentCollectionGroup(key: string, changes: CharacterChangeDiff[]): PresentedCharacterChange {
  const info = COLLECTIONS[rootName(changes[0]!.path)]!;
  const operation = changes.every((change) => change.operation === "added")
    ? "added"
    : changes.every((change) => change.operation === "removed")
      ? "removed"
      : "changed";
  const name = itemName(changes, collectionIdentifier(changes[0]!.path));
  const fields = conciseFields(changes);
  const single = changes.length === 1 ? changes[0]! : null;
  const before = single && mayShowValues(single) ? displayValue(single.before) : undefined;
  const after = single && mayShowValues(single) ? displayValue(single.after) : undefined;

  if ((rootName(changes[0]!.path) === "conditions" || rootName(changes[0]!.path) === "condiciones") && single) {
    const active = single.operation === "added" || single.after === true;
    const inactive = single.operation === "removed" || single.after === false;
    return {
      key,
      section: info.section,
      title: `${info.singular} «${name}» ${active ? "activada" : inactive ? "desactivada" : "actualizada"}`,
      operation
    };
  }

  return {
    key,
    section: info.section,
    title: `${info.singular} «${name}» ${operationAdjective(operation, info.gender)}`,
    operation,
    ...(operation === "changed" && fields.length ? { description: `Se modificó ${new Intl.ListFormat("es", { style: "long", type: "conjunction" }).format(fields.map((field) => field.toLocaleLowerCase("es")))}.` } : {}),
    ...(operation === "changed" && before !== undefined && after !== undefined ? { before, after } : {})
  };
}

function presentSingle(change: CharacterChangeDiff, index: number): PresentedCharacterChange {
  const field = humanField(change.path, change.label);
  const before = mayShowValues(change) ? displayValue(change.before) : undefined;
  const after = mayShowValues(change) ? displayValue(change.after) : undefined;
  return {
    key: `${change.path}-${index}`,
    section: humanSection(change),
    title: field,
    operation: change.operation,
    ...(change.operation === "added" ? { description: "Se añadió este dato." } : {}),
    ...(change.operation === "removed" ? { description: "Se eliminó este dato." } : {}),
    ...(change.operation === "changed" && before === undefined && after === undefined ? { description: "Se actualizó su contenido." } : {}),
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {})
  };
}

export function presentCharacterChanges(changes: CharacterChangeDiff[]): PresentedCharacterChange[] {
  const meaningful = changes.filter((change) => !valuesEqual(change.before, change.after));
  const collectionGroups = new Map<string, CharacterChangeDiff[]>();
  const singles: Array<{ change: CharacterChangeDiff; index: number }> = [];

  meaningful.forEach((change, index) => {
    const key = collectionKey(change.path);
    if (key && COLLECTIONS[rootName(change.path)]) {
      collectionGroups.set(key, [...(collectionGroups.get(key) ?? []), change]);
    } else {
      singles.push({ change, index });
    }
  });

  return [
    ...Array.from(collectionGroups.entries(), ([key, grouped]) => presentCollectionGroup(key, grouped)),
    ...singles.map(({ change, index }) => presentSingle(change, index))
  ];
}
