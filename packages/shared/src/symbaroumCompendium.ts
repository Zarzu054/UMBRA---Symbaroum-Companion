export type SymbaroumCapabilityType = "habilidad" | "poder_mistico" | "ritual";

export type SymbaroumCapabilityAction = {
  id: string;
  label: string;
  cost: "free" | "movement" | "combat" | "reaction";
  requiredLevel?: "principiante" | "adepto" | "maestro";
  rollAttribute?: "agil" | "atento" | "discreto" | "diestro" | "fuerte" | "inteligente" | "persuasivo" | "tenaz";
  fixedTarget?: number;
  damageFormula?: string;
  effectSummary: string;
};

export type SymbaroumCapability = {
  id: string;
  nombre: string;
  tipo: SymbaroumCapabilityType;
  tradiciones: string[];
  libro: string;
  pagina: number;
  efectoResumen: string;
  acciones: SymbaroumCapabilityAction[];
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import { ABILITY_SUMMARIES } from "./abilitySummaries.generated.js";
import { MYSTIC_POWER_SUMMARIES } from "./mysticPowerSummaries.generated.js";
import { RITUAL_SUMMARIES } from "./ritualSummaries.generated.js";

function normalizeSummaryMap(summaries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(summaries).map(([name, summary]) => [slugify(name), summary])
  );
}

const RULE_ADAPTED_ABILITY_SUMMARIES = {
  ...ABILITY_SUMMARIES,
  "Talento místico superior": ABILITY_SUMMARIES["Talento místico superior"].replace(
    "la habilidad Rituales (incluyendo todos los rituales individuales)",
    "uno de los rituales individuales que conozca"
  )
};

const NORMALIZED_ABILITY_SUMMARIES = normalizeSummaryMap(RULE_ADAPTED_ABILITY_SUMMARIES);
const NORMALIZED_MYSTIC_POWER_SUMMARIES = normalizeSummaryMap(MYSTIC_POWER_SUMMARIES);
const NORMALIZED_RITUAL_SUMMARIES = normalizeSummaryMap(RITUAL_SUMMARIES);

function makeCapability(
  tipo: SymbaroumCapabilityType,
  nombre: string,
  libro: string,
  pagina: number,
  tradiciones: string[] = [],
  efectoResumen?: string,
  acciones?: SymbaroumCapabilityAction[]
): SymbaroumCapability {
  const normalizedName = slugify(nombre);
  const generatedSummary =
    tipo === "habilidad" && NORMALIZED_ABILITY_SUMMARIES[normalizedName]
      ? `${NORMALIZED_ABILITY_SUMMARIES[normalizedName]} Ref: ${libro}, p.${pagina}.`
      : tipo === "poder_mistico" && NORMALIZED_MYSTIC_POWER_SUMMARIES[normalizedName]
        ? `${NORMALIZED_MYSTIC_POWER_SUMMARIES[normalizedName]} Ref: ${libro}, p.${pagina}.`
      : tipo === "ritual" && NORMALIZED_RITUAL_SUMMARIES[normalizedName]
        ? `${NORMALIZED_RITUAL_SUMMARIES[normalizedName]} Ref: ${libro}, p.${pagina}.`
      : undefined;
  const resolvedSummary =
    efectoResumen ?? generatedSummary ?? `Consulta ${libro}, p.${pagina} para el efecto completo por niveles (principiante/adepto/maestro).`;

  return {
    id: `${tipo}-${slugify(nombre)}`,
    nombre,
    tipo,
    tradiciones,
    libro,
    pagina,
    efectoResumen: resolvedSummary,
    acciones:
      acciones ??
      (tipo === "habilidad"
        ? resolveAbilityActions(nombre, resolvedSummary)
        : tipo === "poder_mistico"
          ? resolveMysticPowerActions(nombre, resolvedSummary)
          : inferCapabilityActions(tipo, nombre, resolvedSummary))
  };
}

function inferCapabilityActions(
  tipo: SymbaroumCapabilityType,
  nombre: string,
  resumen: string
): SymbaroumCapabilityAction[] {
  const normalized = resumen.toLowerCase();
  if (normalized.startsWith("consulta ")) {
    return [];
  }

  const segments = splitLevelSegments(resumen);
  const actions: SymbaroumCapabilityAction[] = [];
  for (const { level, text } of segments) {
    const cost = inferActionCost(text);
    if (!cost) {
      continue;
    }

    actions.push({
      id: `${slugify(level)}-${slugify(nombre)}`,
      label: buildActionLabel(tipo, nombre, level),
      cost,
      requiredLevel: normalizeSkillLevel(level),
      rollAttribute: inferRollAttribute(text),
      damageFormula: inferDamageFormula(text),
      effectSummary: text.trim()
    });
  }

  if (actions.length > 0) {
    return dedupeActions(actions);
  }

  const fallbackCost = inferActionCost(resumen);
  if (!fallbackCost) {
    return [];
  }

  return [
    {
      id: `general-${slugify(nombre)}`,
      label: buildActionLabel(tipo, nombre, "general"),
      cost: fallbackCost,
      requiredLevel: undefined,
      rollAttribute: inferRollAttribute(resumen),
      damageFormula: inferDamageFormula(resumen),
      effectSummary: resumen.trim()
    }
  ];
}

function splitLevelSegments(summary: string): Array<{ level: string; text: string }> {
  const regex = /(Principiante|Adepto|Maestro):/g;
  const matches = [...summary.matchAll(regex)];
  if (matches.length === 0) {
    return [{ level: "general", text: summary }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? summary.length;
    return {
      level: match[1] ?? "general",
      text: summary.slice(start, nextStart).trim()
    };
  });
}

function inferActionCost(text: string): SymbaroumCapabilityAction["cost"] | null {
  const normalized = stripAccents(text).toLowerCase();
  if (normalized.includes("pasiva.") || normalized.includes("pasivo.")) {
    return null;
  }
  if (normalized.includes("reaccion.")) {
    return "reaction";
  }
  if (normalized.includes("accion de movimiento")) {
    return "movement";
  }
  if (normalized.includes("activa.") || normalized.includes("activo.") || normalized.includes("accion de combate")) {
    return "combat";
  }
  if (normalized.includes("especial.")) {
    return "combat";
  }
  return null;
}

function inferRollAttribute(
  text: string
): SymbaroumCapabilityAction["rollAttribute"] | undefined {
  const normalized = stripAccents(text);
  const bracketMatch = normalized.match(/\[([A-Za-z]+)(?:<-|←|\])/);
  const namedMatch = normalized.match(/tirada(?: con exito)? de ([A-Za-z]+)/i);
  const raw = bracketMatch?.[1] ?? namedMatch?.[1];
  if (!raw) return undefined;

  switch (raw.toLowerCase()) {
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
      return undefined;
  }
}

function inferDamageFormula(text: string): string | undefined {
  const match = text.match(/\b(\d+)D(\d+)([+-]\d+)?\b/);
  return match ? `${match[1]}d${match[2]}${match[3] ?? ""}` : undefined;
}

function buildActionLabel(tipo: SymbaroumCapabilityType, nombre: string, level: string): string {
  const displayLevel = /^principiante$/i.test(level) ? "Principiante" : level;
  const suffix = displayLevel.toLowerCase() === "general" ? "" : ` (${displayLevel})`;
  if (tipo === "habilidad") return `Usar ${nombre}${suffix}`;
  if (tipo === "poder_mistico") return `Lanzar ${nombre}${suffix}`;
  return `Ejecutar ${nombre}${suffix}`;
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSkillLevel(level: string): SymbaroumCapabilityAction["requiredLevel"] {
  const normalized = stripAccents(level).toLowerCase();
  if (normalized === "principiante") return "principiante";
  if (normalized === "adepto") return "adepto";
  if (normalized === "maestro") return "maestro";
  return undefined;
}

function dedupeActions(actions: SymbaroumCapabilityAction[]): SymbaroumCapabilityAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.cost}|${action.rollAttribute ?? ""}|${action.damageFormula ?? ""}|${action.effectSummary}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

const LIBRO_BASICO = "Libro Básico";
const GUIA_AVANZADA = "Guía Avanzada del Jugador";

function capabilityAction(
  id: string,
  label: string,
  cost: SymbaroumCapabilityAction["cost"],
  effectSummary: string,
  extras: Partial<Omit<SymbaroumCapabilityAction, "id" | "label" | "cost" | "effectSummary">> = {}
): SymbaroumCapabilityAction {
  return {
    id,
    label,
    cost,
    effectSummary,
    ...extras
  };
}

const ARMAS_A_DOS_MANOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-armas-a-dos-manos",
    "Usar Armas a dos manos (Adepto)",
    "reaction",
    "Cuando fallas un ataque con arma pesada, puedes aprovechar el movimiento de regreso para intentar un segundo ataque contra el mismo objetivo. Si impacta, causa 1D8 de daño.",
    { damageFormula: "1d8" }
  ),
  capabilityAction(
    "maestro-armas-a-dos-manos",
    "Usar Armas a dos manos (Maestro)",
    "combat",
    "Haz un ataque con arma pesada que ignora por completo la armadura del objetivo golpeado."
  )
];

const ATAQUE_TRAICIONERO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-ataque-traicionero",
    "Usar Ataque traicionero (Principiante)",
    "reaction",
    "Una vez por turno, al atacar con ventaja o sorpresa, puedes usar Discreto en vez de Diestro y causar +1D4 de daño adicional.",
    { rollAttribute: "discreto", damageFormula: "+1d4" }
  ),
  capabilityAction(
    "adepto-ataque-traicionero",
    "Usar Ataque traicionero (Adepto)",
    "reaction",
    "Cuando atacas con ventaja o sorpresa, puedes usar Discreto en vez de Diestro, causar +1D4 de daño adicional y abrir una hemorragia que inflige 1D4 de daño por turno hasta ser tratada.",
    { rollAttribute: "discreto", damageFormula: "+1d4" }
  ),
  capabilityAction(
    "maestro-ataque-traicionero",
    "Usar Ataque traicionero (Maestro)",
    "reaction",
    "Tus ataques con ventaja o sorpresa cuentan como Ataques traicioneros sin límite por turno: usas Discreto en vez de Diestro, causas +1D8 de daño adicional y provocas una hemorragia de 1D4 por turno.",
    { rollAttribute: "discreto", damageFormula: "+1d8" }
  )
];

const COMBATE_CON_ESCUDO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-combate-con-escudo",
    "Usar Combate con escudo (Adepto)",
    "reaction",
    "Después de impactar con tu arma, puedes seguir con un golpe de escudo al mismo objetivo que causa 1D4 de daño; si además superas [Fuerte←Fuerte], lo derribas.",
    { rollAttribute: "fuerte", damageFormula: "1d4" }
  ),
  capabilityAction(
    "maestro-combate-con-escudo",
    "Usar Combate con escudo (Maestro)",
    "reaction",
    "Después de impactar con tu arma, puedes seguir con un golpe de escudo al mismo objetivo que causa 1D8 de daño; si además superas [Fuerte←Fuerte], lo derribas.",
    { rollAttribute: "fuerte", damageFormula: "1d8" }
  )
];

const FINTA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-finta",
    "Usar Finta (Adepto)",
    "reaction",
    "Cuando te defiendes en combate, puedes usar Discreto en vez de Ágil para la tirada de Defensa.",
    { rollAttribute: "discreto" }
  ),
  capabilityAction(
    "maestro-finta",
    "Usar Finta (Maestro)",
    "combat",
    "Supera una tirada de [Discreto←Atento] para sorprender a un enemigo en mitad del combate y ganar un ataque gratuito adicional. Aun si fallas, sigues pudiendo hacer tu ataque normal.",
    { rollAttribute: "discreto" }
  )
];

const GOLPE_DE_HIERRO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "maestro-golpe-de-hierro",
    "Usar Golpe de hierro (Maestro)",
    "combat",
    "Una vez por turno, al atacar cuerpo a cuerpo, puedes usar Fuerte en vez de Diestro y convertir el bonificador adicional de daño en +1D8 en vez de +1D4.",
    { rollAttribute: "fuerte", damageFormula: "+1d8" }
  )
];

const INSTINTO_DE_CAZADOR_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "maestro-instinto-de-cazador",
    "Usar Instinto de cazador (Maestro)",
    "reaction",
    "Cuando tu presa fijada use una acción de movimiento, obtienes inmediatamente un ataque gratuito a distancia contra ella.",
    { rollAttribute: "diestro" }
  )
];

const TIRADOR_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-tirador",
    "Usar Tirador (Adepto)",
    "combat",
    "Haz un ataque a distancia; si hieres al objetivo, puedes hacer una tirada de [Diestro←Fuerte] cada vez que intente moverse para impedir que gaste su acción de movimiento hasta que logre escapar.",
    { rollAttribute: "diestro" }
  ),
  capabilityAction(
    "maestro-tirador",
    "Usar Tirador (Maestro)",
    "combat",
    "Haz un ataque a distancia que golpea un punto débil e ignora completamente la armadura del objetivo.",
    { rollAttribute: "diestro" }
  )
];

const ALIENTO_NEGRO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-aliento-negro",
    "Lanzar Aliento negro (Principiante)",
    "combat",
    "Golpea a una criatura y tira 1D4 contra su corrupción total. Si el resultado es igual o inferior, la criatura se cura esa cantidad; si es superior, sufre esa cantidad como corrupción temporal.",
    { damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-aliento-negro",
    "Lanzar Aliento negro (Adepto)",
    "combat",
    "Golpea a una criatura y tira 1D6 contra su corrupción total. Si el resultado es igual o inferior, la criatura se cura esa cantidad; si es superior, sufre esa cantidad como corrupción temporal.",
    { damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-aliento-negro",
    "Lanzar Aliento negro (Maestro)",
    "combat",
    "Como a nivel adepto, pero el efecto puede encadenarse a objetivos adicionales mientras cada objetivo anterior sufra corrupción; la cadena se rompe en cuanto alguien se cure.",
    { damageFormula: "1d6" }
  )
];

