import { useEffect, useMemo, useRef, useState } from "react";
import {
  MONSTER_ATTRIBUTE_KEYS,
  MONSTER_ATTRIBUTE_LABELS,
  SYMBAROUM_ABILITIES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RITUALS,
  averageDiceFormula,
  getActorCapabilityXpDelta,
  getDerivedMonsterSheetStats,
  getMonsterCreationXp,
  getMonsterTraitLevel,
  type ActorCapabilitySelection,
  type Monster,
  type MonsterAttributeKey,
  type MonsterSheet,
  type MonsterWeaponProfile,
  type SymbaroumCapability
} from "@umbra/shared";
import {
  findCompendiumEntryByTypeAndName,
  getCompendiumSourcePdfUrl,
  type CompendiumEntry
} from "../models/compendiumEntries";
import { buildPdfViewerUrl } from "../services/pdfViewer";
import { CharacterSheetBackgroundPicker } from "./CharacterSheetBackgroundPicker";

type Props = {
  monster: Monster;
  backgroundPreferenceScope: string;
  official?: boolean;
  busy?: boolean;
  onClose: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

function signedModifier(value: number): string {
  const modifier = 10 - value;
  return modifier > 0 ? `+${modifier}` : String(modifier);
}

function sourcePdf(source: string): string | null {
  if (source === "Libro Básico") return "/books/libro-basico.pdf";
  if (source === "Códice de monstruos") return "/books/codice-de-monstruos.pdf";
  return null;
}

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

type CapabilityLevel = NonNullable<ActorCapabilitySelection["level"]>;
type CapabilityTierLabel = "Novato" | "Adepto" | "Maestro";
type MonsterCapabilityItem = {
  id: string;
  name: string;
  kind: SymbaroumCapability["tipo"] | "publicada";
  level: CapabilityLevel | null;
  canonical: SymbaroumCapability | null;
  publishedText: string;
  descriptionOverride?: string;
  source: string;
  page?: number;
  adaptationNote?: string;
};
type MonsterTraitLevel = "I" | "II" | "III";
type MonsterTraitItem = {
  id: string;
  name: string;
  publishedText: string;
  qualifier: string;
  level: MonsterTraitLevel | null;
  entry: CompendiumEntry | null;
  descriptionOverride?: string;
  adaptationNote?: string;
  source: string;
  page?: number;
};
type CalculationAuditRow = { label: string; value: string; explanation?: string };
type CalculationAudit = {
  id: string;
  title: string;
  result: string;
  formula: string;
  rows: CalculationAuditRow[];
  notes?: string[];
  warning?: string;
};

const CAPABILITY_LEVEL_ORDER: Record<CapabilityLevel, number> = { novato: 1, adepto: 2, maestro: 3 };
const CAPABILITY_CATALOG = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS];
const PUBLISHED_CAPABILITY_DETAILS: Record<string, string> = {
  "combate con latigo": "Esta técnica combina un látigo en una mano con un arma a una mano en la otra. Novato: Activa. Si el ataque con látigo impacta, el personaje obtiene un ataque gratuito con el arma a una mano, aunque el látigo no cause daño. Adepto: Activa. Como en novato, pero el látigo obstaculiza al enemigo y el ataque gratuito impacta automáticamente. Maestro: Activa. Como en adepto, pero el combatiente acerca al enemigo para que el ataque gratuito inflija +1D6 de daño. Ref: Códice de monstruos, p.123.",
  "sutileza a dos manos": "El personaje maneja grandes espadas a dos manos con precisión y aprovecha la longitud del arma contra toda clase de oponentes. Novato: Pasiva. Las espadas a dos manos adquieren la cualidad Larga y pueden utilizarse con Armas de asta. Adepto: Reacción. Tras una Defensa con éxito por turno, una tirada de [Fuerte←Fuerte] permite sacar al enemigo del cuerpo a cuerpo: recibe 1D6 de daño, es empujado unos metros y debe enfrentarse otra vez a la cualidad Larga. Maestro: Activa. Los golpes se convierten en una serie de ataques contra enemigos a distancia de cuerpo a cuerpo; tras cada impacto se ataca al siguiente objetivo hasta que un ataque falle. Ref: Códice de monstruos, p.136."
};
const CAPABILITY_ALIASES: Record<string, { canonicalName: string; displayName: string; note?: string }> = {
  "trampa de raices": {
    canonicalName: "Enredadera veloz",
    displayName: "Trampa de raíces",
    note: "Adaptación publicada: funciona como Enredadera veloz, pero utiliza Fuerte para las tiradas de éxito."
  },
  "ola ahogadora": {
    canonicalName: "Estrangulador",
    displayName: "Ola ahogadora",
    note: "Adaptación publicada: funciona como Estrangulador en nivel novato, pero requiere ventaja."
  },
  "espejismo": { canonicalName: "Imagen especular", displayName: "Espejismo" },
  "paseo espiritual": { canonicalName: "Forma espiritual", displayName: "Paseo espiritual" },
  "alma de fuego": { canonicalName: "Espíritu ígneo", displayName: "Alma de fuego" },
  "disparo rapido": { canonicalName: "Arco veloz", displayName: "Disparo rápido" },
  "santo de la espada": { canonicalName: "Esgrima sagrada", displayName: "Santo de la espada" },
  "ritmo de martillo": { canonicalName: "Martillo ariete", displayName: "Ritmo de martillo" },
  "combate con cuchillos": { canonicalName: "Cuchillo rápido", displayName: "Combate con cuchillos" },
  "enredar": { canonicalName: "Armas de presa", displayName: "Enredar" },
  "flagelante": { canonicalName: "Combate con armas de cadena", displayName: "Flagelante" },
  "proeza de fuerza": { canonicalName: "Espíritu combativo", displayName: "Proeza de fuerza" },
  "artesania de artefactos": { canonicalName: "Elaboración de artefactos", displayName: "Artesanía de artefactos" },
  "experto en asedio": { canonicalName: "Experto en asedios", displayName: "Experto en asedio" }
};

