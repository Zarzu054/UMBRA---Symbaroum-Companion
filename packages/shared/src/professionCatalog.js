const req = (id, label, ...anyOfNames) => ({ id, label, anyOfNames });
const ritualReq = (id, label) => ({ id, label, anyRitual: true });
export const SYMBAROUM_PROFESSIONS = [
    {
        id: "juramentado-de-hierro", name: "Juramentado de hierro", archetype: "Cazador", page: 12,
        summary: "Agente del Pacto de Hierro dedicado a combatir la corrupción y evitar el despertar de Davokar.",
        importantAttributes: "Diestro 13+, Ágil 11+",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("tirador", "Tirador", "Tirador"), req("versado", "Versado en criaturas", "Versado en criaturas"), req("armas", "Armas de asta o Ataque con dos armas", "Armas de asta", "Ataque con dos armas")],
        benefits: [{ name: "Danza de batalla", kind: "habilidad" }]
    },
    {
        id: "templario", name: "Templario", archetype: "Guerrero", page: 16,
        summary: "Caballero del Sol Moribundo consagrado a Prios y a la destrucción de abominaciones.",
        importantAttributes: "Fuerte 13+, Tenaz 11+",
        requirements: [req("armadura", "Combate con armadura", "Combate con armadura"), req("golpe", "Golpe de hierro", "Golpe de hierro"), req("teurgia", "Teúrgia", "Teúrgia"), req("poder", "Aura sagrada o Martillo de monstruos", "Aura sagrada", "Martillo de monstruos")],
        benefits: [{ name: "Místico acorazado", kind: "habilidad" }]
    },
    {
        id: "guardia-de-la-furia", name: "Guardia de la Furia", archetype: "Guerrero", page: 21,
        summary: "Guerrero de élite de Karvosti elegido para proteger al gran jefe.",
        importantAttributes: "Fuerte 13+, Tenaz 11+",
        requirements: [req("armadura", "Combate con armadura", "Combate con armadura"), req("golpe", "Golpe de hierro", "Golpe de hierro"), req("recuperacion", "Recuperación", "Recuperación"), req("estilo", "Combate con escudo o Ataque con dos armas", "Combate con escudo", "Ataque con dos armas")],
        otherRequirement: { label: "Humano bárbaro", races: ["Humano"], cultures: ["Bárbaro"] },
        benefits: [{ name: "Combate sangriento", kind: "habilidad" }]
    },
    {
        id: "artesano-de-artefactos", name: "Artesano de artefactos", archetype: "Místico", page: 23,
        summary: "Especialista en el arte recuperado de fabricar artefactos místicos.",
        importantAttributes: "Inteligente 13+, Tenaz 11+",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("herrero", "Herrero", "Herrero"), ritualReq("ritual", "Al menos un ritual")],
        optionalCapabilities: ["Cualquier poder místico"],
        benefits: [{ name: "Elaboración de artefactos", kind: "habilidad" }]
    },
    {
        id: "mago-del-baculo", name: "Mago del báculo", archetype: "Místico", page: 24,
        summary: "Monje guerrero de la Orden del Báculo vinculado a un báculo rúnico.",
        importantAttributes: "Tenaz 13+, Inteligente 11+",
        requirements: [req("asta", "Armas de asta", "Armas de asta"), req("larga", "Combate con arma larga", "Combate con arma larga"), req("estudioso", "Estudioso", "Estudioso")],
        optionalCapabilities: ["Cualquier poder místico"],
        otherRequirement: { label: "Corrupción permanente 3 o menos al ingresar", maximumPermanentCorruptionAtAdmission: 3 },
        benefits: [{ name: "Magia del báculo", kind: "habilidad" }, { name: "Báculo arrojadizo", kind: "poder_mistico" }, { name: "Tormenta de sangre", kind: "ritual" }, { name: "Terremoto", kind: "ritual" }]
    },
    {
        id: "espia-de-la-reina", name: "Espía de la reina", archetype: "Maleante", page: 32,
        summary: "Agente noble del Secretariado Real al servicio de la reina Korinthia.",
        importantAttributes: "Inteligente 13+, Discreto 11+",
        requirements: [req("doble", "Ataque con dos armas", "Ataque con dos armas"), req("esgrima", "Esgrima sagrada", "Esgrima sagrada"), req("finta", "Finta", "Finta"), req("veneno", "Venenos o Estrangulador", "Venenos", "Estrangulador")],
        otherRequirement: { label: "Humano ambrio con Privilegiado", races: ["Humano"], cultures: ["Ambriano", "Ambrio"], blessing: "Privilegiado" },
        benefits: [{ name: "Pirotecnia", kind: "habilidad" }]
    },
    {
        id: "ladron-de-guante-blanco", name: "Ladrón de guante blanco", archetype: "Maleante", page: 36,
        summary: "Ladrón de élite que convierte robos imposibles en demostraciones de elegancia.",
        importantAttributes: "Persuasivo 13+, Inteligente 11+",
        requirements: [req("acrobata", "Acróbata", "Acróbata"), req("dominacion", "Dominación", "Dominación"), req("trampero", "Trampero", "Trampero"), req("estilo", "Ataque con dos armas o Esgrima sagrada", "Ataque con dos armas", "Esgrima sagrada")],
        benefits: [{ name: "Capa danzante", kind: "habilidad" }]
    },
    {
        id: "espiritista", name: "Espiritista", archetype: "Místico", page: 28,
        summary: "Bruja del Camino Blanco especializada en escuchar y doblegar a los muertos.",
        requirements: [req("brujeria", "Brujería", "Brujería"), req("ojo", "Ojo místico", "Ojo místico"), req("herida", "Herida compartida", "Herida compartida"), req("nigromancia", "Nigromancia", "Nigromancia")],
        benefits: [{ name: "Adivinación nigromántica", kind: "ritual", upgradesFrom: "Nigromancia" }, { name: "Espíritus atormentadores", kind: "poder_mistico" }, { name: "Terrorífico", kind: "rasgo_monstruoso" }]
    },
    {
        id: "nomada-de-la-sangre", name: "Nómada de la sangre", archetype: "Místico", page: 28,
        summary: "Bruja del Camino Rojo que domina la sangre y la transformación bestial.",
        requirements: [req("brujeria", "Brujería", "Brujería"), req("combate", "Combate sin armas", "Combate sin armas"), req("medicus", "Medicus", "Medicus"), req("cambiaformas", "Cambiaformas", "Cambiaformas")],
        benefits: [{ name: "Cacería salvaje", kind: "poder_mistico" }, { name: "Arma natural", kind: "rasgo_monstruoso" }, { name: "Compañero bestial", kind: "ritual", upgradesFrom: "Familiar" }, { name: "Regeneración", kind: "rasgo_monstruoso" }]
    },
    {
        id: "demonologo", name: "Demonólogo", archetype: "Místico", page: 28,
        summary: "Hechicero especializado en los pasajes y criaturas del Ultramundo.",
        requirements: [req("hechiceria", "Hechicería", "Hechicería"), req("aura", "Aura impía", "Aura impía"), req("rito", "Rito de profanación", "Rito de profanación"), req("conocimiento", "Ojo místico o Estudioso", "Ojo místico", "Estudioso")],
        benefits: [{ name: "Expulsar a los abismos", kind: "poder_mistico" }, { name: "Invocar demonio", kind: "ritual" }, { name: "Siervo demoníaco", kind: "ritual", upgradesFrom: "Invocar demonio" }, { name: "Teletransportación", kind: "poder_mistico" }]
    },
    {
        id: "tejedora-verde", name: "Tejedora verde", archetype: "Místico", page: 30,
        summary: "Bruja del Camino Verde cuyo poder está arraigado en Davokar.",
        requirements: [req("alquimista", "Alquimista", "Alquimista"), req("brujeria", "Brujería", "Brujería"), req("enredadera", "Enredadera veloz", "Enredadera veloz"), req("crecimiento", "Crecimiento acelerado", "Crecimiento acelerado")],
        benefits: [{ name: "Fortaleza viviente", kind: "ritual", upgradesFrom: "Crecimiento acelerado" }, { name: "Manto de espinas", kind: "poder_mistico" }]
    },
    {
        id: "ilusionista", name: "Ilusionista", archetype: "Místico", page: 30,
        summary: "Mago especializado en retorcer la percepción y explorar lo imaginable.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Modificación ilusoria o Imperceptible", "Modificación ilusoria", "Imperceptible"), req("terreno", "Terreno ilusorio", "Terreno ilusorio"), req("ilusion", "Ilusión", "Ilusión")],
        benefits: [{ name: "Fata morgana", kind: "ritual", upgradesFrom: "Terreno ilusorio" }, { name: "Imagen especular", kind: "poder_mistico" }, { name: "Paisaje hipnótico", kind: "ritual", associatedOnly: true }]
    },
    {
        id: "inquisidor", name: "Inquisidor", archetype: "Místico", page: 30,
        summary: "Teúrgo consagrado a buscar y destruir a los enemigos de Prios.",
        requirements: [req("teurgia", "Teúrgia", "Teúrgia"), req("humo", "Humo sagrado", "Humo sagrado"), req("poder", "Anatema o Imperceptible", "Anatema", "Imperceptible"), req("metodo", "Ojo místico o Ataque traicionero", "Ojo místico", "Ataque traicionero")],
        benefits: [{ name: "Mirada penetrante", kind: "ritual", upgradesFrom: "Humo sagrado" }, { name: "Purgatorio", kind: "poder_mistico" }]
    },
    {
        id: "mentalista", name: "Mentalista", archetype: "Místico", page: 31,
        summary: "Mago que emplea su voluntad como arma y armadura.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Someter voluntad, Empuje mental o Levitación", "Someter voluntad", "Empuje mental", "Levitación"), req("ritual", "Clarividencia o Interrogatorio mental", "Clarividencia", "Interrogatorio mental")],
        benefits: [{ name: "Golpe psíquico", kind: "poder_mistico" }, { name: "Túnel místico", kind: "ritual", upgradesFrom: "Clarividencia" }]
    },
    {
        id: "nigromante", name: "Nigromante", archetype: "Místico", page: 31,
        summary: "Hechicero que domina los engranajes de la muerte y a los muertos vivientes.",
        requirements: [req("medicus", "Medicus", "Medicus"), req("hechiceria", "Hechicería", "Hechicería"), req("golpe", "Golpe espectral", "Golpe espectral"), req("alzamiento", "Alzar muertos vivientes", "Alzar muertos vivientes")],
        benefits: [{ name: "Espíritus atormentadores", kind: "poder_mistico" }, { name: "Forma espiritual", kind: "poder_mistico" }, { name: "Señor de la muerte", kind: "ritual", upgradesFrom: "Alzar muertos vivientes" }]
    },
    {
        id: "piromante", name: "Piromante", archetype: "Místico", page: 31,
        summary: "Mago especializado en dominar la esencia del fuego.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Muro de llamas o Cascada de azufre", "Muro de llamas", "Cascada de azufre"), req("ritual", "Relato de cenizas o Siervo flamígero", "Relato de cenizas", "Siervo flamígero")],
        benefits: [{ name: "Espíritu ígneo", kind: "poder_mistico" }, { name: "Gemelos flamígeros", kind: "ritual", upgradesFrom: "Siervo flamígero" }]
    },
    {
        id: "confesor", name: "Confesor", archetype: "Místico", page: 31,
        summary: "Teúrgo que sostiene la luz de Prios mediante liderazgo, verdad y curación.",
        requirements: [req("teurgia", "Teúrgia", "Teúrgia"), req("exorcismo", "Exorcismo", "Exorcismo"), req("vocacion", "Líder o Medicus", "Líder", "Medicus"), req("poder", "Aura sagrada, Imposición de manos o Forma verdadera", "Aura sagrada", "Imposición de manos", "Forma verdadera")],
        benefits: [{ name: "Expiación", kind: "ritual", upgradesFrom: "Exorcismo" }, { name: "Manantial de vida", kind: "poder_mistico" }]
    }
];
export function normalizeProfessionText(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
export function normalizeProfessionCapabilities(capabilities) {
    const levelRank = { novato: 1, adepto: 2, maestro: 3 };
    const merged = new Map();
    for (const capability of capabilities) {
        const key = normalizeProfessionText(capability.name);
        const current = merged.get(key);
        if (!current || (capability.level ? levelRank[capability.level] : 0) > (current.level ? levelRank[current.level] : 0)) {
            merged.set(key, capability);
        }
    }
    return [...merged.values()];
}
export function getProfessionById(id) {
    return SYMBAROUM_PROFESSIONS.find((entry) => entry.id === id);
}
export function getProfessionByName(name) {
    const normalized = normalizeProfessionText(name);
    return SYMBAROUM_PROFESSIONS.find((entry) => normalizeProfessionText(entry.name) === normalized);
}
function isMasterCapability(capability) {
    return capability.kind !== "ritual" && capability.level === "maestro";
}
export function evaluateProfession(definitionOrId, context, options = {}) {
    const definition = typeof definitionOrId === "string" ? getProfessionById(definitionOrId) : definitionOrId;
    if (!definition) {
        return { professionId: String(definitionOrId), eligible: false, requirementsMet: false, masterRequirementMet: false, otherRequirementMet: false, requirementResults: [], unmetRequirements: ["Profesión desconocida"] };
    }
    const byName = new Map(context.capabilities.map((entry) => [normalizeProfessionText(entry.name), entry]));
    const requirementResults = definition.requirements.map((requirement) => {
        const matches = requirement.anyRitual
            ? context.capabilities.filter((entry) => entry.kind === "ritual")
            : (requirement.anyOfNames ?? []).map((name) => byName.get(normalizeProfessionText(name))).filter((entry) => Boolean(entry));
        return { id: requirement.id, label: requirement.label, met: matches.length > 0, matchedNames: matches.map((entry) => entry.name), hasMaster: matches.some(isMasterCapability) };
    });
    const requirementsMet = requirementResults.every((entry) => entry.met);
    const masterRequirementMet = requirementResults.some((entry) => entry.met && entry.hasMaster);
    const other = definition.otherRequirement;
    let otherRequirementMet = true;
    if (other?.races?.length)
        otherRequirementMet &&= other.races.some((value) => normalizeProfessionText(value) === normalizeProfessionText(context.race));
    if (other?.cultures?.length)
        otherRequirementMet &&= other.cultures.some((value) => normalizeProfessionText(value) === normalizeProfessionText(context.culture));
    if (other?.blessing)
        otherRequirementMet &&= context.blessings.some((value) => normalizeProfessionText(value) === normalizeProfessionText(other.blessing));
    if (options.includeAdmissionOnly !== false && other?.maximumPermanentCorruptionAtAdmission !== undefined) {
        otherRequirementMet &&= context.permanentCorruption <= other.maximumPermanentCorruptionAtAdmission;
    }
    const unmetRequirements = requirementResults.filter((entry) => !entry.met).map((entry) => entry.label);
    if (!masterRequirementMet)
        unmetRequirements.push("Al menos una capacidad requerida a nivel maestro");
    if (!otherRequirementMet && other)
        unmetRequirements.push(other.label);
    return { professionId: definition.id, eligible: requirementsMet && masterRequirementMet && otherRequirementMet, requirementsMet, masterRequirementMet, otherRequirementMet, requirementResults, unmetRequirements };
}
const benefitAccess = new Map();
for (const profession of SYMBAROUM_PROFESSIONS) {
    for (const benefit of profession.benefits.filter((entry) => !entry.associatedOnly)) {
        const key = normalizeProfessionText(benefit.name);
        benefitAccess.set(key, [...new Set([...(benefitAccess.get(key) ?? []), profession.id])]);
    }
}
export function getBenefitProfessionIds(name) {
    return benefitAccess.get(normalizeProfessionText(name)) ?? [];
}
export function isProfessionExclusiveBenefit(name) {
    return getBenefitProfessionIds(name).length > 0;
}
export function getHigherRitualBase(name) {
    for (const profession of SYMBAROUM_PROFESSIONS) {
        const benefit = profession.benefits.find((entry) => normalizeProfessionText(entry.name) === normalizeProfessionText(name));
        if (benefit?.upgradesFrom)
            return benefit.upgradesFrom;
    }
    return undefined;
}
