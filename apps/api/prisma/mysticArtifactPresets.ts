import type { PrismaClient } from "@prisma/client";
import type { MysticArtifactDefinitionInput } from "@umbra/shared";

export const MYSTIC_ARTIFACT_CATALOG_VERSION = 2;

type Preset = { id: string; slug: string; artifact: MysticArtifactDefinitionInput };

const LEGACY_DESCRIPTION_PREFIX = "Artefacto místico vinculable descrito en ";
const LEGACY_ABILITY_PREFIX = "Capacidad de ";

export function isUntouchedLegacyArtifactCopy(description: string, abilityDescriptions: string[]): boolean {
  return description.startsWith(LEGACY_DESCRIPTION_PREFIX)
    && abilityDescriptions.length > 0
    && abilityDescriptions.every((abilityDescription) => abilityDescription.startsWith(LEGACY_ABILITY_PREFIX));
}

const costs: MysticArtifactDefinitionInput["bindingCosts"] = [
  { paymentType: "xp", amount: 1 },
  { paymentType: "permanent_corruption", amount: 1 }
];

function ability(
  name: string,
  description: string,
  actionCost: "free" | "movement" | "combat" | "reaction",
  corruptionFormula: string,
  extra: Partial<MysticArtifactDefinitionInput["abilities"][number]> = {}
): MysticArtifactDefinitionInput["abilities"][number] {
  return {
    name,
    description,
    activation: "active",
    actionCost,
    corruptionFormula,
    requiresBinding: true,
    perSceneNote: "",
    rolls: [],
    requirements: [],
    resourceCosts: [],
    ...extra
  };
}