const MONSTER_TRAIT_ALIASES: Record<string, { canonicalName: string; displayName?: string; note?: string }> = {
  alada: { canonicalName: "Alado", displayName: "Alada" },
  longeva: { canonicalName: "Longevo", displayName: "Longeva" },
  robusta: { canonicalName: "Robusto", displayName: "Robusta" },
  venenosa: { canonicalName: "Venenoso", displayName: "Venenosa" },
  nadador: {
    canonicalName: "Tunelador",
    displayName: "Nadador",
    note: "Adaptación publicada: funciona como Tunelador, pero representa movimiento bajo el agua."
  }
};

const PUBLISHED_TRAIT_DETAILS: Record<string, { source: string; page: number; summary: string; detail: string }> = {
  "montes": {
    source: "Libro Básico",
    page: 107,
    summary: "La criatura sabe encontrar sustento y refugio en tierras salvajes.",
    detail: "Mediante una tirada con éxito de Atento, la criatura encuentra suficiente agua y comida para alimentarse mientras viaja por tierras salvajes o entre las ruinas de Davokar. Si forma parte de un grupo pequeño, de hasta cinco individuos, también puede abastecer a los demás, aunque el grupo debe detener el viaje mientras busca los recursos."
  },
  "poco longevo": {
    source: "Libro Básico",
    page: 107,
    summary: "La criatura alcanza pronto la madurez y rara vez llega a los cuarenta años.",
    detail: "La vida de la criatura es breve incluso en condiciones favorables. Alcanza la madurez en pocos años y después empieza a perder el vigor de la juventud. Poco longevo no tiene otros efectos mecánicos más allá de lo que modifique la interpretación de la criatura."
  },
  superviviente: {
    source: "Libro Básico",
    page: 109,
    summary: "Una energía vital explosiva se manifiesta como movilidad, protección y furia cuando la criatura está acorralada.",
    detail: "I: Gratuita. Una vez por escena, la criatura puede realizar una acción extra de movimiento. II: Reacción. Su instinto de supervivencia le proporciona +1D4 permanente a su armadura. III: Gratuita. Una vez por escena, puede sacrificar una acción de movimiento para realizar una acción de combate adicional."
  },
  "vinculo terrenal": {
    source: "Guía Avanzada del Jugador",
    page: 48,
    summary: "La criatura carece de alma y su vínculo con el mundo convierte la corrupción en daño físico.",
    detail: "La criatura no tiene alma y sufre daño en lugar de corrupción: la corrupción temporal provoca heridas sangrantes. Cada punto de corrupción permanente reduce en 1 la base usada para calcular su Umbral de dolor, sin afectar a su Resistencia. Si el Umbral de dolor llega a cero, muere por hemorragia interna y fallo multiorgánico. Tras morir no puede convertirse en cadáver animado ni ser contactada mediante Nigromancia."
  },
  "sabiduria de los tiempos": {
    source: "Códice de monstruos",
    page: 37,
    summary: "La criatura accede mediante meditación a la sabiduría colectiva de generaciones anteriores.",
    detail: "Usar Sabiduría de los tiempos genera corrupción temporal como un poder místico. I: Turno completo. Tras un trance y una tirada con éxito de Tenaz, obtiene hasta el final de la escena el nivel novato de una habilidad opcional, excepto Tradiciones místicas, Rituales y Poderes místicos; solo puede mantener una de estas habilidades cada vez. II: Activa. Funciona como el nivel I, pero el trance requiere menos tiempo. III: Activa. Funciona como el nivel II, pero puede obtener el nivel adepto de la habilidad elegida."
  },
  "vinculo de sangre nefarani": {
    source: "Códice de monstruos",
    page: 71,
    summary: "Los nefarani supervivientes heredan la fuerza de los miembros caídos de su colectivo.",
    detail: "El vínculo une a los veintisiete nefarani restantes: cada muerte fortalece a quienes sobreviven. Con 27 miembros usan el perfil publicado; con 13 pasan a desafío Difícil y mejoran Golpe de hierro, Fuerte e Inquebrantable; con 3 pasan a Mortal y reúnen diez capacidades de nivel maestro; el último superviviente alcanza desafío Legendario y reúne veinte capacidades de nivel maestro. La tabla de los nefarani del Códice detalla las capacidades y valores exactos de cada umbral."
  }
};

