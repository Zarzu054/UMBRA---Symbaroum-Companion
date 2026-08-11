const req = (id, label, ...anyOfNames) => ({ id, label, anyOfNames });
const ritualReq = (id, label) => ({ id, label, anyRitual: true });
export const SYMBAROUM_PROFESSIONS = [
    {
        id: "juramentado-de-hierro", name: "Juramentado de hierro", archetype: "Cazador", page: 12,
        summary: "Agente del Pacto de Hierro dedicado a combatir la corrupción y evitar el despertar de Davokar.",
        description: "Los juramentados de hierro son agentes de pleno derecho del Pacto de Hierro. Tras superar duras pruebas y prestar su juramento, dedican su vida a impedir que la explotación de Davokar despierte poderes capaces de extender la corrupción. Actúan como exploradores, cazadores e investigadores, y están preparados para enfrentarse tanto a las criaturas corrompidas como a quienes saquean el bosque sin medir las consecuencias.",
        importantAttributes: "Diestro 13+, Ágil 11+",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("tirador", "Tirador", "Tirador"), req("versado", "Versado en criaturas", "Versado en criaturas"), req("armas", "Armas de asta o Ataque con dos armas", "Armas de asta", "Ataque con dos armas")],
        benefits: [{ name: "Danza de batalla", kind: "habilidad" }]
    },
    {
        id: "templario", name: "Templario", archetype: "Guerrero", page: 16,
        summary: "Caballero del Sol Moribundo consagrado a Prios y a la destrucción de abominaciones.",
        description: "Los templarios son los guerreros consagrados de la Iglesia de Prios y la fuerza de choque de los Caballeros del Sol Moribundo. Avanzan protegidos por acero y poder sagrado para destruir abominaciones, defender los lugares santos y sostener la autoridad de la Iglesia. Su disciplina combina una fe inflexible con el dominio de la armadura y el combate cuerpo a cuerpo.",
        importantAttributes: "Fuerte 13+, Tenaz 11+",
        requirements: [req("armadura", "Combate con armadura", "Combate con armadura"), req("golpe", "Golpe de hierro", "Golpe de hierro"), req("teurgia", "Teúrgia", "Teúrgia"), req("poder", "Aura sagrada o Martillo de monstruos", "Aura sagrada", "Martillo de monstruos")],
        benefits: [{ name: "Místico acorazado", kind: "habilidad" }]
    },
    {
        id: "guardia-de-la-furia", name: "Guardia de la Furia", archetype: "Guerrero", page: 21,
        summary: "Guerrero de élite de Karvosti elegido para proteger al gran jefe.",
        description: "La Guardia de la Furia reúne a combatientes escogidos entre los clanes bárbaros para servir en Karvosti y proteger al gran jefe. La elección constituye uno de los mayores honores que puede recibir un guerrero y exige abandonar durante un tiempo las obligaciones del propio clan. En batalla, sus miembros convierten la resistencia, la disciplina y una violencia cuidadosamente dirigida en una defensa implacable.",
        importantAttributes: "Fuerte 13+, Tenaz 11+",
        requirements: [req("armadura", "Combate con armadura", "Combate con armadura"), req("golpe", "Golpe de hierro", "Golpe de hierro"), req("recuperacion", "Recuperación", "Recuperación"), req("estilo", "Combate con escudo o Ataque con dos armas", "Combate con escudo", "Ataque con dos armas")],
        otherRequirement: { label: "Humano bárbaro", races: ["Humano"], cultures: ["Bárbaro"] },
        benefits: [{ name: "Combate sangriento", kind: "habilidad" }]
    },
    {
        id: "artesano-de-artefactos", name: "Artesano de artefactos", archetype: "Místico", page: 23,
        summary: "Especialista en el arte recuperado de fabricar artefactos místicos.",
        description: "Los artesanos de artefactos dominan un conocimiento que durante mucho tiempo se creyó perdido entre humanos y elfos, pero que sobrevivió entre los trolls como una práctica casi sagrada. Combinan estudio, herrería y rituales para encerrar poderes en objetos materiales. Son investigadores y creadores pacientes, tan interesados en recuperar técnicas antiguas como en comprender el precio y los riesgos de cada obra.",
        importantAttributes: "Inteligente 13+, Tenaz 11+",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("herrero", "Herrero", "Herrero"), ritualReq("ritual", "Al menos un ritual")],
        optionalCapabilities: ["Cualquier poder místico"],
        benefits: [{ name: "Elaboración de artefactos", kind: "habilidad" }]
    },
    {
        id: "mago-del-baculo", name: "Mago del báculo", archetype: "Místico", page: 24,
        summary: "Monje guerrero de la Orden del Báculo vinculado a un báculo rúnico.",
        description: "Los magos del báculo pertenecen a una antigua orden de monjes guerreros relacionada con los secretos de Symbaroum. Cada miembro queda ligado a un báculo rúnico que es a la vez símbolo, foco místico y arma. Desde sus refugios en Davokar buscan discípulos y alianzas capaces de contener los horrores de las ruinas, combinando erudición, disciplina marcial y una magia propia de la orden.",
        importantAttributes: "Tenaz 13+, Inteligente 11+",
        requirements: [req("asta", "Armas de asta", "Armas de asta"), req("larga", "Combate con arma larga", "Combate con arma larga"), req("estudioso", "Estudioso", "Estudioso")],
        optionalCapabilities: ["Cualquier poder místico"],
        otherRequirement: { label: "Corrupción permanente 3 o menos al ingresar", maximumPermanentCorruptionAtAdmission: 3 },
        benefits: [{ name: "Magia del báculo", kind: "habilidad" }, { name: "Báculo arrojadizo", kind: "poder_mistico" }, { name: "Tormenta de sangre", kind: "ritual" }, { name: "Terremoto", kind: "ritual" }]
    },
    {
        id: "espia-de-la-reina", name: "Espía de la reina", archetype: "Maleante", page: 32,
        summary: "Agente noble del Secretariado Real al servicio de la reina Korinthia.",
        description: "Los espías de la reina son agentes del Secretariado Real encargados de proteger los intereses de Korinthia lejos de la mirada pública. Se infiltran en cortes, organizaciones y círculos criminales para obtener información, frustrar conspiraciones y sembrar desinformación. Su posición exige combinar el refinamiento de la nobleza con la discreción, el engaño y una eficacia letal cuando una misión deja de admitir soluciones diplomáticas.",
        importantAttributes: "Inteligente 13+, Discreto 11+",
        requirements: [req("doble", "Ataque con dos armas", "Ataque con dos armas"), req("esgrima", "Esgrima sagrada", "Esgrima sagrada"), req("finta", "Finta", "Finta"), req("veneno", "Venenos o Estrangulador", "Venenos", "Estrangulador")],
        otherRequirement: { label: "Humano ambrio con Privilegiado", races: ["Humano"], cultures: ["Ambriano", "Ambrio"], blessing: "Privilegiado" },
        benefits: [{ name: "Pirotecnia", kind: "habilidad" }]
    },
    {
        id: "ladron-de-guante-blanco", name: "Ladrón de guante blanco", archetype: "Maleante", page: 36,
        summary: "Ladrón de élite que convierte robos imposibles en demostraciones de elegancia.",
        description: "Los ladrones de guante blanco forman la élite del crimen elegante, especialmente en Yndaros. Buscan objetivos protegidos y golpes que otros considerarían imposibles, no solo por la recompensa, sino por el prestigio de demostrar su talento. Prefieren la precisión y el ingenio a la violencia abierta, y muchos dejan una firma característica para que nadie dude de quién burló las defensas.",
        importantAttributes: "Persuasivo 13+, Inteligente 11+",
        requirements: [req("acrobata", "Acróbata", "Acróbata"), req("dominacion", "Dominación", "Dominación"), req("trampero", "Trampero", "Trampero"), req("estilo", "Ataque con dos armas o Esgrima sagrada", "Ataque con dos armas", "Esgrima sagrada")],
        benefits: [{ name: "Capa danzante", kind: "habilidad" }]
    },
    {
        id: "espiritista", name: "Espiritista", archetype: "Místico", page: 28,
        summary: "Bruja del Camino Blanco especializada en escuchar y doblegar a los muertos.",
        description: "Los espiritistas recorren el Camino Blanco de la brujería y se ocupan de la relación entre los vivos y los muertos. Escuchan a los espíritus, interpretan aquello que quedó sin resolver y pueden recurrir a ellos para descubrir secretos o defenderse. Su cercanía al otro lado también les permite imponer su voluntad sobre presencias hostiles, por lo que suelen ser mediadores temidos y guías indispensables allí donde los difuntos no descansan.",
        requirements: [req("brujeria", "Brujería", "Brujería"), req("ojo", "Ojo místico", "Ojo místico"), req("herida", "Herida compartida", "Herida compartida"), req("nigromancia", "Nigromancia", "Nigromancia")],
        benefits: [{ name: "Adivinación nigromántica", kind: "ritual", upgradesFrom: "Nigromancia" }, { name: "Espíritus atormentadores", kind: "poder_mistico" }, { name: "Terrorífico", kind: "rasgo_monstruoso" }]
    },
    {
        id: "nomada-de-la-sangre", name: "Nómada de la sangre", archetype: "Místico", page: 28,
        summary: "Bruja del Camino Rojo que domina la sangre y la transformación bestial.",
        description: "Los nómadas de la sangre siguen el Camino Rojo, la senda de la vida, el cuerpo y el instinto. Aprenden a leer la sangre como fuente de vigor y memoria, a sanar las heridas y a alterar su propia forma hasta adoptar cualidades bestiales. Su práctica favorece una existencia errante y una relación directa con depredadores y compañeros animales, convirtiéndolos en cazadores resistentes que combaten con el cuerpo tanto como con la brujería.",
        requirements: [req("brujeria", "Brujería", "Brujería"), req("combate", "Combate sin armas", "Combate sin armas"), req("medicus", "Medicus", "Medicus"), req("cambiaformas", "Cambiaformas", "Cambiaformas")],
        benefits: [{ name: "Cacería salvaje", kind: "poder_mistico" }, { name: "Arma natural", kind: "rasgo_monstruoso" }, { name: "Compañero bestial", kind: "ritual", upgradesFrom: "Familiar" }, { name: "Regeneración", kind: "rasgo_monstruoso" }]
    },
    {
        id: "demonologo", name: "Demonólogo", archetype: "Místico", page: 28,
        summary: "Hechicero especializado en los pasajes y criaturas del Ultramundo.",
        description: "Los demonólogos estudian el Ultramundo, sus habitantes y los pasos que permiten cruzar sus fronteras. Su oficio no consiste necesariamente en servir a los demonios, sino en conocer sus nombres, ataduras y debilidades para invocarlos, expulsarlos o utilizarlos. Ese conocimiento ofrece una movilidad y un poder extraordinarios, pero cada trato acerca al practicante a fuerzas que esperan cualquier error para imponer sus propias condiciones.",
        requirements: [req("hechiceria", "Hechicería", "Hechicería"), req("aura", "Aura impía", "Aura impía"), req("rito", "Rito de profanación", "Rito de profanación"), req("conocimiento", "Ojo místico o Estudioso", "Ojo místico", "Estudioso")],
        benefits: [{ name: "Expulsar a los abismos", kind: "poder_mistico" }, { name: "Invocar demonio", kind: "ritual" }, { name: "Siervo demoníaco", kind: "ritual", upgradesFrom: "Invocar demonio" }, { name: "Teletransportación", kind: "poder_mistico" }]
    },
    {
        id: "tejedora-verde", name: "Tejedora verde", archetype: "Místico", page: 30,
        summary: "Bruja del Camino Verde cuyo poder está arraigado en Davokar.",
        description: "Las tejedoras verdes profundizan en la vertiente de la brujería más unida a la vegetación y a la fuerza indómita de Davokar. Aceleran el crecimiento, convocan raíces y espinas y transforman el terreno en refugio o trampa. Su poder expresa tanto la abundancia como la ferocidad del bosque: protege a quienes respetan sus ciclos y se vuelve contra quienes pretenden someterlos.",
        requirements: [req("alquimista", "Alquimista", "Alquimista"), req("brujeria", "Brujería", "Brujería"), req("enredadera", "Enredadera veloz", "Enredadera veloz"), req("crecimiento", "Crecimiento acelerado", "Crecimiento acelerado")],
        benefits: [{ name: "Fortaleza viviente", kind: "ritual", upgradesFrom: "Crecimiento acelerado" }, { name: "Manto de espinas", kind: "poder_mistico" }]
    },
    {
        id: "ilusionista", name: "Ilusionista", archetype: "Místico", page: 30,
        summary: "Mago especializado en retorcer la percepción y explorar lo imaginable.",
        description: "Los ilusionistas investigan la frontera entre aquello que existe y aquello que una mente acepta como real. Mediante la magia alteran imágenes, sonidos y sensaciones, ocultan presencias o convierten un lugar entero en un escenario engañoso. Los más hábiles no se limitan a distraer: dominan la atención de sus adversarios y emplean la imaginación como una herramienta capaz de abrir posibilidades que la realidad ordinaria niega.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Modificación ilusoria o Imperceptible", "Modificación ilusoria", "Imperceptible"), req("terreno", "Terreno ilusorio", "Terreno ilusorio"), req("ilusion", "Ilusión", "Ilusión")],
        benefits: [{ name: "Fata morgana", kind: "ritual", upgradesFrom: "Terreno ilusorio" }, { name: "Imagen especular", kind: "poder_mistico" }, { name: "Paisaje hipnótico", kind: "ritual", associatedOnly: true }]
    },
    {
        id: "inquisidor", name: "Inquisidor", archetype: "Místico", page: 30,
        summary: "Teúrgo consagrado a buscar y destruir a los enemigos de Prios.",
        description: "Los inquisidores son teúrgos dedicados a descubrir amenazas ocultas contra Prios y su Iglesia. Investigan herejías, corrupción y actividad sobrenatural, combinando observación, interrogatorio y poder sagrado antes de dictar sentencia. Cuando identifican a su enemigo pueden despojarlo de engaños y protecciones, por lo que resultan especialmente peligrosos para místicos clandestinos, cultistas y criaturas capaces de esconder su verdadera naturaleza.",
        requirements: [req("teurgia", "Teúrgia", "Teúrgia"), req("humo", "Humo sagrado", "Humo sagrado"), req("poder", "Anatema o Imperceptible", "Anatema", "Imperceptible"), req("metodo", "Ojo místico o Ataque traicionero", "Ojo místico", "Ataque traicionero")],
        benefits: [{ name: "Mirada penetrante", kind: "ritual", upgradesFrom: "Humo sagrado" }, { name: "Purgatorio", kind: "poder_mistico" }]
    },
    {
        id: "mentalista", name: "Mentalista", archetype: "Místico", page: 31,
        summary: "Mago que emplea su voluntad como arma y armadura.",
        description: "Los mentalistas convierten la voluntad disciplinada en su principal instrumento mágico. Proyectan fuerza con el pensamiento, doblegan impulsos, atraviesan distancias con sus sentidos y levantan defensas que no dependen del acero. Su búsqueda se centra en comprender los límites de la conciencia y extenderla más allá del cuerpo, una práctica poderosa que exige un control absoluto para no perderse en la mente propia o en la ajena.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Someter voluntad, Empuje mental o Levitación", "Someter voluntad", "Empuje mental", "Levitación"), req("ritual", "Clarividencia o Interrogatorio mental", "Clarividencia", "Interrogatorio mental")],
        benefits: [{ name: "Golpe psíquico", kind: "poder_mistico" }, { name: "Túnel místico", kind: "ritual", upgradesFrom: "Clarividencia" }]
    },
    {
        id: "nigromante", name: "Nigromante", archetype: "Místico", page: 31,
        summary: "Hechicero que domina los engranajes de la muerte y a los muertos vivientes.",
        description: "Los nigromantes estudian la muerte como un mecanismo que puede observarse, alterarse y, durante un tiempo, invertirse. Combinan conocimientos del cuerpo con hechicería para tratar con espectros, animar cadáveres y asumir formas cercanas a los espíritus. Su dominio puede proporcionar servidores incansables y respuestas vedadas a los vivos, pero también los enfrenta a una corrupción constante y al rechazo de casi cualquier sociedad.",
        requirements: [req("medicus", "Medicus", "Medicus"), req("hechiceria", "Hechicería", "Hechicería"), req("golpe", "Golpe espectral", "Golpe espectral"), req("alzamiento", "Alzar muertos vivientes", "Alzar muertos vivientes")],
        benefits: [{ name: "Espíritus atormentadores", kind: "poder_mistico" }, { name: "Forma espiritual", kind: "poder_mistico" }, { name: "Señor de la muerte", kind: "ritual", upgradesFrom: "Alzar muertos vivientes" }]
    },
    {
        id: "piromante", name: "Piromante", archetype: "Místico", page: 31,
        summary: "Mago especializado en dominar la esencia del fuego.",
        description: "Los piromantes estudian el fuego como materia, símbolo y fuerza transformadora. Pueden levantar barreras ardientes, leer las huellas que dejan las cenizas y dar forma a servidores de llama. Su arte ofrece una capacidad destructiva evidente, pero sus practicantes más experimentados comprenden que dominar el fuego requiere precisión: una llama fuera de control no distingue entre enemigo, aliado y aquello que se pretendía proteger.",
        requirements: [req("estudioso", "Estudioso", "Estudioso"), req("magia", "Magia", "Magia"), req("poder", "Muro de llamas o Cascada de azufre", "Muro de llamas", "Cascada de azufre"), req("ritual", "Relato de cenizas o Siervo flamígero", "Relato de cenizas", "Siervo flamígero")],
        benefits: [{ name: "Espíritu ígneo", kind: "poder_mistico" }, { name: "Gemelos flamígeros", kind: "ritual", upgradesFrom: "Siervo flamígero" }]
    },
    {
        id: "confesor", name: "Confesor", archetype: "Místico", page: 31,
        summary: "Teúrgo que sostiene la luz de Prios mediante liderazgo, verdad y curación.",
        description: "Los confesores representan el rostro pastoral y doctrinal de la teúrgia de Prios. Escuchan, aconsejan y buscan separar la culpa de la corrupción verdadera, pero también saben exorcizar influencias impías y sostener a una comunidad en momentos de crisis. Su autoridad nace de la palabra, la curación y la capacidad de devolver esperanza; cuando fracasa la persuasión, canalizan la luz del dios para proteger a los fieles.",
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