const CONFUSION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-confusion",
    "Lanzar Confusión (Principiante)",
    "combat",
    "Supera [Tenaz←Tenaz] para confundir a un enemigo mientras mantengas la concentración. Cada turno tira 1D6: 1-2 queda inmóvil, 3-4 ataca al aliado más cercano, 5-6 ataca al enemigo más cercano.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-confusion",
    "Lanzar Confusión (Adepto)",
    "combat",
    "Supera [Tenaz←Tenaz] para confundir a un enemigo sin necesidad de concentración. El efecto continúa hasta que falles una tirada posterior de [Tenaz←Tenaz].",
    { rollAttribute: "tenaz" }
  ),
  capabilityAction(
    "maestro-confusion",
    "Lanzar Confusión (Maestro)",
    "combat",
    "Supera [Tenaz←Tenaz] para confundir a un enemigo y, si lo logras, puedes seguir encadenando el poder contra objetivos adicionales hasta fallar.",
    { rollAttribute: "tenaz" }
  )
];

const ESCUDO_BENDITO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-escudo-bendito",
    "Lanzar Escudo bendito (Principiante)",
    "combat",
    "Supera una tirada de Tenaz para obtener +1D4 de armadura hasta el final de la escena; además, cada abominación o muerto viviente que te ataque cuerpo a cuerpo sufre 1D4 de daño ignorando armadura.",
    { rollAttribute: "tenaz", damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-escudo-bendito",
    "Lanzar Escudo bendito (Adepto)",
    "combat",
    "Supera una tirada de Tenaz para obtener +1D6 de armadura hasta el final de la escena; además, cada abominación o muerto viviente que ataque cuerpo a cuerpo al objetivo protegido sufre 1D6 de daño ignorando armadura. Puede incluir a un aliado a la vista.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-escudo-bendito",
    "Lanzar Escudo bendito (Maestro)",
    "combat",
    "Supera una tirada de Tenaz para obtener +1D8 de armadura hasta el final de la escena; además, cada abominación o muerto viviente que ataque cuerpo a cuerpo a un objetivo protegido sufre 1D8 de daño ignorando armadura. Puede incluir hasta dos aliados a la vista.",
    { rollAttribute: "tenaz", damageFormula: "1d8" }
  )
];

const GOLPE_ESPECTRAL_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-golpe-espectral",
    "Lanzar Golpe espectral (Principiante)",
    "combat",
    "Imbuye tu arma cuerpo a cuerpo con una llama maligna hasta el final de la escena para causar +1D4 de daño adicional en cada impacto.",
    { damageFormula: "+1d4" }
  ),
  capabilityAction(
    "principiante-golpe-psiquico-espectral",
    "Usar Golpe psíquico espectral (Principiante)",
    "reaction",
    "Combina tu ataque cuerpo a cuerpo con un golpe psíquico dirigido a la defensa del oponente y gana una segunda oportunidad de éxito en la prueba de ataque."
  ),
  capabilityAction(
    "adepto-golpe-espectral",
    "Lanzar Golpe espectral (Adepto)",
    "combat",
    "Imbuye tu arma cuerpo a cuerpo con una llama maligna hasta el final de la escena para causar +1D4 de daño adicional; las criaturas muertas por este poder se alzan al siguiente turno bajo tus órdenes.",
    { damageFormula: "+1d4" }
  ),
  capabilityAction(
    "adepto-golpe-psiquico-espectral",
    "Usar Golpe psíquico espectral (Adepto)",
    "reaction",
    "Acompaña un ataque cuerpo a cuerpo con una tirada de [Tenaz←Tenaz]; si tiene éxito, el oponente no puede defenderse y el ataque impacta automáticamente.",
    { rollAttribute: "tenaz" }
  ),
  capabilityAction(
    "maestro-golpe-espectral",
    "Lanzar Golpe espectral (Maestro)",
    "combat",
    "Imbuye tu arma cuerpo a cuerpo con una llama maligna hasta el final de la escena para causar +1D8 de daño adicional; las criaturas muertas por este poder se alzan al siguiente turno bajo tus órdenes.",
    { damageFormula: "+1d8" }
  ),
  capabilityAction(
    "maestro-golpe-psiquico-espectral",
    "Usar Golpe psíquico espectral (Maestro)",
    "reaction",
    "Acompaña un ataque cuerpo a cuerpo con una tirada de [Tenaz←Tenaz]; si tiene éxito, el oponente no puede defenderse, el ataque impacta automáticamente y además sufre 1D4 de daño extra ignorando armadura.",
    { rollAttribute: "tenaz", damageFormula: "1d4" }
  )
];

const IMPOSICION_DE_MANOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-imposicion-de-manos",
    "Lanzar Imposición de manos (Principiante)",
    "combat",
    "Supera una tirada de Tenaz para curar 1D6 de Resistencia a un objetivo o a ti mismo.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-imposicion-de-manos",
    "Lanzar Imposición de manos (Adepto)",
    "combat",
    "Supera una tirada de Tenaz para curar 1D8 de Resistencia y detener cualquier veneno o hemorragia del objetivo.",
    { rollAttribute: "tenaz", damageFormula: "1d8" }
  ),
  capabilityAction(
    "maestro-imposicion-de-manos",
    "Lanzar Imposición de manos (Maestro)",
    "combat",
    "Supera una tirada de Tenaz para curar 1D12 de Resistencia y detener cualquier veneno o hemorragia. También puedes usarlo a distancia en línea de visión, en cuyo caso cura 1D8.",
    { rollAttribute: "tenaz", damageFormula: "1d12" }
  )
];

const MURO_DE_LLAMAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-muro-de-llamas",
    "Lanzar Muro de llamas (Principiante)",
    "combat",
    "Supera una tirada de Tenaz para invocar un muro de fuego delante de ti. Cruzarlo inflige 1D12 de daño por fuego y puedes colocarlo sobre enemigos en línea frente a ti para herirlos automáticamente. Debes sostenerlo con una tirada de Tenaz cada turno.",
    { rollAttribute: "tenaz", damageFormula: "1d12" }
  ),
  capabilityAction(
    "adepto-muro-de-llamas",
    "Lanzar Muro de llamas (Adepto)",
    "combat",
    "Supera una tirada de Tenaz para formar un círculo de llamas alrededor de tu grupo. Cruzarlo inflige 1D12 de daño por fuego. Debes sostenerlo con una tirada de Tenaz cada turno.",
    { rollAttribute: "tenaz", damageFormula: "1d12" }
  ),
  capabilityAction(
    "maestro-muro-de-llamas",
    "Lanzar Muro de llamas (Maestro)",
    "combat",
    "Supera una tirada de Tenaz para formar una cúpula cerrada de llamas alrededor de tu grupo. Cruzarla inflige 1D12 de daño por fuego. Debes sostenerla con una tirada de Tenaz cada turno.",
    { rollAttribute: "tenaz", damageFormula: "1d12" }
  )
];

const RAYO_NEGRO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-rayo-negro",
    "Lanzar Rayo negro (Principiante)",
    "combat",
    "Supera una tirada de [Tenaz←Ágil] para impactar a un objetivo con un rayo negro. Si impacta, sufre 1D6 de daño ignorando armadura y queda atrapado hasta escapar con Tenaz o hasta que pierdas la concentración.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-rayo-negro",
    "Lanzar Rayo negro (Adepto)",
    "combat",
    "Supera una tirada de [Tenaz←Ágil] para iniciar una cadena de rayos negros. Cada impacto causa 1D6 de daño ignorando armadura y puede saltar a otro objetivo hasta fallar una tirada; si uno escapa o pierdes la concentración, todos quedan libres.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-rayo-negro",
    "Lanzar Rayo negro (Maestro)",
    "combat",
    "Supera una tirada de [Tenaz←Ágil] para iniciar una cadena de rayos negros. Cada impacto causa 1D6 de daño ignorando armadura y cada objetivo inmovilizado debe liberarse por separado; si pierdes la concentración, todos quedan libres.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  )
];

const SOMETER_VOLUNTAD_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-someter-voluntad",
    "Lanzar Someter voluntad (Principiante)",
    "combat",
    "Supera [Tenaz←Tenaz] para controlar a una criatura mientras mantengas la concentración. El objetivo solo puede realizar una acción por turno y no puede usar poderes ni habilidades activas.",
    { rollAttribute: "tenaz" }
  ),
  capabilityAction(
    "adepto-someter-voluntad",
    "Lanzar Someter voluntad (Adepto)",
    "combat",
    "Supera [Tenaz←Tenaz] para controlar a una criatura sin necesidad de concentración. El efecto continúa hasta que falles una tirada posterior de [Tenaz←Tenaz]. El objetivo solo puede realizar una acción por turno y no puede usar poderes ni habilidades activas.",
    { rollAttribute: "tenaz" }
  ),
  capabilityAction(
    "maestro-someter-voluntad",
    "Lanzar Someter voluntad (Maestro)",
    "combat",
    "Supera [Tenaz←Tenaz] para controlar a una criatura sin necesidad de concentración. El efecto continúa hasta que falles una tirada posterior de [Tenaz←Tenaz]. El objetivo controlado puede realizar dos acciones por turno, pero sigue sin poder usar poderes ni habilidades activas.",
    { rollAttribute: "tenaz" }
  )
];

const ANATEMA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-anatema", "Lanzar Anatema (Principiante)", "combat", "Supera [Tenaz←Tenaz] para disipar un efecto continuo sobre una criatura o sobre ti mismo.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-anatema", "Lanzar Anatema (Adepto)", "combat", "Disipa efectos continuos sobre varios objetivos en cadena; cada tirada afecta a un objetivo por orden.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-anatema", "Lanzar Anatema (Maestro)", "combat", "Supera una tirada de Tenaz para disipar cualquier efecto místico, incluyendo criaturas y efectos invocados.", { rollAttribute: "tenaz" })
];

const ARMA_DANZANTE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-arma-danzante", "Activar Arma danzante (Principiante)", "combat", "Activa un arma danzante que usa Tenaz para atacar y defender; mientras lucha, no puedes usar otros poderes ni habilidades.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-arma-danzante", "Activar Arma danzante (Adepto)", "combat", "Activa el arma danzante con una acción de combate; después luchará por sí sola usando Tenaz, dejándote libre para otras acciones.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-arma-danzante", "Activar Arma danzante (Maestro)", "free", "El arma sale de la vaina por sí sola, ataca una vez por turno y te defiende usando Tenaz.", { rollAttribute: "tenaz" })
];

const AURA_IMPIA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-aura-impia", "Lanzar Aura impía (Principiante)", "combat", "Supera una tirada de Tenaz para emitir un aura que causa 1D6 de daño ignorando armadura a bestias y seres civilizados alrededor de ti.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-aura-impia", "Lanzar Aura impía (Adepto)", "combat", "Como a nivel principiante, pero puedes excluir a tus aliados vivos del efecto.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("maestro-aura-impia", "Lanzar Aura impía (Maestro)", "combat", "Como a nivel adepto, pero el aura causa 1D8 de daño ignorando armadura y además cura 1D8 a muertos vivientes y abominaciones aliados.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const AURA_SAGRADA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-aura-sagrada", "Lanzar Aura sagrada (Principiante)", "combat", "Supera una tirada de Tenaz para emitir un aura que causa 1D6 de daño ignorando armadura a abominaciones y muertos vivientes en tu línea de visión.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-aura-sagrada", "Lanzar Aura sagrada (Adepto)", "combat", "El aura causa 1D8 a abominaciones y muertos vivientes y las criaturas vivas pueden recuperar 1D4 de Resistencia por turno.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("maestro-aura-sagrada", "Lanzar Aura sagrada (Maestro)", "combat", "El aura causa 1D10 a abominaciones y muertos vivientes y las criaturas vivas pueden recuperar 1D6 de Resistencia por turno.", { rollAttribute: "tenaz", damageFormula: "1d10" })
];

const BACULO_ARROJADIZO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-baculo-arrojadizo", "Lanzar Báculo arrojadizo (Principiante)", "combat", "Lanza tu báculo usando Tenaz en vez de Diestro para acertar; inflige 1D8 de daño y puede añadir una runa elemental activa.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("adepto-baculo-arrojadizo", "Lanzar Báculo arrojadizo (Adepto)", "combat", "Como a nivel principiante, pero causa 1D10 y puede alcanzar objetivos más allá de obstáculos sin línea de visión limpia.", { rollAttribute: "tenaz", damageFormula: "1d10" }),
  capabilityAction("maestro-baculo-arrojadizo", "Lanzar Báculo arrojadizo (Maestro)", "combat", "Lanza una cadena de hasta cinco golpes con tu báculo usando Tenaz; el daño baja de 1D12 a 1D4 con cada objetivo sucesivo.", { rollAttribute: "tenaz", damageFormula: "1d12" })
];

const CACERIA_SALVAJE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-cacería-salvaje", "Invocar Cacería salvaje (Principiante)", "combat", "Invoca una bestia de desafío sencillo para ayudarte en combate."),
  capabilityAction("adepto-cacería-salvaje", "Invocar Cacería salvaje (Adepto)", "combat", "Invoca una bestia de desafío normal o 1D4 bestias sencillas para ayudarte en combate.", { damageFormula: "1d4" }),
  capabilityAction("maestro-cacería-salvaje", "Invocar Cacería salvaje (Maestro)", "combat", "Invoca una bestia de desafío complicado o 1D6 bestias normales para ayudarte en combate.", { damageFormula: "1d6" })
];

const CAMBIAFORMAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-cambiaformas", "Usar Cambiaformas (Principiante)", "combat", "Supera una tirada de Tenaz para asumir la forma de una pequeña bestia útil para escapar o explorar; para volver a tu forma normal también debes superar Tenaz.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-cambiaformas", "Usar Cambiaformas (Adepto)", "combat", "Supera una tirada de Tenaz para adoptar la forma de un animal capaz de luchar, ganando Duro (I) y Arma natural (I).", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-cambiaformas", "Usar Cambiaformas (Maestro)", "combat", "Supera una tirada de Tenaz para adoptar la forma de un animal imponente, ganando además Regeneración (I) y Robusto (I).", { rollAttribute: "tenaz" })
];

const CASCADA_DE_AZUFRE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-cascada-de-azufre", "Lanzar Cascada de azufre (Principiante)", "combat", "Supera [Tenaz←Ágil] para causar 1D12 de daño; si fallas, la cascada aún causa 1D6.", { rollAttribute: "tenaz", damageFormula: "1d12" }),
  capabilityAction("adepto-cascada-de-azufre", "Lanzar Cascada de azufre (Adepto)", "combat", "Como a nivel principiante, pero si el primer objetivo recibe 1D12 puedes encadenar la cascada a enemigos adicionales hasta fallar.", { rollAttribute: "tenaz", damageFormula: "1d12" }),
  capabilityAction("maestro-cascada-de-azufre", "Lanzar Cascada de azufre (Maestro)", "combat", "Como a nivel adepto, pero la cadena solo se desvanece tras dos fallos en [Tenaz←Ágil].", { rollAttribute: "tenaz", damageFormula: "1d12" })
];

const EMPUJE_MENTAL_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-empuje-mental", "Usar Empuje mental (Principiante)", "combat", "Haz una tirada de [Tenaz←Ágil] para lanzar objetos como proyectiles y causar 1D8 de daño. También puedes usar objetos como escudo improvisado.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("adepto-empuje-mental", "Usar Empuje mental (Adepto)", "combat", "Supera [Tenaz←Fuerte] para levantar y lanzar a un enemigo a una acción de movimiento; sufre 1D8 y puede quedar derribado si no supera Ágil.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("maestro-empuje-mental", "Usar Empuje mental (Maestro)", "combat", "Encadena el lanzamiento de enemigos con una serie de tiradas de [Tenaz←Fuerte]; cada uno sufre 1D8 y puede quedar derribado.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const ENREDADERA_VELOZ_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-enredadera-veloz", "Lanzar Enredadera veloz (Principiante)", "combat", "Supera una tirada de Tenaz para inmovilizar a un objetivo con raíces o enredaderas; debes mantenerlo con tiradas posteriores de [Tenaz←Fuerte].", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-enredadera-veloz", "Lanzar Enredadera veloz (Adepto)", "combat", "Encadena la inmovilización a varios objetivos; en turnos posteriores haces una tirada de [Tenaz←Fuerte] por cada uno.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-enredadera-veloz", "Lanzar Enredadera veloz (Maestro)", "combat", "Como a nivel adepto, pero las enredaderas espinosas causan 1D6 por turno ignorando armadura a cada objetivo atrapado.", { rollAttribute: "tenaz", damageFormula: "1d6" })
];

const ERUPCION_DE_LARVAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-erupcion-de-larvas", "Lanzar Erupción de larvas (Principiante)", "combat", "Planta larvas en el cuerpo del objetivo; sufre 1D4 por turno ignorando armadura hasta que falles [Tenaz←Fuerte].", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("adepto-erupcion-de-larvas", "Lanzar Erupción de larvas (Adepto)", "combat", "Como a nivel principiante, pero el daño por turno sube a 1D6.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("maestro-erupcion-de-larvas", "Lanzar Erupción de larvas (Maestro)", "combat", "Como a nivel principiante, pero el daño por turno sube a 1D8.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const ESFERA_DE_PROTECCION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-esfera-de-proteccion", "Lanzar Esfera de protección (Principiante)", "combat", "Crea una esfera que te permite defenderte con Tenaz en vez de Ágil y te protege de ataques físicos mientras permanezcas dentro.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-esfera-de-proteccion", "Lanzar Esfera de protección (Adepto)", "combat", "La esfera bloquea automáticamente un número ilimitado de ataques cuerpo a cuerpo o a distancia, pero no protege contra poderes místicos o áreas.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-esfera-de-proteccion", "Lanzar Esfera de protección (Maestro)", "combat", "Puedes formar la esfera sin tocar el arma, incluir a un aliado y mantener dentro acciones que normalmente sustituyen movimiento.", { rollAttribute: "tenaz" })
];

const ESPIRITU_IGNEO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-espiritu-igneo", "Lanzar Espíritu ígneo (Principiante)", "combat", "Cuando te hieren en cuerpo a cuerpo, las llamas contraatacan por 1D6 y además ganas +1D6 de armadura contra fuego.", { damageFormula: "1d6" }),
  capabilityAction("adepto-espiritu-igneo", "Lanzar Espíritu ígneo (Adepto)", "combat", "Como a nivel principiante, pero el contraataque y la protección contra fuego suben a 1D10.", { damageFormula: "1d10" }),
  capabilityAction("maestro-espiritu-igneo", "Lanzar Espíritu ígneo (Maestro)", "combat", "No sufres daño por fuego, te curas con él y tus llamas contraatacan también a distancia por 1D10.", { damageFormula: "1d10" })
];

const ESPIRITUS_ATORMENTADORES_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-espiritus-atormentadores", "Lanzar Espíritus atormentadores (Principiante)", "combat", "Invoca espíritus que fuerzan al objetivo a tener una segunda oportunidad de fallar cualquier prueba y a fallar automáticamente sus concentraciones.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-espiritus-atormentadores", "Lanzar Espíritus atormentadores (Adepto)", "combat", "Además del efecto base, los espíritus infligen 1D4 de daño a Tenaz por turno ignorando armadura.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("maestro-espiritus-atormentadores", "Lanzar Espíritus atormentadores (Maestro)", "combat", "Como a nivel adepto, pero el daño a Tenaz por turno sube a 1D6.", { rollAttribute: "tenaz", damageFormula: "1d6" })
];

const EXPULSAR_A_LOS_ABISMOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-expulsar-a-los-abismos", "Lanzar Expulsar a los abismos (Principiante)", "combat", "Supera [Tenaz←Tenaz] para enviar a un oponente fuera del mundo durante un turno; al volver sufre 1D4 de daño y 1D4 de corrupción temporal.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("adepto-expulsar-a-los-abismos", "Lanzar Expulsar a los abismos (Adepto)", "combat", "Envía a un oponente al Ultramundo; cada turno atrapado sufre 1D4 de daño y 1D4 de corrupción temporal hasta volver o desaparecer.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("maestro-expulsar-a-los-abismos", "Lanzar Expulsar a los abismos (Maestro)", "reaction", "Una vez por turno, el enemigo que te ataque en cuerpo a cuerpo puede ser expulsado al Ultramundo con [Tenaz←Tenaz], sufriendo el efecto del nivel principiante.", { rollAttribute: "tenaz", damageFormula: "1d4" })
];

const FORMA_ESPIRITUAL_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-forma-espiritual", "Usar Forma espiritual (Principiante)", "movement", "Supera una tirada de Tenaz para asumir forma espiritual durante una acción de movimiento y atravesar paredes u oponentes; solo puedes moverte ese turno.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-forma-espiritual", "Usar Forma espiritual (Adepto)", "reaction", "En vez de una Defensa, puedes hacer [Tenaz←Daño] para dejar que un ataque te atraviese sin daño; poderes y artefactos solo hacen la mitad.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-forma-espiritual", "Usar Forma espiritual (Maestro)", "reaction", "Supera una tirada de Tenaz para dejar que un ataque o poder dañino comience atravesando tu forma espiritual antes de resolver su efecto.", { rollAttribute: "tenaz" })
];

const FORMA_VERDADERA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-forma-verdadera", "Lanzar Forma verdadera", "combat", "Revela o fuerza la verdadera forma de un objetivo según el nivel del poder y su resistencia mástica.", { rollAttribute: "tenaz" })
];

const GLIFO_VAMPIRICO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-glifo-vampirico", "Activar Glifo vampírico", "combat", "Activa un glifo que drena Resistencia del objetivo y la transfiere según el nivel del símbolo.", { rollAttribute: "tenaz", damageFormula: "1d4" })
];

const HERIDA_COMPARTIDA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-herida-compartida", "Lanzar Herida compartida (Principiante)", "free", "Supera una tirada de Tenaz para curar 1D6 de Resistencia a otra criatura y sufrir tú la misma cantidad de daño.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-herida-compartida", "Lanzar Herida compartida (Adepto)", "free", "Cura 1D8 y además elimina venenos o hemorragias; tú sufres solo la mitad del daño de esas heridas y efectos.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("maestro-herida-compartida", "Lanzar Herida compartida (Maestro)", "combat", "Como a nivel adepto, pero tú solo sufres la mitad y puedes transferir la otra mitad a una criatura en línea de visión ignorando armadura.", { rollAttribute: "tenaz" })
];

const HIMNO_DE_BATALLA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-himno-de-batalla", "Cantar Himno de batalla (Principiante)", "free", "Otorga a todos tus aliados y a ti mismo +1 a Ágil, Fuerte o Diestro mientras mantengas el canto."),
  capabilityAction("adepto-himno-de-batalla", "Cantar Himno de batalla (Adepto)", "free", "Otorga a todos tus aliados y a ti mismo +1 a Ágil, Fuerte y Diestro mientras mantengas el canto."),
  capabilityAction("maestro-himno-de-batalla", "Cantar Himno de batalla (Maestro)", "free", "Como a nivel adepto, y además todos recuperan 1D6 de Resistencia al inicio del canto una vez por escena.", { damageFormula: "1d6" })
];

const HIMNO_DEBILITANTE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-himno-debilitante", "Cantar Himno debilitante", "free", "Debilita a los enemigos según el nivel del canto, reduciendo su eficacia y resistencia en combate.")
];

const HIMNO_HEROICO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-himno-heroico", "Cantar Himno heroico", "free", "Potencia a tus aliados con un canto heroico según el nivel del poder.")
];

const IMAGEN_ESPECULAR_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-imagen-especular", "Lanzar Imagen especular", "combat", "Crea duplicados ilusorios que complican los ataques enemigos y mejoran tu defensa según el nivel.")
];

const IMPERCEPTIBLE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("general-imperceptible", "Lanzar Imperceptible", "combat", "Te vuelves difícil de percibir o seguir según el nivel del poder.", { rollAttribute: "tenaz" })
];

const LEVITACION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-levitacion", "Lanzar Levitación (Principiante)", "combat", "Supera una tirada de Tenaz para levitar a velocidad de una zancada por turno; si pierdes la concentración, caes y sufres 1D6 ignorando armadura.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-levitacion", "Lanzar Levitación (Adepto)", "combat", "Supera [Tenaz←Fuerte] para hacer levitar a un aliado; si pierdes la concentración, cae y sufre 1D6 ignorando armadura.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("maestro-levitacion", "Lanzar Levitación (Maestro)", "combat", "Encadena la levitación sobre ti y varios aliados con [Tenaz←Fuerte]; si pierdes la concentración, descienden sin daño.", { rollAttribute: "tenaz" })
];

const MALDICION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-maldicion", "Usar Maldición (Principiante)", "free", "Una vez por turno, obliga a un enemigo que te ataque a doblar sus posibilidades de fallo mientras mantengas el efecto con Tenaz.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-maldicion", "Usar Maldición (Adepto)", "free", "Como a nivel principiante, pero el enemigo dobla sus posibilidades de fallo con independencia del objetivo.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-maldicion", "Lanzar Maldición (Maestro)", "combat", "Lanza una maldición que inflige 1D6 ignorando armadura por cada acción que intente realizar el objetivo mientras mantengas el efecto con Tenaz.", { rollAttribute: "tenaz", damageFormula: "1d6" })
];

const MANANTIAL_DE_VIDA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-manantial-de-vida", "Lanzar Manantial de vida (Principiante)", "combat", "Elimina 1D4 de corrupción temporal de una criatura a la vista; los puntos sobrantes curan Resistencia.", { damageFormula: "1d4" }),
  capabilityAction("adepto-manantial-de-vida", "Lanzar Manantial de vida (Adepto)", "combat", "Elimina 1D4 de corrupción temporal de ti y de todos los aliados a la vista; los puntos sobrantes curan Resistencia.", { damageFormula: "1d4" }),
  capabilityAction("maestro-manantial-de-vida", "Usar Manantial de vida (Maestro)", "reaction", "Cuando un aliado a la vista sufre corrupción temporal por un poder o artefacto, reduces esa cantidad en 1D4.", { damageFormula: "1d4" })
];

const MANTO_DE_ESPINAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-manto-de-espinas", "Lanzar Manto de espinas (Principiante)", "combat", "Ganas +1D4 de armadura, o +1D6 si no te mueves en todo el turno.", { damageFormula: "1d4" }),
  capabilityAction("adepto-manto-de-espinas", "Lanzar Manto de espinas (Adepto)", "combat", "Como a nivel principiante, pero también proteges a aliados cercanos con +1D4 de armadura mientras permanezcan junto a ti.", { damageFormula: "1d4" }),
  capabilityAction("maestro-manto-de-espinas", "Lanzar Manto de espinas (Maestro)", "combat", "Como a nivel adepto, y además cada ataque cuerpo a cuerpo exitoso contra un protegido desencadena un contraataque de espinas por 1D10 ignorando armadura.", { damageFormula: "1d10" })
];