function normalizeCapability(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function capabilityLevelLabel(level: CapabilityLevel | null): string {
  if (level === "maestro") return "Maestro";
  if (level === "adepto") return "Adepto";
  if (level === "novato") return "Novato";
  return "Sin nivel";
}

function inferCapabilityLevel(raw: string, fallback?: CapabilityLevel): CapabilityLevel {
  const normalized = normalizeCapability(raw);
  if (/\bmaestro\b/.test(normalized)) return "maestro";
  if (/\badepto\b/.test(normalized)) return "adepto";
  if (/\b(?:principiante|novato)\b/.test(normalized)) return "novato";
  return fallback ?? "novato";
}

function buildMonsterCapabilityItems(capabilities: ActorCapabilitySelection[]): MonsterCapabilityItem[] {
  const resolved = new Map<string, MonsterCapabilityItem>();

  capabilities
    .filter((entry) => ["habilidad", "poder_mistico", "ritual"].includes(entry.kind))
    .forEach((entry, entryIndex) => {
      const publishedText = entry.legacyData?.trim() || entry.name;
      const normalizedPublished = normalizeCapability(publishedText);
      if (
        !normalizedPublished
        || normalizedPublished.startsWith("ninguna")
        || normalizedPublished === "rituales"
        || normalizedPublished.startsWith("dos ataques al mismo objetivo")
      ) return;

      const directMatches = CAPABILITY_CATALOG.filter((candidate) =>
        normalizedPublished.includes(normalizeCapability(candidate.nombre))
      );
      const aliasMatches = Object.entries(CAPABILITY_ALIASES)
        .filter(([alias]) => normalizedPublished.includes(alias))
        .flatMap(([, alias]) => {
          const capability = CAPABILITY_CATALOG.find(
            (candidate) => normalizeCapability(candidate.nombre) === normalizeCapability(alias.canonicalName)
          );
          return capability ? [{ capability, note: alias.note, displayName: alias.displayName }] : [];
        });
      const matches = [
        ...directMatches.map((capability) => ({
          capability,
          note: undefined as string | undefined,
          displayName: undefined as string | undefined
        })),
        ...aliasMatches
      ];

      if (!matches.length) {
        const fallbackId = `published-${entry.catalogId || entryIndex}`;
        resolved.set(fallbackId, {
          id: fallbackId,
          name: entry.name || publishedText,
          kind: "publicada",
          level: entry.kind === "ritual" ? null : inferCapabilityLevel(publishedText, entry.level),
          canonical: null,
          publishedText,
          descriptionOverride: PUBLISHED_CAPABILITY_DETAILS[normalizedPublished.replace(/\b(?:principiante|novato|adepto|maestro)\b.*$/, "").trim()],
          source: entry.source,
          page: entry.page
        });
        return;
      }

      matches.forEach(({ capability, note, displayName }) => {
        const level = capability.tipo === "ritual" ? null : inferCapabilityLevel(publishedText, entry.level);
        const current = resolved.get(capability.id);
        if (current && current.level && level && CAPABILITY_LEVEL_ORDER[current.level] >= CAPABILITY_LEVEL_ORDER[level]) return;
        resolved.set(capability.id, {
          id: capability.id,
          name: displayName || capability.nombre,
          kind: capability.tipo,
          level,
          canonical: capability,
          publishedText,
          source: capability.libro || entry.source,
          page: capability.pagina || entry.page,
          adaptationNote: note
        });
      });
    });

  return [...resolved.values()];
}

function parseCapabilityDescription(text: string): {
  tiers: Array<{ label: CapabilityTierLabel; content: string }>;
  remainder: string;
  reference: string;
} {
  const source = text.trim();
  const matches = [...source.matchAll(/(Novato|Adepto|Maestro):/g)];
  if (!matches.length) {
    const referenceIndex = source.indexOf("Ref:");
    return {
      tiers: [],
      remainder: (referenceIndex >= 0 ? source.slice(0, referenceIndex) : source).trim(),
      reference: referenceIndex >= 0 ? source.slice(referenceIndex).trim() : ""
    };
  }

  const tiers = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    let content = source.slice(start, end).trim();
    const referenceIndex = content.indexOf("Ref:");
    if (referenceIndex >= 0) content = content.slice(0, referenceIndex).trim();
    return { label: match[1] as CapabilityTierLabel, content };
  });
  const firstTierIndex = matches[0]?.index ?? 0;
  const referenceIndex = source.lastIndexOf("Ref:");
  return {
    tiers,
    remainder: source.slice(0, firstTierIndex).trim(),
    reference: referenceIndex >= 0 ? source.slice(referenceIndex).trim() : ""
  };
}

function parseMonsterTrait(raw: string, capabilities: ActorCapabilitySelection[], index: number): MonsterTraitItem {
  const cleanedRaw = raw.replace(/\s+\d{2,3}\s*$/, "").trim();
  const levelMatch = /\(\s*(III|II|I|3|2|1)(?:\s*,\s*([^)]*))?\)\s*$/i.exec(cleanedRaw);
  const numericLevel = levelMatch?.[1];
  const level: MonsterTraitLevel | null = numericLevel === "III" || numericLevel === "3"
    ? "III"
    : numericLevel === "II" || numericLevel === "2"
      ? "II"
      : numericLevel === "I" || numericLevel === "1"
        ? "I"
        : null;
  const trailingQualifier = /\(([^)]*)\)\s*$/.exec(cleanedRaw);
  const publishedName = cleanedRaw.replace(/\s*\([^)]*\)\s*$/, "").replace(/\*+$/, "").trim() || cleanedRaw;
  const alias = MONSTER_TRAIT_ALIASES[normalizeCapability(publishedName)];
  const canonicalName = alias?.canonicalName || publishedName;
  const entry = (["rasgo", "bendicion", "carga"] as const)
    .map((type) => findCompendiumEntryByTypeAndName(type, canonicalName))
    .find(Boolean) ?? null;
  const publishedDetail = PUBLISHED_TRAIT_DETAILS[normalizeCapability(canonicalName)];
  const capability = capabilities.find((candidate) =>
    ["rasgo_monstruoso", "rasgo_personaje", "rasgo_nivelado", "bendicion", "carga"].includes(candidate.kind)
    && normalizeCapability(candidate.name) === normalizeCapability(canonicalName)
  );

  return {
    id: `${entry?.id || capability?.catalogId || `published-trait-${normalizeCapability(canonicalName).replace(/\s+/g, "-")}`}-${index}`,
    name: alias?.displayName || publishedName,
    publishedText: cleanedRaw,
    qualifier: levelMatch?.[2]?.trim() || (!levelMatch ? trailingQualifier?.[1]?.trim() : "") || "",
    level,
    entry,
    descriptionOverride: publishedDetail ? `${publishedDetail.summary} ${publishedDetail.detail}` : undefined,
    adaptationNote: alias?.note,
    source: entry?.fuente || publishedDetail?.source || capability?.source || "Ficha publicada",
    page: entry?.pagina || publishedDetail?.page || capability?.page
  };
}

function buildMonsterTraitItems(rawTraits: string[], capabilities: ActorCapabilitySelection[]): MonsterTraitItem[] {
  return rawTraits.flatMap((raw, index) => {
    const compositeMatch = /^(?:o\s+)?paria\s+y\s+poco\s+longevo(?:\s*\(([^)]*)\))?$/i.exec(raw.trim());
    if (!compositeMatch) return [parseMonsterTrait(raw, capabilities, index)];
    const qualifier = compositeMatch[1] ? ` (${compositeMatch[1]})` : "";
    return [
      parseMonsterTrait(`Paria${qualifier}`, capabilities, index * 10),
      parseMonsterTrait(`Poco longevo${qualifier}`, capabilities, index * 10 + 1)
    ];
  });
}