function preset(
  number: number,
  slug: string,
  name: string,
  sourceTitle: string,
  sourcePage: number,
  overrides: Partial<MysticArtifactDefinitionInput> = {}
): Preset {
  return {
    id: `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    slug,
    artifact: {
      name,
      description: "",
      kind: "object",
      sourceTitle,
      sourcePage,
      bindingCosts: costs,
      abilities: [],
      resources: [],
      ...overrides
    }
  };
}

const adventureCatalog: Array<[string, string, string, number, MysticArtifactDefinitionInput["kind"]?]> = [
  ["amuleto-aloena", "Amuleto de Aloéna", "Fuerte Espina", 73],
  ["anillo-okran", "Anillo de Okran", "Fuerte Espina", 73],
  ["campana-eamon", "Campana de Eamon", "Fuerte Espina", 73],
  ["daga-filo-negro", "Daga Filo Negro", "Fuerte Espina", 73, "weapon"],
  ["frasco-peatro", "Frasco de Peatro", "Fuerte Espina", 74],
  ["hacha-hambre", "Hacha de batalla Hambre", "Fuerte Espina", 74, "weapon"],
  ["puno-hierro-yarego", "Puño de hierro de Yarego", "Fuerte Espina", 74, "weapon"],
  ["himno", "Himno", "Karvosti", 62, "weapon"],
  ["capucha-dorgvalg", "Capucha de Dorgvalg", "Karvosti", 62, "armor"],
  ["lanza-terael-kael", "Lanza de Terael-Kael", "Karvosti", 62, "weapon"],
  ["mataaranas", "Mataarañas", "Karvosti", 62, "weapon"],
  ["venda-arvalam", "Venda de Arvalam", "Karvosti", 63],
  ["urna-natana", "Urna de Natana", "Karvosti", 63],
  ["anillo-alalarog", "Anillo de anticipación de Alalarog", "Yndaros", 77],
  ["matadragones-elasath", "Matadragones de Elasath", "Yndaros", 77, "weapon"],
  ["escudo-loravana", "Escudo arrojadizo de Loravana", "Yndaros", 77, "armor"],
  ["anillo-gorvadan", "Anillo mental de Gorvadan", "Yndaros", 77],
  ["cabezal-bargalvax", "Cabezal del báculo de Bargalvax", "Yndaros", 78, "weapon"],
  ["incensario-olian", "Incensario de Olian", "Symbar", 98],
  ["flauta-trovador", "Flauta del trovador", "Symbar", 99],
  ["baston-susurrador", "Bastón de la Susurradora de Plantas", "Symbar", 99],
  ["guantes-joliana", "Guantes de Joliana", "Symbar", 100],
  ["hachuela-sangrienta", "Hacha larga Hachuela Sangrienta", "Symbar", 100, "weapon"],
  ["lanza-porgo", "Lanza de Porgo", "Symbar", 100, "weapon"],
  ["hacha-ramara", "Hacha demoníaca de Ramara", "Symbar", 102, "weapon"],
  ["estandarte-kavaler", "Estandarte de Kavaler", "Symbar", 103],
  ["sol-acero", "Sol de Acero", "Symbar", 103],
  ["brujula-einon", "Brújula de Einon", "Symbar", 103],
  ["bolsa-basigor", "Bolsa de comida de Basigor", "Symbar", 104],
  ["manto-alial", "Manto pétreo de Alial", "Symbar", 104],
  ["anillo-pacto-hierro", "Anillo del Pacto de Hierro", "La corona de cobre", 66],
  ["comealmas", "Comealmas", "La corona de cobre", 66, "weapon"],
  ["cruz-troll-ella", "Cruz troll de Ella", "La corona de cobre", 67, "armor"],
  ["fullangra", "Fullangra", "La corona de cobre", 67],
  ["parcabrasa", "Parcabrasa", "La corona de cobre", 68, "weapon"],
  ["piel-haganor", "Piel de Haganor", "La corona de cobre", 69, "armor"],
  ["brasero-eldred", "Brasero de Eldred", "Localizaciones de aventura", 10],
  ["cadena-algsar-mara", "Cadena de Algsar-Mara", "Localizaciones de aventura", 11],
  ["aguas-viles", "Aguas viles", "La corona de cobre", 66]
];

type CompactAbility = [name: string, action: "free" | "movement" | "combat" | "reaction", corruption: string, activation?: "active" | "passive" | "triggered"];
const catalogAbilitySpecs: Record<string, CompactAbility[]> = {
  "amuleto-aloena": [["Escudo espiritual", "reaction", "1D4"], ["Danza espiritual", "free", "1D4"], ["Sacrificio", "free", "1D8"]],
  "anillo-okran": [["Guiado por la luz", "combat", "1"], ["Rayos de luz", "combat", "1D4"]],
  "campana-eamon": [["Desconcertante", "combat", "1D4"], ["Incordio", "free", "1D4", "passive"]],
  "daga-filo-negro": [["Extenuante", "reaction", "1D4"], ["Paralizante", "reaction", "1D6"]],
  "frasco-peatro": [["Cura oscura", "combat", "1 al transformarse"], ["Antioscuridad", "combat", "1 al transformarse"]],
  "hacha-hambre": [["Mordedura nocturna", "free", "1"]],
  "puno-hierro-yarego": [["Aturdir", "reaction", "1D4"], ["Empujar", "reaction", "1D4"], ["Romper", "combat", "1D4"]],
  "capucha-dorgvalg": [["Escudo", "free", "1D4 por impacto detenido"], ["Amigo de los pájaros", "combat", "1D6"]],
  "himno": [["Eco inspirador", "combat", "1D4"], ["Fortalecer la armonía", "combat", "1D4"]],
  "lanza-terael-kael": [["Regreso", "free", "1"], ["Terremoto", "free", "1D4"]],
  "mataaranas": [["Transfiguración", "combat", "1"], ["Limpieza de sangre", "free", "1D4"], ["Azote de arañas", "free", "1D6"]],
  "venda-arvalam": [["Ver a través del demonio", "combat", "+1"], ["Premonición abisal", "combat", "+1"]],
  "urna-natana": [["Natana, espía espectral", "combat", "1D4 por escena u hora", "active"]],
  "anillo-alalarog": [["Premonición", "free", "1D4"], ["Prever huecos", "free", "1D4"]],
  "matadragones-elasath": [["Destrozar armadura", "combat", "1D4"], ["Romper el encanto de la sierpe", "combat", "+1"]],
  "escudo-loravana": [["Lanzar escudo", "combat", "+1"], ["Golpe de escudo", "reaction", "+1"]],
  "anillo-gorvadan": [["Telepatía", "combat", "+1"], ["Confinar", "free", "1D6 por turno"]],
  "cabezal-bargalvax": [["Implantación", "free", "1D6"]],
  "incensario-olian": [["Materialización", "combat", "1D4"], ["Cortina de humo", "combat", "1D4+1 por persona que no sea el amo"], ["El terror de los espíritus", "reaction", "+1D4"]],
  "flauta-trovador": [["Enervar", "combat", "1 por objetivo"], ["Hipnotizar", "combat", "1 por objetivo"]],
  "baston-susurrador": [["Tropiezo", "reaction", "1"], ["Azote", "reaction", "1"], ["Cubierta vegetal", "combat", "1D4"]],
  "guantes-joliana": [["Agarre poderoso", "reaction", "1"], ["Mordisco espinoso", "free", "1D4"], ["Toque espinoso", "free", "1D4"]],
  "hachuela-sangrienta": [["Arco sangriento", "free", "1D4"], ["Arco desgarrador", "free", "1D6"]],
  "lanza-porgo": [["Regreso", "free", "1"], ["Ataque de regreso", "reaction", "+1D4"]],
  "hacha-ramara": [["Golpe salvaje", "combat", "1D4"], ["Golpe masacrador", "free", "1D4"]],
  "estandarte-kavaler": [["Inspirar coraje", "combat", "1D4"], ["Reunir fuerzas", "combat", "1D4"], ["Ofensiva final", "combat", "Según los turnos de efecto"]],
  "sol-acero": [["Tormenta solar", "combat", "1D8"]],
  "brujula-einon": [["Detectar abominación", "combat", "1D4"]],
  "bolsa-basigor": [["Preparar alimento", "combat", "1 por comensal y día"]],
  "manto-alial": [["Cascarón de piedra", "combat", "1D4"], ["Camuflaje", "combat", "1D4"]],
  "aguas-viles": [["Revelaciones de la noche", "combat", "1 Corrupción permanente por gota"], ["Sinergia negra", "reaction", "Ninguna"], ["Salvación de las tinieblas", "free", "1D12"]],
  "anillo-pacto-hierro": [["Escudo de corrupción", "free", "Ninguna"], ["Mensaje onírico", "free", "Ninguna"]],
  "comealmas": [["Saqueador de cuerpos", "reaction", "1D4"], ["Abuso de los muertos", "combat", "1D4"]],
  "cruz-troll-ella": [["Escudo mental", "reaction", "1"], ["Espejo de venganza", "reaction", "1D4 si tiene éxito; 1D6 si falla"]],
  "fullangra": [["Sierva fiel", "combat", "1"], ["Eliminación", "combat", "1D4, uno permanente"]],
  "parcabrasa": [["Hoja de lava", "combat", "1D4"], ["Lluvia de fuego", "combat", "1D6"]],
  "piel-haganor": [["Susurro del dragón", "combat", "1"], ["Voz de mando", "combat", "1D4"]],
  "brasero-eldred": [["La penitencia del mentiroso", "combat", "1D4"], ["Evocar la memoria", "combat", "1D4"]],
  "cadena-algsar-mara": [["Enroscar", "combat", "1D4"], ["Trampa trepadora", "combat", "1D4"]]
};

type AbilityExtra = Partial<MysticArtifactDefinitionInput["abilities"][number]>;
type CatalogDetail = {
  description: string;
  abilityDescriptions: string[];
  artifact?: Partial<MysticArtifactDefinitionInput>;
  abilityExtras?: AbilityExtra[];
};

const capability = (capabilityName: string, minimumLevel: "novato" | "adepto" | "maestro" = "novato") => ({
  type: "capability" as const, capabilityName, minimumLevel, description: ""
});
const check = (label: string, actorAttribute: "agil" | "atento" | "diestro" | "discreto" | "fuerte" | "inteligente" | "persuasivo" | "tenaz", opponentAttribute?: "agil" | "atento" | "diestro" | "discreto" | "fuerte" | "inteligente" | "persuasivo" | "tenaz") => ({
  kind: "check" as const, label, formula: "1D20", actorAttribute, ...(opponentAttribute ? { opponentAttribute } : {})
});
const damage = (label: string, formula: string) => ({ kind: "damage" as const, label, formula });

const catalogDetails: Record<string, CatalogDetail> = {
  "amuleto-aloena": {
    description: "Amuleto de plata entregado por la elfa eterna Aloéna. Alberga un espíritu protector capaz de amortiguar golpes, desviar proyectiles o sacrificarse por completo para salvar a su portador.",
    abilityDescriptions: [
      "Antes de una tirada de Defensa, reduce en 2 el daño de un ataque que llegue a impactar.",
      "Durante un turno evita todos los ataques con armas a distancia o arrojadizas; el portador tampoco puede emplearlas mientras danza el espíritu.",
      "El amuleto se rompe para proteger por completo al portador de todos los ataques durante un turno, sin impedirle actuar."
    ]
  },
  "anillo-okran": {
    description: "Anillo atribuido a Okran, cazador de abominaciones. Su luz revela las debilidades de las criaturas corruptas y puede abrasarlas sin que su protección les sirva de nada.",
    abilityDescriptions: [
      "Señala los puntos débiles de una abominación; todos los ataques posteriores contra ella infligen +1 de daño.",
      "Descarga un rayo contra una abominación que inflige 1D8 de daño e ignora la armadura."
    ],
    abilityExtras: [{ activation: "triggered" }, { rolls: [damage("Rayos de luz", "1D8")] }]
  },
  "campana-eamon": {
    description: "Pequeña campana vinculada al legendario ladrón Eamon. Su tañido desconcierta a una víctima o rompe el ritmo de quienes intentan golpear al portador.",
    abilityDescriptions: [
      "La víctima no puede actuar hasta que el portador supere una tirada de Tenaz al comienzo de uno de sus turnos o hasta que reciba daño.",
      "Mientras combate con la campana en una mano, el portador obtiene una segunda oportunidad en Defensa, pero no puede usar escudo, arma pesada ni dos armas."
    ],
    abilityExtras: [{ rolls: [check("Romper el desconcierto", "tenaz")] }, { activation: "passive" }]
  },
  "daga-filo-negro": {
    description: "Daga ennegrecida asociada al traidor Arbusal. Cuando atraviesa la armadura puede agotar los dones de la víctima o dejarla completamente inmóvil.",
    abilityDescriptions: [
      "Tras causar daño, impide a la víctima usar habilidades durante el turno actual y el siguiente.",
      "Tras causar daño, paraliza por completo a la víctima durante el turno actual y el siguiente."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D6", tags: ["short", "one_handed"], qualities: ["Corta"], requiresBinding: false } }
  },
  "frasco-peatro": {
    description: "Frasco con dos dosis de un líquido transformador. Cada dosis altera temporalmente el cuerpo y puede convertir corrupción en curación o mitigar los venenos, siempre con un precio oscuro.",
    abilityDescriptions: [
      "Durante 1D4 turnos cura 1D4 de Resistencia por turno y genera corrupción temporal igual a la mitad de lo curado, redondeando hacia arriba.",
      "Durante la transformación reduce a la mitad el daño de veneno; el daño evitado se convierte en corrupción temporal."
    ],
    artifact: { resources: [{ key: "dosis", name: "Dosis", suggestedMaxFormula: "2", maximum: 2, current: 2 }] },
    abilityExtras: [
      { rolls: [{ kind: "healing", label: "Curación por turno", formula: "1D4" }], resourceCosts: [{ resourceKey: "dosis", amount: 1 }] },
      { resourceCosts: [{ resourceKey: "dosis", amount: 1 }] }
    ]
  },
  "hacha-hambre": {
    description: "Hacha de batalla llamada Hambre, dotada de un filo sobrenatural. Al despertar su mordedura nocturna, la misma oscuridad que hiere al enemigo va corrompiendo a ambos combatientes.",
    abilityDescriptions: ["Activa el poder durante el resto de la escena. Cada impacto hace sufrir al portador 1D4 de corrupción temporal y causa al objetivo esa misma cantidad como corrupción y daño adicional."],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8+1", tags: ["one_handed"], qualities: ["Impacto agravado"], requiresBinding: false } },
    abilityExtras: [{ rolls: [{ kind: "custom", label: "Corrupción y daño por impacto", formula: "1D4" }] }]
  },
  "puno-hierro-yarego": {
    description: "Puño de hierro que sustituye de forma irreversible la mano del vinculado. Mejora en +1 su Defensa y el daño desarmado, pero le impide manejar armas con ese brazo.",
    abilityDescriptions: [
      "Una vez por escena, tras atravesar la armadura, enfrenta Fuerte contra Tenaz; si vence, la víctima pierde sus dos acciones siguientes.",
      "Una vez por escena, tras causar daño, enfrenta Fuerte contra Fuerte para derribar al objetivo.",
      "Agarra el arma de un enemigo y trata de partirla con Fuerte; un arma mística no se rompe, pero queda desarmada."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D4+1", tags: ["short", "one_handed"], qualities: ["Desarmado", "+1 Defensa"], requiresBinding: true } },
    abilityExtras: [
      { perSceneLimit: 1, rolls: [check("Aturdir", "fuerte", "tenaz")] },
      { perSceneLimit: 1, rolls: [check("Derribar", "fuerte", "fuerte")] },
      { rolls: [check("Romper arma", "fuerte")] }
    ]
  },
  "himno": {
    description: "Hacha doble llamada Himno. Sus golpes contra una superficie dura producen una resonancia marcial que refuerza a los aliados y puede amplificar un Himno de batalla.",
    abilityDescriptions: [
      "Golpea una superficie resistente; durante un turno los aliados reciben +1 a Fuerte y Tenaz.",
      "Requiere Himno de batalla. Durante 1D4 turnos los aliados obtienen +2 a Ágil, Diestro y Fuerte, y al activarse recuperan 1D8 de Resistencia."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D10", tags: ["heavy"], qualities: ["Pesada"], requiresBinding: false } },
    abilityExtras: [{}, { requirements: [capability("Himno de batalla")], rolls: [{ kind: "healing", label: "Resistencia recuperada", formula: "1D8" }] }]
  },
  "capucha-dorgvalg": {
    description: "Capucha de armadura ligera usada por Dorgvalg. Sus runas pueden desplegar una barrera protectora y transformar al portador en una gran criatura alada semejante a un búho.",
    abilityDescriptions: [
      "Activa o desactiva un escudo rúnico. Mientras está activo concede 1D6 de protección, pero cada impacto detenido genera 1D4 de corrupción temporal.",
      "Tras un turno completo de transformación, permite adquirir y usar el rasgo Alado como una habilidad ordinaria mientras se lleve la capucha."
    ],
    artifact: { armor: { protectionFormula: "1D4", qualities: ["Ligera", "Flexible", "Reforzada"], requiresBinding: false } },
    abilityExtras: [{ rolls: [{ kind: "armor", label: "Escudo rúnico", formula: "1D6" }] }, { perSceneNote: "Activarla requiere un turno entero." }]
  },
  "lanza-terael-kael": {
    description: "Lanza larga de Terael-Kael, equilibrada para el lanzamiento y capaz de volver a la mano de su amo o sacudir el terreno con el golpe de su asta.",
    abilityDescriptions: [
      "Requiere Viento de acero. Después de lanzarla, la lanza vuelve de inmediato a la mano del portador.",
      "Golpea el suelo; todas las criaturas a distancia cuerpo a cuerpo que fallen una tirada de Ágil caen derribadas."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8+1", tags: ["long", "thrown"], qualities: ["Larga", "Impacto agravado"], requiresBinding: false } },
    abilityExtras: [{ requirements: [capability("Viento de acero")] }, { rolls: [check("Mantenerse en pie", "agil")] }]
  },
  "mataaranas": {
    description: "Arma cambiante conocida como Mataarañas. Siempre es equilibrada, precisa y de impacto agravado, y puede adoptar distintas formas o despertar una furia especial contra arácnidos.",
    abilityDescriptions: [
      "Durante un turno completo cambia entre arma corta, de una mano, larga o pesada; la forma permanece hasta una nueva transformación.",
      "El portador se corta para que el arma absorba su sangre y reduzca un veneno como si aplicara un antídoto moderado.",
      "Requiere Versado en criaturas a nivel adepto y especialización en bestias. Tras una tirada de Inteligente, inflige +1D8 contra arácnidos durante la escena."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "Según forma", tags: ["short", "one_handed", "long", "heavy"], qualities: ["Equilibrada", "Impacto agravado", "Precisa"], requiresBinding: false } },
    abilityExtras: [
      { perSceneNote: "La transformación requiere un turno entero." }, {},
      { requirements: [capability("Versado en criaturas", "adepto"), { type: "narrative", capabilityName: "", description: "Especialización en bestias" }], rolls: [check("Conocimiento de arácnidos", "inteligente"), damage("Daño adicional", "1D8")] }
    ]
  },
  "venda-arvalam": {
    description: "Venda de Arvalam, creada para enfrentarse a demonios. Debe cubrir los ojos: mientras se lleva, cualquier prueba ajena a las capacidades místicas tiene dos oportunidades de fallar.",
    abilityDescriptions: [
      "Al invocar a un demonio concede +5 a Tenaz en el enfrentamiento; la bonificación se aplica a ambos intentos si se realiza un sacrificio de sangre.",
      "Requiere Exorcismo. Permite decidir si el demonio entra en la víctima y aumenta a 1D6 el daño que esta sufre cada turno."
    ],
    abilityExtras: [{ rolls: [check("Dominio del demonio", "tenaz", "tenaz")] }, { requirements: [capability("Exorcismo")], rolls: [damage("Daño por turno", "1D6")] }]
  },
  "urna-natana": {
    description: "Urna que aprisiona a Natana, un espíritu capaz de actuar como exploradora espectral. Vinculada, puede abrirse sin liberarla; sin vínculo, abrirla o romperla permite que escape.",
    abilityDescriptions: ["Natana explora, informa por telepatía y no puede dañar a los vivos. Fuera de la urna, todos los presentes a distancia de movimiento sufren 1D4 de corrupción por escena u hora; con el tiempo empieza a mezclar mentiras en sus informes."],
    abilityExtras: [{ rolls: [{ kind: "custom", label: "Corrupción del aura", formula: "1D4" }] }]
  },
  "anillo-alalarog": {
    description: "Anillo de anticipación de Alalarog. Ofrece destellos del futuro inmediato para evitar golpes cuerpo a cuerpo o encontrar una abertura imposible en la defensa enemiga.",
    abilityDescriptions: [
      "Antes de defenderse de un ataque cuerpo a cuerpo, permite tirar Defensa dos veces y conservar el mejor resultado.",
      "Antes de un ataque cuerpo a cuerpo o a distancia impone -3 a la tirada; si impacta, el ataque ignora armadura salvo la natural o mística."
    ]
  },
  "matadragones-elasath": {
    description: "Lanza de Elasath, concebida para matar reptiles. Es equilibrada, larga, sangrante y de impacto agravado, además de actuar como arma de perdición contra esas criaturas.",
    abilityDescriptions: [
      "Golpea a un reptil con la parte plana sin causar daño; sus escamas caen y su armadura natural queda reducida a 1 durante un mes.",
      "Golpea el suelo para acabar con la parálisis causada por Hipnótico en quienes lo oigan; pueden volver a ser hipnotizados después."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8+1", tags: ["long"], qualities: ["Equilibrada", "Impacto agravado", "Larga", "Sangrante", "Arma de perdición: reptiles"], requiresBinding: false } }
  },
  "escudo-loravana": {
    description: "Escudo de Loravana que puede arrojarse como un arma de 1D8 y regresar a la mano, o emplearse para golpear y derribar sin renunciar a la protección del portador.",
    abilityDescriptions: [
      "Requiere Viento de acero. Lanza el escudo, que inflige 1D8 y vuelve automáticamente; el portador puede seguir defendiéndose con él.",
      "Requiere Combate con escudo a nivel adepto. El golpe inflige 1D8 y concede +5 a Fuerte al intentar derribar."
    ],
    artifact: { armor: { protectionFormula: "", qualities: ["Escudo", "Arrojadizo"], requiresBinding: false } },
    abilityExtras: [
      { requirements: [capability("Viento de acero")], rolls: [damage("Escudo arrojado", "1D8")] },
      { requirements: [capability("Combate con escudo", "adepto")], rolls: [damage("Golpe de escudo", "1D8"), check("Derribar (+5)", "fuerte", "fuerte")] }
    ]
  },
  "anillo-gorvadan": {
    description: "Anillo mental de Gorvadan. Permite enviar pensamientos breves sin revelar al emisor y, en manos de un místico de la confusión, encerrar una mente dentro de sí misma.",
    abilityDescriptions: [
      "Envía hasta diez palabras a una criatura visible y cercana, normalmente a menos de cien metros. El receptor no identifica al emisor y este obtiene +2 a Persuasivo en una negociación vinculada.",
      "Requiere Confusión. Sin tirada, deja incapacitada a una víctima mientras el portador mantenga el efecto."
    ],
    abilityExtras: [{}, { requirements: [capability("Confusión")] }]
  },
  "cabezal-bargalvax": {
    description: "Cabezal de báculo de Bargalvax. Puede contener hasta tres poderes místicos implantados y permite activarlos con rapidez sin consumirlos.",
    abilityDescriptions: ["Tras un ritual de una hora implanta hasta tres poderes, sustituyendo los anteriores. El portador puede usar uno por turno como acción gratuita en vez de su acción normal; el poder permanece almacenado."],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "Según báculo", tags: ["long"], qualities: ["Cabezal adaptable"], requiresBinding: false } },
    abilityExtras: [{ perSceneNote: "Implantar o reemplazar poderes requiere una hora." }]
  },
  "incensario-olian": {
    description: "Incensario de cuentas de oro atribuido al espiritista Olian. Su humo obliga a los espíritus a tomar forma, oculta a los vivos de su mirada y refuerza los exorcismos.",
    abilityDescriptions: [
      "Envuelve en humo a un espíritu situado a dos movimientos; si Tenaz vence a Tenaz, se materializa durante un turno y puede recibir daño físico.",
      "Oculta al portador y sus acompañantes de los espíritus mientras solo se muevan. Dura 1D4 turnos y después exige Discreto contra Atento por espíritu y turno.",
      "Requiere Exorcismo. Concede dos oportunidades en cada uno de los tres intentos para desterrar al espíritu."
    ],
    abilityExtras: [
      { rolls: [check("Materializar", "tenaz", "tenaz")] },
      { rolls: [check("Mantener la cortina", "discreto", "atento")] },
      { requirements: [capability("Exorcismo")] }
    ]
  },
  "flauta-trovador": {
    description: "Flauta travesera curva vinculada al trovador anónimo de antiguas leyendas. Sus melodías frustran a los seres civilizados, ya sea distrayéndolos o dejándolos absortos.",
    abilityDescriptions: [
      "Encadena enfrentamientos de Inteligente contra Tenaz hasta fallar. Cada afectado sufre -3 a sus pruebas mientras continúe la música o hasta que se rompa la concentración.",
      "Requiere la bendición Músico. Encadena objetivos como Enervar; los afectados dejan de actuar hasta ser atacados, sufrir un cambio importante o terminar la música."
    ],
    abilityExtras: [{ rolls: [check("Enervar", "inteligente", "tenaz")] }, { requirements: [capability("Músico")], rolls: [check("Hipnotizar", "inteligente", "tenaz")] }]
  },
  "baston-susurrador": {
    description: "Bastón vivo atribuido a Ur, la primera bruja. No sirve como arma, pero concede +1 a las pruebas de poderes y rituales de la senda verde de Brujería y permite mandar sobre la vegetación cercana.",
    abilityDescriptions: [
      "Una vez por turno y sobre tierra, enfrenta Tenaz contra Ágil durante el movimiento de un enemigo; si vence, el objetivo cae y pierde el resto de sus acciones.",
      "Una vez por turno, ramas o raíces hacen que un ataque a distancia o poder místico tenga dos oportunidades de fallar, o que su objetivo se defienda dos veces.",
      "En un turno entero forma una cubierta vegetal que protege de ataques físicos y poderes. El portador no puede actuar y la cubierta dura hasta un día o hasta descartarla."
    ],
    abilityExtras: [{ rolls: [check("Tropiezo", "tenaz", "agil")] }, {}, { perSceneNote: "Requiere un turno entero y vegetación suficiente." }]
  },
  "guantes-joliana": {
    description: "Guantes de raíces vivas que se ajustan a las manos del vinculado. Refuerzan las presas y pueden brotar espinas o raíces que drenan la vitalidad del enemigo agarrado.",
    abilityDescriptions: [
      "Con Lucha o Estrangulador, añade +5 a los atributos usados para iniciar o mantener una presa.",
      "Contra un enemigo apresado, inflige 1D4 de daño por turno que ignora armadura.",
      "Contra un enemigo apresado, inflige 1D6 que ignora armadura y cura esa misma Resistencia al portador. Sustituye al Mordisco espinoso durante ese turno."
    ],
    abilityExtras: [
      { requirements: [{ type: "narrative", capabilityName: "", description: "Requiere Lucha o Estrangulador" }] },
      { rolls: [damage("Espinas", "1D4")] },
      { rolls: [damage("Drenaje", "1D6"), { kind: "healing", label: "Resistencia recuperada", formula: "1D6" }] }
    ]
  },
  "hachuela-sangrienta": {
    description: "Hacha bastarda de la herrera rúnica Xansha. A dos manos es larga y gigantesca; a una mano puede combinarse con escudo, pero pierde esas cualidades. Siempre es de difícil manejo.",
    abilityDescriptions: [
      "Durante una escena, el portador recupera Resistencia igual a la mitad del daño que inflige a sus enemigos.",
      "Durante el turno, cada ataque que impacte se encadena contra otro enemigo cuerpo a cuerpo hasta que uno falle; las habilidades empleadas se aplican a toda la serie."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D10", tags: ["one_handed", "long", "heavy"], qualities: ["Arma bastarda", "Larga a dos manos", "Gigantesca a dos manos", "Difícil manejo"], requiresBinding: false } }
  },
  "lanza-porgo": {
    description: "Lanza élfica regalada al caballero Porgo. En combate cuerpo a cuerpo inflige 1D8 y lanzada 1D6; posee las cualidades Larga, Precisa y Sangrante.",
    abilityDescriptions: [
      "Requiere Viento de acero. Después de ser lanzada, vuelve automáticamente a la mano del portador.",
      "Requiere Viento de acero. En el regreso realiza un segundo ataque; si impacta aplica de nuevo el daño del arma, pero no las habilidades del portador."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8 cuerpo a cuerpo / 1D6 arrojada", tags: ["long", "thrown"], qualities: ["Larga", "Precisa", "Sangrante"], requiresBinding: false } },
    abilityExtras: [{ requirements: [capability("Viento de acero")] }, { requirements: [capability("Viento de acero")], rolls: [{ kind: "attack", label: "Ataque de regreso", formula: "1D20", actorAttribute: "diestro" }] }]
  },
  "hacha-ramara": {
    description: "Cabeza de hacha de la cazadora Ramara. Con el mango adecuado funciona como hacha de una mano, alabarda o zapapico y conserva siempre la cualidad Sangrante.",
    abilityDescriptions: [
      "Contra Bestias o Abominaciones, renuncia a las reacciones para atacar a todos los enemigos al alcance; cada impacto causa +1D8 de daño.",
      "Requiere Versado en criaturas. Inflige +1D4 a Bestias y Abominaciones, o +1D8 si la habilidad está a nivel adepto."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "Según mango", tags: ["one_handed", "long", "heavy"], qualities: ["Sangrante"], requiresBinding: false } },
    abilityExtras: [{ rolls: [damage("Daño adicional", "1D8")] }, { requirements: [capability("Versado en criaturas")], rolls: [damage("Daño adicional", "1D4 / 1D8 a nivel adepto")] }]
  },
  "estandarte-kavaler": {
    description: "Bandera imperecedera del pueblo de Kavaler. Su roble y espadas cruzadas infunden valor, permiten a una formación recuperar fuerzas y sostienen una ofensiva desesperada.",
    abilityDescriptions: [
      "Durante una escena, los aliados que ven el estandarte no huyen salvo orden y obtienen +5 para resistir miedo y efectos de destierro.",
      "Una vez por escena de combate, los aliados visibles pueden sacrificar sus dos acciones para recuperar 1D6 de Resistencia.",
      "Si los aliados superan al enemigo al menos en un 50%, durante 1D4, 1D6 o 1D8 turnos ignoran 1D4 de cada impacto e infligen +1D6 de daño."
    ],
    abilityExtras: [{}, { perSceneLimit: 1, rolls: [{ kind: "healing", label: "Resistencia recuperada", formula: "1D6" }] }, { rolls: [{ kind: "armor", label: "Daño ignorado", formula: "1D4" }, damage("Daño adicional", "1D6"), { kind: "custom", label: "Duración elegida", formula: "1D4 / 1D6 / 1D8 turnos" }] }]
  },
  "sol-acero": {
    description: "Disco metálico asociado al sol y montado en un bastón. Libera una tormenta luminosa devastadora, pero necesita varios días de luz para recuperar su poder.",
    abilityDescriptions: ["Ciega durante 1D4 turnos a quien mire el destello. Abominaciones y muertos vivientes sufren 3D10 de daño que ignora armadura, reducido a la mitad si superan Tenaz. Se recarga en 1D6+4 días soleados o el doble con cielo cubierto."],
    abilityExtras: [{ rolls: [damage("Daño sagrado", "3D10"), check("Resistir para mitad de daño", "tenaz")] }]
  },
  "brujula-einon": {
    description: "Brújula creada por el elfo invernal Einon. Su aguja blanca y negra busca a la abominación más poderosa dentro de un kilómetro.",
    abilityDescriptions: ["Durante una escena u hora apunta hacia la abominación más poderosa en un radio de un kilómetro. La aguja se vuelve inestable al acercarse y gira sin dirección a menos de cien metros."],
    abilityExtras: [{ perSceneNote: "Dura una escena o una hora y puede volver a activarse." }]
  },
  "bolsa-basigor": {
    description: "Bolsa aceitosa fabricada con el estómago de una gwann. Procesa materia orgánica durante una hora y produce una pasta capaz de alimentar a seis personas durante un día.",
    abilityDescriptions: ["Tras una hora produce seis raciones diarias. Cada comensal gana 1 de corrupción temporal por cada día que la consume; esa corrupción persiste hasta completar siete días seguidos comiendo alimentos normales."],
    abilityExtras: [{ perSceneNote: "El procesado tarda aproximadamente una hora." }]
  },
  "manto-alial": {
    description: "Manto creado para el paranoico rey Alial XIII. Sus poderes forman un velo hermético: tras 10+1D10 minutos el portador se desmaya por falta de aire.",
    abilityDescriptions: [
      "Forma durante una escena un cascarón de piedra con Resistencia 20, Punto de ruptura 10 y Protección 10, hasta cancelarlo o romperlo.",
      "Adopta el color y textura del entorno durante una escena. Solo quien sepa con certeza dónde buscar puede encontrar al portador con Atento -5."
    ],
    abilityExtras: [{ rolls: [{ kind: "armor", label: "Protección del cascarón", formula: "10" }] }, { rolls: [{ kind: "check", label: "Encontrar al portador", formula: "1D20", actorAttribute: "atento", fixedTarget: 5 }] }]
  },
  "aguas-viles": {
    description: "Mercurio negro de corrupción pura, contenido en vidrio volcánico. Solo acepta un vínculo mediante Corrupción permanente y su jarra contiene diez gotas.",
    abilityDescriptions: [
      "Cada gota concede 1D12 de experiencia y causa 1 punto de Corrupción permanente al receptor.",
      "Una vez por escena aumenta un nivel el dado de efecto de un poder de Hechicería.",
      "Rompe el vial: cada criatura corrupta presente recibe hasta 1D12 de Corrupción permanente, aplicando solo la diferencia si ya tenía corrupción permanente."
    ],
    artifact: { bindingCosts: [{ paymentType: "permanent_corruption", amount: 1 }], resources: [{ key: "gotas", name: "Gotas", suggestedMaxFormula: "10", maximum: 10, current: 10 }] },
    abilityExtras: [{ resourceCosts: [{ resourceKey: "gotas", amount: 1 }], rolls: [{ kind: "custom", label: "Experiencia concedida", formula: "1D12" }] }, { perSceneLimit: 1 }, { rolls: [{ kind: "custom", label: "Corrupción permanente", formula: "1D12" }] }]
  },
  "anillo-pacto-hierro": {
    description: "Anillo forjado para los antiguos líderes del Pacto de Hierro. Solo acepta un vínculo pagado con experiencia y castiga con 1D4 de daño cada punto de corrupción aceptado voluntariamente.",
    abilityDescriptions: [
      "Protege por completo de entornos corruptores y Ataques de Corrupción, pero no de la corrupción aceptada voluntariamente al usar poderes o artefactos.",
      "Una vez por noche de sueño envía a otro portador conocido un mensaje onírico formado solo por imágenes."
    ],
    artifact: { bindingCosts: [{ paymentType: "xp", amount: 1 }] },
    abilityExtras: [{ activation: "passive" }, { perSceneLimit: 1, perSceneNote: "Una vez por noche de sueño." }]
  },
  "comealmas": {
    description: "Martillo de guerra de funesta reputación. Puede robar un poder místico ligado a Tenaz de una criatura a la que mate y conservar uno solo en sus runas.",
    abilityDescriptions: [
      "Cuando el martillo da el golpe mortal, puede sustituir el poder almacenado por un poder místico de Tenaz que poseyera la víctima.",
      "Usa el poder almacenado como propio, con Tenaz 15 para resolverlo salvo al calcular el umbral de Corrupción."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D8", tags: ["one_handed"], qualities: ["Martillo de guerra"], requiresBinding: false } }
  },
  "cruz-troll-ella": {
    description: "Escudo de hierro meteórico grabado con la cruz troll de Ella. Puede usarse como rodela sin vínculo; sus bendiciones protegen la mente y devuelven poderes ofensivos.",
    abilityDescriptions: [
      "Una vez por turno concede una segunda oportunidad para resistir con Tenaz un poder mental o para cancelar uno que continúe activo.",
      "Refleja un poder ofensivo contra su lanzador usando los atributos del portador; genera 1D4 de corrupción si funciona y 1D6 si falla."
    ],
    artifact: { armor: { protectionFormula: "", qualities: ["Escudo", "Rodela"], requiresBinding: false } }
  },
  "fullangra": {
    description: "Cofre que contiene a la enana Fullangra, también llamada Longenuff. El vínculo permite comunicarse mentalmente con ella y ordenarle tareas; si muere ligada, se recupera en el cofre durante siete días.",
    abilityDescriptions: [
      "Ordena a Fullangra vigilar, buscar, transportar, comerciar o servir de guardaespaldas. Viaja sin descansar; en trayectos largos un 20 en 1D20 provoca que regrese herida al cofre durante una semana.",
      "Libera a Fullangra a cambio de un último asesinato. Si se la libera sin pedir nada puede retirar 1D6 de Corrupción permanente o conceder 1D6 PX reservados para tiradas por experiencia."
    ],
    abilityExtras: [{ rolls: [{ kind: "custom", label: "Riesgo del viaje", formula: "1D20" }] }, { rolls: [{ kind: "custom", label: "Regalo de libertad", formula: "1D6" }] }]
  },
  "parcabrasa": {
    description: "Hacha arrojadiza habitada por espíritus de fuego y ceniza. Su cabeza ardiente inflige +1D4 de daño y regresa gratis a la mano de su amo tras lanzarla o dejarla caer.",
    abilityDescriptions: [
      "Al lanzarla, el filo se vuelve lava y el ataque ignora por completo la armadura.",
      "Tras impactar al primer objetivo, encadena ataques contra nuevos enemigos hasta que uno falle; entonces regresa a la mano."
    ],
    artifact: { weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D6+1D4", tags: ["one_handed", "thrown"], qualities: ["Arrojadiza", "Regreso"], requiresBinding: false } }
  },
  "piel-haganor": {
    description: "Manto de piel de lindorma que añade 1D4 a la armadura sin aumentar la incomodidad, incluso sin vínculo. Las lindormas lo reconocen y se vuelven enemigas personales de su portador.",
    abilityDescriptions: [
      "Enfrenta Persuasivo contra Tenaz de todos los oyentes enemigos; cada afectado pierde una de sus próximas acciones.",
      "Enfrenta Persuasivo contra Tenaz para controlar una criatura hasta fallar una nueva tirada o perder la concentración. La víctima solo dispone de una acción por turno y no usa poderes activos."
    ],
    artifact: { armor: { protectionFormula: "+1D4", qualities: ["Complementaria", "Sin Incómoda"], requiresBinding: false } },
    abilityExtras: [{ rolls: [check("Cautivar", "persuasivo", "tenaz")] }, { rolls: [check("Controlar", "persuasivo", "tenaz"), check("Mantener control", "persuasivo", "tenaz")] }]
  },
  "brasero-eldred": {
    description: "Brasero de cerámica agrietada atribuido al interrogador Eldred. Encendido en la mano de su amo, fuerza a la verdad a manifestarse o recupera memorias perdidas.",
    abilityDescriptions: [
      "Tras una pregunta y su respuesta, el interrogado introduce la mano en la llama: si ha mentido sufre 1D4 de daño; si dijo la verdad, el fuego resulta frío.",
      "El interrogado introduce la mano, sufre 1D4 de daño y recupera con claridad un recuerdo olvidado, reprimido o alterado que responda a la pregunta."
    ],
    abilityExtras: [{ perSceneNote: "Requiere un turno entero.", rolls: [damage("Quemadura si miente", "1D4")] }, { perSceneNote: "Requiere un turno entero.", rolls: [damage("Quemadura", "1D4")] }]
  },
  "cadena-algsar-mara": {
    description: "Cadena ligera y voraz de casi dos metros, atribuida a Algsar-Mara. Puede esgrimirse como un látigo largo con las cualidades Articulada, Enredadora e Impacto agravado.",
    abilityDescriptions: [
      "Con Ventaja, un ataque hace que la cadena inmovilice por completo a la víctima durante el siguiente turno. Después, una tirada contra Fuerte del objetivo mantiene la presa cada turno.",
      "Se coloca como trampa viva sobre una zona. Busca a quienes no la hayan tocado, atrapa hasta dos criaturas cercanas y avisa al portador con su traqueteo."
    ],
    artifact: { kind: "weapon", weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D6", tags: ["long"], qualities: ["Articulada", "Enredadora", "Impacto agravado"], requiresBinding: false } },
    abilityExtras: [{ rolls: [{ kind: "attack", label: "Lanzar cadena", formula: "1D20", actorAttribute: "diestro" }, check("Mantener presa", "fuerte")] }, { rolls: [check("Advertir al portador", "atento")] }]
  }
};

const detailedPresets: Preset[] = [
  preset(1, "aguas-penumbra", "Aguas de penumbra", "Guía del Director de Juego", 184, {
    description: "Vial de lágrimas sagradas elaborado por teúrgos de Prios durante el solsticio. Solo permite un vínculo pagado con experiencia: al vincularse, el portador recibe 1D4 de daño por cada punto de Corrupción permanente y, si sobrevive, queda purificado. El vial contiene 1D10 gotas.",
    bindingCosts: [{ paymentType: "xp", amount: 1 }],
    resources: [{ key: "gotas", name: "Gotas", suggestedMaxFormula: "1D10", maximum: undefined, current: undefined }],
    abilities: [
      ability("La luz del sol", "Baña el entorno con una luz equivalente a un día despejado con el sol en su cénit.", "free", "Ninguna"),
      ability("Lágrimas del sol", "Cada gota cura 1D10 de Resistencia, actúa como antídoto moderado, expía un punto de Corrupción permanente y causa a una criatura corrupta daño igual a su Corrupción.", "free", "Ninguna", { requiresBinding: false, resourceCosts: [{ resourceKey: "gotas", amount: 1 }], rolls: [{ kind: "healing", label: "Curación", formula: "1D10" }] }),
      ability("Energía sagrada", "Aumenta un nivel el dado de efecto de los poderes teúrgicos.", "free", "Ninguna", { perSceneLimit: 1 }),
      ability("La justicia del iluminario", "Rompe el vial y causa a cada criatura corrupta presente un daño igual a su Corrupción; las abominaciones reciben 1D10+10. También afecta al portador.", "free", "Ninguna", { rolls: [damage("Daño a abominaciones", "1D10+10")] }),
      ability("Castigo reluciente", "Si el portador vinculado queda marcado por la corrupción, el vial detona automáticamente con el efecto de La justicia del iluminario.", "reaction", "Ninguna", { activation: "triggered" })
    ]
  }),
  preset(2, "baculo-opadia", "Báculo serpiente de Opadia", "Guía del Director de Juego", 185, {
    kind: "weapon",
    description: "Báculo rúnico cuya cabeza de serpiente cobra vida y muerde con veneno.",
    weapon: { attackAttribute: "diestro", attackFormula: "1D20", damageFormula: "1D6", tags: ["long"], qualities: ["Bastón", "Larga"], requiresBinding: false },
    abilities: [
      ability("El mordisco del báculo", "Tras causar daño con el báculo, aplica veneno moderado durante 1D6 turnos.", "reaction", "1D4", { rolls: [{ kind: "damage", label: "Veneno", formula: "1D6" }] }),
      ability("Abrazo de mordiscos", "El báculo se enrosca y sigue mordiendo mientras se mantenga la presa.", "reaction", "1D6", { rolls: [{ kind: "check", label: "Mantener presa", formula: "1D20", actorAttribute: "atento", opponentAttribute: "fuerte" }, { kind: "damage", label: "Mordisco", formula: "1D6" }], requirements: [{ type: "capability", capabilityName: "Armas de asta", minimumLevel: "novato", description: "" }] })
    ]
  }),
  preset(3, "mano-mal-rogan", "Mano momificada de Mal-Rogan", "Libro Básico", 255, {
    description: "La mano de Mal-Rogan contiene su alma y le permite regresar mientras exista.",
    abilities: [
      ability("Palabra de perdición", "El objetivo repite sus tiradas de Defensa y conserva el peor resultado durante la escena.", "combat", "1D6", { rolls: [{ kind: "check", label: "Perdición", formula: "1D20", actorAttribute: "tenaz" }], requirements: [{ type: "capability", capabilityName: "Líder", minimumLevel: "novato", description: "" }] }),
      ability("Éxtasis oscuro", "Permite repetir una tirada de acción.", "free", "1D4", { rolls: [{ kind: "check", label: "Activación", formula: "1D20", actorAttribute: "tenaz" }] }),
      ability("La venganza de Mal-Rogan", "Destruye el amuleto y libera el alma de Mal-Rogan, que intenta poseer al portador. Al terminar la posesión, tenga éxito o no, Mal-Rogan muere definitivamente.", "combat", "Ninguna; resuelve Posesión", { rolls: [{ kind: "check", label: "Destrucción", formula: "1D20", actorAttribute: "tenaz" }] })
    ]
  }),
  preset(4, "piedra-solar", "Piedra Solar", "Libro Básico", 255, {
    description: "Piedra que alberga un espíritu salvaje del fuego.",
    abilities: [
      ability("Golpe de fuego", "Incendia un objeto visible; causa 1D4 de daño durante 1D4 turnos.", "combat", "1D4", { rolls: [{ kind: "check", label: "Activación", formula: "1D20", actorAttribute: "tenaz" }, { kind: "damage", label: "Fuego", formula: "1D4" }] }),
      ability("Avivar llama", "Aumenta un nivel el dado de efecto de un poder de fuego.", "free", "1D4", { rolls: [{ kind: "check", label: "Activación", formula: "1D20", actorAttribute: "tenaz" }] }),
      ability("Espíritu de fuego", "Destruye la piedra y libera un espíritu que obedece durante la escena.", "combat", "1D6", { rolls: [{ kind: "check", label: "Liberación", formula: "1D20", actorAttribute: "tenaz" }] })
    ]
  }),
  preset(5, "escudo-abalog", "Escudo de Abalog", "Aventuras 1", 6, {
    kind: "armor",
    description: "Escudo mágico de piedra asociado al troll sabio Abalog.",
    armor: { protectionFormula: "", qualities: ["Escudo"], requiresBinding: false },
    abilities: [
      ability("Punto de apoyo", "Permite tirar Fuerte en vez de Ágil para mantener la posición o recuperar el equilibrio.", "reaction", "1"),
      ability("Arremetida enana", "La cara de piedra muerde al golpear e inflige 1D4 adicional.", "reaction", "1D4", { rolls: [{ kind: "damage", label: "Mordisco", formula: "1D4" }], requirements: [{ type: "capability", capabilityName: "Combate con escudo", minimumLevel: "novato", description: "" }] })
    ]
  }),
  preset(6, "ojo-matulda", "Ojo de Matulda", "Aventuras 1", 6, {
    description: "Ojo de piedra verde que contiene al familiar alado Megase y puede acumular corrupción.",
    resources: [{ key: "corrupcion", name: "Corrupción acumulada", suggestedMaxFormula: "Según Piedra de Espíritu", maximum: undefined, current: undefined }],
    abilities: [
      ability("Amigo de Megase", "Convoca como familiar a Megase, un cerdo alado que recuerda lo que devora y permite repetir pruebas de Inteligente usando el atributo de la criatura.", "free", "Ninguna", { activation: "passive" }),
      ability("Imán de corrupción", "Acumula Corrupción como una Piedra de Espíritu cuando su portador conoce el ritual necesario.", "free", "Ninguna", { activation: "passive" }),
      ability("Ojo diabólico", "Dispara energía negra gastando corrupción acumulada; causa 1D4 por punto y cada punto liberado pasa a ser Corrupción permanente del portador.", "combat", "1 Corrupción permanente por punto gastado", { rolls: [{ kind: "check", label: "Ataque", formula: "1D20", actorAttribute: "tenaz", opponentAttribute: "tenaz" }, { kind: "damage", label: "Daño por punto", formula: "1D4" }], resourceCosts: [{ resourceKey: "corrupcion", amount: 1 }] })
    ]
  }),
  preset(7, "velo-mial", "Velo de Mial", "Aventuras 1", 8, { description: "Velo encargado por el rey Mial para ocultar sus secretos. Puede volver invisibles objetos y, en manos de alguien hábil con el engaño, también criaturas vivas.", abilities: [
    ability("Ocultar objeto", "Vuelve invisible un objeto inanimado; puede detectarse con Discreto contra Atento.", "combat", "1", { rolls: [{ kind: "check", label: "Ocultación", formula: "1D20", actorAttribute: "discreto", opponentAttribute: "atento" }] }),
    ability("Ocultar criatura", "Oculta una criatura viva, incluso en movimiento con mayor dificultad.", "combat", "1D4", { rolls: [{ kind: "check", label: "Ocultación", formula: "1D20", actorAttribute: "discreto", opponentAttribute: "atento" }], requirements: [{ type: "capability", capabilityName: "Finta", minimumLevel: "novato", description: "" }] })
  ] }),
  preset(8, "capa-vesper", "Capa Flotante de Vesper", "Aventuras 1", 8, { description: "Capa asociada a Vesper y los Zorros Voladores. Retiene el aire para permitir descensos seguros y breves ascensos antes de planear.", abilities: [
    ability("Aterrizaje suave", "Permite planear y aterrizar suavemente desde gran altura.", "movement", "1D4"),
    ability("Jinete del viento", "Permite elevarse y descender planeando en la dirección elegida.", "combat", "1D6", { rolls: [{ kind: "check", label: "Vuelo", formula: "1D20", actorAttribute: "agil" }], requirements: [{ type: "capability", capabilityName: "Acróbata", minimumLevel: "novato", description: "" }] })
  ] }),
  preset(9, "mascaras-yeleta", "Máscaras de Yeleta", "Aventuras 1", 8, { description: "Máscaras creadas por la huldra Yeleta para contemplar el mundo sin disfraces. Revelan formas verdaderas y pueden proyectar una aparición aterradora.", abilities: [
    ability("La terrible realidad", "Permite ver al objetivo tal y como es realmente.", "free", "1D4", { rolls: [{ kind: "check", label: "Revelación", formula: "1D20", actorAttribute: "atento" }] }),
    ability("Mordisco de máscara", "Una aparición ataca al objetivo y puede aterrorizarlo.", "combat", "1D4", { rolls: [{ kind: "check", label: "Terror", formula: "1D20", actorAttribute: "tenaz", opponentAttribute: "tenaz" }], requirements: [{ type: "capability", capabilityName: "Ojo místico", minimumLevel: "novato", description: "" }] })
  ] }),
  preset(10, "careta-garulfu", "Careta de Garulfu", "Aventuras 1", 8, { description: "Sombría careta del caudillo Garulfu, concebida para imponer disciplina y convertir la fuerza de la personalidad en protección y dominio.", abilities: [
    ability("Escudo de carisma", "Sustituye una vez por turno la Defensa por Persuasivo e ignora Incómoda.", "reaction", "1D4"),
    ability("Pastor de esclavos", "Permite usar Dominación como Someter voluntad al mismo nivel.", "combat", "1D6", { requirements: [{ type: "capability", capabilityName: "Dominación", minimumLevel: "novato", description: "" }] })
  ] })
];

export const MYSTIC_ARTIFACT_PRESETS: Preset[] = [
  ...detailedPresets,
  ...adventureCatalog.map(([slug, name, source, page, kind], index) => {
    const details = catalogDetails[slug];
    if (!details) throw new Error(`Faltan los datos del artefacto predeterminado ${slug}`);
    const defaultWeapon = kind === "weapon" ? { attackAttribute: "diestro" as const, attackFormula: "1D20", damageFormula: "", tags: [], qualities: [], requiresBinding: true } : undefined;
    const defaultArmor = kind === "armor" ? { protectionFormula: "", qualities: [], requiresBinding: true } : undefined;
    return preset(100 + index, slug, name, source, page, {
      kind: kind ?? "object",
      description: details.description,
      weapon: defaultWeapon,
      armor: defaultArmor,
      resources: [],
      ...details.artifact,
      abilities: (catalogAbilitySpecs[slug] ?? []).map(([abilityName, actionCost, corruptionFormula, activation], abilityIndex) => ability(
        abilityName,
        details.abilityDescriptions[abilityIndex] ?? "",
        actionCost,
        corruptionFormula,
        { ...(activation ? { activation } : {}), ...(details.abilityExtras?.[abilityIndex] ?? {}) }
      ))
    });
  })
];

export async function seedMysticArtifactPresets(prisma: PrismaClient): Promise<void> {
  for (const entry of MYSTIC_ARTIFACT_PRESETS) {
    const input = entry.artifact;
    await prisma.$transaction(async (tx) => {
      const artifact = await tx.mysticArtifact.upsert({
        where: { slug: entry.slug },
        create: {
          id: entry.id, scope: "preset", slug: entry.slug, name: input.name, description: input.description,
          kind: input.kind, sourceTitle: input.sourceTitle, sourcePage: input.sourcePage,
          weaponAttackAttribute: input.weapon?.attackAttribute, weaponAttackFormula: input.weapon?.attackFormula ?? "1d20",
          weaponDamageFormula: input.weapon?.damageFormula ?? "", weaponTags: input.weapon?.tags ?? [], weaponQualities: input.weapon?.qualities ?? [],
          weaponRequiresBinding: input.weapon?.requiresBinding ?? true, armorProtectionFormula: input.armor?.protectionFormula ?? "",
          armorQualities: input.armor?.qualities ?? [], armorRequiresBinding: input.armor?.requiresBinding ?? true
        },
        update: {
          name: input.name, description: input.description, kind: input.kind, sourceTitle: input.sourceTitle, sourcePage: input.sourcePage,
          weaponAttackAttribute: input.weapon?.attackAttribute, weaponAttackFormula: input.weapon?.attackFormula ?? "1d20",
          weaponDamageFormula: input.weapon?.damageFormula ?? "", weaponTags: input.weapon?.tags ?? [], weaponQualities: input.weapon?.qualities ?? [],
          weaponRequiresBinding: input.weapon?.requiresBinding ?? true, armorProtectionFormula: input.armor?.protectionFormula ?? "",
          armorQualities: input.armor?.qualities ?? [], armorRequiresBinding: input.armor?.requiresBinding ?? true
        }
      });
      await tx.mysticArtifactAbility.deleteMany({ where: { artifactId: artifact.id } });
      await tx.mysticArtifactResource.deleteMany({ where: { artifactId: artifact.id } });
      await tx.mysticArtifactBindingCost.deleteMany({ where: { artifactId: artifact.id } });
      await tx.mysticArtifactBindingCost.createMany({ data: input.bindingCosts.map((cost) => ({ artifactId: artifact.id, paymentType: cost.paymentType, amount: cost.amount })) });
      const resourceIds = new Map<string, string>();
      for (const [sortOrder, resource] of input.resources.entries()) {
        const created = await tx.mysticArtifactResource.create({ data: { artifactId: artifact.id, ...resource, sortOrder } });
        resourceIds.set(resource.key, created.id);
      }
      for (const [sortOrder, capability] of input.abilities.entries()) {
        const created = await tx.mysticArtifactAbility.create({ data: {
          artifactId: artifact.id, name: capability.name, description: capability.description, activation: capability.activation,
          actionCost: capability.actionCost, corruptionFormula: capability.corruptionFormula, requiresBinding: capability.requiresBinding,
          perSceneLimit: capability.perSceneLimit, perSceneNote: capability.perSceneNote, sortOrder,
          rolls: { create: capability.rolls.map((roll, index) => ({ ...roll, sortOrder: index })) },
          requirements: { create: capability.requirements }
        } });
        for (const cost of capability.resourceCosts) {
          const resourceId = resourceIds.get(cost.resourceKey);
          if (resourceId) await tx.mysticArtifactAbilityResourceCost.create({ data: { abilityId: created.id, resourceId, amount: cost.amount } });
        }
      }
    });
  }

  for (const entry of MYSTIC_ARTIFACT_PRESETS.filter((presetEntry) => presetEntry.artifact.sourceTitle === "La corona de cobre")) {
    await refreshUntouchedLegacyCampaignCopies(prisma, entry);
  }
}

async function refreshUntouchedLegacyCampaignCopies(prisma: PrismaClient, entry: Preset): Promise<void> {
  const copies = await prisma.mysticArtifact.findMany({
    where: { scope: "campaign", presetSourceId: entry.id },
    select: { id: true, description: true, abilities: { select: { description: true } } }
  });

  for (const copy of copies) {
    if (!isUntouchedLegacyArtifactCopy(copy.description, copy.abilities.map((abilityEntry) => abilityEntry.description))) continue;
    const input = entry.artifact;
    await prisma.$transaction(async (tx) => {
      await tx.mysticArtifactAbility.deleteMany({ where: { artifactId: copy.id } });
      await tx.mysticArtifactBindingCost.deleteMany({ where: { artifactId: copy.id } });
      await tx.mysticArtifact.update({
        where: { id: copy.id },
        data: {
          description: input.description,
          kind: input.kind,
          sourceTitle: input.sourceTitle,
          sourcePage: input.sourcePage,
          weaponAttackAttribute: input.weapon?.attackAttribute,
          weaponAttackFormula: input.weapon?.attackFormula ?? "1d20",
          weaponDamageFormula: input.weapon?.damageFormula ?? "",
          weaponTags: input.weapon?.tags ?? [],
          weaponQualities: input.weapon?.qualities ?? [],
          weaponRequiresBinding: input.weapon?.requiresBinding ?? true,
          armorProtectionFormula: input.armor?.protectionFormula ?? "",
          armorQualities: input.armor?.qualities ?? [],
          armorRequiresBinding: input.armor?.requiresBinding ?? true
        }
      });
      await tx.mysticArtifactBindingCost.createMany({
        data: input.bindingCosts.map((cost) => ({ artifactId: copy.id, paymentType: cost.paymentType, amount: cost.amount }))
      });

      const existingResources = await tx.mysticArtifactResource.findMany({ where: { artifactId: copy.id } });
      const resourceIds = new Map(existingResources.map((resource) => [resource.key, resource.id]));
      for (const [sortOrder, resource] of input.resources.entries()) {
        const existingId = resourceIds.get(resource.key);
        if (existingId) {
          await tx.mysticArtifactResource.update({
            where: { id: existingId },
            data: { name: resource.name, suggestedMaxFormula: resource.suggestedMaxFormula, sortOrder }
          });
          continue;
        }
        const created = await tx.mysticArtifactResource.create({
          data: { artifactId: copy.id, ...resource, sortOrder }
        });
        resourceIds.set(resource.key, created.id);
      }

      for (const [sortOrder, artifactAbility] of input.abilities.entries()) {
        const created = await tx.mysticArtifactAbility.create({
          data: {
            artifactId: copy.id,
            name: artifactAbility.name,
            description: artifactAbility.description,
            activation: artifactAbility.activation,
            actionCost: artifactAbility.actionCost,
            corruptionFormula: artifactAbility.corruptionFormula,
            requiresBinding: artifactAbility.requiresBinding,
            perSceneLimit: artifactAbility.perSceneLimit,
            perSceneNote: artifactAbility.perSceneNote,
            sortOrder,
            rolls: { create: artifactAbility.rolls.map((roll, index) => ({ ...roll, sortOrder: index })) },
            requirements: { create: artifactAbility.requirements }
          }
        });
        for (const resourceCost of artifactAbility.resourceCosts) {
          const resourceId = resourceIds.get(resourceCost.resourceKey);
          if (resourceId) {
            await tx.mysticArtifactAbilityResourceCost.create({
              data: { abilityId: created.id, resourceId, amount: resourceCost.amount }
            });
          }
        }
      }
    });
  }
}