const MARTILLO_DE_MONSTRUOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-martillo-de-monstruos", "Invocar Martillo de monstruos (Principiante)", "free", "Envuelve tu arma cuerpo a cuerpo en una llama sagrada que añade 1D4 de daño, o 1D6 contra abominaciones y muertos vivientes, hasta el final de la escena.", { damageFormula: "1d4" }),
  capabilityAction("adepto-martillo-de-monstruos", "Invocar Martillo de monstruos (Adepto)", "free", "Como a nivel principiante, pero el daño contra abominaciones y muertos vivientes sube a 1D8.", { damageFormula: "1d8" }),
  capabilityAction("maestro-martillo-de-monstruos", "Invocar Martillo de monstruos (Maestro)", "free", "Como a nivel principiante, pero el daño contra abominaciones y muertos vivientes sube a 1D10.", { damageFormula: "1d10" })
];

const MODIFICACION_ILUSORIA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-modificacion-ilusoria", "Usar Modificación ilusoria (Principiante)", "reaction", "Haz una tirada de Tenaz para repetir una tirada fallida de Defensa.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-modificacion-ilusoria", "Usar Modificación ilusoria (Adepto)", "reaction", "Haz una tirada de Tenaz para forzar la repetición de cualquier tirada que te haya afectado este turno.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-modificacion-ilusoria", "Usar Modificación ilusoria (Maestro)", "reaction", "Haz una tirada de Tenaz para forzar la repetición de cualquier tirada que afecte a otro objetivo.", { rollAttribute: "tenaz" })
];

const NUBE_DE_VENGANZA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-nube-de-venganza", "Lanzar Nube de venganza (Principiante)", "combat", "Supera [Tenaz←Tenaz] para marcar a un objetivo de modo que cualquiera que lo ataque tenga una segunda oportunidad de éxito durante la escena.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-nube-de-venganza", "Usar Nube de venganza (Adepto)", "reaction", "Cuando sufres daño y superas [Tenaz←Tenaz], enlazas al atacante con un vínculo mortal que le transfiere todo el daño que recibas.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-nube-de-venganza", "Usar Nube de venganza (Maestro)", "reaction", "Como a nivel adepto, pero puedes mantener vínculos mortales con un número ilimitado de atacantes.", { rollAttribute: "tenaz" })
];

const PRISMA_ARDIENTE_DE_PRIOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-prisma-ardiente-de-prios", "Lanzar Prisma ardiente de Prios (Principiante)", "combat", "Supera una tirada de Tenaz para infligir 1D6 de daño, o 1D8 contra abominaciones y muertos vivientes.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-prisma-ardiente-de-prios", "Lanzar Prisma ardiente de Prios (Adepto)", "combat", "Supera una tirada de Tenaz para dañar a todos los enemigos cercanos por 1D8, o 1D12 si son abominaciones o muertos vivientes.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("maestro-prisma-ardiente-de-prios", "Lanzar Prisma ardiente de Prios (Maestro)", "combat", "Como a nivel adepto, y además puedes superar [Tenaz←Tenaz] para aturdir durante un turno a muertos vivientes o criaturas consumidas por la Corrupción.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const PURGATORIO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("adepto-purgatorio", "Lanzar Purgatorio (Adepto)", "combat", "Obliga a todos los enemigos a la vista a tirar 1D20 contra su corrupción total; si fallan quedan incapacitados un turno, y las criaturas totalmente corruptas sufren 1D6 ignorando armadura.", { damageFormula: "1d6" }),
  capabilityAction("maestro-purgatorio", "Lanzar Purgatorio (Maestro)", "combat", "Castiga automáticamente a todos los oponentes corruptos a la vista; cada punto de corrupción sufrido por poderes o artefactos les causa la misma cantidad de daño físico ignorando armadura.")
];

const REFUGIO_TERRESTRE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-refugio-terrestre", "Lanzar Refugio terrestre (Principiante)", "combat", "Supera una tirada de Tenaz para hundirte en la tierra y volverte invulnerable mientras no hagas nada más; debes repetir Tenaz cada turno para permanecer dentro.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-refugio-terrestre", "Lanzar Refugio terrestre (Adepto)", "combat", "Como a nivel principiante, pero puedes usar poderes místicos sobre ti mismo y no necesitas repetir Tenaz para mantenerte.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-refugio-terrestre", "Lanzar Refugio terrestre (Maestro)", "combat", "Como a nivel adepto, pero puedes moverte bajo tierra con tus acciones de movimiento y aparecer en otro punto.", { rollAttribute: "tenaz" })
];

const RUNAS_DE_PROTECCION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-runas-de-proteccion", "Lanzar Runas de protección (Principiante)", "combat", "Otorga +1D4 de armadura hasta que falles Tenaz o pierdas la concentración.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("adepto-runas-de-proteccion", "Lanzar Runas de protección (Adepto)", "combat", "Como a nivel principiante, y además cada atacante que dañe al protegido sufre 1D4 ignorando armadura.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("maestro-runas-de-proteccion", "Lanzar Runas de protección (Maestro)", "combat", "La protección y la represalia se resuelven con 1D6 en vez de 1D4.", { rollAttribute: "tenaz", damageFormula: "1d6" })
];

const SELLO_DE_EXPULSION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-sello-de-expulsion", "Activar Sello de expulsión (Principiante)", "combat", "Supera [Tenaz←Tenaz] para expulsar al objetivo más cercano y seguir intentándolo con el siguiente hasta fallar.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-sello-de-expulsion", "Activar Sello de expulsión (Adepto)", "combat", "Como a nivel principiante, pero quienes resistan el destierro sufren 1D4 ignorando armadura o pueden huir para evitarlo.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("maestro-sello-de-expulsion", "Activar Sello de expulsión (Maestro)", "combat", "Como a nivel adepto, pero quienes no sean desterrados sufren 1D8 ignorando armadura, o 1D4 si huyen.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const SIMBOLO_CEGADOR_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-simbolo-cegador", "Activar Símbolo cegador (Principiante)", "combat", "Supera [Tenaz←Tenaz] para cegar al objetivo más cercano y encadenar el efecto a otros hasta fallar.", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-simbolo-cegador", "Activar Símbolo cegador (Adepto)", "combat", "Como a nivel principiante, pero la ceguera dura hasta que falles Tenaz o pierdas la concentración.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-simbolo-cegador", "Activar Símbolo cegador (Maestro)", "combat", "Como a nivel principiante, pero la ceguera dura hasta que los afectados recuperen Resistencia por curación o elixires.", { rollAttribute: "tenaz" })
];

const TELETRANSPORTACION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-teletransportacion", "Lanzar Teletransportación (Principiante)", "combat", "Supera una tirada de Tenaz para desaparecer y reaparecer hasta dos acciones de movimiento más lejos; sufres 1D4 ignorando armadura por el viaje.", { rollAttribute: "tenaz", damageFormula: "1d4" }),
  capabilityAction("adepto-teletransportacion", "Lanzar Teletransportación (Adepto)", "combat", "Como a nivel principiante, pero no sufres daño en el viaje al Ultramundo.", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-teletransportacion", "Lanzar Teletransportación (Maestro)", "combat", "Como a nivel adepto, pero puedes llevar contigo a otra criatura; si no coopera debes superar [Tenaz←Tenaz].", { rollAttribute: "tenaz" })
];

const TORMENTA_DE_FLECHAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-tormenta-de-flechas", "Lanzar Tormenta de flechas (Principiante)", "combat", "Encanta hasta cinco flechas; puedes disparar una por turno como acción gratuita y cada una impacta automáticamente por 1D6 más sus cualidades.", { rollAttribute: "tenaz", damageFormula: "1d6" }),
  capabilityAction("adepto-tormenta-de-flechas", "Lanzar Tormenta de flechas (Adepto)", "combat", "Como a nivel principiante, pero cada flecha causa 1D8 y puedes usar una acción de combate para disparar dos proyectiles a uno o varios objetivos.", { rollAttribute: "tenaz", damageFormula: "1d8" }),
  capabilityAction("maestro-tormenta-de-flechas", "Lanzar Tormenta de flechas (Maestro)", "combat", "Como a nivel adepto, pero una acción de combate te permite disparar tres flechas.", { rollAttribute: "tenaz", damageFormula: "1d8" })
];

const TRANSFORMACION_REGRESIVA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction("principiante-transformacion-regresiva", "Lanzar Transformación regresiva (Principiante)", "combat", "Supera una tirada de Tenaz para transformar a un objetivo en una bestia indefensa mientras mantengas la concentración y tus tiradas posteriores de [Tenaz←Tenaz].", { rollAttribute: "tenaz" }),
  capabilityAction("adepto-transformacion-regresiva", "Lanzar Transformación regresiva (Adepto)", "combat", "Como a nivel principiante, pero ya no necesitas concentración; el efecto dura hasta que falles una tirada posterior de [Tenaz←Tenaz].", { rollAttribute: "tenaz" }),
  capabilityAction("maestro-transformacion-regresiva", "Lanzar Transformación regresiva (Maestro)", "combat", "Encadena la transformación sobre varios objetivos sucesivos hasta fallar, manteniendo una tirada de Tenaz por turno y por objetivo.", { rollAttribute: "tenaz" })
];

const GOLPE_PSIQUICO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "general-golpe-psiquico",
    "Lanzar Golpe psíquico",
    "combat",
    "Desata un ataque psíquico directo contra un objetivo usando Tenaz como atributo de resolución. El efecto exacto depende del nivel del poder.",
    { rollAttribute: "tenaz" }
  )
];

function resolveMysticPowerActions(nombre: string, resumen: string): SymbaroumCapabilityAction[] {
  switch (slugify(nombre)) {
    case "aliento-negro": return ALIENTO_NEGRO_ACTIONS;
    case "anatema": return ANATEMA_ACTIONS;
    case "arma-danzante": return ARMA_DANZANTE_ACTIONS;
    case "aura-impia": return AURA_IMPIA_ACTIONS;
    case "aura-sagrada": return AURA_SAGRADA_ACTIONS;
    case "baculo-arrojadizo": return BACULO_ARROJADIZO_ACTIONS;
    case "caceria-salvaje": return CACERIA_SALVAJE_ACTIONS;
    case "cambiaformas": return CAMBIAFORMAS_ACTIONS;
    case "cascada-de-azufre": return CASCADA_DE_AZUFRE_ACTIONS;
    case "confusion": return CONFUSION_ACTIONS;
    case "empuje-mental": return EMPUJE_MENTAL_ACTIONS;
    case "enredadera-veloz": return ENREDADERA_VELOZ_ACTIONS;
    case "erupcion-de-larvas": return ERUPCION_DE_LARVAS_ACTIONS;
    case "escudo-bendito": return ESCUDO_BENDITO_ACTIONS;
    case "esfera-de-proteccion": return ESFERA_DE_PROTECCION_ACTIONS;
    case "espiritu-igneo": return ESPIRITU_IGNEO_ACTIONS;
    case "espiritus-atormentadores": return ESPIRITUS_ATORMENTADORES_ACTIONS;
    case "expulsar-a-los-abismos": return EXPULSAR_A_LOS_ABISMOS_ACTIONS;
    case "forma-espiritual": return FORMA_ESPIRITUAL_ACTIONS;
    case "forma-verdadera": return FORMA_VERDADERA_ACTIONS;
    case "glifo-vampirico": return GLIFO_VAMPIRICO_ACTIONS;
    case "golpe-espectral": return GOLPE_ESPECTRAL_ACTIONS;
    case "golpe-psiquico": return GOLPE_PSIQUICO_ACTIONS;
    case "herida-compartida": return HERIDA_COMPARTIDA_ACTIONS;
    case "himno-de-batalla": return HIMNO_DE_BATALLA_ACTIONS;
    case "himno-debilitante": return HIMNO_DEBILITANTE_ACTIONS;
    case "himno-heroico": return HIMNO_HEROICO_ACTIONS;
    case "imagen-especular": return IMAGEN_ESPECULAR_ACTIONS;
    case "imperceptible": return IMPERCEPTIBLE_ACTIONS;
    case "imposicion-de-manos": return IMPOSICION_DE_MANOS_ACTIONS;
    case "levitacion": return LEVITACION_ACTIONS;
    case "maldicion": return MALDICION_ACTIONS;
    case "manantial-de-vida": return MANANTIAL_DE_VIDA_ACTIONS;
    case "manto-de-espinas": return MANTO_DE_ESPINAS_ACTIONS;
    case "martillo-de-monstruos": return MARTILLO_DE_MONSTRUOS_ACTIONS;
    case "modificacion-ilusoria": return MODIFICACION_ILUSORIA_ACTIONS;
    case "muro-de-llamas": return MURO_DE_LLAMAS_ACTIONS;
    case "nube-de-venganza": return NUBE_DE_VENGANZA_ACTIONS;
    case "prisma-ardiente-de-prios": return PRISMA_ARDIENTE_DE_PRIOS_ACTIONS;
    case "purgatorio": return PURGATORIO_ACTIONS;
    case "rayo-negro": return RAYO_NEGRO_ACTIONS;
    case "refugio-terrestre": return REFUGIO_TERRESTRE_ACTIONS;
    case "runas-de-proteccion": return RUNAS_DE_PROTECCION_ACTIONS;
    case "sello-de-expulsion": return SELLO_DE_EXPULSION_ACTIONS;
    case "simbolo-cegador": return SIMBOLO_CEGADOR_ACTIONS;
    case "someter-voluntad": return SOMETER_VOLUNTAD_ACTIONS;
    case "teletransportacion": return TELETRANSPORTACION_ACTIONS;
    case "tormenta-de-flechas": return TORMENTA_DE_FLECHAS_ACTIONS;
    case "transformacion-regresiva": return TRANSFORMACION_REGRESIVA_ACTIONS;
    default: return inferCapabilityActions("poder_mistico", nombre, resumen);
  }
}