function parseMonsterTraitDescription(text: string): {
  tiers: Array<{ label: string; content: string }>;
  remainder: string;
} {
  const source = text.trim();
  const matches = [...source.matchAll(/(?:^|\s)((?:III|II|I)(?:\/(?:III|II|I))*)\s*:/g)];
  if (!matches.length) return { tiers: [], remainder: source };

  const tiers = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    return { label: match[1], content: source.slice(start, end).trim() };
  });
  return {
    tiers,
    remainder: source.slice(0, matches[0]?.index ?? 0).trim()
  };
}

function leadingNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value ?? "").trim().replace(/[−–—]/g, "-").match(/^[+-]?\d+/);
  return match ? Number(match[0]) : null;
}

function traitLevelLabel(level: number): string {
  return level === 3 ? "III" : level === 2 ? "II" : "I";
}

function buildAttributeCalculation(sheet: MonsterSheet, attribute: MonsterAttributeKey): CalculationAudit {
  const value = Number(sheet.attributes[attribute] || 0);
  const modifier = 10 - value;
  return {
    id: `attribute-${attribute}`,
    title: `Modificador de ${MONSTER_ATTRIBUTE_LABELS[attribute]}`,
    result: modifier > 0 ? `+${modifier}` : String(modifier),
    formula: `10 − ${value} = ${modifier}`,
    rows: [
      { label: "Valor del atributo", value: String(value) },
      { label: "Valor de referencia", value: "10", explanation: "Los modificadores de las fichas de monstruo se expresan respecto a 10." },
      { label: "Modificador final", value: modifier > 0 ? `+${modifier}` : String(modifier) }
    ]
  };
}

function buildDefenseCalculation(sheet: MonsterSheet, result: string): CalculationAudit {
  const quick = Number(sheet.attributes.quick || 0);
  const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
  const robustoPenalty = robustoLevel === 3 ? 4 : robustoLevel === 2 ? 3 : robustoLevel === 1 ? 2 : 0;
  const base = 10 - quick;
  const finalNumber = leadingNumber(result);
  const automatic = robustoLevel > 0 || !String(sheet.defense ?? "").trim();
  const rows: CalculationAuditRow[] = [
    { label: "Ágil", value: String(quick) },
    { label: "Base", value: String(base), explanation: `10 − Ágil (${quick})` }
  ];
  if (robustoLevel > 0) rows.push({ label: `Robusto ${traitLevelLabel(robustoLevel)}`, value: `+${robustoPenalty}`, explanation: "El tamaño facilita que los adversarios alcancen a la criatura." });
  if (!automatic && finalNumber !== null && finalNumber !== base) {
    const adjustment = finalNumber - base;
    rows.push({
      label: "Ajustes publicados",
      value: adjustment > 0 ? `+${adjustment}` : String(adjustment),
      explanation: "Diferencia ya incluida en el perfil por armadura, escudo, rasgos o capacidades. La tabla no separa esos sumandos."
    });
  }
  rows.push({ label: "Defensa final", value: result });
  return {
    id: "defense",
    title: "Cálculo de Defensa",
    result,
    formula: automatic
      ? `10 − Ágil (${quick})${robustoPenalty ? ` + ${robustoPenalty}` : ""} = ${result}`
      : `Valor final publicado: ${result}`,
    rows,
    notes: automatic ? undefined : ["La app conserva el valor final de la tabla. La comparación con la base permite localizar modificadores implícitos."]
  };
}

function buildToughnessCalculation(sheet: MonsterSheet, result: string): CalculationAudit {
  const strong = Number(sheet.attributes.strong || 0);
  const recioLevel = getMonsterTraitLevel(sheet.traits ?? [], ["recio"]);
  const multiplier = recioLevel === 3 ? 3 : recioLevel === 2 ? 2 : recioLevel === 1 ? 1.5 : 1;
  const automatic = recioLevel > 0 || !String(sheet.toughness ?? "").trim();
  const base = Math.max(10, strong);
  const finalNumber = leadingNumber(result);
  const rows: CalculationAuditRow[] = [{ label: "Fuerte", value: String(strong) }];
  if (recioLevel > 0) rows.push({ label: `Recio ${traitLevelLabel(recioLevel)}`, value: `×${multiplier}`, explanation: "Recio multiplica la Resistencia basada en Fuerte." });
  else rows.push({ label: "Base ordinaria", value: String(base), explanation: "La Resistencia ordinaria es como mínimo 10." });
  if (!automatic && finalNumber !== null && finalNumber !== base) rows.push({ label: "Ajuste publicado", value: String(finalNumber - base), explanation: "Diferencia incluida en el perfil publicado." });
  rows.push({ label: "Resistencia final", value: result });
  return {
    id: "toughness",
    title: "Cálculo de Resistencia",
    result,
    formula: recioLevel > 0 ? `Fuerte (${strong}) × ${multiplier} = ${result}` : `Valor final publicado: ${result}`,
    rows,
    notes: automatic ? undefined : ["El perfil almacena este resultado como valor fijo; se muestra la base reglamentaria para facilitar su auditoría."]
  };
}

function buildPainThresholdCalculation(sheet: MonsterSheet, result: string): CalculationAudit {
  const strong = Number(sheet.attributes.strong || 0);
  const base = Math.ceil(strong / 2);
  const finalNumber = leadingNumber(result);
  const rows: CalculationAuditRow[] = [
    { label: "Fuerte", value: String(strong) },
    { label: "Mitad, redondeada hacia arriba", value: String(base) }
  ];
  if (finalNumber !== null && finalNumber !== base) rows.push({ label: "Ajuste publicado", value: String(finalNumber - base), explanation: "Puede proceder de rasgos, corrupción u otra regla especial del perfil." });
  rows.push({ label: "Umbral final", value: result });
  return {
    id: "pain-threshold",
    title: "Cálculo del Umbral de dolor",
    result,
    formula: finalNumber === null ? "La criatura no utiliza Umbral de dolor." : `⌈Fuerte (${strong}) ÷ 2⌉${finalNumber !== base ? ` con ajustes = ${result}` : ` = ${result}`}`,
    rows,
    notes: finalNumber === null ? ["Los perfiles con «—» carecen de Umbral de dolor por sus reglas de categoría o naturaleza."] : undefined
  };
}

