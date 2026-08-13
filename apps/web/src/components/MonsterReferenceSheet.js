import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONSTER_ATTRIBUTE_KEYS, MONSTER_ATTRIBUTE_LABELS, SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, WEAPON_TEMPLATES, averageDiceFormula, getActorCapabilityXpDelta, getDerivedMonsterSheetStats, getMonsterCreationXp, getMonsterTraitLevel, increaseEffectDieFormula } from "@umbra/shared";
import { findCompendiumEntryByTypeAndName, getCompendiumSourcePdfUrl } from "../models/compendiumEntries";
import { buildPdfViewerUrl } from "../services/pdfViewer";
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
const CAPABILITY_LEVEL_ORDER = { principiante: 1, adepto: 2, maestro: 3 };
const CAPABILITY_CATALOG = [...SYMBAROUM_ABILITIES, ...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS];
const PUBLISHED_CAPABILITY_DETAILS = {
    "combate con latigo": "Esta técnica combina un látigo en una mano con un arma a una mano en la otra. Principiante: Activa. Si el ataque con látigo impacta, el personaje obtiene un ataque gratuito con el arma a una mano, aunque el látigo no cause daño. Adepto: Activa. Como en Principiante, pero el látigo obstaculiza al enemigo y el ataque gratuito impacta automáticamente. Maestro: Activa. Como en Adepto, pero el combatiente acerca al enemigo para que el ataque gratuito inflija +1D6 de daño. Ref: Códice de monstruos, p.123.",
    "sutileza a dos manos": "El personaje maneja grandes espadas a dos manos con precisión y aprovecha la longitud del arma contra toda clase de oponentes. Principiante: Pasiva. Las espadas a dos manos adquieren la cualidad Larga y pueden utilizarse con Armas de asta. Adepto: Reacción. Tras una Defensa con éxito por turno, una tirada de [Fuerte←Fuerte] permite sacar al enemigo del cuerpo a cuerpo: recibe 1D6 de daño, es empujado unos metros y debe enfrentarse otra vez a la cualidad Larga. Maestro: Activa. Los golpes se convierten en una serie de ataques contra enemigos a distancia de cuerpo a cuerpo; tras cada impacto se ataca al siguiente objetivo hasta que un ataque falle. Ref: Códice de monstruos, p.136."
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
        note: "Adaptación publicada: funciona como Estrangulador a nivel principiante, pero requiere ventaja."
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
        detail: "Usar Sabiduría de los tiempos genera corrupción temporal como un poder místico. I: Turno completo. Tras un trance y una tirada con éxito de Tenaz, obtiene hasta el final de la escena el nivel principiante de una habilidad opcional, excepto Tradiciones místicas, Rituales y Poderes místicos; solo puede mantener una de estas habilidades cada vez. II: Activa. Funciona como el nivel I, pero el trance requiere menos tiempo. III: Activa. Funciona como el nivel II, pero puede obtener el nivel adepto de la habilidad elegida."
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
    if (level === "principiante")
        return "Principiante";
    return "Sin nivel";
}
function inferCapabilityLevel(raw, fallback) {
    const normalized = normalizeCapability(raw);
    if (/\bmaestr[oa]\b/.test(normalized))
        return "maestro";
    if (/\badept[oa]\b/.test(normalized))
        return "adepto";
    if (/\bprincipiante\b/.test(normalized))
        return "principiante";
    return fallback ?? "principiante";
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
                descriptionOverride: PUBLISHED_CAPABILITY_DETAILS[normalizedPublished.replace(/\b(?:principiante|adepto|maestro)\b.*$/, "").trim()],
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
    const matches = [...source.matchAll(/(Principiante|Adepto|Maestro):/g)];
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
        const parsedLabel = match[1] ?? "Principiante";
        return { label: parsedLabel, content };
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
function mechanicalLevelLabel(level) {
    return level >= 3 ? "Maestro" : level === 2 ? "Adepto" : "Principiante";
}
function capabilityLevel(sheet, aliases) {
    const normalizedAliases = aliases.map(normalizeCapability);
    let highest = getMonsterTraitLevel(sheet.traits ?? [], normalizedAliases);
    for (const capability of sheet.capabilities ?? []) {
        const normalized = normalizeCapability(`${capability.name} ${capability.legacyData ?? ""}`);
        if (!normalizedAliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `) || normalized.includes(`${alias} `)))
            continue;
        const level = capability.level === "maestro" ? 3 : capability.level === "adepto" ? 2 : capability.level === "principiante" ? 1 : inferCapabilityLevel(normalized) === "maestro" ? 3 : inferCapabilityLevel(normalized) === "adepto" ? 2 : 1;
        highest = Math.max(highest, level);
    }
    return highest;
}
function capabilitySource(name, level, roman = false) {
    if (level <= 0)
        return name;
    return `${name} (${roman ? traitLevelLabel(level) : mechanicalLevelLabel(level)})`;
}
function formulaAverage(formula) {
    return averageDiceFormula(formula.toLowerCase());
}
function formulaWithAverage(formula, prefix = "") {
    const average = formulaAverage(formula);
    return average === null ? `${prefix}${formula.toUpperCase()}` : `${prefix}${formula.toUpperCase()} → ${prefix}${average}`;
}
function normalizeWeaponName(value) {
    return normalizeCapability(value)
        .replace(/\b(?:dos|doble|ambas?|envenenad[ao]s?|oxidada|ritual|espectral(?:es)?|apresadoras?)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function weaponText(weapon) {
    return normalizeCapability(`${weapon.name} ${weapon.qualities} ${weapon.details}`);
}
function isRangedWeapon(weapon) {
    return /\b(arco|ballesta|arbalesta|honda|cerbatana|proyectil|a distancia)\b/.test(weaponText(weapon));
}
function isThrownWeapon(weapon) {
    return /\b(arrojadiz|jabalina|lanzadardos|granada|bolas)\b/.test(weaponText(weapon));
}
function isNaturalWeapon(weapon, sheet) {
    const hasNaturalAttackTraining = capabilityLevel(sheet, ["arma natural", "armas naturales", "combate sin armas"]) > 0;
    if (!hasNaturalAttackTraining)
        return false;
    return /\b(garras?|zarpas?|mordisco|colmillos?|cuernos?|mandibulas?|tentaculos?|aguijon|picadura|pezuñas?|puños?|cabezazo|ramas?)\b/.test(weaponText(weapon));
}
function findWeaponTemplate(weapon) {
    const target = normalizeWeaponName(weapon.name);
    const exact = WEAPON_TEMPLATES.find((template) => normalizeWeaponName(template.name) === target);
    if (exact)
        return exact;
    const contained = WEAPON_TEMPLATES
        .filter((template) => {
        const candidate = normalizeWeaponName(template.name);
        return candidate.length >= 4 && (target.includes(candidate) || candidate.includes(target));
    })
        .sort((left, right) => normalizeWeaponName(right.name).length - normalizeWeaponName(left.name).length)[0];
    if (contained)
        return contained;
    if (/\bdaga\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-dagger");
    if (/\barco\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-bow");
    if (/\bballesta\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-crossbow");
    if (/\blanza|alabarda\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-spear");
    if (/\bvara|baston\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-quarterstaff");
    if (/\bespada|hacha|maza|martillo|garrote\b/.test(target))
        return WEAPON_TEMPLATES.find((entry) => entry.templateId === "weapon-single-handed");
    return undefined;
}
function exceptionalAttributeContribution(sheet, attribute) {
    const exceptional = sheet.capabilities.find((entry) => normalizeCapability(entry.name) === "atributo excepcional" && entry.attributeKey === attribute);
    if (!exceptional)
        return null;
    const level = exceptional.level === "maestro" ? 3 : exceptional.level === "adepto" ? 2 : 1;
    return {
        label: "Aumento del atributo",
        value: `+${level}`,
        explanation: `El valor final de ${MONSTER_ATTRIBUTE_LABELS[attribute]} ya incorpora esta mejora.`,
        source: capabilitySource("Atributo excepcional", level),
        kind: "capability"
    };
}
function monsterAttributeKey(value) {
    const normalized = normalizeCapability(value ?? "");
    const aliases = [
        ["quick", ["agil", "quick"]],
        ["vigilant", ["atento", "vigilant"]],
        ["accurate", ["diestro", "accurate"]],
        ["discreet", ["discreto", "discreet"]],
        ["strong", ["fuerte", "strong"]],
        ["cunning", ["inteligente", "cunning"]],
        ["persuasive", ["persuasivo", "persuasive"]],
        ["resolute", ["tenaz", "resolute"]]
    ];
    return aliases.find(([, names]) => names.some((name) => normalized.includes(name)))?.[0] ?? null;
}
function findArmorTemplate(sheet) {
    const armorName = normalizeCapability(sheet.armorDetails || sheet.armor).replace(/\d.*$/, "").trim();
    const aliases = [
        [/hilo de seda/, "Hilo de seda"],
        [/coraza de seda lacada/, "Coraza de seda lacada"],
        [/cuero tachonado/, "Cuero tachonado"],
        [/armadura de placas/, "Armadura de placas"],
        [/armadura completa/, "Armadura completa"],
        [/armadura lamelar/, "Armadura lamelar"],
        [/cota de malla/, "Cota de malla de doble"],
        [/armadura ligera/, "Armadura ligera"],
        [/armadura media/, "Armadura media"],
        [/armadura pesada/, "Armadura pesada"]
    ];
    const matched = aliases.find(([pattern]) => pattern.test(armorName));
    return matched?.[1] ?? null;
}
function buildAttributeCalculation(sheet, attribute) {
    const value = Number(sheet.attributes[attribute] || 0);
    const modifier = 10 - value;
    const exceptional = exceptionalAttributeContribution(sheet, attribute);
    const baseValue = exceptional ? value - Number(exceptional.value) : value;
    return {
        id: `attribute-${attribute}`,
        title: `Modificador de ${MONSTER_ATTRIBUTE_LABELS[attribute]}`,
        result: modifier > 0 ? `+${modifier}` : String(modifier),
        formula: "El modificador compara el valor final del atributo con 10.",
        rows: [
            { label: "Valor base", value: String(baseValue), kind: "base" },
            ...(exceptional ? [exceptional] : []),
            {
                label: "Conversión a modificador",
                value: `10 − ${value}`,
                explanation: "Las fichas de monstruo expresan la dificultad para los PJ respecto al valor de referencia 10.",
                kind: "published"
            }
        ]
    };
}
function buildDefenseCalculation(sheet, result) {
    const quick = Number(sheet.attributes.quick || 0);
    const vigilant = Number(sheet.attributes.vigilant || 0);
    const cunning = Number(sheet.attributes.cunning || 0);
    const sixthSenseLevel = capabilityLevel(sheet, ["sexto sentido"]);
    const tacticianLevel = capabilityLevel(sheet, ["tactico"]);
    const feintLevel = capabilityLevel(sheet, ["finta"]);
    const berserkerLevel = capabilityLevel(sheet, ["berserker"]);
    const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
    const robustoPenalty = robustoLevel === 3 ? 4 : robustoLevel === 2 ? 3 : robustoLevel === 1 ? 2 : 0;
    const candidates = [
        { attribute: "quick", value: quick },
        ...(sixthSenseLevel >= 2 ? [{ attribute: "vigilant", value: vigilant, source: capabilitySource("Sexto sentido", sixthSenseLevel) }] : []),
        ...(tacticianLevel >= 2 ? [{ attribute: "cunning", value: cunning, source: capabilitySource("Táctico", tacticianLevel) }] : []),
        ...(feintLevel >= 2 ? [{ attribute: "discreet", value: Number(sheet.attributes.discreet || 0), source: capabilitySource("Finta", feintLevel) }] : [])
    ];
    const selectedAttribute = candidates.sort((left, right) => right.value - left.value)[0] ?? candidates[0];
    const berserkerChangesDefense = berserkerLevel > 0 && berserkerLevel < 3;
    const defenseAttributeValue = berserkerChangesDefense ? 5 : selectedAttribute.value;
    const base = 10 - defenseAttributeValue;
    const finalNumber = leadingNumber(result);
    const rows = [];
    if (berserkerChangesDefense) {
        rows.push({
            label: "Atributo para Defensa",
            value: "Ágil 5",
            explanation: `El frenesí sustituye el valor normal de Ágil (${quick}) mientras está activo.`,
            source: capabilitySource("Berserker", berserkerLevel),
            kind: "capability"
        });
    }
    else {
        rows.push({
            label: "Atributo para Defensa",
            value: `${MONSTER_ATTRIBUTE_LABELS[selectedAttribute.attribute]} ${selectedAttribute.value}`,
            explanation: selectedAttribute.source
                ? `Esta capacidad permite sustituir Ágil (${quick}) por ${MONSTER_ATTRIBUTE_LABELS[selectedAttribute.attribute]}.`
                : "La Defensa usa Ágil cuando ninguna capacidad permite sustituirlo.",
            source: selectedAttribute.source,
            kind: selectedAttribute.source ? "capability" : "base"
        });
    }
    rows.push({ label: "Defensa base", value: `10 − ${defenseAttributeValue} = ${base}`, kind: "base" });
    let calculated = base;
    if (robustoLevel > 0) {
        calculated += robustoPenalty;
        rows.push({
            label: "Modificador de Defensa",
            value: `+${robustoPenalty}`,
            explanation: "El tamaño de la criatura facilita que sus adversarios la alcancen.",
            source: capabilitySource("Robusto", robustoLevel, true),
            kind: "capability"
        });
    }
    const allEquipmentText = normalizeCapability(`${sheet.armorDetails} ${sheet.armor} ${sheet.weapons.map((weapon) => `${weapon.name} ${weapon.qualities} ${weapon.details}`).join(" ")} ${(sheet.equipment ?? []).map((entry) => `${entry.name} ${entry.qualities} ${entry.notes}`).join(" ")}`);
    const hasShield = /\bescudo\b/.test(allEquipmentText);
    if (hasShield) {
        const shieldLevel = capabilityLevel(sheet, ["combate con escudo"]);
        const shieldBonus = shieldLevel > 0 ? 2 : 1;
        calculated -= shieldBonus;
        rows.push({
            label: "Bonificación de escudo",
            value: `−${shieldBonus}`,
            explanation: shieldLevel > 0 ? "La habilidad mejora a +2 la bonificación ordinaria de +1 del escudo." : "Bonificación ordinaria por llevar escudo.",
            source: shieldLevel > 0 ? capabilitySource("Combate con escudo", shieldLevel) : "Escudo",
            kind: shieldLevel > 0 ? "capability" : "quality"
        });
    }
    const balancedCount = sheet.weapons.filter((weapon) => normalizeCapability(`${weapon.qualities} ${weapon.details}`).includes("equilibrada")).length;
    if (balancedCount > 0) {
        calculated -= balancedCount;
        rows.push({ label: "Arma Equilibrada", value: `−${balancedCount}`, explanation: "Cada arma Equilibrada equipada proporciona +1 a Defensa.", source: "Cualidad Equilibrada", kind: "quality" });
    }
    const twoWeaponsLevel = capabilityLevel(sheet, ["ataque con dos armas"]);
    if (twoWeaponsLevel > 0) {
        calculated -= 1;
        rows.push({
            label: "Bonificación por dos armas",
            value: "−1",
            explanation: "Al llevar un arma en cada mano, la bonificación de +1 se traduce en un punto menos en la Defensa del perfil.",
            source: capabilitySource("Ataque con dos armas", twoWeaponsLevel),
            kind: "capability"
        });
    }
    const armorText = normalizeCapability(`${sheet.armorDetails} ${sheet.armor}`);
    const armorTemplate = findArmorTemplate(sheet);
    const armorKind = armorTemplate && ["Armadura completa", "Armadura de placas", "Armadura pesada"].includes(armorTemplate)
        ? "pesada"
        : armorTemplate && ["Armadura lamelar", "Cota de malla de doble", "Coraza de seda lacada", "Armadura media"].includes(armorTemplate)
            ? "media"
            : armorTemplate
                ? "ligera"
                : null;
    const ordinaryArmorPenalty = armorKind === "pesada" ? 4 : armorKind === "media" ? 3 : armorKind === "ligera" ? 2 : 0;
    const clumsyPenalty = /aparatos/.test(armorText) ? 1 : 0;
    const flexibleReduction = /flexible/.test(armorText) ? 2 : 0;
    let armorPenalty = Math.max(0, ordinaryArmorPenalty + clumsyPenalty - flexibleReduction);
    if (armorKind) {
        rows.push({
            label: "Impedimento de la armadura",
            value: `+${ordinaryArmorPenalty}`,
            explanation: `Penalización ordinaria de una armadura ${armorKind}.`,
            source: armorTemplate ?? undefined,
            kind: "quality"
        });
    }
    if (clumsyPenalty > 0)
        rows.push({ label: "Aparatosa", value: `+${clumsyPenalty}`, source: "Cualidad Aparatosa", kind: "quality" });
    if (flexibleReduction > 0)
        rows.push({
            label: "Reducción del impedimento",
            value: `-${Math.min(flexibleReduction, ordinaryArmorPenalty + clumsyPenalty)}`,
            explanation: "Flexible reduce en dos puntos la penalización causada por la armadura.",
            source: "Cualidad Flexible",
            kind: "quality"
        });
    const armoredCombatLevel = capabilityLevel(sheet, ["combate con armadura"]);
    if (armorPenalty > 0 && armoredCombatLevel >= 2) {
        rows.push({
            label: "Penalización de armadura",
            value: `${armorPenalty} → 0`,
            explanation: "El nivel Adepto o superior elimina el efecto negativo de la armadura sobre Ágil y Defensa.",
            source: capabilitySource("Combate con armadura", armoredCombatLevel),
            kind: "capability"
        });
        armorPenalty = 0;
    }
    else if (armorPenalty > 0) {
        calculated += armorPenalty;
    }
    const mismatch = finalNumber !== null && calculated !== finalNumber;
    if (mismatch) {
        const adjustment = finalNumber - calculated;
        rows.push({
            label: "Diferencia no atribuida",
            value: adjustment > 0 ? `+${adjustment}` : String(adjustment),
            explanation: "El perfil publicado contiene otro modificador que los datos estructurados aún no identifican.",
            kind: "published"
        });
    }
    return {
        id: "defense",
        title: "Cálculo de Defensa",
        result,
        formula: "Atributo de Defensa y modificadores que alteran el valor publicado.",
        rows,
        warning: mismatch ? `El desglose conocido produce ${calculated}, pero el perfil publica ${result}.` : undefined
    };
}
function buildToughnessCalculation(sheet, result) {
    const strong = Number(sheet.attributes.strong || 0);
    const recioLevel = getMonsterTraitLevel(sheet.traits ?? [], ["recio"]);
    const fightingSpiritLevel = capabilityLevel(sheet, ["espiritu combativo"]);
    const multiplier = recioLevel === 3 ? 3 : recioLevel === 2 ? 2 : recioLevel === 1 ? 1.5 : 1;
    const base = recioLevel > 0 ? strong : fightingSpiritLevel > 0 ? strong + 5 : Math.max(10, strong);
    const finalNumber = leadingNumber(result);
    const exceptional = exceptionalAttributeContribution(sheet, "strong");
    const rows = [
        { label: "Fuerte final", value: String(strong), explanation: exceptional ? "Este valor ya contiene la mejora indicada debajo." : undefined, kind: "base" },
        ...(exceptional ? [exceptional] : [])
    ];
    let calculated = base;
    if (recioLevel > 0) {
        calculated = Math.floor(strong * multiplier);
        rows.push({
            label: "Multiplicador de Resistencia",
            value: `×${multiplier}`,
            explanation: `${strong} × ${multiplier} = ${calculated}.`,
            source: capabilitySource("Recio", recioLevel, true),
            kind: "capability"
        });
    }
    else if (fightingSpiritLevel > 0) {
        rows.push({
            label: "Bonificación de Resistencia",
            value: `+5 (${strong} + 5 = ${calculated})`,
            source: capabilitySource("Espíritu combativo", fightingSpiritLevel),
            kind: "capability"
        });
    }
    else {
        rows.push({ label: "Mínimo ordinario", value: "10", explanation: "La Resistencia no baja de 10 si ningún rasgo establece otra fórmula.", kind: "base" });
    }
    const mismatch = finalNumber !== null && finalNumber !== calculated;
    if (mismatch)
        rows.push({ label: "Diferencia no atribuida", value: String(finalNumber - calculated), explanation: "El perfil contiene una modificación adicional que no figura de forma estructurada.", kind: "published" });
    return {
        id: "toughness",
        title: "Cálculo de Resistencia",
        result,
        formula: "Fuerte, rasgos de tamaño y multiplicadores de Resistencia.",
        rows,
        warning: mismatch ? `El desglose conocido produce ${calculated}, pero el perfil publica ${result}.` : undefined
    };
}
function buildPainThresholdCalculation(sheet, result) {
    const strong = Number(sheet.attributes.strong || 0);
    const earthlyBond = capabilityLevel(sheet, ["vinculo terrenal"]);
    const corruptionPenalty = earthlyBond > 0 ? Number(sheet.corruption ?? 0) : 0;
    const base = Math.ceil(strong / 2);
    const calculated = Math.max(0, base - corruptionPenalty);
    const finalNumber = leadingNumber(result);
    const exceptional = exceptionalAttributeContribution(sheet, "strong");
    const rows = [
        { label: "Fuerte final", value: String(strong), explanation: exceptional ? "Este valor ya contiene la mejora indicada debajo." : undefined, kind: "base" },
        ...(exceptional ? [exceptional] : []),
        { label: "Mitad de Fuerte", value: `⌈${strong} ÷ 2⌉ = ${base}`, kind: "base" }
    ];
    if (earthlyBond > 0 && corruptionPenalty > 0)
        rows.push({
            label: "Corrupción permanente",
            value: `−${corruptionPenalty}`,
            explanation: "Vínculo terrenal reduce el Umbral de dolor en uno por cada punto de Corrupción permanente.",
            source: "Vínculo terrenal",
            kind: "capability"
        });
    const mismatch = finalNumber !== null && finalNumber !== calculated;
    if (mismatch)
        rows.push({ label: "Diferencia no atribuida", value: String(finalNumber - calculated), explanation: "El perfil publicado contiene otra modificación no identificada en sus datos estructurados.", kind: "published" });
    return {
        id: "pain-threshold",
        title: "Cálculo del Umbral de dolor",
        result,
        formula: finalNumber === null ? "La criatura no utiliza Umbral de dolor." : "Mitad de Fuerte, redondeada hacia arriba, y reglas que modifican el umbral.",
        rows,
        notes: finalNumber === null ? ["Los perfiles con «—» carecen de Umbral de dolor por su categoría, naturaleza o una regla especial."] : undefined,
        warning: mismatch ? `El desglose conocido produce ${calculated}, pero el perfil publica ${result}.` : undefined
    };
}
function buildArmorCalculation(sheet, result) {
    const duroLevel = getMonsterTraitLevel(sheet.traits ?? [], ["duro"]);
    const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
    const berserkerLevel = capabilityLevel(sheet, ["berserker"]);
    const survivorLevel = capabilityLevel(sheet, ["superviviente"]);
    const armoredMysticLevel = capabilityLevel(sheet, ["mistico acorazado"]);
    const armoredCombatLevel = capabilityLevel(sheet, ["combate con armadura"]);
    const shellLevel = capabilityLevel(sheet, ["caparazon"]);
    const finalNumber = leadingNumber(result);
    const publishedArithmetic = String(sheet.armorDetails || sheet.armor).match(/^\s*(\d+(?:\s*\+\s*\d+)+)/)?.[1];
    const publishedArithmeticTotal = publishedArithmetic
        ? publishedArithmetic.split("+").reduce((total, term) => total + Number(term.trim()), 0)
        : null;
    const rows = [];
    let calculated = 0;
    let hasKnownBase = false;
    const armorTemplateName = findArmorTemplate(sheet);
    const armorFormulaByName = {
        "Hilo de seda": "1d4",
        "Coraza de seda lacada": "1d6+1",
        "Cuero tachonado": "1d4+1",
        "Armadura de placas": "1d8+1",
        "Armadura completa": "1d8",
        "Armadura lamelar": "1d6+1",
        "Cota de malla de doble": "1d6+1",
        "Armadura ligera": "1d4",
        "Armadura media": "1d6",
        "Armadura pesada": "1d8"
    };
    const structuredArmor = (sheet.equipment ?? []).find((item) => item.category === "armor" && item.protectionFormula);
    let armorFormula = structuredArmor?.protectionFormula || (armorTemplateName ? armorFormulaByName[armorTemplateName] : undefined);
    if (armorFormula) {
        hasKnownBase = true;
        const originalFormula = armorFormula;
        if (armoredCombatLevel >= 1)
            armorFormula = increaseEffectDieFormula(armorFormula) ?? armorFormula;
        const armorAverage = formulaAverage(armorFormula) ?? 0;
        calculated += armorAverage;
        rows.push({
            label: "Armadura equipada",
            value: formulaWithAverage(armorFormula),
            explanation: armoredCombatLevel >= 1 && originalFormula !== armorFormula
                ? `La protección base ${originalFormula.toUpperCase()} sube un nivel de dado.`
                : undefined,
            source: armoredCombatLevel >= 1 ? capabilitySource("Combate con armadura", armoredCombatLevel) : structuredArmor?.name ?? armorTemplateName ?? undefined,
            kind: armoredCombatLevel >= 1 ? "capability" : "base"
        });
        if (/\+1$/.test(originalFormula))
            rows.push({
                label: "Refuerzo incluido",
                value: "+1",
                explanation: "Este punto ya forma parte de la fórmula de protección mostrada arriba; no se suma de nuevo.",
                source: "Cualidad Reforzada",
                kind: "quality"
            });
    }
    if (duroLevel > 0) {
        hasKnownBase = true;
        const formula = duroLevel === 3 ? "1d8" : duroLevel === 2 ? "1d6" : "1d4";
        const average = formulaAverage(formula) ?? 0;
        calculated += average;
        rows.push({
            label: "Armadura natural",
            value: formulaWithAverage(formula),
            explanation: "Protección natural permanente proporcionada por el rasgo.",
            source: capabilitySource("Duro", duroLevel, true),
            kind: "capability"
        });
    }
    if (robustoLevel > 0) {
        hasKnownBase = true;
        const formula = robustoLevel === 3 ? "1d8" : robustoLevel === 2 ? "1d6" : "1d4";
        const average = formulaAverage(formula) ?? 0;
        calculated += average;
        rows.push({
            label: "Protección por tamaño",
            value: formulaWithAverage(formula),
            explanation: "La corpulencia funciona como armadura natural permanente.",
            source: capabilitySource("Robusto", robustoLevel, true),
            kind: "capability"
        });
    }
    if (berserkerLevel >= 2) {
        const average = formulaAverage("1d4") ?? 2;
        calculated += average;
        rows.push({
            label: "Protección durante el frenesí",
            value: formulaWithAverage("1d4", "+"),
            explanation: "La furia funciona como armadura mientras Berserker está activo.",
            source: capabilitySource("Berserker", berserkerLevel),
            kind: "capability"
        });
    }
    if (survivorLevel >= 2) {
        const average = formulaAverage("1d4") ?? 2;
        calculated += average;
        rows.push({
            label: "Protección de supervivencia",
            value: formulaWithAverage("1d4", "+"),
            explanation: "La energía vital del nivel II añade protección permanente.",
            source: capabilitySource("Superviviente", survivorLevel, true),
            kind: "capability"
        });
    }
    if (armoredMysticLevel >= 3 && armorFormula) {
        const average = formulaAverage("1d4") ?? 2;
        calculated += average;
        rows.push({
            label: "Canalización a través de la armadura",
            value: formulaWithAverage("1d4", "+"),
            source: capabilitySource("Místico acorazado", armoredMysticLevel),
            kind: "capability"
        });
    }
    const tattooLevel = capabilityLevel(sheet, ["tatuaje runico"]);
    if (tattooLevel > 0)
        rows.push({
            label: "Protección opcional",
            value: formulaWithAverage("1d4", "+"),
            explanation: "Puede activarse antes de tirar protección y cuesta Corrupción temporal; no se suma al valor permanente.",
            source: capabilitySource("Tatuaje rúnico", tattooLevel),
            kind: "conditional"
        });
    if (shellLevel > 0)
        rows.push({
            label: "Protección reactiva",
            value: "×2 en las situaciones permitidas",
            explanation: "Caparazón puede duplicar la armadura, pero no altera el valor permanente mostrado.",
            source: capabilitySource("Caparazón", shellLevel, true),
            kind: "conditional"
        });
    if (armoredCombatLevel >= 3 && armorFormula)
        rows.push({
            label: "Protección frente a perforación",
            value: "Conserva el valor completo con una tirada de Ágil",
            explanation: "Puede contrarrestar efectos de equipo o habilidades que ignoren o reduzcan la armadura.",
            source: capabilitySource("Combate con armadura", armoredCombatLevel),
            kind: "conditional"
        });
    if (publishedArithmetic && publishedArithmeticTotal !== null)
        rows.push({
            label: "Componentes escritos en el perfil",
            value: `${publishedArithmetic} = ${publishedArithmeticTotal}`,
            explanation: "Comprobación independiente del texto de armadura publicado.",
            source: sheet.armorDetails || sheet.armor,
            kind: "published"
        });
    if (finalNumber !== null && !hasKnownBase) {
        const inferredBase = finalNumber - calculated;
        if (inferredBase >= 0) {
            calculated += inferredBase;
            rows.unshift({
                label: "Protección base publicada",
                value: String(inferredBase),
                explanation: "Valor residual después de separar las capacidades identificadas; el perfil no conserva su dado original.",
                source: sheet.armorDetails || sheet.armor,
                kind: "published"
            });
        }
    }
    const calculatedMismatch = finalNumber !== null && calculated !== finalNumber;
    const publishedMismatch = finalNumber !== null && publishedArithmeticTotal !== null && publishedArithmeticTotal !== finalNumber;
    if (calculatedMismatch)
        rows.push({
            label: "Diferencia no atribuida",
            value: String(finalNumber - calculated),
            explanation: "Hay otro componente publicado que todavía no está identificado por los datos estructurados.",
            kind: "published"
        });
    return {
        id: "armor",
        title: "Cálculo de Armadura",
        result,
        formula: "Dados de protección convertidos a sus valores fijos de monstruo.",
        rows,
        notes: ["Las reglas condicionales se muestran para consulta, pero no se suman al valor permanente."],
        warning: publishedMismatch
            ? `Posible discrepancia: los componentes escritos en el perfil suman ${publishedArithmeticTotal}, pero la ficha muestra ${result}.`
            : calculatedMismatch
                ? `El desglose conocido produce ${calculated}, pero el perfil publica ${result}.`
                : undefined
    };
}
function buildWeaponCalculation(sheet, weapon, index) {
    const result = weapon.damage || String(weapon.fixedValue ?? "-");
    const publishedValue = leadingNumber(result);
    const template = findWeaponTemplate(weapon);
    const naturalWeaponLevel = getMonsterTraitLevel(sheet.traits ?? [], ["arma natural", "armas naturales"]);
    const natural = isNaturalWeapon(weapon, sheet);
    const ranged = isRangedWeapon(weapon) || isThrownWeapon(weapon);
    const melee = !ranged;
    const heavy = Boolean(template?.qualities.some((quality) => normalizeCapability(quality) === "pesada")) || /\bpesada|dos manos\b/.test(weaponText(weapon));
    const long = Boolean(template?.qualities.some((quality) => normalizeCapability(quality) === "larga")) || /\blarga\b/.test(weaponText(weapon));
    const short = Boolean(template?.qualities.some((quality) => normalizeCapability(quality) === "corta")) || /\bcorta\b/.test(weaponText(weapon));
    const bowOrCrossbow = /\b(arco|ballesta|arbalesta)\b/.test(weaponText(weapon));
    const marksmanEligible = (bowOrCrossbow || ranged) && !isThrownWeapon(weapon);
    const rows = [];
    const sixthSenseLevel = capabilityLevel(sheet, ["sexto sentido"]);
    const tacticianLevel = capabilityLevel(sheet, ["tactico"]);
    const ironFistLevel = capabilityLevel(sheet, ["golpe de hierro"]);
    const quickKnifeLevel = capabilityLevel(sheet, ["cuchillo rapido", "combate con cuchillos"]);
    const dominationLevel = capabilityLevel(sheet, ["dominacion"]);
    const feintLevel = capabilityLevel(sheet, ["finta"]);
    const explicitAttribute = normalizeCapability(weapon.attribute);
    const precise = normalizeCapability(`${weapon.qualities} ${weapon.details}`).includes("precisa") || template?.qualities.some((quality) => normalizeCapability(quality) === "precisa");
    let attackAttribute = null;
    let attackAttributeSource;
    if (ranged && sixthSenseLevel > 0) {
        attackAttribute = "vigilant";
        attackAttributeSource = capabilitySource("Sexto sentido", sixthSenseLevel);
    }
    else if (melee && dominationLevel > 0 && explicitAttribute.includes("persuasivo")) {
        attackAttribute = "persuasive";
        attackAttributeSource = capabilitySource("Dominación", dominationLevel);
    }
    else if (melee && feintLevel > 0 && (short || precise) && explicitAttribute.includes("discreto")) {
        attackAttribute = "discreet";
        attackAttributeSource = capabilitySource("Finta", feintLevel);
    }
    else if (!heavy && tacticianLevel >= 3) {
        attackAttribute = "cunning";
        attackAttributeSource = capabilitySource("Táctico", tacticianLevel);
    }
    else if (melee && ironFistLevel > 0) {
        attackAttribute = "strong";
        attackAttributeSource = capabilitySource("Golpe de hierro", ironFistLevel);
    }
    else if (short && quickKnifeLevel > 0) {
        attackAttribute = "quick";
        attackAttributeSource = capabilitySource("Cuchillo rápido", quickKnifeLevel);
    }
    else {
        attackAttribute = monsterAttributeKey(explicitAttribute)
            ?? monsterAttributeKey(template?.attackAttribute)
            ?? "accurate";
    }
    if (attackAttribute) {
        const attributeValue = Number(sheet.attributes[attackAttribute] || 0);
        rows.push({
            label: "Atributo de ataque",
            value: `${MONSTER_ATTRIBUTE_LABELS[attackAttribute]} ${attributeValue} (${signedModifier(attributeValue)})`,
            explanation: attackAttributeSource
                ? `La capacidad sustituye el atributo ordinario para este tipo de ataque.`
                : weapon.attribute ? "Atributo indicado en el perfil publicado." : "Atributo ordinario del arma.",
            source: attackAttributeSource,
            kind: attackAttributeSource ? "capability" : "base"
        });
        const exceptional = exceptionalAttributeContribution(sheet, attackAttribute);
        if (exceptional)
            rows.push(exceptional);
    }
    else {
        rows.push({ label: "Atributo de ataque", value: weapon.attribute || "No identificado", explanation: "El perfil no conserva un atributo estructurado para este ataque.", kind: "published" });
    }
    if (precise)
        rows.push({ label: "Bonificación a la tirada", value: "+1", explanation: "La cualidad facilita impactar; no modifica el daño.", source: "Cualidad Precisa", kind: "quality" });
    let baseFormula = weapon.damageFormula?.trim() || (natural
        ? naturalWeaponLevel >= 3 ? "1d10" : naturalWeaponLevel === 2 ? "1d8" : "1d6"
        : template?.damageFormula || "");
    let calculated = 0;
    let hasKnownBase = Boolean(baseFormula);
    if (baseFormula) {
        calculated = formulaAverage(baseFormula) ?? 0;
        rows.push({
            label: natural ? "Daño del arma natural" : "Dado base del arma",
            value: formulaWithAverage(baseFormula),
            source: natural ? capabilitySource("Arma natural", naturalWeaponLevel, true) : template?.name,
            kind: natural ? "capability" : "base"
        });
    }
    const applyDieUpgrade = (name, level, explanation) => {
        if (!baseFormula || level <= 0)
            return;
        const upgraded = increaseEffectDieFormula(baseFormula);
        if (!upgraded || upgraded === baseFormula)
            return;
        const previous = baseFormula;
        const previousAverage = formulaAverage(previous) ?? 0;
        const upgradedAverage = formulaAverage(upgraded) ?? previousAverage;
        calculated += upgradedAverage - previousAverage;
        baseFormula = upgraded;
        rows.push({
            label: "Mejora del dado",
            value: `${previous.toUpperCase()} (${previousAverage}) → ${upgraded.toUpperCase()} (${upgradedAverage})`,
            explanation,
            source: capabilitySource(name, level),
            kind: "capability"
        });
    };
    const unarmedLevel = capabilityLevel(sheet, ["combate sin armas"]);
    if (natural && naturalWeaponLevel > 0 && unarmedLevel > 0)
        applyDieUpgrade("Combate sin armas", unarmedLevel, "Aumenta un nivel el dado de Arma natural.");
    const sacredFencingLevel = capabilityLevel(sheet, ["esgrima sagrada"]);
    if (/\bespada\b/.test(weaponText(weapon)) && precise && sacredFencingLevel > 0) {
        applyDieUpgrade("Esgrima sagrada", sacredFencingLevel, "La espada Precisa aumenta su dado de daño.");
        if (sacredFencingLevel >= 3)
            applyDieUpgrade("Esgrima sagrada", sacredFencingLevel, "El nivel Maestro aumenta de nuevo el dado de la espada Precisa.");
    }
    const marksmanLevel = capabilityLevel(sheet, ["tirador"]);
    if (marksmanEligible && marksmanLevel > 0)
        applyDieUpgrade("Tirador", marksmanLevel, "Aumenta un nivel el dado base del arma a distancia.");
    const polearmLevel = capabilityLevel(sheet, ["armas de asta"]);
    if (long && polearmLevel > 0)
        applyDieUpgrade("Armas de asta", polearmLevel, "Aumenta un nivel el dado de las armas Largas.");
    const twoHandedLevel = capabilityLevel(sheet, ["armas a dos manos"]);
    if (heavy && twoHandedLevel > 0)
        applyDieUpgrade("Armas a dos manos", twoHandedLevel, "Aumenta un nivel el dado del arma pesada.");
    const windOfSteelLevel = capabilityLevel(sheet, ["viento de acero"]);
    if (isThrownWeapon(weapon) && windOfSteelLevel > 0)
        applyDieUpgrade("Viento de acero", windOfSteelLevel, "Aumenta un nivel el dado del arma arrojadiza.");
    const shieldCombatLevel = capabilityLevel(sheet, ["combate con escudo"]);
    const carriesShield = normalizeCapability(`${sheet.weapons.map((entry) => `${entry.name} ${entry.qualities}`).join(" ")} ${(sheet.equipment ?? []).map((entry) => `${entry.name} ${entry.qualities}`).join(" ")}`).includes("escudo");
    if (melee && !heavy && !long && carriesShield && shieldCombatLevel > 0)
        applyDieUpgrade("Combate con escudo", shieldCombatLevel, "Aumenta un nivel el daño del arma empuñada junto al escudo.");
    const addBonus = (name, level, formula, explanation, roman = false) => {
        const average = formulaAverage(formula);
        if (level <= 0 || average === null)
            return;
        calculated += average;
        rows.push({
            label: "Daño adicional",
            value: formulaWithAverage(formula, "+"),
            explanation,
            source: capabilitySource(name, level, roman),
            kind: "capability"
        });
    };
    if (melee && ironFistLevel >= 2)
        addBonus("Golpe de hierro", ironFistLevel, ironFistLevel >= 3 ? "1d8" : "1d4", ironFistLevel >= 3 ? "Golpe devastador aplicable una vez por turno." : "Bono pasivo a los ataques cuerpo a cuerpo.");
    const berserkerLevel = capabilityLevel(sheet, ["berserker"]);
    if (melee && berserkerLevel > 0)
        addBonus("Berserker", berserkerLevel, "1d6", "Bono de daño mientras la criatura está en frenesí.");
    const robustoLevel = getMonsterTraitLevel(sheet.traits ?? [], ["robusto", "robusta"]);
    if (melee && robustoLevel > 0)
        addBonus("Robusto", robustoLevel, robustoLevel >= 3 ? "1d8" : robustoLevel === 2 ? "1d6" : "1d4", "Bono aplicable una vez por turno a un ataque cuerpo a cuerpo.", true);
    if (natural && unarmedLevel >= 3)
        addBonus("Combate sin armas", unarmedLevel, "1d6", "El nivel Maestro añade daño a todos los ataques sin armas.");
    const axeMasterLevel = capabilityLevel(sheet, ["maestro del hacha"]);
    if (/\bhacha\b/.test(weaponText(weapon)) && axeMasterLevel >= 3)
        addBonus("Maestro del hacha", axeMasterLevel, "1d4", "Bono limitado a un golpe por acción de combate.");
    const tattooLevel = capabilityLevel(sheet, ["tatuaje runico"]);
    if (tattooLevel >= 3 && melee)
        rows.push({
            label: "Daño opcional",
            value: formulaWithAverage("1d4", "+"),
            explanation: "Puede añadirse al coste de Corrupción temporal y no forma parte del valor permanente.",
            source: capabilitySource("Tatuaje rúnico", tattooLevel),
            kind: "conditional"
        });
    if (marksmanLevel >= 2 && bowOrCrossbow)
        rows.push({
            label: marksmanLevel >= 3 ? "Efecto del proyectil" : "Efecto al herir",
            value: marksmanLevel >= 3 ? "Ignora armadura" : "Puede impedir el movimiento",
            source: capabilitySource("Tirador", marksmanLevel),
            kind: "conditional"
        });
    const sneakAttackLevel = capabilityLevel(sheet, ["ataque traicionero"]);
    if (sneakAttackLevel > 0)
        rows.push({
            label: "Atributo alternativo con ventaja",
            value: `Discreto ${sheet.attributes.discreet} (${signedModifier(sheet.attributes.discreet)})`,
            explanation: "Puede sustituir a Diestro únicamente si el ataque se realiza con ventaja.",
            source: capabilitySource("Ataque traicionero", sneakAttackLevel),
            kind: "conditional"
        }, {
            label: "Daño con ventaja",
            value: formulaWithAverage(sneakAttackLevel >= 3 ? "1d8" : "1d4", "+"),
            explanation: sneakAttackLevel >= 2
                ? "Se aplica con ventaja; además provoca una herida abierta según el nivel."
                : "Se aplica una vez por turno cuando el ataque cuenta con ventaja.",
            source: capabilitySource("Ataque traicionero", sneakAttackLevel),
            kind: "conditional"
        });
    const creatureLoreLevel = capabilityLevel(sheet, ["versado en criaturas"]);
    if (creatureLoreLevel >= 2)
        rows.push({
            label: "Daño contra la categoría estudiada",
            value: formulaWithAverage(creatureLoreLevel >= 3 ? "1d6" : "1d4", "+"),
            explanation: "Solo se aplica contra el subtipo de criatura indicado por la capacidad.",
            source: capabilitySource("Versado en criaturas", creatureLoreLevel),
            kind: "conditional"
        });
    const riderLevel = capabilityLevel(sheet, ["jinete"]);
    if (melee && riderLevel > 0)
        rows.push({
            label: "Daño de carga montada",
            value: formulaWithAverage(riderLevel >= 3 ? "1d10" : "1d6", "+"),
            explanation: "Se aplica si la montura se mueve antes del ataque.",
            source: capabilitySource("Jinete", riderLevel),
            kind: "conditional"
        });
    const bloodyCombatLevel = capabilityLevel(sheet, ["combate sangriento"]);
    if (melee && bloodyCombatLevel >= 2)
        rows.push({
            label: "Daño estando herido",
            value: formulaWithAverage("1d8", "+"),
            explanation: "Se aplica cuando la Resistencia de la criatura se ha reducido a la mitad.",
            source: capabilitySource("Combate sangriento", bloodyCombatLevel),
            kind: "conditional"
        });
    const fightingSpiritLevel = capabilityLevel(sheet, ["espiritu combativo"]);
    if (melee && fightingSpiritLevel >= 3)
        rows.push({
            label: "Daño estando herido",
            value: formulaWithAverage("1d4", "+"),
            explanation: "Se aplica cuando la Resistencia de la criatura se ha reducido a la mitad.",
            source: capabilitySource("Espíritu combativo", fightingSpiritLevel),
            kind: "conditional"
        });
    const hunterInstinctLevel = capabilityLevel(sheet, ["instinto de cazador"]);
    if (ranged && hunterInstinctLevel >= 2)
        rows.push({
            label: "Daño contra la presa fijada",
            value: formulaWithAverage("1d4", "+"),
            explanation: "Solo se aplica contra el objetivo que la capacidad ha fijado como presa.",
            source: capabilitySource("Instinto de cazador", hunterInstinctLevel),
            kind: "conditional"
        });
    const staffMagicLevel = capabilityLevel(sheet, ["magia del baculo"]);
    if (/\b(baculo|baston|vara)\b/.test(weaponText(weapon)) && staffMagicLevel > 0)
        rows.push({
            label: "Runa elemental",
            value: formulaWithAverage("1d4", "+"),
            explanation: "Se aplica al activar gratuitamente una runa elemental del báculo.",
            source: capabilitySource("Magia del báculo", staffMagicLevel),
            kind: "conditional"
        });
    const twoWeaponsLevel = capabilityLevel(sheet, ["ataque con dos armas"]);
    if (twoWeaponsLevel > 0)
        rows.push({
            label: "Ataques de la acción",
            value: twoWeaponsLevel >= 3 ? "1D10 (5) y 1D8 (4)" : twoWeaponsLevel === 2 ? "1D8 (4) y 1D8 (4)" : "1D8 (4) y 1D6 (3)",
            explanation: "Cada ataque se resuelve y se defiende por separado; los bonos limitados a una vez por turno no se duplican.",
            source: capabilitySource("Ataque con dos armas", twoWeaponsLevel),
            kind: "conditional"
        });
    const fastBowLevel = capabilityLevel(sheet, ["arco veloz"]);
    if (/\barco\b/.test(weaponText(weapon)) && fastBowLevel > 0)
        rows.push({
            label: "Ataques con arco",
            value: fastBowLevel >= 3 ? "3 ataques" : "2 ataques",
            explanation: "Cada flecha se resuelve como un ataque independiente.",
            source: capabilitySource("Arco veloz", fastBowLevel),
            kind: "conditional"
        });
    if (natural && unarmedLevel >= 2)
        rows.push({
            label: "Ataques sin armas",
            value: "2 ataques",
            explanation: "El nivel Adepto permite atacar dos veces al mismo objetivo; cada ataque se resuelve por separado.",
            source: capabilitySource("Combate sin armas", unarmedLevel),
            kind: "conditional"
        });
    const chargeLevel = getMonsterTraitLevel(sheet.traits ?? [], ["embestida"]);
    if (melee && chargeLevel > 0)
        rows.push({
            label: "Efecto de embestida",
            value: /\+\s*\d+/.exec(weapon.details)?.[0] ?? "Según movimiento y nivel",
            explanation: "Es un modificador condicionado a la carga y no forma parte de todos los ataques.",
            source: capabilitySource("Embestida", chargeLevel, true),
            kind: "conditional"
        });
    if (publishedValue !== null && !hasKnownBase) {
        const inferredBase = publishedValue - calculated;
        if (inferredBase >= 0) {
            calculated += inferredBase;
            rows.splice(attackAttribute ? 1 : 0, 0, {
                label: "Daño base publicado",
                value: String(inferredBase),
                explanation: "Valor residual tras separar los bonos identificados; el perfil no conserva el dado original del arma.",
                source: weapon.name,
                kind: "published"
            });
            hasKnownBase = true;
        }
    }
    const mismatch = publishedValue !== null && calculated !== publishedValue;
    if (mismatch)
        rows.push({
            label: "Diferencia no atribuida",
            value: String(publishedValue - calculated),
            explanation: "El valor publicado incluye otro modificador o una excepción que los datos estructurados aún no identifican.",
            kind: "published"
        });
    if (weapon.qualities)
        rows.push({ label: "Cualidades sin suma directa", value: weapon.qualities, explanation: "Se muestran como reglas del ataque; solo las cualidades numéricas aparecen arriba como componentes.", kind: "quality" });
    const compactPublishedDetails = normalizeCapability(weapon.details);
    const ordinaryDetails = normalizeCapability(`${weapon.name} ${weapon.damage} ${weapon.qualities}`);
    const hasSpecialDetails = compactPublishedDetails.length > ordinaryDetails.length && !ordinaryDetails.includes(compactPublishedDetails);
    return {
        id: `weapon-${index}`,
        title: `Desglose de ataque: ${weapon.name}`,
        result,
        formula: "Dados de PJ convertidos a promedios fijos y modificadores aplicables al perfil.",
        rows,
        notes: hasSpecialDetails ? [weapon.details] : undefined,
        warning: mismatch ? `El desglose conocido produce ${calculated}, pero el perfil publica ${result}.` : undefined
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
export function MonsterReferenceSheet({ monster, official = false, busy = false, onClose, onDuplicate, onEdit, onDelete }) {
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
    const shownDefense = String(sheet.defense || derived.defense);
    const shownToughness = String(sheet.toughness || derived.toughness);
    const shownPainThreshold = String(sheet.painThreshold || derived.painThreshold);
    const defenseCalculation = useMemo(() => buildDefenseCalculation(sheet, shownDefense), [sheet, shownDefense]);
    const toughnessCalculation = useMemo(() => buildToughnessCalculation(sheet, shownToughness), [sheet, shownToughness]);
    const painThresholdCalculation = useMemo(() => buildPainThresholdCalculation(sheet, shownPainThreshold), [sheet, shownPainThreshold]);
    const shownArmor = String(sheet.fixedValues.armor ?? derived.armor);
    const armorCalculation = useMemo(() => buildArmorCalculation(sheet, shownArmor), [sheet, shownArmor]);
    const weaponCalculations = useMemo(() => sheet.weapons.map((weapon, index) => buildWeaponCalculation(sheet, weapon, index)), [sheet]);
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
        window.setTimeout(() => closeRef.current?.focus(), 0);
    }, [monster.id]);
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
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, selectedCalculation, selectedCapability, selectedTrait]);
    return (_jsxs("article", { className: "monster-reference-sheet", "aria-label": `Ficha de ${monster.name}`, children: [_jsxs("header", { className: "monster-reference-sheet__header", children: [_jsxs("div", { className: "monster-reference-sheet__identity", children: [_jsx("span", { className: "compendium-eyebrow", children: sheet.family || monster.family || monster.category }), _jsx("h2", { children: monster.name }), _jsxs("p", { children: [sheet.race || monster.category, " \u00B7 ", monster.category] })] }), _jsxs("div", { className: "monster-reference-sheet__actions", children: [official && onDuplicate ? _jsx("button", { type: "button", onClick: onDuplicate, children: "Duplicar en Mis monstruos" }) : null, !official && onEdit ? _jsx("button", { type: "button", onClick: onEdit, children: "Editar" }) : null, !official && onDelete ? _jsx("button", { type: "button", className: "danger", disabled: busy, onClick: onDelete, children: "Eliminar" }) : null, _jsx("button", { ref: closeRef, type: "button", className: "subtle-button", onClick: onClose, children: "Cerrar ficha" })] })] }), _jsxs("div", { className: "monster-reference-sheet__scroll", children: [_jsxs("section", { className: "monster-reference-sheet__hero campaign-sheet-card", children: [_jsxs("div", { className: "monster-calculation-host", children: [_jsx("span", { children: "Desaf\u00EDo calculado" }), _jsx("strong", { children: monster.threat }), _jsxs("small", { children: [xp, " PX"] }), _jsx(CalculationInfoButton, { label: "desaf\u00EDo", onClick: () => setSelectedCalculation(challengeCalculation) })] }), _jsxs("div", { children: [_jsx("span", { children: "Conducta" }), _jsx("strong", { children: sheet.conduct || "No indicada" })] }), _jsxs("div", { children: [_jsx("span", { children: "Sombra" }), _jsx("strong", { children: sheet.shadow || "No indicada" }), sheet.corruption !== null ? _jsxs("small", { children: ["Corrupci\u00F3n: ", sheet.corruption] }) : null] })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", "aria-labelledby": `monster-${monster.id}-attributes`, children: [_jsx("h3", { id: `monster-${monster.id}-attributes`, children: "Atributos" }), _jsx("div", { className: "monster-reference-attributes", children: MONSTER_ATTRIBUTE_KEYS.map((attribute) => (_jsxs("div", { className: "monster-reference-attribute monster-calculation-host", children: [_jsx("span", { children: MONSTER_ATTRIBUTE_LABELS[attribute] }), _jsx("strong", { children: sheet.attributes[attribute] }), _jsx("small", { children: signedModifier(sheet.attributes[attribute]) }), _jsx(CalculationInfoButton, { label: `modificador de ${MONSTER_ATTRIBUTE_LABELS[attribute]}`, onClick: () => setSelectedCalculation(attributeCalculations[attribute]) })] }, attribute))) })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Combate y defensas" }), _jsxs("dl", { className: "monster-reference-values", children: [_jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Defensa" }), _jsx("dd", { children: shownDefense }), _jsx(CalculationInfoButton, { label: "Defensa", onClick: () => setSelectedCalculation(defenseCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Resistencia" }), _jsx("dd", { children: shownToughness }), _jsx(CalculationInfoButton, { label: "Resistencia", onClick: () => setSelectedCalculation(toughnessCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Umbral de dolor" }), _jsx("dd", { children: shownPainThreshold }), _jsx(CalculationInfoButton, { label: "Umbral de dolor", onClick: () => setSelectedCalculation(painThresholdCalculation) })] }), _jsxs("div", { className: "monster-calculation-host", children: [_jsx("dt", { children: "Armadura" }), _jsx("dd", { children: shownArmor }), _jsx(CalculationInfoButton, { label: "Armadura", onClick: () => setSelectedCalculation(armorCalculation) })] })] }), _jsx("p", { className: "monster-reference-rule", children: sheet.armorDetails || sheet.armor })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Armas" }), sheet.weapons.length ? (_jsx("div", { className: "monster-reference-weapons", children: sheet.weapons.map((weapon, index) => (_jsxs("article", { className: "monster-calculation-host", children: [_jsxs("div", { children: [_jsx("strong", { children: weapon.name }), _jsx("span", { children: weapon.attribute || "Ataque" })] }), _jsx("b", { children: weapon.damage || String(weapon.fixedValue ?? "-") }), _jsx("p", { children: weapon.details || weapon.qualities }), weapon.damageFormula ? _jsxs("small", { children: ["F\u00F3rmula: ", weapon.damageFormula] }) : null, _jsx(CalculationInfoButton, { label: `ataque de ${weapon.name}`, onClick: () => setSelectedCalculation(weaponCalculations[index]) })] }, `${weapon.name}-${index}`))) })) : _jsx("p", { children: sheet.actions.find((entry) => entry.startsWith("Armas:"))?.replace(/^Armas:\s*/, "") || "Sin armas indicadas." })] })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Rasgos" }), traits.length ? (_jsx("ul", { className: "monster-reference-tags monster-reference-trait-list", children: traits.map((trait) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedTrait(trait), children: [_jsxs("span", { children: [_jsx("strong", { children: trait.name }), trait.qualifier ? _jsx("small", { children: trait.qualifier }) : null] }), _jsx("b", { children: trait.level ? `Nivel ${trait.level}` : "Ver reglas" })] }) }, trait.id))) })) : _jsx("p", { children: "Sin rasgos registrados." })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Habilidades y poderes" }), capabilities.length ? (_jsx("ul", { className: "monster-reference-list", children: capabilities.map((entry) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelectedCapability(entry), children: [_jsxs("span", { children: [_jsx("strong", { children: entry.name }), _jsx("small", { children: entry.kind === "poder_mistico" ? "Poder místico" : entry.kind === "ritual" ? "Ritual" : "Habilidad" })] }), _jsx("b", { children: entry.level ? capabilityLevelLabel(entry.level) : "Ver reglas" })] }) }, entry.id))) })) : _jsx("p", { children: "Sin habilidades registradas." }), hasText(sheet.blessingsBurdens) ? _jsxs(_Fragment, { children: [_jsx("h4", { children: "Bendiciones y cargas" }), _jsx("p", { children: sheet.blessingsBurdens })] }) : null] })] }), _jsxs("div", { className: "monster-reference-columns", children: [_jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "T\u00E1cticas" }), _jsx("p", { children: sheet.tactics || "Sin tácticas registradas." })] }), _jsxs("section", { className: "monster-reference-section campaign-sheet-card", children: [_jsx("h3", { children: "Equipo y bot\u00EDn" }), _jsx("p", { children: sheet.loot || sheet.equipment?.map((entry) => entry.notes || entry.name).filter(Boolean).join(" · ") || "Sin equipo o botín registrado." }), hasText(sheet.weakness) ? _jsxs(_Fragment, { children: [_jsx("h4", { children: "Debilidad" }), _jsx("p", { children: sheet.weakness })] }) : null] })] }), _jsxs("details", { className: "monster-reference-collapsible narrative-collapsible-card campaign-sheet-card", open: isDescriptionOpen, onToggle: (event) => setIsDescriptionOpen(event.currentTarget.open), children: [_jsxs("summary", { children: [_jsx("span", { children: "Descripci\u00F3n" }), _jsx("small", { children: isDescriptionOpen ? "Ocultar" : "Mostrar" })] }), _jsx("div", { className: "narrative-collapsible-content", children: _jsx("p", { children: sheet.description || monster.summary }) })] }), _jsxs("footer", { className: "monster-reference-sources campaign-sheet-card", children: [_jsx("h3", { children: "Fuentes" }), _jsx("div", { children: references.map((reference, index) => {
                                    const pdf = sourcePdf(reference.source);
                                    const label = `${reference.source} · p.${reference.page}`;
                                    return pdf
                                        ? _jsx(SourceReferenceLink, { href: buildPdfViewerUrl(pdf, reference.pdfPage), source: reference.source, page: reference.page, ariaLabel: label }, `${reference.source}-${reference.page}-${index}`)
                                        : _jsx("span", { children: label }, `${reference.source}-${reference.page}-${index}`);
                                }) })] })] }), selectedCalculation ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedCalculation(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal monster-calculation-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-calculation-${selectedCalculation.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Auditor\u00EDa del c\u00E1lculo" }), _jsx("h3", { id: `monster-calculation-${selectedCalculation.id}`, children: selectedCalculation.title }), _jsx("p", { children: selectedCalculation.formula })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Resultado final" }), _jsx("strong", { children: selectedCalculation.result })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [_jsx("dl", { className: "monster-calculation-breakdown", children: selectedCalculation.rows.map((row, index) => (_jsxs("div", { className: row.kind ? `is-${row.kind}` : undefined, children: [_jsxs("dt", { children: [_jsx("span", { children: row.label }), row.source ? _jsx("small", { className: "monster-calculation-source", children: row.source }) : null] }), _jsx("dd", { children: row.value }), row.explanation ? _jsx("p", { children: row.explanation }) : null] }, `${row.label}-${index}`))) }), selectedCalculation.warning ? (_jsxs("p", { className: "monster-calculation-warning", children: [_jsx("strong", { children: "Revisar:" }), " ", selectedCalculation.warning] })) : null, selectedCalculation.notes?.map((note, index) => (_jsx("p", { className: "monster-calculation-note", children: note }, `${selectedCalculation.id}-note-${index}`)))] }), _jsx("footer", { className: "monster-capability-modal__actions", children: _jsx("button", { ref: calculationCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedCalculation(null), children: "Cerrar" }) })] }) })) : null, selectedTrait && traitDescription ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedTrait(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal monster-trait-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-trait-${selectedTrait.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: "Rasgo de monstruo" }), _jsx("h3", { id: `monster-trait-${selectedTrait.id}`, children: selectedTrait.name }), _jsxs("p", { children: [selectedTrait.source, selectedTrait.page ? ` · p.${selectedTrait.page}` : ""] })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Nivel del monstruo" }), _jsx("strong", { children: selectedTrait.level ? `Nivel ${selectedTrait.level}` : "Sin niveles" })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [traitDescription.remainder ? _jsx("p", { children: traitDescription.remainder }) : null, traitDescription.tiers.length ? (_jsx("div", { className: "monster-capability-tier-list", children: traitDescription.tiers.map((tier) => {
                                        const isCurrent = Boolean(selectedTrait.level && tier.label.split("/").includes(selectedTrait.level));
                                        return (_jsxs("section", { className: `monster-capability-tier${isCurrent ? " is-current" : ""}`, children: [_jsxs("header", { children: [_jsxs("h4", { children: ["Nivel ", tier.label] }), isCurrent ? _jsx("span", { children: "Nivel del monstruo" }) : null] }), _jsx("p", { children: tier.content })] }, tier.label));
                                    }) })) : null, selectedTrait.qualifier ? (_jsxs("p", { className: "monster-capability-adaptation", children: [_jsx("strong", { children: "Aplicaci\u00F3n en esta criatura:" }), " ", selectedTrait.qualifier] })) : null, selectedTrait.adaptationNote ? _jsx("p", { className: "monster-capability-adaptation", children: selectedTrait.adaptationNote }) : null, !selectedTrait.entry && !selectedTrait.descriptionOverride ? (_jsx("p", { className: "monster-capability-adaptation", children: "Rasgo publicado sin una entrada can\u00F3nica enlazada; se conserva literalmente el dato de la ficha." })) : null] }), _jsxs("footer", { className: "monster-capability-modal__actions", children: [selectedTraitSourceUrl ? _jsx(SourceReferenceLink, { href: selectedTraitSourceUrl, source: selectedTrait.source, page: selectedTrait.page, ariaLabel: "Abrir fuente" }) : null, _jsx("button", { ref: traitCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedTrait(null), children: "Cerrar" })] })] }) })) : null, selectedCapability && capabilityDescription ? (_jsx("div", { className: "modal-backdrop monster-capability-modal-backdrop", onClick: () => setSelectedCapability(null), children: _jsxs("div", { className: "panel modal-panel monster-capability-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `monster-capability-${selectedCapability.id}`, onClick: (event) => event.stopPropagation(), children: [_jsxs("header", { className: "monster-capability-modal__header", children: [_jsxs("div", { children: [_jsx("span", { className: "compendium-eyebrow", children: selectedCapability.kind === "poder_mistico" ? "Poder místico" : selectedCapability.kind === "ritual" ? "Ritual" : "Habilidad" }), _jsx("h3", { id: `monster-capability-${selectedCapability.id}`, children: selectedCapability.name }), _jsxs("p", { children: [selectedCapability.source, selectedCapability.page ? ` · p.${selectedCapability.page}` : ""] })] }), _jsxs("span", { className: "monster-capability-current-level", children: [_jsx("small", { children: "Nivel del monstruo" }), _jsx("strong", { children: selectedCapability.level ? capabilityLevelLabel(selectedCapability.level) : selectedCapability.kind === "ritual" ? "Ritual" : "Publicado" })] })] }), _jsxs("div", { className: "monster-capability-modal__body", children: [capabilityDescription.remainder ? _jsx("p", { children: capabilityDescription.remainder }) : null, capabilityDescription.tiers.length ? (_jsx("div", { className: "monster-capability-tier-list", children: capabilityDescription.tiers.map((tier) => {
                                        const isCurrent = selectedCapability.level && capabilityLevelLabel(selectedCapability.level) === tier.label;
                                        return (_jsxs("section", { className: `monster-capability-tier${isCurrent ? " is-current" : ""}`, children: [_jsxs("header", { children: [_jsx("h4", { children: tier.label }), isCurrent ? _jsx("span", { children: "Nivel del monstruo" }) : null] }), _jsx("p", { children: tier.content })] }, tier.label));
                                    }) })) : capabilityDescription.remainder ? null : (_jsx("p", { children: selectedCapability.publishedText })), selectedCapability.adaptationNote ? _jsx("p", { className: "monster-capability-adaptation", children: selectedCapability.adaptationNote }) : null, !selectedCapability.canonical && !selectedCapability.descriptionOverride ? (_jsx("p", { className: "monster-capability-adaptation", children: "Entrada publicada sin equivalencia can\u00F3nica; se conserva literalmente el dato de la ficha." })) : null, capabilityDescription.reference ? _jsx("small", { className: "monster-capability-reference", children: capabilityDescription.reference }) : null] }), _jsxs("footer", { className: "monster-capability-modal__actions", children: [selectedSourceUrl ? _jsx(SourceReferenceLink, { href: selectedSourceUrl, source: selectedCapability.source, page: selectedCapability.page, ariaLabel: "Abrir fuente" }) : null, _jsx("button", { ref: capabilityCloseRef, type: "button", className: "subtle-button", onClick: () => setSelectedCapability(null), children: "Cerrar" })] })] }) })) : null] }));
}