const ARCO_VELOZ_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-arco-veloz",
    "Usar Arco veloz (Principiante)",
    "combat",
    "Sacrifica tu acción de movimiento para disparar una segunda flecha este turno. Ambas flechas se resuelven por separado y pueden dirigirse al mismo objetivo o a dos distintos.",
    { rollAttribute: "diestro" }
  ),
  capabilityAction(
    "adepto-arco-veloz",
    "Usar Arco veloz (Adepto)",
    "combat",
    "Dispara dos flechas con una sola acción de combate, contra uno o dos objetivos.",
    { rollAttribute: "diestro" }
  ),
  capabilityAction(
    "maestro-arco-veloz",
    "Usar Arco veloz (Maestro)",
    "combat",
    "Resuelve tres disparos con una sola acción de combate, contra uno o varios objetivos.",
    { rollAttribute: "diestro" }
  )
];

const ATAQUE_CON_DOS_ARMAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-ataque-con-dos-armas",
    "Usar Ataque con dos armas (Principiante)",
    "combat",
    "Haz dos ataques contra el mismo objetivo: el arma principal causa 1D8 y la secundaria 1D6. El enemigo debe defenderse por separado de cada ataque.",
    { damageFormula: "1d8/1d6" }
  ),
  capabilityAction(
    "adepto-ataque-con-dos-armas",
    "Usar Ataque con dos armas (Adepto)",
    "combat",
    "Haz dos ataques con armas de una mano en una sola acción de combate; cada uno causa 1D8 de daño y se defiende por separado.",
    { damageFormula: "1d8/1d8" }
  ),
  capabilityAction(
    "maestro-ataque-con-dos-armas",
    "Usar Ataque con dos armas (Maestro)",
    "combat",
    "Haz dos ataques en una sola acción de combate; el arma principal causa 1D10 y la secundaria 1D8. El enemigo debe defenderse por separado de cada ataque.",
    { damageFormula: "1d10/1d8" }
  )
];

const BERSERKER_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-berserker",
    "Entrar en frenesí (Principiante)",
    "free",
    "Entra en frenesí homicida para causar +1D6 de daño en combate cuerpo a cuerpo. Mientras dure, tu Defensa se calcula como si tuvieras Ágil 5.",
    { damageFormula: "+1d6" }
  ),
  capabilityAction(
    "principiante-berserker-defensa",
    "Defender con Berserker (Principiante)",
    "reaction",
    "Mientras estés en frenesí, tu Defensa se resuelve como si tuvieras Ágil 5.",
    { rollAttribute: "agil", fixedTarget: 5 }
  ),
  capabilityAction(
    "adepto-berserker",
    "Absorber daño con Berserker (Adepto)",
    "reaction",
    "Mientras estás en frenesí, puedes ignorar 1D4 de daño de cada ataque sufrido.",
    { damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-berserker-defensa",
    "Defender con Berserker (Adepto)",
    "reaction",
    "Mientras estés en frenesí, tu Defensa se resuelve como si tuvieras Ágil 5.",
    { rollAttribute: "agil", fixedTarget: 5 }
  ),
  capabilityAction(
    "maestro-berserker",
    "Entrar en frenesí controlado (Maestro)",
    "free",
    "Entra en frenesí manteniendo el daño y la protección adicionales de Berserker sin perder tu capacidad normal de defenderte.",
    { damageFormula: "+1d6" }
  )
];

const COMBATE_SIN_ARMAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-combate-sin-armas",
    "Usar Combate sin armas (Adepto)",
    "combat",
    "Haz dos ataques desarmados contra el mismo objetivo. Cada ataque se resuelve por separado.",
    { damageFormula: "1d6/1d6" }
  )
];

const CUCHILLO_RAPIDO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-cuchillo-rapido",
    "Usar Cuchillo rápido (Adepto)",
    "combat",
    "Haz dos ataques con cuchillo en una sola acción de combate contra el mismo objetivo. Si también tienes Ataque con dos armas, puedes llegar a tres ataques en total.",
    { rollAttribute: "agil" }
  ),
  capabilityAction(
    "maestro-cuchillo-rapido",
    "Cerrar distancia con Cuchillo rápido (Maestro)",
    "reaction",
    "Tras dañar con un cuchillo, puedes mantenerte pegado al objetivo, dificultando sus ataques con armas comunes y obligándolo a ganar la iniciativa o retirarse bajo ataque gratuito para recuperar distancia."
  )
];

const LUCHA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-lucha",
    "Usar Lucha (Principiante)",
    "combat",
    "Haz un ataque normal y, si impactas, atrapa al oponente. Después puedes intentar lanzarlo o mantenerlo preso con [Fuerte←Fuerte]. El lanzamiento causa 1D4 ignorando armadura y lo deja boca arriba.",
    { rollAttribute: "fuerte", damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-lucha",
    "Contraatacar con Lucha (Adepto)",
    "reaction",
    "Tras superar una Defensa contra un ataque cuerpo a cuerpo, puedes hacer una tirada de [Fuerte←Fuerte] para lanzar al enemigo: recibe 1D4 ignorando armadura, queda boca arriba y pierde sus acciones activas del siguiente turno.",
    { rollAttribute: "fuerte", damageFormula: "1d4" }
  ),
  capabilityAction(
    "maestro-lucha",
    "Contraatacar con Lucha (Maestro)",
    "reaction",
    "Puedes lanzar al enemigo con una tirada de [Ágil←Fuerte] sin necesitar Defensa previa. Si aciertas, recibe 1D6 ignorando armadura, queda boca arriba, pierde sus acciones activas del siguiente turno y tú ganas un ataque gratuito inmediato.",
    { rollAttribute: "agil", damageFormula: "1d6" }
  )
];

const PIROTECNIA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-pirotecnia",
    "Usar polvo cegador (Principiante)",
    "combat",
    "Haz una tirada de [Diestro←Ágil] para deslumbrar a un oponente en cuerpo a cuerpo. Si impactas, causas 1D4 de daño ignorando armadura y lo dejas cegado durante 1D4 turnos.",
    { rollAttribute: "diestro", damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-pirotecnia",
    "Lanzar bomba de humo (Adepto)",
    "combat",
    "Llena un área de humo denso y ciega a todos los que estén dentro hasta que salgan. Quien permanezca en la nube debe superar una prueba de Fuerte cada turno o sufrir 1D4 de daño ignorando armadura.",
    { rollAttribute: "diestro", damageFormula: "1d4" }
  ),
  capabilityAction(
    "maestro-pirotecnia",
    "Lanzar granada de trueno (Maestro)",
    "combat",
    "Haz una tirada de [Diestro←Ágil] contra todos los objetivos en un radio de cinco metros: sufren 1D12 de daño ignorando armadura con efecto completo, o la mitad si resisten. Quienes sufran el efecto completo quedan cegados 1D4 turnos.",
    { rollAttribute: "diestro", damageFormula: "1d12" }
  )
];

const PUNO_DE_FLECHA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-puno-de-flecha",
    "Usar Puño de flecha (Principiante)",
    "reaction",
    "Responde a un ataque cuerpo a cuerpo clavando una flecha o virote al rival con una tirada de ataque normal. Si impactas, causas 1D6 y aplicas las cualidades del proyectil.",
    { damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-puno-de-flecha",
    "Usar Puño de flecha (Adepto)",
    "reaction",
    "Como a nivel principiante, pero el impacto con la flecha o virote causa 1D8 de daño.",
    { damageFormula: "1d8" }
  ),
  capabilityAction(
    "maestro-puno-de-flecha",
    "Usar Puño de flecha (Maestro)",
    "reaction",
    "Como a nivel adepto, y si impactas puedes hacer inmediatamente un ataque gratuito con el arco contra el mismo objetivo.",
    { damageFormula: "1d8" }
  )
];

const RECUPERACION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-recuperacion",
    "Usar Recuperación (Principiante)",
    "combat",
    "Supera una tirada de Tenaz para recuperar 1D4 de Resistencia. Solo puedes tener un éxito por día.",
    { rollAttribute: "tenaz", damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-recuperacion",
    "Usar Recuperación (Adepto)",
    "combat",
    "Supera una tirada de Tenaz para recuperar 1D6 de Resistencia. Solo puedes tener un éxito por día.",
    { rollAttribute: "tenaz", damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-recuperacion",
    "Usar Recuperación (Maestro)",
    "combat",
    "Supera una tirada de Tenaz para recuperar 1D8 de Resistencia. Solo puedes tener un éxito por día.",
    { rollAttribute: "tenaz", damageFormula: "1d8" }
  )
];

const VIENTO_DE_ACERO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-viento-de-acero",
    "Usar Viento de acero (Adepto)",
    "combat",
    "Lanza dos armas arrojadizas con una sola acción. Los ataques se resuelven por separado y pueden ir al mismo enemigo o a dos distintos. También puedes lanzar un arma de cuerpo a cuerpo, pero solo una por acción."
  ),
  capabilityAction(
    "maestro-viento-de-acero",
    "Usar Viento de acero (Maestro)",
    "combat",
    "Realiza un ataque devastador lanzando hasta tres armas arrojadizas con una sola acción, contra uno o varios objetivos. También puedes lanzar un arma de cuerpo a cuerpo, pero solo una por acción."
  )
];

const ACROBATA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-acrobata",
    "Usar Acróbata (Principiante)",
    "combat",
    "Supera una tirada de Ágil para evitar los ataques gratuitos provocados al retirarte de un combate cuerpo a cuerpo o al pasar junto a un enemigo.",
    { rollAttribute: "agil" }
  ),
  capabilityAction(
    "adepto-acrobata",
    "Levantarse de un salto (Adepto)",
    "free",
    "Si estás derribado, puedes usar una acción gratuita para levantarte con una tirada de Ágil. Si fallas, necesitas una acción de movimiento normal.",
    { rollAttribute: "agil" }
  ),
  capabilityAction(
    "maestro-acrobata",
    "Usar Acróbata (Maestro)",
    "combat",
    "Una vez por turno, cuando luchas contra más de un oponente, puedes usar a uno de ellos como escudo para que reciba en su lugar un ataque exitoso. Debes superar una tirada de Ágil y el enemigo no puede defenderse.",
    { rollAttribute: "agil" }
  )
];

const ARMAS_DE_ASTA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-armas-de-asta",
    "Interceptar con Armas de asta (Adepto)",
    "reaction",
    "Obtienes un ataque gratuito contra cada enemigo que entre a distancia de cuerpo a cuerpo contigo, salvo si también empuña un arma Larga."
  ),
  capabilityAction(
    "maestro-armas-de-asta",
    "Mantener a raya con Armas de asta (Maestro)",
    "reaction",
    "Cuando usas el ataque gratuito de Armas de asta y aciertas, puedes impedir que el enemigo se acerque lo suficiente para golpearte con armas cuerpo a cuerpo."
  )
];

const ARMAS_DE_PRESA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-armas-de-presa",
    "Usar Armas de presa (Principiante)",
    "combat",
    "Al atacar con un arma con la cualidad Presa, ganas una segunda oportunidad para inmovilizar al objetivo."
  ),
  capabilityAction(
    "adepto-armas-de-presa",
    "Usar Armas de presa (Adepto)",
    "combat",
    "Al atacar con un arma con la cualidad Presa, ganas una segunda oportunidad para inmovilizar y para derribar a un oponente inmovilizado."
  ),
  capabilityAction(
    "maestro-armas-de-presa",
    "Estrangular con Armas de presa (Maestro)",
    "reaction",
    "Tus ataques con armas de presa se consideran golpes al cuello: además de inmovilizar y poder derribar, infligen 1D6 de daño por turno ignorando armadura.",
    { damageFormula: "1d6" }
  )
];

const CAPA_DANZANTE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-capa-danzante",
    "Usar Capa danzante (Adepto)",
    "combat",
    "Si aciertas una tirada de ataque, la capa golpea los ojos del objetivo, lo ciega temporalmente y te concede un ataque gratuito inmediato contra él."
  ),
  capabilityAction(
    "maestro-capa-danzante",
    "Usar Capa danzante (Maestro)",
    "combat",
    "Usa la capa como un látigo con la cualidad Presa para atrapar al objetivo."
  )
];

const COMBATE_CON_ARMA_LARGA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-combate-con-arma-larga",
    "Usar Combate con arma larga (Adepto)",
    "reaction",
    "Si el oponente se defiende del ataque inicial, puedes hacer un ataque gratuito con la parte trasera del arma Larga que causa 1D6. Con vara o báculo rúnico también puedes contraatacar tras una Defensa exitosa.",
    { damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-combate-con-arma-larga",
    "Usar Combate con arma larga (Maestro)",
    "combat",
    "Haz un ataque que, si superas [Diestro←Ágil], derriba al oponente. Después obtienes un ataque gratuito con Ventaja contra ese enemigo.",
    { rollAttribute: "diestro" }
  )
];

const COMBATE_CON_ARMADURA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "maestro-combate-con-armadura",
    "Usar Combate con armadura (Maestro)",
    "reaction",
    "Haz una tirada de Ágil para contrarrestar efectos que reduzcan o ignoren tu armadura; si tienes éxito, tu armadura protege con todo su valor.",
    { rollAttribute: "agil" }
  )
];

