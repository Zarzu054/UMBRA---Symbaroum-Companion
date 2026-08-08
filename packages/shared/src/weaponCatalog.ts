export type WeaponQualityOption = {
  id: string;
  label: string;
  aliases?: string[];
  summary: string;
  details?: string;
  grantsAction?: "thrown_attack" | "reload";
};

export type WeaponTemplate = {
  templateId: string;
  name: string;
  description: string;
  slot: "mainHand" | "offHand" | "ranged" | "none";
  attackAttribute: "agil" | "atento" | "discreto" | "diestro" | "fuerte" | "inteligente" | "persuasivo" | "tenaz";
  damageFormula: string;
  qualities: string[];
  weight: string;
  value: string;
  notes?: string;
  stackable?: boolean;
  defaultQuantity?: number;
};

export const WEAPON_QUALITY_OPTIONS: WeaponQualityOption[] = [
  { id: "corta", label: "Corta", summary: "Puede desenvainarse con una acción gratuita y utilizarse con Finta.", details: "Las armas cortas son fáciles de esconder, pueden desenvainarse con una acción gratuita y utilizarse con la habilidad Finta." },
  { id: "larga", label: "Larga", summary: "Concede un ataque gratuito cuando un rival sin arma Larga entra en combate.", details: "Proporciona un ataque gratuito el primer turno que un oponente sin arma Larga se traba en combate cuerpo a cuerpo." },
  { id: "precisa", label: "Precisa", summary: "Proporciona +1 a las tiradas de ataque.", details: "El arma está diseñada para golpear con facilidad y proporciona +1 a las tiradas de ataque." },
  { id: "pesada", label: "Pesada", summary: "Arma de gran masa orientada a impacto y uso a dos manos.", details: "En la hoja se usa como etiqueta de peso y estilo para armas grandes; suele combinarse con danios altos y otras cualidades exigentes." },
  { id: "a-distancia", label: "A distancia", summary: "Se usa desde la ranura a distancia y resuelve ataques como arma de proyectiles.", details: "Las armas a distancia dependen de linea de vision clara y a menudo requieren municion o recarga para rendir al maximo." },
  { id: "arrojadiza", label: "Arrojadiza", summary: "Puede lanzarse como ataque a distancia con su propio modo de uso.", details: "La hoja genera una accion de lanzamiento separada para el arma en la ficha.", grantsAction: "thrown_attack" },
  { id: "equilibrada", label: "Equilibrada", summary: "Proporciona +1 a Defensa mientras está equipada.", details: "El arma está especialmente bien equilibrada para bloquear ataques y proporciona +1 a Defensa." },
  { id: "recarga", label: "Recarga", summary: "Debe recargarse antes de volver a disparar.", details: "La ficha genera una accion especifica de recarga para que el flujo del arma quede visible junto a sus ataques.", grantsAction: "reload" },
  { id: "impacto-agravado", label: "Impacto agravado", aliases: ["Perforante"], summary: "Añade +1 al daño del arma.", details: "El arma causa +1 punto de daño adicional; este incremento ya está incluido en la fórmula de daño de las armas del catálogo." },
  { id: "cruenta", label: "Cruenta", aliases: ["Sangrado", "Profunda"], summary: "Causa una hemorragia acumulativa de 1 Resistencia por turno.", details: "Tras un golpe que cause daño, el objetivo pierde 1 Resistencia por turno; cada golpe adicional incrementa la hemorragia en +1 hasta recibir curación." },
  { id: "roma", label: "Roma", aliases: ["Contundente"], summary: "Usa un dado de daño inferior al normal para su categoría.", details: "La falta de filo reduce en un nivel el dado de efecto normal del tipo de arma; la fórmula del catálogo ya refleja esta reducción." },
  { id: "mistica", label: "Mistica", summary: "Arma mistica compatible con poderes, runas y mejoras sobrenaturales.", details: "La cualidad indica afinidad con tradiciones misticas o forja encantada." },
  { id: "arma-bastarda", label: "Arma bastarda", summary: "Puede usarse a una o dos manos, cambiando parte de su rendimiento segun el agarre.", details: "Las armas bastardas ofrecen versatilidad: escudo y una mano en espacios apretados, o control total cuando se empunan con ambas." },
  { id: "gigantesca", label: "Gigantesca", aliases: ["Masiva"], summary: "Permite tirar dos veces el dado de daño del arma y conservar el mejor resultado.", details: "Solo se repite el dado de daño propio del arma, no los dados adicionales procedentes de habilidades, poderes o elixires." },
  { id: "engorrosa", label: "Engorrosa", aliases: ["Torpe"], summary: "Atacar consume las acciones de combate y movimiento del turno.", details: "El arma es pesada y desequilibrada; quien la usa no puede atacar y moverse durante el mismo turno." },
  { id: "articulada", label: "Articulada", summary: "Las defensas impares reducen el golpe a 1D6 en vez de detenerlo.", details: "Si una defensa exitosa obtiene un resultado impar, el ataque impacta igualmente pero causa 1D6 de daño no modificable." },
  { id: "ocultable", label: "Ocultable", aliases: ["Oculta"], summary: "Solo puede descubrirse mediante un examen exhaustivo.", details: "Durante un examen exhaustivo puede detectarse con una tirada enfrentada de Discreto contra Atento; de otro modo pasa desapercibida." },
  { id: "presa", label: "Presa", aliases: ["Enredadora", "Inmovilizadora", "Inmovilizador"], summary: "Permite atrapar e inmovilizar a un objetivo.", details: "Con una tirada exitosa de Diestro contra Ágil impide moverse al objetivo y le da una segunda oportunidad de fallar sus tiradas de acción." },
  { id: "llameante", label: "Llameante", summary: "Puede prender fuego o dejar un efecto continuo de llamas.", details: "Granadas, flechas preparadas y tubos de fuego usan esta cualidad para extender danos o amenazas de incendio." },
  { id: "efecto-de-area-cono", label: "Efecto de area (cono)", summary: "Afecta a varios objetivos delante del usuario en un cono.", details: "Se resuelve contra cada criatura alcanzada dentro del frente del arma o dispositivo." },
  { id: "efecto-de-area-radio", label: "Efecto de area (radio)", summary: "Golpea a todos los objetivos dentro de un radio alrededor del punto de impacto.", details: "Se usa en granadas y dispositivos explosivos o incendiarios." },
  { id: "especial", label: "Especial", summary: "La regla exacta depende del arma y se detalla en sus notas.", details: "Esta cualidad se reserva para armas cuyo uso no cabe en una sola etiqueta, como cerbatanas, bolas o ballestas de repeticion." },
  { id: "retornante", label: "Retornante", summary: "Tras fallar, puede regresar con una tirada gratuita de Diestro.", details: "Si el ataque falla, una tirada exitosa de Diestro que cuenta como acción gratuita permite recuperar el arma." },
  { id: "demoledora", label: "Demoledora", summary: "Está destinada a destruir edificios y fortificaciones.", details: "Contra criaturas causa daño ignorando armadura; una Defensa exitosa reduce ese daño a la mitad." }
];

