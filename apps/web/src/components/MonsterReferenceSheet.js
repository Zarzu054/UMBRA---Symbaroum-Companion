import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONSTER_ATTRIBUTE_KEYS, MONSTER_ATTRIBUTE_LABELS, SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, averageDiceFormula, getActorCapabilityXpDelta, getDerivedMonsterSheetStats, getMonsterCreationXp, getMonsterTraitLevel } from "@umbra/shared";
import { findCompendiumEntryByTypeAndName, getCompendiumSourcePdfUrl } from "../models/compendiumEntries";
import { buildPdfViewerUrl } from "../services/pdfViewer";
import { CharacterSheetBackgroundPicker } from "./CharacterSheetBackgroundPicker";
import { SourceReferenceLink } from "./SourceReferenceLink";
function signedModifier(value) {
    const modifier = 10 - value;
    return modifier > 0 ? `+${modifier}` : String(modifier);
}
function sourcePdf(source) {
    if (source === "Libro Básico")
        return "/books/libro-basico.pdf";
    if (source === "Códice de monstruos")
        return "/books/codice-de-monstruos.pdf";
    return null;
}
function hasText(value) {
    return Boolean(value?.trim());
}
const CAPABILITY_LEVEL_ORDER = { novato: 1, adepto: 2, maestro: 3 };
const CAPABILITY_CATALOG = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS];
const PUBLISHED_CAPABILITY_DETAILS = {
    "combate con latigo": "Esta técnica combina un látigo en una mano con un arma a una mano en la otra. Novato: Activa. Si el ataque con látigo impacta, el personaje obtiene un ataque gratuito con el arma a una mano, aunque el látigo no cause daño. Adepto: Activa. Como en novato, pero el látigo obstaculiza al enemigo y el ataque gratuito impacta automáticamente. Maestro: Activa. Como en adepto, pero el combatiente acerca al enemigo para que el ataque gratuito inflija +1D6 de daño. Ref: Códice de monstruos, p.123.",
    "sutileza a dos manos": "El personaje maneja grandes espadas a dos manos con precisión y aprovecha la longitud del arma contra toda clase de oponentes. Novato: Pasiva. Las espadas a dos manos adquieren la cualidad Larga y pueden utilizarse con Armas de asta. Adepto: Reacción. Tras una Defensa con éxito por turno, una tirada de [Fuerte←Fuerte] permite sacar al enemigo del cuerpo a cuerpo: recibe 1D6 de daño, es empujado unos metros y debe enfrentarse otra vez a la cualidad Larga. Maestro: Activa. Los golpes se convierten en una serie de ataques contra enemigos a distancia de cuerpo a cuerpo; tras cada impacto se ataca al siguiente objetivo hasta que un ataque falle. Ref: Códice de monstruos, p.136."
};
const CAPABILITY_ALIASES = {
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
const MONSTER_TRAIT_ALIASES = {
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
const PUBLISHED_TRAIT_DETAILS = {
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
function normalizeCapability(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function capabilityLevelLabel(level) {
    if (level === "maestro")
        return "Maestro";
    if (level === "adepto")
        return "Adepto";
    if (level === "novato")
        return "Novato";
    return "Sin nivel";
}
function inferCapabilityLevel(raw, fallback) {
    const normalized = normalizeCapability(raw);
    if (/\bmaestro\b/.test(normalized))
        return "maestro";
    if (/\badepto\b/.test(normalized))
        return "adepto";
    if (/\b(?:principiante|novato)\b/.test(normalized))
        return "novato";
    return fallback ?? "novato";
}
function buildMonsterCapabilityItems(capabilities) {
    const resolved = new Map();
    capabilities
        .filter((entry) => ["habilidad", "poder_mistico", "ritual"].includes(entry.kind))
        .forEach((entry, entryIndex) => {
        const publishedText = entry.legacyData?.trim() || entry.name;
        const normalizedPublished = normalizeCapability(publishedText);
        if (!normalizedPublished
            || normalizedPublished.startsWith("ninguna")
            || normalizedPublished === "rituales"
            || normalizedPublished.startsWith("dos ataques al mismo objetivo"))
            return;
        const directMatches = CAPABILITY_CATALOG.filter((candidate) => normalizedPublished.includes(normalizeCapability(candidate.nombre)));
        const aliasMatches = Object.entries(CAPABILITY_ALIASES)
            .filter(([alias]) => normalizedPublished.includes(alias))
            .flatMap(([, alias]) => {
            const capability = CAPABILITY_CATALOG.find((candidate) => normalizeCapability(candidate.nombre) === normalizeCapability(alias.canonicalName));
            return capability ? [{ capability, note: alias.note, displayName: alias.displayName }] : [];
        });
        const matches = [
            ...directMatches.map((capability) => ({
                capability,
                note: undefined,
                displayName: undefined
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
            if (current && current.level && level && CAPABILITY_LEVEL_ORDER[current.level] >= CAPABILITY_LEVEL_ORDER[level])
                return;
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
function parseCapabilityDescription(text) {
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
        if (referenceIndex >= 0)
            content = content.slice(0, referenceIndex).trim();
        return { label: match[1], content };
    });
    const firstTierIndex = matches[0]?.index ?? 0;
    const referenceIndex = source.lastIndexOf("Ref:");
    return {
        tiers,
        remainder: source.slice(0, firstTierIndex).trim(),
        reference: referenceIndex >= 0 ? source.slice(referenceIndex).trim() : ""
    };
}
function parseMonsterTrait(raw, capabilities, index) {
    const cleanedRaw = raw.replace(/\s+\d{2,3}\s*$/, "").trim();
    const levelMatch = /\(\s*(III|II|I|3|2|1)(?:\s*,\s*([^)]*))?\)\s*$/i.exec(cleanedRaw);
    const numericLevel = levelMatch?.[1];
    const level = numericLevel === "III" || numericLevel === "3"
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
    const entry = ["rasgo", "bendicion", "carga"]
        .map((type) => findCompendiumEntryByTypeAndName(type, canonicalName))
        .find(Boolean) ?? null;
    const publishedDetail = PUBLISHED_TRAIT_DETAILS[normalizeCapability(canonicalName)];
    const capability = capabilities.find((candidate) => ["rasgo_monstruoso", "rasgo_personaje", "rasgo_nivelado", "bendicion", "carga"].includes(candidate.kind)
        && normalizeCapability(candidate.name) === normalizeCapability(canonicalName));
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
function buildMonsterTraitItems(rawTraits, capabilities) {
    return rawTraits.flatMap((raw, index) => {
        const compositeMatch = /^(?:o\s+)?paria\s+y\s+poco\s+longevo(?:\s*\(([^)]*)\))?$/i.exec(raw.trim());
        if (!compositeMatch)
            return [parseMonsterTrait(raw, capabilities, index)];
        const qualifier = compositeMatch[1] ? ` (${compositeMatch[1]})` : "";
        return [
            parseMonsterTrait(`Paria${qualifier}`, capabilities, index * 10),
            parseMonsterTrait(`Poco longevo${qualifier}`, capabilities, index * 10 + 1)
        ];
    });
}
function parseMonsterTraitDescription(text) {
    const source = text.trim();
    const matches = [...source.matchAll(/(?:^|\s)((?:III|II|I)(?:\/(?:III|II|I))*)\s*:/g)];
    if (!matches.length)
        return { tiers: [], remainder: source };
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
function leadingNumber(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
    const match = String(value ?? "").trim().replace(/[−–—]/g, "-").match(/^[+-]?\d+/);
    return match ? Number(match[0]) : null;
}
function traitLevelLabel(level) {
    return level === 3 ? "III" : level === 2 ? "II" : "I";
}
function buildAttributeCalculation(sheet, attribute) {
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
function buildDefenseCalculation(sheet, result) {
    const quick = Number(sheet.attributes.quick || 0);
    const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
    const robustoPenalty = robustoLevel === 3 ? 4 : robustoLevel === 2 ? 3 : robustoLevel === 1 ? 2 : 0;
    const base = 10 - quick;
    const finalNumber = leadingNumber(result);
    const automatic = robustoLevel > 0 || !String(sheet.defense ?? "").trim();
    const rows = [
        { label: "Ágil", value: String(quick) },
        { label: "Base", value: String(base), explanation: `10 − Ágil (${quick})` }
    ];
    if (robustoLevel > 0)
        rows.push({ label: `Robusto ${traitLevelLabel(robustoLevel)}`, value: `+${robustoPenalty}`, explanation: "El tamaño facilita que los adversarios alcancen a la criatura." });
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
function buildToughnessCalculation(sheet, result) {
    const strong = Number(sheet.attributes.strong || 0);
    const recioLevel = getMonsterTraitLevel(sheet.traits ?? [], ["recio"]);
    const multiplier = recioLevel === 3 ? 3 : recioLevel === 2 ? 2 : recioLevel === 1 ? 1.5 : 1;
    const automatic = recioLevel > 0 || !String(sheet.toughness ?? "").trim();
    const base = Math.max(10, strong);
    const finalNumber = leadingNumber(result);
    const rows = [{ label: "Fuerte", value: String(strong) }];
    if (recioLevel > 0)
        rows.push({ label: `Recio ${traitLevelLabel(recioLevel)}`, value: `×${multiplier}`, explanation: "Recio multiplica la Resistencia basada en Fuerte." });
    else
        rows.push({ label: "Base ordinaria", value: String(base), explanation: "La Resistencia ordinaria es como mínimo 10." });
    if (!automatic && finalNumber !== null && finalNumber !== base)
        rows.push({ label: "Ajuste publicado", value: String(finalNumber - base), explanation: "Diferencia incluida en el perfil publicado." });
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
function buildPainThresholdCalculation(sheet, result) {
    const strong = Number(sheet.attributes.strong || 0);
    const base = Math.ceil(strong / 2);
    const finalNumber = leadingNumber(result);
    const rows = [
        { label: "Fuerte", value: String(strong) },
        { label: "Mitad, redondeada hacia arriba", value: String(base) }
    ];
    if (finalNumber !== null && finalNumber !== base)
        rows.push({ label: "Ajuste publicado", value: String(finalNumber - base), explanation: "Puede proceder de rasgos, corrupción u otra regla especial del perfil." });
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
function buildArmorCalculation(sheet, result) {
    const duroLevel = getMonsterTraitLevel(sheet.traits ?? [], ["duro"]);
    const duroArmor = duroLevel === 3 ? 4 : duroLevel === 2 ? 3 : duroLevel === 1 ? 2 : 0;
    const arithmetic = String(sheet.armorDetails || sheet.armor).match(/^\s*(\d+(?:\s*\+\s*\d+)+)/)?.[1];
    const arithmeticTotal = arithmetic ? arithmetic.split("+").reduce((total, term) => total + Number(term.trim()), 0) : null;
    const finalNumber = leadingNumber(result);
    const rows = [];
    if (arithmetic)
        rows.push({ label: "Componentes publicados", value: arithmetic, explanation: `Suma: ${arithmeticTotal}` });
    else
        rows.push({ label: "Protección publicada", value: sheet.armorDetails || sheet.armor || "0" });
    if (duroLevel > 0)
        rows.push({ label: `Duro ${traitLevelLabel(duroLevel)}`, value: String(duroArmor), explanation: "Protección natural correspondiente al nivel del rasgo." });
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
function buildWeaponCalculation(weapon, index) {
    const result = String(weapon.fixedValue ?? (weapon.damage || "-"));
    const averaged = weapon.damageFormula ? averageDiceFormula(weapon.damageFormula) : null;
    const rows = [
        { label: "Ataque", value: weapon.name },
        { label: "Atributo usado", value: weapon.attribute || "Indicado por el perfil" }
    ];
    if (weapon.damageFormula)
        rows.push({ label: "Fórmula original", value: weapon.damageFormula, explanation: averaged === null ? "La fórmula no puede convertirse automáticamente." : `Valor fijo oficial para PNJ: ${averaged}.` });
    else
        rows.push({ label: "Daño publicado", value: weapon.damage || result, explanation: "El libro proporciona el valor final y no desglosa sus sumandos." });
    if (weapon.qualities)
        rows.push({ label: "Cualidades", value: weapon.qualities });
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
function buildChallengeCalculation(sheet, xp, result) {
    const paid = sheet.capabilities
        .map((entry) => ({ entry, cost: Math.max(0, getActorCapabilityXpDelta(entry)) }))
        .filter(({ cost }) => cost > 0);
    const rows = paid.length
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
function CalculationInfoButton({ label, onClick }) {
    return (_jsx("button", { type: "button", className: "monster-calculation-info-button", "aria-label": `Ver cálculo de ${label}`, title: `Ver cálculo de ${label}`, onClick: onClick, children: "i" }));
}
export function MonsterReferenceSheet({ monster, backgroundPreferenceScope, official = false, busy = false, onClose, onDuplicate, onEdit, onDelete }) {
    const closeRef = useRef(null);
    const capabilityCloseRef = useRef(null);
    const traitCloseRef = useRef(null);
    const calculationCloseRef = useRef(null);
    const sheet = monster.sheet;
    const derived = getDerivedMonsterSheetStats(sheet);
    const xp = getMonsterCreationXp(sheet);
    const capabilities = useMemo(() => buildMonsterCapabilityItems(sheet.capabilities), [sheet.capabilities]);
    const traits = useMemo(() => buildMonsterTraitItems(sheet.traits, sheet.capabilities), [sheet.capabilities, sheet.traits]);
    const references = monster.references?.length ? monster.references : sheet.sourceReferences;
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(true);
    const [selectedCapability, setSelectedCapability] = useState(null);
    const [selectedTrait, setSelectedTrait] = useState(null);
    const [selectedCalculation, setSelectedCalculation] = useState(null);
    const selectedCompendiumEntry = selectedCapability?.canonical
        ? findCompendiumEntryByTypeAndName(selectedCapability.canonical.tipo, selectedCapability.canonical.nombre)
        : null;
    const capabilityDescription = useMemo(() => selectedCapability
        ? parseCapabilityDescription(selectedCapability.descriptionOverride
            || selectedCompendiumEntry?.detalle
            || selectedCapability.canonical?.efectoResumen
            || selectedCapability.publishedText)
        : null, [selectedCapability, selectedCompendiumEntry]);
    const selectedSourceUrl = selectedCapability
        ? getCompendiumSourcePdfUrl(selectedCapability.source, selectedCapability.page, selectedCapability.name)
        : null;
    const traitDescription = useMemo(() => selectedTrait
        ? parseMonsterTraitDescription(selectedTrait.entry?.detalle || selectedTrait.descriptionOverride || selectedTrait.entry?.resumen || selectedTrait.publishedText)
        : null, [selectedTrait]);
    const selectedTraitSourceUrl = selectedTrait
        ? getCompendiumSourcePdfUrl(selectedTrait.source, selectedTrait.page, selectedTrait.name)
        : null;
    const challengeCalculation = useMemo(() => buildChallengeCalculation(sheet, xp, monster.threat), [monster.threat, sheet, xp]);
    const attributeCalculations = useMemo(() => Object.fromEntries(MONSTER_ATTRIBUTE_KEYS.map((attribute) => [attribute, buildAttributeCalculation(sheet, attribute)])), [sheet]);
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
        if (selectedCapability)
            window.setTimeout(() => capabilityCloseRef.current?.focus(), 0);
    }, [selectedCapability]);
    useEffect(() => {
        if (selectedTrait)
            window.setTimeout(() => traitCloseRef.current?.focus(), 0);
    }, [selectedTrait]);
    useEffect(() => {
        if (selectedCalculation)
            window.setTimeout(() => calculationCloseRef.current?.focus(), 0);
    }, [selectedCalculation]);
    useEffect(() => {
        const onKeyDown = (event) => {
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
    return (_jsxs("article", { className: "monster-reference-sheet", "aria-label": `Ficha de ${monster.name}`, children: [_jsxs("header", { className: "monster-reference-sheet__header", children: [_jsxs("div", { className: "monster-reference-sheet__identity", children: [_jsx("span", { className: "compendium-eyebrow", children: sheet.family || monster.family || monster.category }), _jsx("h2", { children: monster.name }), _jsxs("p", { children: [sheet.race || monster.category, " \u00B7 ", monster.category] })] }), _jsxs("div", { className: "monster-reference-sheet__actions", children: [_jsx(CharacterSheetBackgroundPicker, { preferenceScope: backgroundPreferenceScope }), official && onDuplicate ? _jsx("button", { type: "button", onClick: onDuplicate, children: "Duplicar en Mis monstruos" }) : null, !official && onEdit ? _jsx("button", { type: "button", onClick: onEdit, children: "Editar" }) : null, !official && onDelete ? _jsx("button", { type: "button", className: "danger", disabled: busy, onClick: onDelete, children: "Eliminar" }) : null, _jsx("button", { ref: closeRef, type: "button", className: "subtle-button", onClick: onClose, children: "Cerrar ficha" })] })] }), _jsxs("div", { className: "monster-reference-sheet__scroll", children: [_jsxs("section", { className: "monster-reference-sheet__hero campaign-sheet-card", children: [_jsxs("div", { className: "monster-calculation-host", children: [_jsx("span", { children: "Desaf\u00EDo calculado" }), _jsx("strong", { children: monster.threat }), _jsxs("small", { children: [xp, " PX"] }), _jsx(CalculationInfoButton, { label: "desaf\u00EDo", onClick: () => setSelectedCalculation(challengeCalculation) })] }), _jsxs("div", { children: [_jsx("span", { children: "Conducta" }), _jsx("strong", { children: sheet.conduct || "No indicada" })] }), _jsxs("div", { children: [_jsx("span", { children: "Sombra" }), _jsx("strong", { children: sheet.shadow || "No indicada" }), sheet.corruption !== null ? _jsxs("small", { children: ["Corrupci\u00F3n: ", sheet.corruption] }) : null] })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", "aria-labelledby": `monster-${monster.id}-attributes`, children: [_jsx("h3", { id: `monster-${monster.id}-attributes`, children: "Atributos" }), _jsx("div", { className: "monster-reference-attributes", children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsxs("div", { className: "monster-reference-attribute monster-calculation-host", children: [_jsx("span", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }), _jsx("strong", { children: sheet.attributes[attribute] }), _jsx("small", { children: signedModifier(sheet.attributes[attribute]) }), _jsx(CalculationInfoButton, { label: `modificador de ${MONSTER_ATTRIBUTE_LABELS[attribute]}`, onClick: () => setSelectedCalculation(attributeCalculations[attribute]) })] }, attribute))) })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Combate y defensas" }), _jsxs("dl", { className: "monster-reference-values", children: [_jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Defensa" }), _jsx("dd", { children: derived.defense }), _jsx(CalculationInfoButton, { label: "Defensa", onClick: () => setSelectedCalculation(defenseCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Resistencia" }), _jsx("dd", { children: derived.toughness }), _jsx(CalculationInfoButton, { label: "Resistencia", onClick: () => setSelectedCalculation(toughnessCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Umbral de dolor" }), _jsx("dd", { children: derived.painThreshold }), _jsx(CalculationInfoButton, { label: "Umbral de dolor", onClick: () => setSelectedCalculation(painThresholdCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Armadura" }), _jsx("dd", { children: shownArmor }), _jsx(CalculationInfoButton, { label: "Armadura", onClick: () => setSelectedCalculation(armorCalculation) })] })] }), _jsx("p", { className: "monster-reference-rule", children: sheet.armorDetails || sheet.armor })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Armas" }), sheet.weapons.length ? (_jsx("div", { className: "monster-reference-weapons", children: sheet.weapons.map((weapon, index) => (_jsxs("article", { className: "monster-calculation-host", children: [_jsxs("div", { children: [_jsx("strong", { children: weapon.name }), _jsx("span", { children: weapon.attribute || "Ataque" })] }), _jsx("b", { children: weapon.fixedValue ?? (weapon.damage || "-") }), _jsx("p", { children: weapon.details || weapon.qualities }), weapon.damageFormula ? _jsxs("small", { children: ["F\u00F3rmula: ", weapon.damageFormula] }) : null, _jsx(CalculationInfoButton, { label: `daño de ${weapon.name}`, onClick: () => setSelectedCalculation(weaponCalculations[index]) })] }, `${weapon.name}-${index}`))) })) : _jsx("p", { children: sheet.actions.find((entry) => entry.startsWith("Armas:"))?.replace(/^Armas:\s*/, "") || "Sin armas indicadas." })] })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Rasgos" }), traits.length ? (_jsx("ul", { className: "monster-reference-tags monster-reference-trait-list", children: traits.map((trait) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedTrait(trait), children: [_jsxs("span", { children: [_jsx("strong", { children: trait.name }), trait.qualifier ? _jsx("small", { children: trait.qualifier }) : null] }), _jsx("b", { children: trait.level ? `Nivel ${trait.level}` : "Ver reglas" })] }) }, trait.id))) })) : _jsx("p", { children: "Sin rasgos registrados." })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Habilidades y poderes" }), capabilities.length ? (_jsx("ul", { className: "monster-reference-list", children: capabilities.map((entry) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedCapability(entry), children: [_jsxs("span", { children: [_jsx("strong", { children: entry.name }), _jsx("small", { children: entry.kind === "poder_mistico" ? "Poder místico" : entry.kind === "ritual" ? "Ritual" : "Habilidad" })] }), _jsx("b", { children: entry.level ? capabilityLevelLabel(entry.level) : "Ver reglas" })] }) }, entry.id))) })) : _jsx("p", { children: "Sin habilidades registradas." }), hasText(sheet.blessingsBurdens) ? _jsxs(_Fragment, { children: [_jsx("h4", { children: "Bendiciones y cargas" }), _jsx("p", { children: sheet.blessingsBurdens })] }) : null] })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "T\u00E1cticas" }), _jsx("p", { children: sheet.tactics || "Sin tácticas registradas." })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Equipo y bot\u00EDn" }), _jsx("p", { children: sheet.loot || sheet.equipment?.map((entry) => entry.notes || entry.name).filter(Boolean).join(" · ") || "Sin equipo o botín registrado." }), hasText(sheet.weakness) ? _jsxs(_Fragment, { children: [_jsx("h4", { children: "Debilidad" }), _jsx("p", { children: sheet.weakness })] }) : null] })] }), _jsxs("details", { className: "monster-reference-collapsible narrative-collapsible-card campaign-sheet-card", open: isDescriptionOpen, onToggle: (event) => setIsDescriptionOpen(event.currentTarget.open), children: [_jsxs("summary", { children: [_jsx("span", { children: "Descripci\u00F3n" }), _jsx("small", { children: isDescriptionOpen ? "Ocultar" : "Mostrar" })] }), _jsx("div", { className: "narrative-collapsible-content", children: _jsx("p", { children: sheet.description || monster.summary }) })] }), _jsxs("footer", { className: "monster-reference-sources campaign-sheet-card", children: [_jsx("h3", { children: "Fuentes" }), _jsx("div", { children: references.map((reference, index) => {
                                    const pdf = sourcePdf(reference.source);
                                    const label = `${reference.source} · p.${reference.page}`;
                                    return pdf
                                        ? _jsx(SourceReferenceLink, { href: buildPdfViewerUrl(pdf, reference.pdfPage), source: reference.source, page: reference.page, ariaLabel: label }, `${reference.source}-${reference.page}-${index}`)
                                        : _jsx("span", { children: label }, `${reference.source}-${reference.page}-${index}`);
                                }) })] })] }), selectedCalculation ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedCalculation(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal monster-calculation-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-calculation-${selectedCalculation.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Auditor\u00EDa del c\u00E1lculo" }), _jsx("h3", { id: `monster-calculation-${selectedCalculation.id}`, children: selectedCalculation.title }), _jsx("p", { children: selectedCalculation.formula })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Resultado final" }), _jsx("strong", { children: selectedCalculation.result })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [_jsx("dl", { className: "monster-calculation-breakdown", children: selectedCalculation.rows.map((row, index) => (_jsxs("div", { children: [_jsx("dt", { children: row.label }), _jsx("dd", { children: row.value }), row.explanation ? _jsx("p", { children: row.explanation }) : null] }, `${row.label}-${index}`))) }), selectedCalculation.warning ? (_jsxs("p", { className: "monster-calculation-warning", children: [_jsx("strong", { children: "Revisar:" }), " ", selectedCalculation.warning] })) : null, selectedCalculation.notes?.map((note, index) => (_jsx("p", { className: "monster-calculation-note", children: note }, `${selectedCalculation.id}-note-${index}`)))] }), _jsx("footer", { className: "monster-capability-modal__actions", children: _jsx("button", { ref: calculationCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedCalculation(null), children: "Cerrar" }) })] }) })) : null, selectedTrait && traitDescription ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedTrait(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal monster-trait-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-trait-${selectedTrait.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Rasgo de monstruo" }), _jsx("h3", { id: `monster-trait-${selectedTrait.id}`, children: selectedTrait.name }), _jsxs("p", { children: [selectedTrait.source, selectedTrait.page ? ` · p.${selectedTrait.page}` : ""] })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Nivel del monstruo" }), _jsx("strong", { children: selectedTrait.level ? `Nivel ${selectedTrait.level}` : "Sin niveles" })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [traitDescription.remainder ? _jsx("p", { children: traitDescription.remainder }) : null, traitDescription.tiers.length ? (_jsx("div", { className: "monster-capability-tier-list", children: traitDescription.tiers.map((tier) => {
                                        const isCurrent = Boolean(selectedTrait.level && tier.label.split("/").includes(selectedTrait.level));
                                        return (_jsxs("section", { className: `monster-capability-tier${isCurrent ? " is-current" : ""}`, children: [_jsxs("header", { children: [_jsxs("h4", { children: ["Nivel ", tier.label] }), isCurrent ? _jsx("span", { children: "Nivel del monstruo" }) : null] }), _jsx("p", { children: tier.content })] }, tier.label));
                                    }) })) : null, selectedTrait.qualifier ? (_jsxs("p", { className: "monster-capability-adaptation", children: [_jsx("strong", { children: "Aplicaci\u00F3n en esta criatura:" }), " ", selectedTrait.qualifier] })) : null, selectedTrait.adaptationNote ? _jsx("p", { className: "monster-capability-adaptation", children: selectedTrait.adaptationNote }) : null, !selectedTrait.entry && !selectedTrait.descriptionOverride ? (_jsx("p", { className: "monster-capability-adaptation", children: "Rasgo publicado sin una entrada can\u00F3nica enlazada; se conserva literalmente el dato de la ficha." })) : null] }), _jsxs("footer", { className: "monster-capability-modal__actions", children: [selectedTraitSourceUrl ? _jsx(SourceReferenceLink, { href: selectedTraitSourceUrl, source: selectedTrait.source, page: selectedTrait.page, ariaLabel: "Abrir fuente" }) : null, _jsx("button", { ref: traitCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedTrait(null), children: "Cerrar" })] })] }) })) : null, selectedCapability && capabilityDescription ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedCapability(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-capability-${selectedCapability.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: selectedCapability.kind === "poder_mistico" ? "Poder místico" : selectedCapability.kind === "ritual" ? "Ritual" : "Habilidad" }), _jsx("h3", { id: `monster-capability-${selectedCapability.id}`, children: selectedCapability.name }), _jsxs("p", { children: [selectedCapability.source, selectedCapability.page ? ` · p.${selectedCapability.page}` : ""] })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Nivel del monstruo" }), _jsx("strong", { children: selectedCapability.level ? capabilityLevelLabel(selectedCapability.level) : selectedCapability.kind === "ritual" ? "Ritual" : "Publicado" })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [capabilityDescription.remainder ? _jsx("p", { children: capabilityDescription.remainder }) : null, capabilityDescription.tiers.length ? (_jsx("div", { className: "monster-capability-tier-list", children: capabilityDescription.tiers.map((tier) => {
                                        const isCurrent = selectedCapability.level && capabilityLevelLabel(selectedCapability.level) === tier.label;
                                        return (_jsxs("section", { className: `monster-capability-tier${isCurrent ? " is-current" : ""}`, children: [_jsxs("header", { children: [_jsx("h4", { children: tier.label }), isCurrent ? _jsx("span", { children: "Nivel del monstruo" }) : null] }), _jsx("p", { children: tier.content })] }, tier.label));
                                    }) })) : capabilityDescription.remainder ? null : (_jsx("p", { children: selectedCapability.publishedText })), selectedCapability.adaptationNote ? _jsx("p", { className: "monster-capability-adaptation", children: selectedCapability.adaptationNote }) : null, !selectedCapability.canonical && !selectedCapability.descriptionOverride ? (_jsx("p", { className: "monster-capability-adaptation", children: "Entrada publicada sin equivalencia can\u00F3nica; se conserva literalmente el dato de la ficha." })) : null, capabilityDescription.reference ? _jsx("small", { className: "monster-capability-reference", children: capabilityDescription.reference }) : null] }), _jsxs("footer", { className: "monster-capability-modal__actions", children: [selectedSourceUrl ? _jsx(SourceReferenceLink, { href: selectedSourceUrl, source: selectedCapability.source, page: selectedCapability.page, ariaLabel: "Abrir fuente" }) : null, _jsx("button", { ref: capabilityCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedCapability(null), children: "Cerrar" })] })] }) })) : null] }));
}