const COMBATE_CON_ARMAS_DE_CADENA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-combate-con-armas-de-cadena",
    "Usar Combate con armas de cadena (Adepto)",
    "combat",
    "El golpe secundario de tu arma de cadena causa 1D8 de daño en lugar de 1D6.",
    { damageFormula: "1d8" }
  ),
  capabilityAction(
    "maestro-combate-con-armas-de-cadena",
    "Usar Combate con armas de cadena (Maestro)",
    "combat",
    "Después de golpear al objetivo, puedes seguir atacando a todos los oponentes dentro de tu alcance cuerpo a cuerpo. Cada ataque se resuelve por separado."
  )
];

const COMBATE_SANGRIENTO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-combate-sangriento",
    "Usar Combate sangriento (Principiante)",
    "reaction",
    "Cuando tu Resistencia cae hasta la mitad, obtienes una segunda oportunidad en todas tus tiradas de ataque cuerpo a cuerpo."
  ),
  capabilityAction(
    "adepto-combate-sangriento",
    "Usar Combate sangriento (Adepto)",
    "reaction",
    "Mientras tu Resistencia esté reducida a más de la mitad, todos tus ataques cuerpo a cuerpo causan +1D8 de daño adicional.",
    { damageFormula: "+1d8" }
  ),
  capabilityAction(
    "maestro-combate-sangriento",
    "Usar Combate sangriento (Maestro)",
    "reaction",
    "La mitad del daño que causes en combate cuerpo a cuerpo se suma a tu Resistencia, redondeando hacia abajo."
  )
];

const DANZA_DE_BATALLA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-danza-de-batalla",
    "Usar Danza de batalla (Principiante)",
    "reaction",
    "Divide tu acción de movimiento para hacer una parte antes de la acción de combate y otra después."
  ),
  capabilityAction(
    "adepto-danza-de-batalla",
    "Usar Danza de batalla (Adepto)",
    "reaction",
    "Como parte de tu acción de combate puedes cambiar libremente de armas una o más veces mientras ejecutas tu secuencia de movimiento y ataque."
  ),
  capabilityAction(
    "maestro-danza-de-batalla",
    "Usar Danza de batalla (Maestro)",
    "reaction",
    "Ganas una segunda oportunidad en las Defensas contra ataques gratuitos al retirarte de cuerpo a cuerpo y cada uno de esos ataques dirigidos contra ti te concede un contraataque gratuito."
  )
];

const DISPARO_MAGISTRAL_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-disparo-magistral",
    "Usar Disparo magistral (Principiante)",
    "combat",
    "Invierte turno completo en apuntar para desarmar, clavar o cegar al objetivo. Si impactas e infliges daño, además aplica el efecto elegido y el objetivo pierde una acción de combate.",
    { rollAttribute: "diestro" }
  ),
  capabilityAction(
    "adepto-disparo-magistral",
    "Usar Disparo magistral (Adepto)",
    "combat",
    "Haz un disparo que rebota para alcanzar a un objetivo a cubierto sin línea de visión libre, siempre que sepas dónde está y no haya usado doble movimiento.",
    { rollAttribute: "diestro" }
  ),
  capabilityAction(
    "maestro-disparo-magistral",
    "Parar disparo con Disparo magistral (Maestro)",
    "reaction",
    "Una vez por turno, supera [Diestro←Ágil] para desviar un ataque cuerpo a cuerpo contra un aliado o un proyectil físico dirigido a ti o a un aliado.",
    { rollAttribute: "diestro" }
  )
];

const GOLPE_BAJO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-golpe-bajo",
    "Usar Golpe bajo (Principiante)",
    "combat",
    "Haz un golpe bajo que causa 1D6 de daño y, si hiere al oponente, te concede un ataque gratuito contra él.",
    { damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-golpe-bajo",
    "Usar Golpe bajo (Adepto)",
    "reaction",
    "Después de causar daño con un ataque cuerpo a cuerpo, supera [Inteligente←Ágil] para derribar al oponente con una zancadilla o un placaje.",
    { rollAttribute: "inteligente" }
  ),
  capabilityAction(
    "maestro-golpe-bajo",
    "Contraatacar con Golpe bajo (Maestro)",
    "reaction",
    "Tras cada ataque cuerpo a cuerpo de un oponente contra ti, puedes hacer un contraataque que causa 1D6 e ignora la armadura si impacta.",
    { damageFormula: "1d6" }
  )
];

const GUARDAESPALDAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-guardaespaldas",
    "Usar Guardaespaldas (Principiante)",
    "reaction",
    "Supera una tirada de Tenaz para recibir tú un golpe dirigido contra un aliado. No puedes defenderte de ese ataque.",
    { rollAttribute: "tenaz" }
  ),
  capabilityAction(
    "adepto-guardaespaldas",
    "Usar Guardaespaldas (Adepto)",
    "reaction",
    "Puedes redirigir y defenderte de todos los ataques dirigidos contra la persona a la que estás protegiendo."
  ),
  capabilityAction(
    "maestro-guardaespaldas",
    "Usar Guardaespaldas (Maestro)",
    "reaction",
    "Además de redirigir y defenderte de todos los ataques dirigidos contra tu protegido, obtienes un ataque gratuito contra cualquiera que intente atacarlo en cuerpo a cuerpo."
  )
];

const JINETE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-jinete",
    "Cargar con Jinete (Principiante)",
    "reaction",
    "Si tu montura se mueve antes de atacar, puedes causar +1D6 de daño adicional en un ataque cuerpo a cuerpo.",
    { damageFormula: "+1d6" }
  ),
  capabilityAction(
    "adepto-jinete",
    "Atacar al galope (Adepto)",
    "combat",
    "Puedes usar parte de la acción de movimiento antes del ataque y el resto después, sin quedar trabado en combate."
  ),
  capabilityAction(
    "maestro-jinete",
    "Cargar con Jinete (Maestro)",
    "reaction",
    "Si tu montura se mueve antes de atacar, puedes causar +1D10 de daño adicional en un ataque cuerpo a cuerpo.",
    { damageFormula: "+1d10" }
  )
];

const LIDER_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-lider",
    "Marcar objetivo prioritario (Adepto)",
    "combat",
    "Señala una criatura u objeto como objetivo prioritario para tus aliados durante toda una escena. Los aliados que lo ataquen causan +1D4 de daño adicional.",
    { damageFormula: "+1d4" }
  ),
  capabilityAction(
    "maestro-lider",
    "Inspirar aliados (Maestro)",
    "combat",
    "Da un discurso que permite a tus aliados sustituir su Tenaz por tu Persuasivo durante toda una escena.",
    { rollAttribute: "persuasivo" }
  )
];

const MEDICUS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-medicus",
    "Usar Medicus (Principiante)",
    "combat",
    "Haz una tirada de Inteligente para curar 1D4 de Resistencia a un objetivo, o 1D6 si usas hierbas curativas. Solo una vez al día por paciente.",
    { rollAttribute: "inteligente", damageFormula: "1d4" }
  ),
  capabilityAction(
    "adepto-medicus",
    "Usar Medicus (Adepto)",
    "combat",
    "Haz una tirada de Inteligente para curar 1D6 de Resistencia a un objetivo, o 1D8 si usas hierbas curativas. Solo una vez al día por paciente.",
    { rollAttribute: "inteligente", damageFormula: "1d6" }
  ),
  capabilityAction(
    "maestro-medicus",
    "Usar Medicus (Maestro)",
    "combat",
    "Haz una tirada de Inteligente para curar 1D8 de Resistencia a un objetivo, o 1D10 si usas hierbas curativas. Si fallas, aún curas 1D4 o 1D6 con hierbas. Solo una vez al día por paciente.",
    { rollAttribute: "inteligente", damageFormula: "1d8" }
  )
];

const OPORTUNISTA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-oportunista",
    "Usar Oportunista (Principiante)",
    "reaction",
    "Obtienes una segunda oportunidad para acertar ataques gratuitos contra un oponente que se retira del combate cuerpo a cuerpo."
  ),
  capabilityAction(
    "adepto-oportunista",
    "Usar Oportunista (Adepto)",
    "reaction",
    "Puedes aplicar habilidades activas a los ataques gratuitos contra un oponente que se retira del combate cuerpo a cuerpo, perdiendo la segunda oportunidad del nivel principiante."
  ),
  capabilityAction(
    "maestro-oportunista",
    "Usar Oportunista (Maestro)",
    "reaction",
    "Cuando un oponente se retira del combate cuerpo a cuerpo, obtienes una segunda oportunidad para acertar y además puedes usar habilidades activas en ese ataque gratuito."
  )
];

const REFLEJOS_RAPIDOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-reflejos-rapidos",
    "Usar Reflejos rápidos (Principiante)",
    "reaction",
    "Frente a efectos de área o similares que infligen daño completo o mitad, pasas a sufrir mitad o ningún daño respectivamente."
  ),
  capabilityAction(
    "adepto-reflejos-rapidos",
    "Usar Reflejos rápidos (Adepto)",
    "reaction",
    "Tras una Defensa exitosa contra un ataque cuerpo a cuerpo, puedes intercambiar tu posición con la del oponente."
  )
];

const TRAMPERO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-trampero",
    "Usar Trampero (Principiante)",
    "combat",
    "Haz una tirada de Inteligente para desplegar o desarmar una trampa mecánica. También puedes construir una trampa improvisada que causa 1D6 de daño.",
    { rollAttribute: "inteligente", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-trampero",
    "Usar Trampero (Adepto)",
    "combat",
    "Haz una tirada de Inteligente para usar minas alquímicas igual que trampas mecánicas. Una trampa improvisada de adepto causa 1D8 de daño.",
    { rollAttribute: "inteligente", damageFormula: "1d8" }
  ),
  capabilityAction(
    "maestro-trampero",
    "Usar Trampero (Maestro)",
    "combat",
    "Tus trampas y minas suben un nivel, obtienen segundas oportunidades relevantes y una trampa improvisada de maestro causa 1D10 de daño.",
    { damageFormula: "1d10" }
  )
];

const VENENOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-venenos",
    "Aplicar veneno (Principiante)",
    "free",
    "Aplica una dosis de veneno a un arma para un solo golpe. La víctima queda envenenada si superas [Inteligente←Fuerte].",
    { rollAttribute: "inteligente" }
  ),
  capabilityAction(
    "adepto-venenos",
    "Aplicar veneno (Adepto)",
    "free",
    "Aplica una dosis de veneno que dura toda la escena de combate: todos tus ataques cuentan como venenosos."
  ),
  capabilityAction(
    "maestro-venenos",
    "Aplicar veneno (Maestro)",
    "free",
    "Supera una tirada de Inteligente para aumentar en un nivel la potencia del veneno aplicado; además puedes repetir una vez la tirada de [Inteligente←Fuerte] con veneno potente.",
    { rollAttribute: "inteligente" }
  )
];

const VERSADO_EN_CRIATURAS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-versado-en-criaturas",
    "Analizar criatura (Principiante)",
    "free",
    "Haz una tirada de Inteligente para reconocer o recordar puntos débiles y fuertes de un monstruo.",
    { rollAttribute: "inteligente" }
  ),
  capabilityAction(
    "adepto-versado-en-criaturas",
    "Explotar debilidad conocida (Adepto)",
    "free",
    "Contra el subtipo elegido, tus ataques y los de aliados instruidos causan +1D4 de daño adicional.",
    { damageFormula: "+1d4" }
  ),
  capabilityAction(
    "maestro-versado-en-criaturas",
    "Explotar debilidad conocida (Maestro)",
    "free",
    "Contra el subtipo elegido, tus ataques y los de aliados instruidos causan +1D6 de daño adicional.",
    { damageFormula: "+1d6" }
  )
];

const CANALIZACION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-canalizacion",
    "Usar Canalización (Principiante)",
    "reaction",
    "Recibe sobre ti la corrupción temporal que iba a sufrir otra criatura a la vista."
  ),
  capabilityAction(
    "adepto-canalizacion",
    "Usar Canalización (Adepto)",
    "reaction",
    "Cuando hagas una tirada por corrupción, o al recibir corrupción por otra persona, tienes una segunda oportunidad y eliges el resultado más favorable."
  ),
  capabilityAction(
    "maestro-canalizacion",
    "Usar Canalización (Maestro)",
    "reaction",
    "Supera [Tenaz←Tenaz] para transferir a un objetivo a la vista la corrupción que acabas de sufrir. Si fallas, solo recibes la mitad y el resto se disipa en el entorno.",
    { rollAttribute: "tenaz" }
  )
];

const DOMINACION_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-dominacion",
    "Usar Dominación (Adepto)",
    "free",
    "Supera [Persuasivo←Tenaz] para obligar a un enemigo trabado contigo a dudar y no atacarte durante este turno; si puede, atacará a otro objetivo.",
    { rollAttribute: "persuasivo" }
  ),
  capabilityAction(
    "maestro-dominacion",
    "Usar Dominación (Maestro)",
    "combat",
    "Supera [Persuasivo←Tenaz] contra un enemigo ya herido por ti o por un aliado para forzarlo a detenerse, rendirse o huir si tiene escapatoria.",
    { rollAttribute: "persuasivo" }
  )
];

const ESGRIMA_SAGRADA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-esgrima-sagrada",
    "Contraatacar con Esgrima sagrada (Adepto)",
    "reaction",
    "Después de una Defensa exitosa, obtienes un ataque gratuito inmediato con tu espada Precisa."
  ),
  capabilityAction(
    "maestro-esgrima-sagrada",
    "Contraatacar con Esgrima sagrada (Maestro)",
    "reaction",
    "Obtienes un ataque gratuito por cada Defensa exitosa, sin límite por turno, con el aumento pasivo de daño propio de la maestría."
  )
];