function buildArmorCalculation(sheet: MonsterSheet, result: string): CalculationAudit {
  const duroLevel = getMonsterTraitLevel(sheet.traits ?? [], ["duro"]);
  const duroArmor = duroLevel === 3 ? 4 : duroLevel === 2 ? 3 : duroLevel === 1 ? 2 : 0;
  const arithmetic = String(sheet.armorDetails || sheet.armor).match(/^\s*(\d+(?:\s*\+\s*\d+)+)/)?.[1];
  const arithmeticTotal = arithmetic ? arithmetic.split("+").reduce((total, term) => total + Number(term.trim()), 0) : null;
  const finalNumber = leadingNumber(result);
  const rows: CalculationAuditRow[] = [];
  if (arithmetic) rows.push({ label: "Componentes publicados", value: arithmetic, explanation: `Suma: ${arithmeticTotal}` });
  else rows.push({ label: "Protección publicada", value: sheet.armorDetails || sheet.armor || "0" });
  if (duroLevel > 0) rows.push({ label: `Duro ${traitLevelLabel(duroLevel)}`, value: String(duroArmor), explanation: "Protección natural correspondiente al nivel del rasgo." });
  rows.push({ label: "Armadura final mostrada", value: result });
  const mismatch = arithmeticTotal !== null && finalNumber !== null && arithmeticTotal !== finalNumber;
  return {
    id: "armor",
    title: "Cálculo de Armadura",
    result,
    formula: arithmetic ? `${arithmetic} = ${arithmeticTotal}` : duroLevel > 0 ? `Duro ${traitLevelLabel(duroLevel)} = ${duroArmor}` : `Valor final publicado: ${result}`,
    rows,
    notes: ["Las cualidades y reglas especiales se conservan en el texto de protección y no se suman si no modifican su valor numérico."],
    warning: mismatch ? `Posible discrepancia: los componentes publicados suman ${arithmeticTotal}, pero la ficha muestra ${result}.` : undefined
  };
}

function buildWeaponCalculation(weapon: MonsterWeaponProfile, index: number): CalculationAudit {
  const result = String(weapon.fixedValue ?? (weapon.damage || "-"));
  const averaged = weapon.damageFormula ? averageDiceFormula(weapon.damageFormula) : null;
  const rows: CalculationAuditRow[] = [
    { label: "Ataque", value: weapon.name },
    { label: "Atributo usado", value: weapon.attribute || "Indicado por el perfil" }
  ];
  if (weapon.damageFormula) rows.push({ label: "Fórmula original", value: weapon.damageFormula, explanation: averaged === null ? "La fórmula no puede convertirse automáticamente." : `Valor fijo oficial para PNJ: ${averaged}.` });
  else rows.push({ label: "Daño publicado", value: weapon.damage || result, explanation: "El libro proporciona el valor final y no desglosa sus sumandos." });
  if (weapon.qualities) rows.push({ label: "Cualidades", value: weapon.qualities });
  rows.push({ label: "Daño final mostrado", value: result });
  return {
    id: `weapon-${index}`,
    title: `Cálculo de daño: ${weapon.name}`,
    result,
    formula: weapon.damageFormula && averaged !== null
      ? `${weapon.damageFormula} → valor fijo ${averaged}`
      : `Valor final publicado: ${weapon.damage || result}`,
    rows,
    notes: [weapon.details || "Las capacidades y rasgos aplicables ya están incorporados en el valor publicado salvo que el perfil indique expresamente lo contrario."],
    warning: averaged !== null && weapon.fixedValue !== null && averaged !== weapon.fixedValue
      ? `Posible discrepancia: la fórmula se convierte en ${averaged}, pero la ficha muestra ${weapon.fixedValue}.`
      : undefined
  };
}

function buildChallengeCalculation(sheet: MonsterSheet, xp: number, result: string): CalculationAudit {
  const paid = sheet.capabilities
    .map((entry) => ({ entry, cost: Math.max(0, getActorCapabilityXpDelta(entry)) }))
    .filter(({ cost }) => cost > 0);
  const rows: CalculationAuditRow[] = paid.length
    ? paid.map(({ entry, cost }) => ({ label: entry.name, value: `${cost} PX`, explanation: entry.level ? capabilityLevelLabel(entry.level) : undefined }))
    : [{ label: "Capacidades con coste", value: "0 PX" }];
  rows.push({ label: "PX utilizada", value: `${xp} PX` }, { label: "Desafío resultante", value: result });
  const threshold = result === "Legendario" ? "1200 PX o más" : result === "Mortal" ? "600–1199 PX" : result === "Difícil" ? "300–599 PX" : result === "Complicado" ? "150–299 PX" : result === "Normal" ? "50–149 PX" : "0–49 PX";
  return {
    id: "challenge",
    title: "Cálculo de desafío",
    result,
    formula: `${xp} PX → ${result}`,
    rows,
    notes: [`Intervalo de ${result}: ${threshold}. Las cargas no reducen la PX utilizada para calcular el desafío.`]
  };
}

function CalculationInfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="monster-calculation-info-button"
      aria-label={`Ver cálculo de ${label}`}
      title={`Ver cálculo de ${label}`}
      onClick={onClick}
    >i</button>
  );
}