function makeWeaponTemplate(template: WeaponTemplate): WeaponTemplate {
  return template;
}

export const WEAPON_TEMPLATES: WeaponTemplate[] = [
  makeWeaponTemplate({ templateId: "weapon-single-handed", name: "Arma de una mano", description: "Categoria base de espadas, hachas y mazas comunes de una mano.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: [], weight: "Media", value: "5 taleros", notes: "Ref: Libro Basico p. 149." }),
  makeWeaponTemplate({ templateId: "weapon-short", name: "Arma corta", description: "Categoria base de cuchillos y armas cortas para combate muy cercano.", slot: "offHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Corta"], weight: "Ligera", value: "1 talero", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-long", name: "Arma larga", description: "Categoria base de lanzas, picas y otras armas de asta comunes.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["Larga"], weight: "Media", value: "3 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-heavy", name: "Arma pesada", description: "Categoria base de armas grandes de dos manos.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d10", qualities: ["Pesada"], weight: "Pesada", value: "10 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-ranged", name: "Arma a distancia", description: "Categoria base de armas de proyectiles sin rasgo distintivo adicional.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["A distancia"], weight: "Media", value: "5 taleros", notes: "Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-thrown", name: "Arma arrojadiza", description: "Categoria base de cuchillos, piedras o armas disenadas para lanzar.", slot: "none", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Arrojadiza"], weight: "Ligera", value: "2 taleros", notes: "Ref: Guia Avanzada del Jugador p. 112.", stackable: true, defaultQuantity: 3 }),
  makeWeaponTemplate({ templateId: "weapon-dagger", name: "Daga", description: "Arma corta facil de ocultar y util como secundaria o en pelea cerrada.", slot: "offHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Corta"], weight: "Ligera", value: "1 talero", notes: "Equivalente habitual a un arma corta." }),
  makeWeaponTemplate({ templateId: "weapon-parrying-dagger", name: "Daga de parada", description: "Daga de guardamano amplio pensada para desviar y responder rapidamente.", slot: "offHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Corta", "Equilibrada"], weight: "Ligera", value: "5 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-assassins-blade", name: "Hoja de asesino", description: "Hoja delgada y facil de esconder en la muneca, tobillo o tras la nuca.", slot: "offHand", attackAttribute: "discreto", damageFormula: "1d6", qualities: ["Corta", "Ocultable"], weight: "Ligera", value: "5 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-stiletto", name: "Estilete", description: "Punal estrecho hecho para entrar entre placas y costuras de armadura.", slot: "offHand", attackAttribute: "diestro", damageFormula: "1d6+1", qualities: ["Corta", "Impacto agravado"], weight: "Ligera", value: "5 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-battle-claw", name: "Garras de batalla", description: "Arma de punio o guantelete con hoja corta, util cuando no se quiere soltar otra cosa.", slot: "offHand", attackAttribute: "diestro", damageFormula: "1d4+1", qualities: ["Corta", "Impacto agravado"], weight: "Ligera", value: "1 talero", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-short-sword", name: "Espada corta", description: "Espada ligera para pelea cerrada o mano secundaria.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Corta"], weight: "Ligera", value: "4 taleros", notes: "Variante comun de arma corta." }),
  makeWeaponTemplate({ templateId: "weapon-long-sword", name: "Espada larga", description: "Arma versatil de una mano, comun entre aventureros y soldados.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: [], weight: "Media", value: "8 taleros", notes: "Variante comun de arma de una mano." }),
  makeWeaponTemplate({ templateId: "weapon-fencing-sword", name: "Hoja de esgrima", description: "Hoja agil de duelos y estocadas rapidas.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["Precisa"], weight: "Ligera", value: "25 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-estoc", name: "Estoque", description: "Espada estrecha acabada en punta de cuna para perforar armaduras.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8+1", qualities: ["Impacto agravado"], weight: "Media", value: "25 taleros", notes: "Ref: Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-crows-beak", name: "Pico de cuervo", description: "Martillo-pico concentrado en perforar armadura y cascos.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8+1", qualities: ["Impacto agravado"], weight: "Media", value: "25 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-axe", name: "Hacha", description: "Arma robusta de filo amplio y uso general.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: [], weight: "Media", value: "6 taleros", notes: "Variante comun de arma de una mano." }),
  makeWeaponTemplate({ templateId: "weapon-mace", name: "Maza", description: "Arma contundente para romper guardias y cascos.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: [], weight: "Media", value: "5 taleros", notes: "Variante comun de arma de una mano." }),
  makeWeaponTemplate({ templateId: "weapon-flail", name: "Mangual", description: "Cabeza articulada que rodea paradas y escudos con facilidad.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: ["Articulada"], weight: "Media", value: "25 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-bastard-sword-one-hand", name: "Espada bastarda (1 mano)", description: "Espada de gran calidad util con escudo, aunque luce mas a dos manos.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: ["Arma bastarda"], weight: "Media", value: "50 taleros", notes: "Empunada a una mano pierde la ventaja precisa de su agarre a dos manos. Ref: Libro Basico p. 148-149; Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-bastard-sword-two-hand", name: "Espada bastarda (2 manos)", description: "Espada bastarda llevada con ambas manos para exprimir alcance y precision.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Arma bastarda", "Precisa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Libro Basico p. 148-149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-greatsword", name: "Mandoble", description: "Espada a dos manos de gran potencia.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada"], weight: "Pesada", value: "14 taleros", notes: "Variante comun de arma pesada." }),
  makeWeaponTemplate({ templateId: "weapon-double-axe", name: "Hacha de doble filo", description: "Arma pesada de dos filos asociada a guerreros barbaros y simbolos antiguos.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10+1", qualities: ["Pesada", "Impacto agravado"], weight: "Pesada", value: "50 taleros", notes: "Ref: Libro Basico p. 148-149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-battle-flail", name: "Mayal de guerra", description: "Mangual de dos manos con impacto muy superior al modelo comun.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Articulada"], weight: "Pesada", value: "50 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-executioners-axe", name: "Hacha del verdugo", description: "Hacha enorme de ejecucion adoptada tambien en guerra por combatientes brutales.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10+1", qualities: ["Pesada", "Impacto agravado", "Gigantesca", "Engorrosa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-warhammer", name: "Martillo de guerra", description: "Martillo enorme con pinchos o cabeza pesada para aplastar y abrir sangrado.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Cruenta", "Gigantesca", "Engorrosa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-long-hammer-one-hand", name: "Martillo largo (1 mano)", description: "Arma bastarda que puede acompanar a un escudo, aunque con menor control.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: ["Arma bastarda", "Engorrosa"], weight: "Media", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 110." }),
  makeWeaponTemplate({ templateId: "weapon-long-hammer-two-hand", name: "Martillo largo (2 manos)", description: "Martillo bastardo llevado a dos manos para liberar su impacto completo.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Arma bastarda", "Gigantesca", "Engorrosa", "Precisa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-executioners-sword", name: "Espada del verdugo", description: "Espada gigantesca de golpe definitivo, dificil de manejar pero demoledora.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Precisa", "Gigantesca", "Engorrosa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-heavy-flail", name: "Mangual pesado", description: "Version ampliada del mangual de batalla, lenta pero dificil de bloquear.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10", qualities: ["Pesada", "Articulada", "Gigantesca", "Engorrosa"], weight: "Pesada", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-grappling-axe", name: "Hacha de abordaje", description: "Hacha larga de asalto que sirve para trepar, enganchar y despejar murallas o cubiertas.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d10+1", qualities: ["Arma bastarda", "Impacto agravado", "Engorrosa", "Precisa"], weight: "Pesada", value: "50 taleros", notes: "Puede blandirse a una mano con escudo, aunque rinde mejor a dos manos. Ref: Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-spear", name: "Lanza", description: "Arma larga para controlar distancia en combate.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8", qualities: ["Larga"], weight: "Media", value: "4 taleros", notes: "Variante comun de arma larga." }),
  makeWeaponTemplate({ templateId: "weapon-halberd", name: "Alabarda", description: "Arma de asta con punta y hoja de hacha, devastadora cuando conecta.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8+1", qualities: ["Larga", "Impacto agravado"], weight: "Pesada", value: "15 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-pike", name: "Pica", description: "Asta estrecha y punta templada pensadas para estocar con gran control.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["Larga", "Precisa"], weight: "Media", value: "15 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-quarterstaff", name: "Vara", description: "Baston de madera endurecida con fuego, de largo alcance y uso sencillo.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Larga", "Roma"], weight: "Media", value: "1 chelin", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 111." }),
  makeWeaponTemplate({ templateId: "weapon-chain-staff", name: "Vara mangual", description: "Baston con cadenas cortas en los extremos para atrapar y azotar al objetivo.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["Larga", "Presa"], weight: "Media", value: "15 taleros", notes: "Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-lance-mounted", name: "Lanza de caballeria", description: "Lanza adaptada para caballeria; a caballo mantiene gran alcance incluso a una mano.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8+1", qualities: ["Arma bastarda", "Larga"], weight: "Pesada", value: "15 taleros", notes: "A caballo conserva Larga incluso con una mano. Ref: Guia Avanzada del Jugador p. 110-112." }),
  makeWeaponTemplate({ templateId: "weapon-lance-two-hand", name: "Lanza de caballeria (2 manos)", description: "La misma lanza cuando se usa a pie con ambas manos.", slot: "mainHand", attackAttribute: "fuerte", damageFormula: "1d8+1", qualities: ["Arma bastarda", "Larga", "Precisa"], weight: "Pesada", value: "15 taleros", notes: "A pie es demasiado larga para una sola mano. Ref: Guia Avanzada del Jugador p. 111-112." }),
  makeWeaponTemplate({ templateId: "weapon-long-whip", name: "Latigo largo", description: "Latigo adaptado del pastoreo y la esclavitud para herir, trabar y castigar a distancia.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Articulada", "Presa", "Roma"], weight: "Ligera", value: "10 taleros", notes: "Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-runic-staff", name: "Baculo runico", description: "Baculo apto para combate y para canalizar poder mistico.", slot: "mainHand", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Larga", "Equilibrada", "Mistica"], weight: "Media", value: "25 taleros", notes: "Objeto habitual de Magia del baculo; el pie del baston puede potenciarlo todavia mas." }),
  makeWeaponTemplate({ templateId: "weapon-short-bow", name: "Arco corto", description: "Arma ligera de proyectiles facil de portar.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["A distancia"], weight: "Ligera", value: "6 taleros", notes: "Variante ligera y comun de arco." }),
  makeWeaponTemplate({ templateId: "weapon-bow", name: "Arco", description: "Arco comun de proyectiles, base de muchas companias de hostigadores.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["A distancia"], weight: "Media", value: "5 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-long-bow", name: "Arco largo", description: "Arma a distancia de mayor pegada y alcance.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["A distancia", "Precisa"], weight: "Media", value: "25 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-horsemans-bow", name: "Arco largo de jinete", description: "Arco asimetrico disenado para disparar a caballo sin perder demasiada pegada.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["A distancia", "Precisa"], weight: "Media", value: "50 taleros", notes: "Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-composite-bow", name: "Arco compuesto", description: "Arco de cuerno, tendones y madera con gran potencia para su tamano.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d8+1", qualities: ["A distancia", "Impacto agravado"], weight: "Media", value: "25 taleros", notes: "Muy apreciado entre pueblos jinetes. Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-sling", name: "Honda", description: "Arma sencilla de proyectiles para hostigar a distancia.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["A distancia"], weight: "Ligera", value: "1 talero", notes: "Arma de proyectiles simple y facil de transportar." }),
  makeWeaponTemplate({ templateId: "weapon-crossbow", name: "Ballesta", description: "Arma a distancia de gran impacto que exige recarga.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d10", qualities: ["A distancia", "Recarga"], weight: "Media", value: "8 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-arbalest", name: "Arbalesta", description: "Ballesta de gran penetracion para tiradores que priorizan potencia sobre cadencia.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d10+1", qualities: ["A distancia", "Impacto agravado", "Recarga"], weight: "Pesada", value: "40 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-small-crossbow", name: "Ballesta de mano", description: "Version escondible de la ballesta, disparable con una mano pero recargada con dos.", slot: "ranged", attackAttribute: "discreto", damageFormula: "1d10", qualities: ["A distancia", "Ocultable", "Recarga"], weight: "Ligera", value: "40 taleros", notes: "Se puede disparar con una mano pero no cargar con una sola. Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-repeating-crossbow", name: "Ballesta de repeticion", description: "Ballesta mecanica avanzada con palanca inferior para recargas muy rapidas.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d10", qualities: ["A distancia", "Especial", "Recarga"], weight: "Media", value: "40 taleros", notes: "La recarga se considera accion gratuita sin perder la pegada de una ballesta normal. Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-blowpipe", name: "Cerbatana", description: "Lanza dardos envenenados; el dardo no hace danio base, pero puede superar la armadura.", slot: "ranged", attackAttribute: "discreto", damageFormula: "", qualities: ["A distancia", "Especial"], weight: "Ligera", value: "2 taleros", notes: "El dardo penetra si supera la Armadura con 1d8, o 1d10 si el usuario tiene Tirador. Ref: Guia Avanzada del Jugador p. 112." }),
  makeWeaponTemplate({ templateId: "weapon-portable-firetube", name: "Tubo de fuego alquimico (portatil)", description: "Lanzallamas portatil de corto alcance que golpea a todos los enemigos frente al portador.", slot: "ranged", attackAttribute: "diestro", damageFormula: "1d12", qualities: ["A distancia", "Llameante", "Efecto de area (cono)", "Especial"], weight: "Pesada", value: "10 taleros", notes: "Puede causar fuego continuo; usarlo sin Experto en asedios implica riesgo de fallo catastrofico. Ref: Guia Avanzada del Jugador p. 110, 112." }),
  makeWeaponTemplate({ templateId: "weapon-throwing-knife", name: "Cuchillo arrojadizo", description: "Arma ligera para combate cercano o lanzamiento.", slot: "none", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Arrojadiza", "Corta", "Precisa"], weight: "Ligera", value: "2 taleros", notes: "Variante refinada de arma arrojadiza.", stackable: true, defaultQuantity: 3 }),
  makeWeaponTemplate({ templateId: "weapon-javelin", name: "Jabalina", description: "Arma ligera de asta preparada para lanzar o mantener distancia.", slot: "none", attackAttribute: "diestro", damageFormula: "1d8", qualities: ["Arrojadiza", "Larga"], weight: "Media", value: "2 taleros", notes: "Variante comun de arma arrojadiza con asta.", stackable: true, defaultQuantity: 2 }),
  makeWeaponTemplate({ templateId: "weapon-alchemical-grenade", name: "Granada alquimica", description: "Vasija ceramica con sustancias volatiles que explotan al encenderse o romperse.", slot: "none", attackAttribute: "diestro", damageFormula: "1d10", qualities: ["Arrojadiza", "Llameante", "Efecto de area (radio)", "Especial"], weight: "Ligera", value: "1 talero", notes: "Quien no tenga Alquimia, Experto en asedios o Pirotecnia corre riesgo de fallo catastrofico. Ref: Guia Avanzada del Jugador p. 111-112.", stackable: true, defaultQuantity: 1 }),
  makeWeaponTemplate({ templateId: "weapon-bolas", name: "Bolas", description: "Pesos unidos por cuerdas que se lanzan para frenar o capturar sin matar.", slot: "none", attackAttribute: "diestro", damageFormula: "", qualities: ["Arrojadiza", "Presa", "Especial"], weight: "Ligera", value: "2 taleros", notes: "Normalmente se lanzan a las piernas para impedir movimiento; apuntar a los brazos es mas dificil. Retirarlas requiere accion de combate y prueba de Agil. Ref: Guia Avanzada del Jugador p. 112.", stackable: true, defaultQuantity: 1 }),
  makeWeaponTemplate({ templateId: "weapon-throwing-wing", name: "Ala arrojadiza", description: "Arma arrojadiza curvada que puede regresar al lanzador si falla.", slot: "none", attackAttribute: "diestro", damageFormula: "1d6", qualities: ["Arrojadiza", "Retornante"], weight: "Ligera", value: "10 taleros", notes: "Vuelve con una tirada de Diestro hecha como accion gratuita si falla el blanco. Ref: Guia Avanzada del Jugador p. 112.", stackable: true, defaultQuantity: 1 }),
  makeWeaponTemplate({ templateId: "weapon-spear-sling", name: "Lanzadardos", description: "Correa para impulsar lanzas o dardos con fuerza muy superior a la del brazo.", slot: "none", attackAttribute: "diestro", damageFormula: "1d6+1", qualities: ["Arrojadiza", "Impacto agravado"], weight: "Ligera", value: "10 taleros", notes: "Ref: Libro Basico p. 149; Guia Avanzada del Jugador p. 112.", stackable: true, defaultQuantity: 3 })
];

export function normalizeWeaponQualityId(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseWeaponQualities(rawValue: string): string[] {
  return Array.from(new Set(
    String(rawValue ?? "")
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  ));
}

export function formatWeaponQualities(qualities: string[]): string {
  return Array.from(new Set(qualities.map((entry) => entry.trim()).filter(Boolean))).join(", ");
}

export function findWeaponQualityOption(value: string): WeaponQualityOption | undefined {
  const target = normalizeWeaponQualityId(value);
  return WEAPON_QUALITY_OPTIONS.find((entry) =>
    entry.id === target ||
    normalizeWeaponQualityId(entry.label) === target ||
    entry.aliases?.some((alias) => normalizeWeaponQualityId(alias) === target)
  );
}

export function describeWeaponQualities(qualities: string[]): string[] {
  return qualities
    .map((quality) => findWeaponQualityOption(quality))
    .filter((entry): entry is WeaponQualityOption => Boolean(entry))
    .map((entry) => `${entry.label}: ${entry.details ?? entry.summary}`);
}

export function buildWeaponCatalogNotes(baseNotes: string, qualities: string[]): string {
  const detailLines = describeWeaponQualities(qualities);
  return [baseNotes.trim(), ...detailLines]
    .filter(Boolean)
    .join("\n");
}