const ESPIRITU_COMBATIVO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "adepto-espiritu-combativo",
    "Activar Espíritu combativo (Adepto)",
    "reaction",
    "Cuando tu Resistencia cae hasta la mitad, ganas repetición en todas tus tiradas contra Fuerte, incluidos los ataques que usen Fuerte.",
    { rollAttribute: "fuerte" }
  ),
  capabilityAction(
    "maestro-espiritu-combativo",
    "Activar Espíritu combativo (Maestro)",
    "reaction",
    "Mientras tu Resistencia esté a la mitad o menos, mantienes las repeticiones de Adepto y además infliges +1D4 de daño cuerpo a cuerpo.",
    { rollAttribute: "fuerte", damageFormula: "+1d4" }
  )
];

const ESTRANGULADOR_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-estrangulador",
    "Usar Estrangulador (Principiante)",
    "combat",
    "Si tienes Ventaja, realiza un ataque que, si impacta, causa 1D6 por turno ignorando armadura e inmoviliza al objetivo hasta que falles la presa.",
    { damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-estrangulador",
    "Lanzar esporas asfixiantes (Adepto)",
    "combat",
    "Supera [Inteligente←Ágil] para cubrir a un enemigo con esporas que le causan 1D4 por turno ignorando armadura durante 1D4 turnos.",
    { rollAttribute: "inteligente", damageFormula: "1d4" }
  ),
  capabilityAction(
    "maestro-estrangulador",
    "Lanzar bomba de esporas (Maestro)",
    "combat",
    "Haz una tirada de Inteligente para colocar una nube de esporas en un área pequeña; todos los afectados sufren 1D4 por turno ignorando armadura durante 1D4 turnos.",
    { rollAttribute: "inteligente", damageFormula: "1d4" }
  )
];

const EXPERTO_EN_ASEDIOS_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-experto-en-asedios",
    "Usar arma de asedio o granada (Principiante)",
    "combat",
    "Maneja balistas y granadas alquímicas de forma segura, sin riesgo de detonación accidental."
  ),
  capabilityAction(
    "adepto-experto-en-asedios",
    "Desplegar recurso de asedio (Adepto)",
    "combat",
    "Emplea o coordina catapultas, fundíbulos, bombas de humo, ollas de explosión o tubos de fuego alquímico."
  ),
  capabilityAction(
    "maestro-experto-en-asedios",
    "Disparar arma alquímica mejorada (Maestro)",
    "combat",
    "Todas tus armas alquímicas cuentan como Gigantescas si aún no lo eran."
  )
];

const MANO_VELOZ_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-mano-veloz",
    "Usar Mano veloz (Principiante)",
    "free",
    "Supera una tirada de Ágil para desenvainar y empuñar un arma, o para recargar una ballesta, como acción gratuita.",
    { rollAttribute: "agil" }
  ),
  capabilityAction(
    "adepto-mano-veloz",
    "Cambiar armas con Mano veloz (Adepto)",
    "free",
    "Supera una tirada de Ágil para envainar un arma y sacar otra como una única acción gratuita.",
    { rollAttribute: "agil" }
  ),
  capabilityAction(
    "maestro-mano-veloz",
    "Consumir elixir con Mano veloz (Maestro)",
    "free",
    "Supera una tirada de Ágil para consumir un elixir, o ayudar a otro a hacerlo, como acción gratuita.",
    { rollAttribute: "agil" }
  )
];

const MARTILLO_ARIETE_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-martillo-ariete",
    "Usar Martillo ariete (Principiante)",
    "reaction",
    "Si un escudo desvía tu ataque de martillo, supera [Fuerte←Ágil] para romper un escudo de madera o arrancar uno metálico, causando además 1D6 al portador.",
    { rollAttribute: "fuerte", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-martillo-ariete",
    "Embestir con Martillo ariete (Adepto)",
    "reaction",
    "Cuando un enemigo se defiende con éxito de tu ataque de martillo, supera [Fuerte←Fuerte] para empujarlo atrás y ganar un ataque gratuito.",
    { rollAttribute: "fuerte" }
  ),
  capabilityAction(
    "maestro-martillo-ariete",
    "Usar Martillo ariete (Maestro)",
    "combat",
    "Realiza dos ataques de martillo contra el mismo objetivo en una sola acción; si se defiende de alguno, puedes aplicar la embestida de Adepto una vez por turno."
  )
];

const MAESTRO_DEL_HACHA_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-maestro-del-hacha",
    "Usar Maestro del hacha (Principiante)",
    "combat",
    "Golpea con el extremo corto del hacha para causar 1D6 de daño y, si superas [Diestro←Tenaz], aturdir al objetivo y ganar un ataque gratuito inmediato.",
    { rollAttribute: "diestro", damageFormula: "1d6" }
  ),
  capabilityAction(
    "adepto-maestro-del-hacha",
    "Usar Maestro del hacha (Adepto)",
    "combat",
    "Realiza dos ataques con hacha en una sola acción de combate, ambos con un nivel de dado inferior al normal.",
    { damageFormula: "reducido/reducido" }
  ),
  capabilityAction(
    "maestro-maestro-del-hacha",
    "Usar Maestro del hacha (Maestro)",
    "combat",
    "Cada golpe de hacha causa +1D4 de daño, pero quedas limitado a un golpe por acción de combate.",
    { damageFormula: "+1d4" }
  )
];

const OJO_MISTICO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-ojo-mistico",
    "Usar Ojo místico (Principiante)",
    "free",
    "Supera [Atento←Discreto] para ver la Sombra dominante de una criatura, lugar u objeto. Cada intento te causa 1D4 de corrupción temporal.",
    { rollAttribute: "atento" }
  ),
  capabilityAction(
    "adepto-ojo-mistico",
    "Usar Ojo místico (Adepto)",
    "free",
    "Supera [Atento←Discreto] para ver todas las Sombras de un objetivo. Cada intento te causa 1D6 de corrupción temporal.",
    { rollAttribute: "atento" }
  ),
  capabilityAction(
    "maestro-ojo-mistico",
    "Usar Ojo místico (Maestro)",
    "free",
    "Supera [Atento←Discreto] para ver todas las Sombras y su potencia. Cada intento te causa 1D8 de corrupción temporal.",
    { rollAttribute: "atento" }
  )
];

const SIMBOLISMO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-simbolismo",
    "Activar símbolo preparado (Principiante)",
    "combat",
    "Activa un símbolo preparado a la vista o en contacto pronunciando su frase de activación."
  ),
  capabilityAction(
    "adepto-simbolismo",
    "Activar símbolo preparado (Adepto)",
    "free",
    "Activa un símbolo permanente o temporal como acción gratuita. Solo puedes activar un símbolo por turno; también puedes borrar uno de tus símbolos con un gesto."
  ),
  capabilityAction(
    "maestro-simbolismo",
    "Crear y activar runa (Maestro)",
    "combat",
    "Creas runas llameantes en el aire y las activas como parte de la misma acción de combate."
  )
];

const TATUAJE_RUNICO_ACTIONS: SymbaroumCapabilityAction[] = [
  capabilityAction(
    "principiante-tatuaje-runico",
    "Activar Tatuaje rúnico (Principiante)",
    "reaction",
    "Activa la runa antes de tirar protección para obtener +1D4 a la armadura contra ese ataque, al coste de 1 punto de corrupción temporal.",
    { damageFormula: "+1d4" }
  ),
  capabilityAction(
    "adepto-tatuaje-runico",
    "Regenerar con Tatuaje rúnico (Adepto)",
    "free",
    "Regenera 1 punto de Resistencia por turno al coste de 1 punto de corrupción temporal por cada punto curado."
  ),
  capabilityAction(
    "maestro-tatuaje-runico",
    "Potenciar arma con Tatuaje rúnico (Maestro)",
    "reaction",
    "Cuando golpeas a un oponente, puedes hacer que tu arma inflija +1D4 de daño al coste de tantos puntos de corrupción temporal como el resultado del dado.",
    { damageFormula: "+1d4" }
  )
];

function resolveAbilityActions(nombre: string, resumen: string): SymbaroumCapabilityAction[] {
  switch (nombre) {
    case "Acróbata":
      return ACROBATA_ACTIONS;
    case "Arco veloz":
      return ARCO_VELOZ_ACTIONS;
    case "Armas de asta":
      return ARMAS_DE_ASTA_ACTIONS;
    case "Armas de presa":
      return ARMAS_DE_PRESA_ACTIONS;
    case "Armas a dos manos":
      return ARMAS_A_DOS_MANOS_ACTIONS;
    case "Ataque con dos armas":
      return ATAQUE_CON_DOS_ARMAS_ACTIONS;
    case "Ataque traicionero":
      return ATAQUE_TRAICIONERO_ACTIONS;
    case "Berserker":
      return BERSERKER_ACTIONS;
    case "Capa danzante":
      return CAPA_DANZANTE_ACTIONS;
    case "Combate con arma larga":
      return COMBATE_CON_ARMA_LARGA_ACTIONS;
    case "Combate con armadura":
      return COMBATE_CON_ARMADURA_ACTIONS;
    case "Combate con armas de cadena":
      return COMBATE_CON_ARMAS_DE_CADENA_ACTIONS;
    case "Combate con escudo":
      return COMBATE_CON_ESCUDO_ACTIONS;
    case "Combate sangriento":
      return COMBATE_SANGRIENTO_ACTIONS;
    case "Combate sin armas":
      return COMBATE_SIN_ARMAS_ACTIONS;
    case "Cuchillo rápido":
      return CUCHILLO_RAPIDO_ACTIONS;
    case "Danza de batalla":
      return DANZA_DE_BATALLA_ACTIONS;
    case "Disparo magistral":
      return DISPARO_MAGISTRAL_ACTIONS;
    case "Finta":
      return FINTA_ACTIONS;
    case "Golpe bajo":
      return GOLPE_BAJO_ACTIONS;
    case "Golpe de hierro":
      return GOLPE_DE_HIERRO_ACTIONS;
    case "Guardaespaldas":
      return GUARDAESPALDAS_ACTIONS;
    case "Instinto de cazador":
      return INSTINTO_DE_CAZADOR_ACTIONS;
    case "Jinete":
      return JINETE_ACTIONS;
    case "Líder":
      return LIDER_ACTIONS;
    case "Lucha":
      return LUCHA_ACTIONS;
    case "Medicus":
      return MEDICUS_ACTIONS;
    case "Oportunista":
      return OPORTUNISTA_ACTIONS;
    case "Pirotecnia":
      return PIROTECNIA_ACTIONS;
    case "Puño de flecha":
      return PUNO_DE_FLECHA_ACTIONS;
    case "Recuperación":
      return RECUPERACION_ACTIONS;
    case "Reflejos rápidos":
      return REFLEJOS_RAPIDOS_ACTIONS;
    case "Tirador":
      return TIRADOR_ACTIONS;
    case "Trampero":
      return TRAMPERO_ACTIONS;
    case "Venenos":
      return VENENOS_ACTIONS;
    case "Versado en criaturas":
      return VERSADO_EN_CRIATURAS_ACTIONS;
    case "Viento de acero":
      return VIENTO_DE_ACERO_ACTIONS;
    case "Alquimista":
    case "Atributo excepcional":
    case "Brujería":
    case "Canto Troll":
    case "Elaboración de artefactos":
    case "Estudioso":
    case "Hechicería":
    case "Herrero":
    case "Inquebrantable":
    case "Magia":
    case "Magia del báculo":
    case "Místico acorazado":
    case "Sexto sentido":
    case "Táctico":
    case "Talento místico superior":
    case "Teúrgia":
      return [];
    case "Canalización":
      return CANALIZACION_ACTIONS;
    case "Dominación":
      return DOMINACION_ACTIONS;
    case "Esgrima sagrada":
      return ESGRIMA_SAGRADA_ACTIONS;
    case "Espíritu combativo":
      return ESPIRITU_COMBATIVO_ACTIONS;
    case "Estrangulador":
      return ESTRANGULADOR_ACTIONS;
    case "Experto en asedios":
      return EXPERTO_EN_ASEDIOS_ACTIONS;
    case "Mano veloz":
      return MANO_VELOZ_ACTIONS;
    case "Martillo ariete":
      return MARTILLO_ARIETE_ACTIONS;
    case "Maestro del hacha":
      return MAESTRO_DEL_HACHA_ACTIONS;
    case "Ojo místico":
      return OJO_MISTICO_ACTIONS;
    case "Simbolismo":
      return SIMBOLISMO_ACTIONS;
    case "Tatuaje rúnico":
      return TATUAJE_RUNICO_ACTIONS;
    default:
      return inferCapabilityActions("habilidad", nombre, resumen);
  }
}