export function MonsterReferenceSheet({
  monster,
  backgroundPreferenceScope,
  official = false,
  busy = false,
  onClose,
  onDuplicate,
  onEdit,
  onDelete
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const capabilityCloseRef = useRef<HTMLButtonElement | null>(null);
  const traitCloseRef = useRef<HTMLButtonElement | null>(null);
  const calculationCloseRef = useRef<HTMLButtonElement | null>(null);
  const sheet = monster.sheet;
  const derived = getDerivedMonsterSheetStats(sheet);
  const xp = getMonsterCreationXp(sheet);
  const capabilities = useMemo(() => buildMonsterCapabilityItems(sheet.capabilities), [sheet.capabilities]);
  const traits = useMemo(
    () => buildMonsterTraitItems(sheet.traits, sheet.capabilities),
    [sheet.capabilities, sheet.traits]
  );
  const references = monster.references?.length ? monster.references : sheet.sourceReferences;
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
  const [selectedCapability, setSelectedCapability] = useState<MonsterCapabilityItem | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<MonsterTraitItem | null>(null);
  const [selectedCalculation, setSelectedCalculation] = useState<CalculationAudit | null>(null);
  const selectedCompendiumEntry = selectedCapability?.canonical
    ? findCompendiumEntryByTypeAndName(selectedCapability.canonical.tipo, selectedCapability.canonical.nombre)
    : null;
  const capabilityDescription = useMemo(
    () => selectedCapability
      ? parseCapabilityDescription(
          selectedCapability.descriptionOverride
          || selectedCompendiumEntry?.detalle
          || selectedCapability.canonical?.efectoResumen
          || selectedCapability.publishedText
        )
      : null,
    [selectedCapability, selectedCompendiumEntry]
  );
  const selectedSourceUrl = selectedCapability
    ? getCompendiumSourcePdfUrl(selectedCapability.source, selectedCapability.page, selectedCapability.name)
    : null;
  const traitDescription = useMemo(
    () => selectedTrait
      ? parseMonsterTraitDescription(selectedTrait.entry?.detalle || selectedTrait.descriptionOverride || selectedTrait.entry?.resumen || selectedTrait.publishedText)
      : null,
    [selectedTrait]
  );
  const selectedTraitSourceUrl = selectedTrait
    ? getCompendiumSourcePdfUrl(selectedTrait.source, selectedTrait.page, selectedTrait.name)
    : null;
  const challengeCalculation = useMemo(() => buildChallengeCalculation(sheet, xp, monster.threat), [monster.threat, sheet, xp]);
  const attributeCalculations = useMemo(
    () => Object.fromEntries(MONSTER_ATTRIBUTE_KEYS.map((attribute) => [attribute, buildAttributeCalculation(sheet, attribute)])) as Record<MonsterAttributeKey, CalculationAudit>,
    [sheet]
  );
  const defenseCalculation = useMemo(() => buildDefenseCalculation(sheet, derived.defense), [derived.defense, sheet]);
  const toughnessCalculation = useMemo(() => buildToughnessCalculation(sheet, derived.toughness), [derived.toughness, sheet]);
  const painThresholdCalculation = useMemo(() => buildPainThresholdCalculation(sheet, derived.painThreshold), [derived.painThreshold, sheet]);
  const shownArmor = String(sheet.fixedValues.armor ?? derived.armor);
  const armorCalculation = useMemo(() => buildArmorCalculation(sheet, shownArmor), [sheet, shownArmor]);
  const weaponCalculations = useMemo(() => sheet.weapons.map(buildWeaponCalculation), [sheet.weapons]);

  useEffect(() => {
    setIsDescriptionOpen(true);
    setSelectedCapability(null);
    setSelectedTrait(null);
    setSelectedCalculation(null);
  }, [monster.id]);

  useEffect(() => {
    if (selectedCapability) window.setTimeout(() => capabilityCloseRef.current?.focus(), 0);
  }, [selectedCapability]);

  useEffect(() => {
    if (selectedTrait) window.setTimeout(() => traitCloseRef.current?.focus(), 0);
  }, [selectedTrait]);

  useEffect(() => {
    if (selectedCalculation) window.setTimeout(() => calculationCloseRef.current?.focus(), 0);
  }, [selectedCalculation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedCalculation) {
          setSelectedCalculation(null);
          return;
        }
        if (selectedTrait) {
          setSelectedTrait(null);
          return;
        }
        if (selectedCapability) {
          setSelectedCapability(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [monster.id, onClose, selectedCalculation, selectedCapability, selectedTrait]);

  return (
    <article className="monster-reference-sheet" aria-label={`Ficha de ${monster.name}`}>
      <header className="monster-reference-sheet__header">
        <div className="monster-reference-sheet__identity">
          <span className="compendium-eyebrow">{sheet.family || monster.family || monster.category}</span>
          <h2>{monster.name}</h2>
          <p>{sheet.race || monster.category} · {monster.category}</p>
        </div>
        <div className="monster-reference-sheet__actions">
          <CharacterSheetBackgroundPicker preferenceScope={backgroundPreferenceScope} />
          {official && onDuplicate ? <button type="button" onClick={onDuplicate}>Duplicar en Mis monstruos</button> : null}
          {!official && onEdit ? <button type="button" onClick={onEdit}>Editar</button> : null}
          {!official && onDelete ? <button type="button" className="danger" disabled={busy} onClick={onDelete}>Eliminar</button> : null}
          <button ref={closeRef} type="button" className="subtle-button" onClick={onClose}>Cerrar ficha</button>
        </div>
      </header>

      <div className="monster-reference-sheet__scroll">
        <section className="monster-reference-sheet__hero campaign-sheet-card">
          <div className="monster-calculation-host">
            <span>Desafío calculado</span>
            <strong>{monster.threat}</strong>
            <small>{xp} PX</small>
            <CalculationInfoButton label="desafío" onClick={() => setSelectedCalculation(challengeCalculation)} />
          </div>
          <div>
            <span>Conducta</span>
            <strong>{sheet.conduct || "No indicada"}</strong>
          </div>
          <div>
            <span>Sombra</span>
            <strong>{sheet.shadow || "No indicada"}</strong>
            {sheet.corruption !== null ? <small>Corrupción: {sheet.corruption}</small> : null}
          </div>
        </section>

        <section className="monster-reference-section campaign-sheet-card" aria-labelledby={`monster-${monster.id}-attributes`}>
          <h3 id={`monster-${monster.id}-attributes`}>Atributos</h3>
          <div className="monster-reference-attributes">
            {MONSTER_ATTRIBUTE_KEYS.map((attribute) => (
              <div key={attribute} className="monster-reference-attribute monster-calculation-host">
                <span>{MONSTER_ATTRIBUTE_LABELS[attribute]}</span>
                <strong>{sheet.attributes[attribute]}</strong>
                <small>{signedModifier(sheet.attributes[attribute])}</small>
                <CalculationInfoButton label={`modificador de ${MONSTER_ATTRIBUTE_LABELS[attribute]}`} onClick={() => setSelectedCalculation(attributeCalculations[attribute])} />
              </div>
            ))}
          </div>
        </section>

        <div className="monster-reference-columns">
          <section className="monster-reference-section campaign-sheet-card">
            <h3>Combate y defensas</h3>
            <dl className="monster-reference-values">
              <div className="monster-calculation-host"><dt>Defensa</dt><dd>{derived.defense}</dd><CalculationInfoButton label="Defensa" onClick={() => setSelectedCalculation(defenseCalculation)} /></div>
              <div className="monster-calculation-host"><dt>Resistencia</dt><dd>{derived.toughness}</dd><CalculationInfoButton label="Resistencia" onClick={() => setSelectedCalculation(toughnessCalculation)} /></div>
              <div className="monster-calculation-host"><dt>Umbral de dolor</dt><dd>{derived.painThreshold}</dd><CalculationInfoButton label="Umbral de dolor" onClick={() => setSelectedCalculation(painThresholdCalculation)} /></div>
              <div className="monster-calculation-host"><dt>Armadura</dt><dd>{shownArmor}</dd><CalculationInfoButton label="Armadura" onClick={() => setSelectedCalculation(armorCalculation)} /></div>
            </dl>
            <p className="monster-reference-rule">{sheet.armorDetails || sheet.armor}</p>
          </section>

          <section className="monster-reference-section campaign-sheet-card">
            <h3>Armas</h3>
            {sheet.weapons.length ? (
              <div className="monster-reference-weapons">
                {sheet.weapons.map((weapon, index) => (
                  <article key={`${weapon.name}-${index}`} className="monster-calculation-host">
                    <div><strong>{weapon.name}</strong><span>{weapon.attribute || "Ataque"}</span></div>
                    <b>{weapon.fixedValue ?? (weapon.damage || "-")}</b>
                    <p>{weapon.details || weapon.qualities}</p>
                    {weapon.damageFormula ? <small>Fórmula: {weapon.damageFormula}</small> : null}
                    <CalculationInfoButton label={`daño de ${weapon.name}`} onClick={() => setSelectedCalculation(weaponCalculations[index])} />
                  </article>
                ))}
              </div>
            ) : <p>{sheet.actions.find((entry) => entry.startsWith("Armas:"))?.replace(/^Armas:\s*/, "") || "Sin armas indicadas."}</p>}
          </section>
        </div>

        <div className="monster-reference-columns">
          <section className="monster-reference-section campaign-sheet-card">
            <h3>Rasgos</h3>
            {traits.length ? (
              <ul className="monster-reference-tags monster-reference-trait-list">
                {traits.map((trait) => (
                  <li key={trait.id}>
                    <button type="button" onClick={() => setSelectedTrait(trait)}>
                      <span>
                        <strong>{trait.name}</strong>
                        {trait.qualifier ? <small>{trait.qualifier}</small> : null}
                      </span>
                      <b>{trait.level ? `Nivel ${trait.level}` : "Ver reglas"}</b>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p>Sin rasgos registrados.</p>}
          </section>
          <section className="monster-reference-section campaign-sheet-card">
            <h3>Habilidades y poderes</h3>
            {capabilities.length ? (
              <ul className="monster-reference-list">
                {capabilities.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => setSelectedCapability(entry)}>
                      <span>
                        <strong>{entry.name}</strong>
                        <small>{entry.kind === "poder_mistico" ? "Poder místico" : entry.kind === "ritual" ? "Ritual" : "Habilidad"}</small>
                      </span>
                      <b>{entry.level ? capabilityLevelLabel(entry.level) : "Ver reglas"}</b>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p>Sin habilidades registradas.</p>}
            {hasText(sheet.blessingsBurdens) ? <><h4>Bendiciones y cargas</h4><p>{sheet.blessingsBurdens}</p></> : null}
          </section>
        </div>

        <div className="monster-reference-columns">
          <section className="monster-reference-section campaign-sheet-card">
            <h3>Tácticas</h3>
            <p>{sheet.tactics || "Sin tácticas registradas."}</p>
          </section>
          <section className="monster-reference-section campaign-sheet-card">
            <h3>Equipo y botín</h3>
            <p>{sheet.loot || sheet.equipment?.map((entry) => entry.notes || entry.name).filter(Boolean).join(" · ") || "Sin equipo o botín registrado."}</p>
            {hasText(sheet.weakness) ? <><h4>Debilidad</h4><p>{sheet.weakness}</p></> : null}
          </section>
        </div>

        <details
          className="monster-reference-collapsible narrative-collapsible-card campaign-sheet-card"
          open={isDescriptionOpen}
          onToggle={(event) => setIsDescriptionOpen(event.currentTarget.open)}
        >
          <summary><span>Descripción</span><small>{isDescriptionOpen ? "Ocultar" : "Mostrar"}</small></summary>
          <div className="narrative-collapsible-content"><p>{sheet.description || monster.summary}</p></div>
        </details>

        <footer className="monster-reference-sources campaign-sheet-card">
          <h3>Fuentes</h3>
          <div>
            {references.map((reference, index) => {
              const pdf = sourcePdf(reference.source);
              const label = `${reference.source} · p.${reference.page}`;
              return pdf
                ? <a key={`${reference.source}-${reference.page}-${index}`} href={buildPdfViewerUrl(pdf, reference.pdfPage)} target="_blank" rel="noreferrer">{label}</a>
                : <span key={`${reference.source}-${reference.page}-${index}`}>{label}</span>;
            })}
          </div>
        </footer>
      </div>

      {selectedCalculation ? (
        <div className="modal-backdrop monster-capability-modal-backdrop" onClick={() => setSelectedCalculation(null)}>
          <div
            className="panel modal-panel monster-capability-modal monster-calculation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`monster-calculation-${selectedCalculation.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="monster-capability-modal__header">
              <div>
                <span className="compendium-eyebrow">Auditoría del cálculo</span>
                <h3 id={`monster-calculation-${selectedCalculation.id}`}>{selectedCalculation.title}</h3>
                <p>{selectedCalculation.formula}</p>
              </div>
              <span className="monster-capability-current-level">
                <small>Resultado final</small>
                <strong>{selectedCalculation.result}</strong>
              </span>
            </header>

            <div className="monster-capability-modal__body">
              <dl className="monster-calculation-breakdown">
                {selectedCalculation.rows.map((row, index) => (
                  <div key={`${row.label}-${index}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                    {row.explanation ? <p>{row.explanation}</p> : null}
                  </div>
                ))}
              </dl>
              {selectedCalculation.warning ? (
                <p className="monster-calculation-warning"><strong>Revisar:</strong> {selectedCalculation.warning}</p>
              ) : null}
              {selectedCalculation.notes?.map((note, index) => (
                <p key={`${selectedCalculation.id}-note-${index}`} className="monster-calculation-note">{note}</p>
              ))}
            </div>

            <footer className="monster-capability-modal__actions">
              <button ref={calculationCloseRef} type="button" className="subtle-button" onClick={() => setSelectedCalculation(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      ) : null}

      {selectedTrait && traitDescription ? (
        <div className="modal-backdrop monster-capability-modal-backdrop" onClick={() => setSelectedTrait(null)}>
          <div
            className="panel modal-panel monster-capability-modal monster-trait-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`monster-trait-${selectedTrait.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="monster-capability-modal__header">
              <div>
                <span className="compendium-eyebrow">Rasgo de monstruo</span>
                <h3 id={`monster-trait-${selectedTrait.id}`}>{selectedTrait.name}</h3>
                <p>{selectedTrait.source}{selectedTrait.page ? ` · p.${selectedTrait.page}` : ""}</p>
              </div>
              <span className="monster-capability-current-level">
                <small>Nivel del monstruo</small>
                <strong>{selectedTrait.level ? `Nivel ${selectedTrait.level}` : "Sin niveles"}</strong>
              </span>
            </header>

            <div className="monster-capability-modal__body">
              {traitDescription.remainder ? <p>{traitDescription.remainder}</p> : null}
              {traitDescription.tiers.length ? (
                <div className="monster-capability-tier-list">
                  {traitDescription.tiers.map((tier) => {
                    const isCurrent = Boolean(selectedTrait.level && tier.label.split("/").includes(selectedTrait.level));
                    return (
                      <section key={tier.label} className={`monster-capability-tier${isCurrent ? " is-current" : ""}`}>
                        <header>
                          <h4>Nivel {tier.label}</h4>
                          {isCurrent ? <span>Nivel del monstruo</span> : null}
                        </header>
                        <p>{tier.content}</p>
                      </section>
                    );
                  })}
                </div>
              ) : null}
              {selectedTrait.qualifier ? (
                <p className="monster-capability-adaptation"><strong>Aplicación en esta criatura:</strong> {selectedTrait.qualifier}</p>
              ) : null}
              {selectedTrait.adaptationNote ? <p className="monster-capability-adaptation">{selectedTrait.adaptationNote}</p> : null}
              {!selectedTrait.entry && !selectedTrait.descriptionOverride ? (
                <p className="monster-capability-adaptation">Rasgo publicado sin una entrada canónica enlazada; se conserva literalmente el dato de la ficha.</p>
              ) : null}
            </div>

            <footer className="monster-capability-modal__actions">
              {selectedTraitSourceUrl ? <a href={selectedTraitSourceUrl} target="_blank" rel="noreferrer">Abrir fuente</a> : null}
              <button ref={traitCloseRef} type="button" className="subtle-button" onClick={() => setSelectedTrait(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      ) : null}

      {selectedCapability && capabilityDescription ? (
        <div className="modal-backdrop monster-capability-modal-backdrop" onClick={() => setSelectedCapability(null)}>
          <div
            className="panel modal-panel monster-capability-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`monster-capability-${selectedCapability.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="monster-capability-modal__header">
              <div>
                <span className="compendium-eyebrow">
                  {selectedCapability.kind === "poder_mistico" ? "Poder místico" : selectedCapability.kind === "ritual" ? "Ritual" : "Habilidad"}
                </span>
                <h3 id={`monster-capability-${selectedCapability.id}`}>{selectedCapability.name}</h3>
                <p>{selectedCapability.source}{selectedCapability.page ? ` · p.${selectedCapability.page}` : ""}</p>
              </div>
              <span className="monster-capability-current-level">
                <small>Nivel del monstruo</small>
                <strong>{selectedCapability.level ? capabilityLevelLabel(selectedCapability.level) : selectedCapability.kind === "ritual" ? "Ritual" : "Publicado"}</strong>
              </span>
            </header>

            <div className="monster-capability-modal__body">
              {capabilityDescription.remainder ? <p>{capabilityDescription.remainder}</p> : null}
              {capabilityDescription.tiers.length ? (
                <div className="monster-capability-tier-list">
                  {capabilityDescription.tiers.map((tier) => {
                    const isCurrent = selectedCapability.level && capabilityLevelLabel(selectedCapability.level) === tier.label;
                    return (
                      <section key={tier.label} className={`monster-capability-tier${isCurrent ? " is-current" : ""}`}>
                        <header>
                          <h4>{tier.label}</h4>
                          {isCurrent ? <span>Nivel del monstruo</span> : null}
                        </header>
                        <p>{tier.content}</p>
                      </section>
                    );
                  })}
                </div>
              ) : capabilityDescription.remainder ? null : (
                <p>{selectedCapability.publishedText}</p>
              )}
              {selectedCapability.adaptationNote ? <p className="monster-capability-adaptation">{selectedCapability.adaptationNote}</p> : null}
              {!selectedCapability.canonical && !selectedCapability.descriptionOverride ? (
                <p className="monster-capability-adaptation">Entrada publicada sin equivalencia canónica; se conserva literalmente el dato de la ficha.</p>
              ) : null}
              {capabilityDescription.reference ? <small className="monster-capability-reference">{capabilityDescription.reference}</small> : null}
            </div>

            <footer className="monster-capability-modal__actions">
              {selectedSourceUrl ? <a href={selectedSourceUrl} target="_blank" rel="noreferrer">Abrir fuente</a> : null}
              <button ref={capabilityCloseRef} type="button" className="subtle-button" onClick={() => setSelectedCapability(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      ) : null}
    </article>
  );
}