export const SYMBAROUM_ABILITIES: SymbaroumCapability[] = [
  makeCapability("habilidad", "Acróbata", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Alquimista", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Arco veloz", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Armas a dos manos", LIBRO_BASICO, 113, [], undefined, ARMAS_A_DOS_MANOS_ACTIONS),
  makeCapability("habilidad", "Armas de asta", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Armas de presa", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Ataque con dos armas", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Ataque traicionero", LIBRO_BASICO, 114, [], undefined, ATAQUE_TRAICIONERO_ACTIONS),
  makeCapability("habilidad", "Atributo excepcional", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Berserker", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Brujería", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Canalización", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Canto Troll", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Capa danzante", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Combate con arma larga", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Combate con armadura", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Combate con armas de cadena", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Combate con escudo", LIBRO_BASICO, 115, [], undefined, COMBATE_CON_ESCUDO_ACTIONS),
  makeCapability("habilidad", "Combate sangriento", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Combate sin armas", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Cuchillo rápido", GUIA_AVANZADA, 66),
  makeCapability("habilidad", "Danza de batalla", GUIA_AVANZADA, 66),
  makeCapability("habilidad", "Disparo magistral", GUIA_AVANZADA, 66),
  makeCapability("habilidad", "Dominación", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Elaboración de artefactos", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Esgrima sagrada", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Espíritu combativo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Estrangulador", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Estudioso", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Experto en asedios", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Finta", LIBRO_BASICO, 116, [], undefined, FINTA_ACTIONS),
  makeCapability("habilidad", "Golpe bajo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Golpe de hierro", LIBRO_BASICO, 116, [], undefined, GOLPE_DE_HIERRO_ACTIONS),
  makeCapability("habilidad", "Guardaespaldas", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Hechicería", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Herrero", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Inquebrantable", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Instinto de cazador", GUIA_AVANZADA, 67, [], undefined, INSTINTO_DE_CAZADOR_ACTIONS),
  makeCapability("habilidad", "Jinete", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Líder", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Lucha", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Magia", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Magia del báculo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Mano veloz", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Martillo ariete", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Maestro del hacha", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Medicus", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Místico acorazado", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Ojo místico", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Oportunista", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Pirotecnia", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Puño de flecha", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Recuperación", LIBRO_BASICO, 116),
  makeCapability(
    "habilidad",
    "Recio",
    "Códice de monstruos",
    1,
    [],
    "Principiante: tu Robustez se calcula como Fuerte x1,5. Adepto: tu Robustez se calcula como Fuerte x2. Maestro: tu Robustez se calcula como Fuerte x3. Ref: Códice de monstruos, p.1."
  ),
  makeCapability("habilidad", "Reflejos rápidos", GUIA_AVANZADA, 67),
  makeCapability(
    "habilidad",
    "Robusto",
    "Códice de monstruos",
    1,
    [],
    "Principiante: tu Defensa se reduce en 2 y una vez por turno puedes añadir +1D4 al daño de un ataque cuerpo a cuerpo. Adepto: tu Defensa se reduce en 3 y el bono pasa a +1D6. Maestro: tu Defensa se reduce en 4 y el bono pasa a +1D8. Ref: Códice de monstruos, p.1."
  ),
  makeCapability("habilidad", "Sexto sentido", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Simbolismo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Táctico", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Talento místico superior", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Tatuaje rúnico", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Teúrgia", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Tirador", LIBRO_BASICO, 116, [], undefined, TIRADOR_ACTIONS),
  makeCapability("habilidad", "Trampero", GUIA_AVANZADA, 67),
  makeCapability(
    "habilidad",
    "Arma natural",
    "Códice de monstruos",
    1,
    [],
    "Principiante: ganas un ataque de Arma natural que inflige 1D6. Adepto: el ataque de Arma natural inflige 1D8. Maestro: el ataque de Arma natural inflige 1D10. Ref: Códice de monstruos, p.1."
  ),
  makeCapability(
    "habilidad",
    "Duro",
    "Códice de monstruos",
    1,
    [],
    "Principiante: obtienes armadura natural 1D4. Adepto: obtienes armadura natural 1D6. Maestro: obtienes armadura natural 1D8. Ref: Códice de monstruos, p.1."
  ),
  makeCapability("habilidad", "Venenos", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Versado en criaturas", LIBRO_BASICO, 124),
  makeCapability("habilidad", "Viento de acero", LIBRO_BASICO, 116)
];

export const SYMBAROUM_MYSTIC_POWERS: SymbaroumCapability[] = [
  makeCapability("poder_mistico", "Aliento negro", GUIA_AVANZADA, 80, ["Hechicería"], undefined, ALIENTO_NEGRO_ACTIONS),
  makeCapability("poder_mistico", "Anatema", GUIA_AVANZADA, 81, ["Magia", "Magia del báculo", "Teúrgia"]),
  makeCapability("poder_mistico", "Arma danzante", GUIA_AVANZADA, 80, ["Magia del báculo", "Canto Troll"]),
  makeCapability("poder_mistico", "Aura impía", GUIA_AVANZADA, 81, ["Hechicería"]),
  makeCapability("poder_mistico", "Aura sagrada", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Báculo arrojadizo", GUIA_AVANZADA, 80, ["Magia del báculo"]),
  makeCapability("poder_mistico", "Cacería salvaje", GUIA_AVANZADA, 81, ["Nómadas de la sangre"]),
  makeCapability("poder_mistico", "Cambiaformas", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Cascada de azufre", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Confusión", GUIA_AVANZADA, 81, ["Magia", "Canto Troll"], undefined, CONFUSION_ACTIONS),
  makeCapability("poder_mistico", "Empuje mental", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Enredadera veloz", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Erupción de larvas", GUIA_AVANZADA, 81, ["Brujería", "Hechicería"]),
  makeCapability("poder_mistico", "Escudo bendito", GUIA_AVANZADA, 81, ["Teúrgia"], undefined, ESCUDO_BENDITO_ACTIONS),
  makeCapability("poder_mistico", "Esfera de protección", GUIA_AVANZADA, 80, ["Magia del báculo"]),
  makeCapability("poder_mistico", "Espíritu ígneo", GUIA_AVANZADA, 81, ["Piromantes"]),
  makeCapability("poder_mistico", "Espíritus atormentadores", GUIA_AVANZADA, 81, ["Espiritistas", "Nigromantes"]),
  makeCapability("poder_mistico", "Expulsar a los abismos", GUIA_AVANZADA, 81, ["Demonólogos"]),
  makeCapability("poder_mistico", "Forma espiritual", GUIA_AVANZADA, 81, ["Nigromantes"]),
  makeCapability("poder_mistico", "Forma verdadera", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Glifo vampírico", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Golpe espectral", GUIA_AVANZADA, 81, ["Hechicería"], undefined, GOLPE_ESPECTRAL_ACTIONS),
  makeCapability("poder_mistico", "Golpe psíquico", GUIA_AVANZADA, 81, ["Mentalistas"]),
  makeCapability("poder_mistico", "Herida compartida", GUIA_AVANZADA, 81, ["Brujería", "Teúrgia"]),
  makeCapability("poder_mistico", "Himno de batalla", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Himno debilitante", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Himno heroico", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Imagen especular", GUIA_AVANZADA, 81, ["Ilusionistas"]),
  makeCapability("poder_mistico", "Imperceptible", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Imposición de manos", GUIA_AVANZADA, 81, ["Brujería", "Teúrgia"], undefined, IMPOSICION_DE_MANOS_ACTIONS),
  makeCapability("poder_mistico", "Levitación", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Maldición", GUIA_AVANZADA, 81, ["Brujería", "Hechicería"]),
  makeCapability("poder_mistico", "Manantial de vida", GUIA_AVANZADA, 81, ["Confesores"]),
  makeCapability("poder_mistico", "Manto de espinas", GUIA_AVANZADA, 81, ["Tejedoras verdes"]),
  makeCapability("poder_mistico", "Martillo de monstruos", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Modificación ilusoria", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Muro de llamas", GUIA_AVANZADA, 81, ["Magia"], undefined, MURO_DE_LLAMAS_ACTIONS),
  makeCapability("poder_mistico", "Nube de venganza", GUIA_AVANZADA, 81, ["Hechicería", "Canto Troll"]),
  makeCapability("poder_mistico", "Prisma ardiente de Prios", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Purgatorio", GUIA_AVANZADA, 81, ["Inquisidores"]),
  makeCapability("poder_mistico", "Rayo negro", GUIA_AVANZADA, 81, ["Hechicería"], undefined, RAYO_NEGRO_ACTIONS),
  makeCapability("poder_mistico", "Refugio terrestre", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Runas de protección", GUIA_AVANZADA, 81, ["Magia del báculo", "Simbolismo"]),
  makeCapability("poder_mistico", "Sello de expulsión", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Símbolo cegador", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Someter voluntad", GUIA_AVANZADA, 81, ["Brujería", "Magia", "Hechicería"], undefined, SOMETER_VOLUNTAD_ACTIONS),
  makeCapability("poder_mistico", "Teletransportación", GUIA_AVANZADA, 81, ["Demonólogos"]),
  makeCapability("poder_mistico", "Tormenta de flechas", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Transformación regresiva", GUIA_AVANZADA, 81, ["Brujería"])
];

export const SYMBAROUM_RITUALS: SymbaroumCapability[] = [
  makeCapability("ritual", "Adivinación", GUIA_AVANZADA, 90, ["Brujería"]),
  makeCapability("ritual", "Adivinación nigromántica", GUIA_AVANZADA, 90, ["Espiritistas"]),
  makeCapability("ritual", "Alzar muertos vivientes", GUIA_AVANZADA, 90, ["Hechicería"]),
  makeCapability("ritual", "Cadenas de juicio", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Círculo de bruja", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Círculo mágico", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Clarividencia", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Compañero bestial", GUIA_AVANZADA, 90, ["Nómadas de la sangre"]),
  makeCapability("ritual", "Crecimiento acelerado", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Decretar confesión", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Esclavizar", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Escritura lejana", GUIA_AVANZADA, 90, ["Simbolismo"]),
  makeCapability("ritual", "Espíritu protector", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Exorcismo", GUIA_AVANZADA, 90, ["Teúrgia"]),
  makeCapability("ritual", "Expiación", GUIA_AVANZADA, 90, ["Confesores"]),
  makeCapability("ritual", "Familiar", GUIA_AVANZADA, 90, ["Brujería"]),
  makeCapability("ritual", "Fata morgana", GUIA_AVANZADA, 90, ["Ilusionistas"]),
  makeCapability("ritual", "Forma ilusoria", GUIA_AVANZADA, 90, ["Magia"]),
  makeCapability("ritual", "Fortaleza viviente", GUIA_AVANZADA, 91, ["Tejedoras verdes"]),
  makeCapability("ritual", "Fuego purificador", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Gemelos flamígeros", GUIA_AVANZADA, 91, ["Piromantes"]),
  makeCapability("ritual", "Grilletes rúnicos", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Guardián rúnico", GUIA_AVANZADA, 91, ["Simbolismo"]),
  makeCapability("ritual", "Humo sagrado", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Ilusión", GUIA_AVANZADA, 90, ["Magia"]),
  makeCapability("ritual", "Intercambiar sombra", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Interrogatorio mental", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Invocación", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Invocar demonio", GUIA_AVANZADA, 91, ["Demonólogos"]),
  makeCapability("ritual", "Manipulación atmosférica", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Mirada penetrante", GUIA_AVANZADA, 91, ["Inquisidores"]),
  makeCapability("ritual", "Moldear la carne", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Nana del bosque", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Nigromancia", GUIA_AVANZADA, 90, ["Brujería"]),
  makeCapability("ritual", "Oráculo", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Paisaje hipnótico", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Piedra de espíritu", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Posesión", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Préstamo animal", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Prisión espiritual", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Prolongar la vida", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Rastro herético", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Rastro invisible", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Recipiente vital", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Recuperar objeto", GUIA_AVANZADA, 91, ["Canto Troll"]),
  makeCapability("ritual", "Relato de cenizas", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Reparar", GUIA_AVANZADA, 91, ["Canto Troll"]),
  makeCapability("ritual", "Rito de bendición", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Rito de profanación", GUIA_AVANZADA, 91, ["Hechicería"]),
  makeCapability("ritual", "Rito de sellado/apertura", GUIA_AVANZADA, 91, ["Canto Troll"]),
  makeCapability("ritual", "Romper conexión", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Santuario", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Señor de la muerte", GUIA_AVANZADA, 91, ["Nigromantes"]),
  makeCapability("ritual", "Siervo demoníaco", GUIA_AVANZADA, 91, ["Demonólogos"]),
  makeCapability("ritual", "Siervo flamígero", GUIA_AVANZADA, 91, ["Magia"]),
  makeCapability("ritual", "Tatuar runa", GUIA_AVANZADA, 91, ["Simbolismo"]),
  makeCapability("ritual", "Terremoto", GUIA_AVANZADA, 91, ["Magos del báculo"]),
  makeCapability("ritual", "Terreno ilusorio", GUIA_AVANZADA, 90, ["Magia"]),
  makeCapability("ritual", "Tormenta de sangre", GUIA_AVANZADA, 91, ["Magos del báculo"]),
  makeCapability("ritual", "Tormento", GUIA_AVANZADA, 91, ["Brujería"]),
  makeCapability("ritual", "Tortura resonante", GUIA_AVANZADA, 91, ["Brujería", "Hechicería", "Teúrgia"]),
  makeCapability("ritual", "Trampa mística", GUIA_AVANZADA, 91, ["Simbolismo"]),
  makeCapability("ritual", "Túnel místico", GUIA_AVANZADA, 91, ["Mentalistas"]),
  makeCapability("ritual", "Ungir", GUIA_AVANZADA, 91, ["Teúrgia"]),
  makeCapability("ritual", "Vínculo de sangre", GUIA_AVANZADA, 90, ["Brujería"]),
  makeCapability("ritual", "Zancada de siete leguas", GUIA_AVANZADA, 91, ["Magia"])
];

export const SYMBAROUM_CAPABILITIES: SymbaroumCapability[] = [
  ...SYMBAROUM_ABILITIES,
  ...SYMBAROUM_MYSTIC_POWERS,
  ...SYMBAROUM_RITUALS
];
