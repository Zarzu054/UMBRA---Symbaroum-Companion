import {
  SYMBAROUM_ABILITIES,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_CAPABILITIES,
  SYMBAROUM_CULTURES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RACES,
  SYMBAROUM_RITUALS,
  type SymbaroumCapability
} from "@umbra/shared";

export type EntryType =
  | "regla"
  | "rasgo"
  | "habilidad"
  | "poder_mistico"
  | "ritual"
  | "raza"
  | "cultura"
  | "arquetipo"
  | "tradicion";

export type CompendiumEntry = {
  id: string;
  tipo: EntryType;
  nombre: string;
  resumen: string;
  detalle: string;
  fuente: string;
  pagina?: number;
  tags: string[];
  media?: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
};

export type CompendiumSummaryLink = {
  url: string;
  documentLabel: string;
  sectionLabel: string;
};

export const TYPE_LABELS: Record<"all" | EntryType, string> = {
  all: "Todo",
  regla: "Reglas",
  rasgo: "Rasgos",
  habilidad: "Habilidades",
  poder_mistico: "Poderes",
  ritual: "Rituales",
  raza: "Razas",
  cultura: "Culturas",
  arquetipo: "Arquetipos",
  tradicion: "Tradiciones"
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCapabilityEntry(item: SymbaroumCapability): CompendiumEntry {
  return {
    id: item.id,
    tipo: item.tipo,
    nombre: item.nombre,
    resumen: item.efectoResumen,
    detalle: item.efectoResumen,
    fuente: item.libro,
    pagina: item.pagina,
    tags: [...item.tradiciones, item.tipo]
  };
}

function buildSimpleEntries(
  items: readonly string[],
  tipo: Extract<EntryType, "raza" | "cultura" | "arquetipo">,
  fuente: string,
  resumenBase: string
): CompendiumEntry[] {
  return items.map((item) => ({
    id: `${tipo}-${slugify(item)}`,
    tipo,
    nombre: item,
    resumen: resumenBase,
    detalle: `${resumenBase} Ãšsalo como referencia rÃ¡pida dentro del creador y la ficha. Si necesitas reglas extendidas o variantes, consulta el libro correspondiente.`,
    fuente,
    tags: [tipo]
  }));
}

function buildRaceEntries(): CompendiumEntry[] {
  const raceSources: Record<string, { fuente: string; pagina: number; detalle: string }> = {
    Humano: {
      fuente: "Libro B\u00e1sico",
      pagina: 100,
      detalle: "Raza base del Libro B\u00e1sico. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Trocalengo: {
      fuente: "Libro B\u00e1sico",
      pagina: 100,
      detalle: "Raza base del Libro B\u00e1sico. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Trasgo: {
      fuente: "Libro B\u00e1sico",
      pagina: 100,
      detalle: "Raza base del Libro B\u00e1sico. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Ogro: {
      fuente: "Libro B\u00e1sico",
      pagina: 100,
      detalle: "Raza base del Libro B\u00e1sico. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Elfo: {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 38,
      detalle: "Raza a\u00f1adida en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Enano: {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 38,
      detalle: "Raza a\u00f1adida en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    Troll: {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 38,
      detalle: "Raza a\u00f1adida en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    "Humano tomado": {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 38,
      detalle: "Raza a\u00f1adida en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    },
    "Muerto viviente": {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 38,
      detalle: "Raza a\u00f1adida en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de razas para trasfondo, rasgos y creaci\u00f3n de personaje."
    }
  };

  return SYMBAROUM_RACES.map((item) => {
    const source = raceSources[item] ?? {
      fuente: "Libro B\u00e1sico",
      pagina: 100,
      detalle: "Referencia de raza disponible para creaci\u00f3n de personaje."
    };

    return {
      id: `raza-${slugify(item)}`,
      tipo: "raza",
      nombre: item,
      resumen: "Referencia de raza disponible para creaci\u00f3n de personaje.",
      detalle: source.detalle,
      fuente: source.fuente,
      pagina: source.pagina,
      tags: ["raza"]
    };
  });
}

function buildCultureEntries(): CompendiumEntry[] {
  const cultureSources: Record<string, { fuente: string; pagina: number; detalle: string }> = {
    Ambriano: {
      fuente: "Libro B\u00e1sico",
      pagina: 16,
      detalle: "Cultura base del Libro B\u00e1sico. Consulta la secci\u00f3n de culturas y estilos de vida para trasfondo y contexto de personaje."
    },
    "B\u00e1rbaro": {
      fuente: "Libro B\u00e1sico",
      pagina: 16,
      detalle: "Cultura base del Libro B\u00e1sico. Consulta la secci\u00f3n de culturas y estilos de vida para trasfondo y contexto de personaje."
    },
    "Clan goblin": {
      fuente: "Libro B\u00e1sico",
      pagina: 16,
      detalle: "Cultura base del Libro B\u00e1sico. Consulta la secci\u00f3n de culturas y estilos de vida para trasfondo y contexto de personaje."
    },
    "Pueblo libre": {
      fuente: "Libro B\u00e1sico",
      pagina: 16,
      detalle: "Cultura base del Libro B\u00e1sico. Consulta la secci\u00f3n de culturas y estilos de vida para trasfondo y contexto de personaje."
    },
    "Ordo M\u00e1gica": {
      fuente: "Libro B\u00e1sico",
      pagina: 27,
      detalle: "Cultura/facci\u00f3n de referencia del Libro B\u00e1sico. Consulta las secciones de facciones y juego de personaje para contexto dentro de Ambria y Davokar."
    },
    "Templo de Prios": {
      fuente: "Libro B\u00e1sico",
      pagina: 27,
      detalle: "Cultura/facci\u00f3n de referencia del Libro B\u00e1sico. Consulta las secciones de facciones y juego de personaje para contexto dentro de Ambria y Davokar."
    }
  };

  return SYMBAROUM_CULTURES.map((item) => {
    const source = cultureSources[item] ?? {
      fuente: "Libro B\u00e1sico",
      pagina: 16,
      detalle: "Referencia de cultura disponible para creaci\u00f3n de personaje."
    };

    return {
      id: `cultura-${slugify(item)}`,
      tipo: "cultura",
      nombre: item,
      resumen: "Referencia de cultura disponible para creaci\u00f3n de personaje.",
      detalle: source.detalle,
      fuente: source.fuente,
      pagina: source.pagina,
      tags: ["cultura"]
    };
  });
}

function buildArchetypeEntries(): CompendiumEntry[] {
  const archetypeSources: Record<string, { fuente: string; pagina: number; detalle: string }> = {
    Guerrero: {
      fuente: "Libro B\u00e1sico",
      pagina: 80,
      detalle: "Arquetipo base del Libro B\u00e1sico. Consulta la secci\u00f3n de arquetipos para enfoque de juego, habilidades y estilo de personaje."
    },
    "M\u00edstico": {
      fuente: "Libro B\u00e1sico",
      pagina: 80,
      detalle: "Arquetipo base del Libro B\u00e1sico. Consulta la secci\u00f3n de arquetipos para enfoque de juego, habilidades y estilo de personaje."
    },
    Maleante: {
      fuente: "Libro B\u00e1sico",
      pagina: 80,
      detalle: "Arquetipo base del Libro B\u00e1sico. Consulta la secci\u00f3n de arquetipos para enfoque de juego, habilidades y estilo de personaje."
    },
    Cazador: {
      fuente: "Gu\u00eda Avanzada del Jugador",
      pagina: 12,
      detalle: "Arquetipo a\u00f1adido en la Gu\u00eda Avanzada del Jugador. Consulta la secci\u00f3n de arquetipos para enfoque de juego, habilidades y estilo de personaje."
    }
  };

  return SYMBAROUM_ARCHETYPES.map((item) => {
    const source = archetypeSources[item] ?? {
      fuente: "Libro B\u00e1sico",
      pagina: 80,
      detalle: "Referencia de arquetipo disponible para creaci\u00f3n de personaje."
    };

    return {
      id: `arquetipo-${slugify(item)}`,
      tipo: "arquetipo",
      nombre: item,
      resumen: "Referencia de arquetipo disponible para creaci\u00f3n de personaje.",
      detalle: source.detalle,
      fuente: source.fuente,
      pagina: source.pagina,
      tags: ["arquetipo"]
    };
  });
}

function buildTraditionEntries(): CompendiumEntry[] {

  const traditions = new Map<string, { powers: number; rituals: number }>();
  [...SYMBAROUM_MYSTIC_POWERS, ...SYMBAROUM_RITUALS].forEach((entry) => {
    entry.tradiciones.forEach((tradition) => {
      const current = traditions.get(tradition) ?? { powers: 0, rituals: 0 };
      if (entry.tipo === "poder_mistico") current.powers += 1;
      if (entry.tipo === "ritual") current.rituals += 1;
      traditions.set(tradition, current);
    });
  });

  return [...traditions.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([name, counts]) => ({
      id: `tradicion-${slugify(name)}`,
      tipo: "tradicion",
      nombre: name,
      resumen: `${counts.powers} poderes mÃ­sticos, ${counts.rituals} rituales.`,
      detalle: `TradiciÃ³n listada en el compendio central de UMBRA. Actualmente enlaza ${counts.powers} poderes mÃ­sticos y ${counts.rituals} rituales del catÃ¡logo cargado.`,
      fuente: "GuÃ­a Avanzada del Jugador",
      tags: ["tradicion", "magia"]
    }));
}

type MonsterTraitDefinition = {
  nombre: string;
  fuente?: string;
  pagina: number;
  resumen: string;
  detalle: string;
  tags?: string[];
};

function buildMonsterTraitEntries(): CompendiumEntry[] {
  const traits: MonsterTraitDefinition[] = [
    {
      nombre: "Alado",
      fuente: "Libro Básico",
      pagina: 197,
      resumen: "La criatura domina el aire y gana maniobras de vuelo cada vez más agresivas.",
      detalle:
        "I: puede volar y reposicionarse con ventaja táctica. II: el vuelo le permite evitar parte del combate trabado y castigar desde ángulos difíciles. III: combina velocidad, altura y control del espacio para convertir la movilidad aérea en una ventaja constante.",
      tags: ["movilidad", "vuelo"]
    },
    {
      nombre: "Arma natural",
      fuente: "Libro Básico",
      pagina: 197,
      resumen: "Garras, colmillos o cuernos convierten el cuerpo de la criatura en un arma siempre lista.",
      detalle:
        "El rasgo representa ataques corporales integrados en la anatomía del monstruo. Sus distintos niveles mejoran el valor ofensivo y sirven de base para muchos otros rasgos, como Venenoso, Ataque de corrupción o Abrazo aplastante.",
      tags: ["ataque", "cuerpo a cuerpo"]
    },
    {
      nombre: "Ataque ácido",
      fuente: "Libro Básico",
      pagina: 197,
      resumen: "La criatura cubre a su objetivo con ácido persistente que sigue dañando tras el impacto.",
      detalle:
        "I/II/III: como reacción, el ácido es débil, moderado o potente y provoca 3/4/5 puntos de daño durante 3/4/5 turnos. Hace falta gastar una acción y superar una tirada de Inteligente para lavar el ácido con agua, tierra o algo similar.",
      tags: ["ácido", "daño persistente"]
    },
    {
      nombre: "Ataque de corrupción",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "Las armas naturales de la criatura transmiten Corrupción temporal además del daño normal.",
      detalle:
        "I/II/III: cualquier víctima que sufra al menos 1 punto de daño de uno de sus ataques recibe además 1D4/1D6/1D8 de Corrupción temporal. Representa bestias o abominaciones tan contaminadas que su mera herida ya infecta.",
      tags: ["corrupción", "abominación"]
    },
    {
      nombre: "Daño alternativo",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "La criatura hiere atributos distintos de Resistencia y puede devorar directamente alma o vigor.",
      detalle:
        "Requiere Forma espiritual. I/II/III: el arma natural inflige 3/4/5 puntos de daño alternativo que ignoran armadura, normalmente contra Fuerte o Tenaz. Si el atributo llega a cero, la víctima muere.",
      tags: ["espíritu", "atributos"]
    },
    {
      nombre: "Duro",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "Piel, escamas o quitina conceden protección natural sin las penalizaciones de una armadura incómoda.",
      detalle:
        "I/II/III: la criatura obtiene una protección natural de 2/3/4. No puede llevar protección adicional sobre esa armadura natural, pero sí combinarla con Combate con armadura.",
      tags: ["armadura", "durabilidad"]
    },
    {
      nombre: "Enjambre",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "La criatura es una mente colmena repartida entre muchos cuerpos y resiste el daño de forma anómala.",
      detalle:
        "I/II/III: el enjambre sufre la mitad, la mitad o una cuarta parte del daño de todos los ataques. Sus niveles también ajustan cuándo huye por instinto de supervivencia y cómo resiste ataques mentales.",
      tags: ["grupo", "durabilidad"]
    },
    {
      nombre: "Escupitajo venenoso",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "Además de ser venenosa, la criatura puede proyectar su toxina a distancia.",
      detalle:
        "Requiere Venenoso al mismo nivel o superior. I/II/III: como acción activa, el veneno provoca 2/3/4 puntos de daño durante 2/3/4 turnos si la víctima no supera [Fuerte←Inteligente]. Se neutraliza con antídoto y una tirada de Inteligente.",
      tags: ["veneno", "distancia"]
    },
    {
      nombre: "Forma corpórea",
      fuente: "Libro Básico",
      pagina: 198,
      resumen: "Un espíritu puede manifestarse físicamente para combatir o manipular el mundo material.",
      detalle:
        "I: se vuelve corpóreo durante un turno y puede actuar con ataques físicos. II: puede mantenerse así todo el tiempo que quiera y usar equipo que portara al morir. III: interactúa con el mundo físico sin perder la mayoría de ventajas de su estado espiritual.",
      tags: ["espíritu", "manifestación"]
    },
    {
      nombre: "Forma espiritual",
      fuente: "Libro Básico",
      pagina: 199,
      resumen: "La criatura existe como espíritu inmaterial y solo ciertos efectos pueden dañarla con normalidad.",
      detalle:
        "I/II/III: puede atravesar obstáculos y sufre la mitad de daño de armas físicas; a niveles altos también reduce el daño de armas mágicas o alquímicas. El rasgo da acceso a Daño alternativo, Forma corpórea y Terrorífico.",
      tags: ["espíritu", "intangibilidad"]
    },
    {
      nombre: "Frío de ultratumba",
      fuente: "Libro Básico",
      pagina: 199,
      resumen: "La criatura paraliza y hiere con un aura de muerte helada a quienes se acercan demasiado.",
      detalle:
        "I: los personajes a distancia cuerpo a cuerpo deben superar Tenaz o quedan paralizados. II: además sufren 2 de daño que ignora armadura. III: el aura aprieta aún más la tirada enfrentada y multiplica el riesgo para quienes se acerquen.",
      tags: ["aura", "parálisis"]
    },
    {
      nombre: "Hipnótico",
      fuente: "Libro Básico",
      pagina: 199,
      resumen: "La criatura deja sin acciones a sus víctimas mediante mirada, canto o fascinación sobrenatural.",
      detalle:
        "I: afecta a una víctima con [Tenaz←Tenaz]. II: puede afectar a todas las víctimas de su canto o sonido. III: el efecto persiste hasta superar la tirada o recibir daño.",
      tags: ["control", "mente"]
    },
    {
      nombre: "Muerto viviente",
      fuente: "Libro Básico",
      pagina: 199,
      resumen: "El cuerpo ya no vive: ignora dolor, no se cura normalmente y gana resistencias propias de los no muertos.",
      detalle:
        "I: es inmune a veneno, enfermedad, shock y dolor, pero no se cura de forma natural. II: además solo sufre la mitad de daño de ataques físicos normales. III: también reduce magia y alquimia, mientras armas mágicas o benditas siguen siendo plenamente efectivas.",
      tags: ["muerto viviente", "durabilidad"]
    },
    {
      nombre: "Regeneración",
      fuente: "Libro Básico",
      pagina: 199,
      resumen: "La criatura recupera Resistencia cada turno, aunque mantiene una vulnerabilidad concreta.",
      detalle:
        "I/II/III: regenera 2/3/4 puntos de Resistencia por turno. Cada monstruo debe tener un punto débil definido, como fuego, ácido, armas mágicas, ataques sagrados o impíos.",
      tags: ["curación", "durabilidad"]
    },
    {
      nombre: "Robusto",
      fuente: "Libro Básico",
      pagina: 200,
      resumen: "El tamaño y la masa del monstruo absorben daño y vuelven sus golpes mucho más demoledores.",
      detalle:
        "I/II/III: ignora 2/3/4 puntos de daño por golpe además de su armadura, puede añadir +2/+3/+4 daño una vez por turno y su Defensa se calcula sobre [Ágil−2/−3/−4].",
      tags: ["tamaño", "durabilidad"]
    },
    {
      nombre: "Sangre ácida",
      fuente: "Libro Básico",
      pagina: 200,
      resumen: "Herir a la criatura en combate cuerpo a cuerpo puede bañar al atacante en sangre corrosiva.",
      detalle:
        "I/II/III: quien la hiera a cuerpo a cuerpo debe superar Defensa o sufrir 3/4/5 puntos de daño durante 3/4/5 turnos. Se limpia gastando una acción y superando una tirada de Inteligente.",
      tags: ["ácido", "reacción"]
    },
    {
      nombre: "Telaraña",
      fuente: "Libro Básico",
      pagina: 200,
      resumen: "La criatura puede tender hebras pegajosas o lanzar redes vivas para inmovilizar a sus presas.",
      detalle:
        "I: cruzar la telaraña exige [Ágil←Inteligente] o se queda atrapado. II: además puede lanzar una red como acción activa. III: la red es semiconsciente y golpea hasta tres veces por turno con los mismos efectos.",
      tags: ["control", "presa"]
    },
    {
      nombre: "Terrorífico",
      fuente: "Libro Básico",
      pagina: 200,
      resumen: "El monstruo fuerza a retroceder o paraliza de miedo a quienes no soportan su presencia.",
      detalle:
        "Requiere Forma espiritual. I: obliga a una víctima a gastar sus acciones retrocediendo si falla [Tenaz←Tenaz]. II: extiende el efecto a todos los cercanos. III: quienes no puedan huir quedan encogidos de miedo en el sitio.",
      tags: ["miedo", "control"]
    },
    {
      nombre: "Venenoso",
      fuente: "Libro Básico",
      pagina: 200,
      resumen: "Los ataques sin armas o con arma natural inoculan veneno al herir al objetivo.",
      detalle:
        "I/II/III: si el ataque consigue herir y la víctima falla [Fuerte←Inteligente], sufre 2/3/4 puntos de daño durante 2/3/4 turnos hasta que reciba antídoto y una tirada de Inteligente.",
      tags: ["veneno", "ataque"]
    },
    {
      nombre: "Abrazo aplastante",
      pagina: 164,
      resumen: "Tras dañar con arma natural, la criatura puede apresar y triturar al objetivo.",
      detalle:
        "I/II/III: como reacción al causar daño con arma natural, la criatura intenta agarrar. La víctima evita o rompe la presa con [Ágil←Diestro] y [Fuerte←Fuerte]; si falla, queda sin actuar y recibe 2/3/4 daño por turno que ignora armadura mientras la criatura mantiene el agarre.",
      tags: ["presa", "arma natural"]
    },
    {
      nombre: "Acaparador de corrupción",
      pagina: 164,
      resumen: "La criatura acumula corrupción y la gasta para torcer tiradas a su favor.",
      detalle:
        "Solo para criaturas consumidas por la corrupción. Puede almacenar hasta Tenaz/2 puntos; drena corrupción permanente de víctimas sometidas y, a niveles altos, también al herir con armas naturales. Esa reserva se gasta para forzar segundas oportunidades de fallar defensas, ataques, tiradas de resistencia o efectos contra la criatura.",
      tags: ["corrupción", "abominación"]
    },
    {
      nombre: "Aliento mortal",
      pagina: 164,
      resumen: "La criatura exhala un torrente devastador de fuego, frío, ácido, rayos u otro efecto.",
      detalle:
        "I: un objetivo sufre 3 o 6 daño según supere [Ágil←Diestro]. II: el torrente puede encadenarse a más objetivos mientras fallen. III: la tormenta continúa incluso con un éxito inicial y solo se rompe cuando un segundo objetivo logra resistir. Puede combinarse con Daño alternativo, Ataque de Corrupción o Venenoso.",
      tags: ["daño", "área"]
    },
    {
      nombre: "Anfibio",
      pagina: 164,
      resumen: "La criatura puede respirar aire y agua y combatir bajo el agua sin penalizadores.",
      detalle:
        "Permite vivir dentro y fuera del agua, ignorar los penalizadores por combate acuático y no sufrir daño por esfuerzo o falta de oxígeno al luchar sumergida.",
      tags: ["movilidad", "agua"]
    },
    {
      nombre: "Aparición",
      pagina: 164,
      resumen: "La criatura puede poseer cuerpos ajenos de forma mucho más rápida que el ritual Posesión.",
      detalle:
        "Requiere Forma espiritual I. I: al tocar, intenta poseer con [Tenaz←Tenaz] y la duración escala de día a permanente. II: al caer a Resistencia 0 puede saltar como reacción al enemigo que le dio el golpe final. III: la posesión lograda pasa a ser permanente hasta Exorcismo o abandono voluntario.",
      tags: ["espíritu", "posesión"]
    },
    {
      nombre: "Ataque perforante",
      pagina: 165,
      resumen: "El ataque no causa daño normal; intenta atravesar la armadura para aplicar otro efecto.",
      detalle:
        "El valor de daño del ataque se usa solo para perforar armadura. Si supera la protección del objetivo, entra el efecto secundario del monstruo, como veneno o corrupción. Los niveles fijan un valor de 4/5/6.",
      tags: ["armadura", "penetración"]
    },
    {
      nombre: "Aura nociva",
      pagina: 165,
      resumen: "La criatura daña automáticamente a cualquiera que permanezca a alcance cuerpo a cuerpo.",
      detalle:
        "I/II/III: quienes estén trabados con la criatura sufren 2/3/4 daño por turno que ignora armadura. El aura deja un rastro evidente y puede tratarse como fuego, frío, ácido, rayos, corrupción o veneno si combina con otros rasgos.",
      tags: ["aura", "daño pasivo"]
    },
    {
      nombre: "Caparazón",
      pagina: 165,
      resumen: "La armadura natural puede reforzarse en momentos concretos para duplicar su valor.",
      detalle:
        "El rasgo representa placas, conchas o quitina extremadamente resistentes. Según el nivel, la criatura puede duplicar su armadura al reaccionar frente a ataques, proyectiles o situaciones definidas por su anatomía y patrón defensivo.",
      tags: ["armadura", "defensa"]
    },
    {
      nombre: "Compañeros",
      pagina: 165,
      resumen: "La criatura combate mejor cuando actúa junto a miembros de su misma especie o grupo.",
      detalle:
        "El rasgo modela manadas, bandadas y equipos coordinados. A mayor nivel, más fuertes son los bonos que obtiene la criatura por luchar cerca de aliados compatibles o por concentrarse sobre un mismo objetivo.",
      tags: ["grupo", "manada"]
    },
    {
      nombre: "Convocante",
      pagina: 165,
      resumen: "La criatura llama refuerzos del Ultramundo que desaparecen al final de la escena o con su muerte.",
      detalle:
        "Solo para criaturas consumidas por la corrupción. Una vez por escena puede hacer una tirada de Tenaz para convocar intrusos demoníacos; con niveles altos trae refuerzos más fuertes o más numerosos. Los convocados obedecen órdenes audibles, no telepáticas.",
      tags: ["demonios", "refuerzos"]
    },
    {
      nombre: "Demoledor",
      pagina: 166,
      resumen: "Los golpes de la criatura tumban, lanzan por los aires o incluso derriban estructuras.",
      detalle:
        "I: al causar daño, el objetivo puede caer al suelo si falla [Fuerte←Fuerte]. II: además puede ser arrojado 1D6 metros y sufrir daño por caída equivalente. III: los ataques ganan la cualidad Demoledora y sirven también contra puertas, torres y muros.",
      tags: ["derribo", "fortificaciones"]
    },
    {
      nombre: "Descomunal",
      pagina: 166,
      resumen: "El tamaño monstruoso reduce movilidad, pero vuelve a la criatura casi imparable.",
      detalle:
        "Requiere Robusto III. I: ataca usando ambas acciones, pero obliga a tirar la armadura dos veces y quedarse con el peor resultado. II: al moverse no puede defenderse, pero sus enemigos tienen dos oportunidades de fallar la Defensa. III: añade todavía más presión física y dominio del espacio en combate.",
      tags: ["tamaño", "jefe"]
    },
    {
      nombre: "Devorador",
      pagina: 166,
      resumen: "La criatura inmoviliza, engulle y digiere a sus víctimas dentro de un vientre hostil.",
      detalle:
        "Requiere Descomunal I. I: tras un mordisco dañino, la presa queda sujeta y al turno siguiente puede ser tragada si falla [Fuerte←Fuerte], sufriendo 2 daño por turno dentro del vientre. II y III hacen más fácil iniciar el engullir y aumentan el daño y el número de víctimas simultáneas.",
      tags: ["engullir", "mordisco"]
    },
    {
      nombre: "Diminuto",
      pagina: 167,
      resumen: "La criatura es tan pequeña o lastimosa que cuesta tratarla como amenaza prioritaria.",
      detalle:
        "Los enemigos deben superar [Tenaz←Discreto] para atacarla mientras existan otros blancos viables. El efecto desaparece si la criatura demuestra claramente que sabe luchar o usa capacidades demasiado peligrosas para seguir pareciendo inofensiva.",
      tags: ["evasión", "tamaño"]
    },
    {
      nombre: "Embestida",
      pagina: 167,
      resumen: "La criatura usa su masa para abrirse paso, aplastar enemigos y derribarlos.",
      detalle:
        "Requiere Robusto al mismo nivel. I/II/III: al mover, quienes estén en su trayectoria deben resistir con [Fuerte←Fuerte] o reciben 2/3/4 daño y caen al suelo. Robusto añade +2 por nivel al daño y a la tirada enfrentada. Acróbata permite esquivarlo con [Ágil←Fuerte].",
      tags: ["movimiento", "derribo"]
    },
    {
      nombre: "Espíritu libre",
      pagina: 167,
      resumen: "El alma de la criatura está desligada del destino del mundo y no puede corromperse.",
      detalle:
        "La criatura es inmune a la corrupción y suele dejar señales sobrenaturales vinculadas a su naturaleza espiritual. El rasgo representa seres separados del flujo normal de Wratha, Wielda y Wyrtha.",
      tags: ["espíritu", "inmunidad"]
    },
    {
      nombre: "Garras prensiles",
      pagina: 167,
      resumen: "Las garras permiten herir, sujetar y arrastrar presas hacia las fauces o el cuerpo del monstruo.",
      detalle:
        "I: la criatura hace dos ataques de garra y, si ambos impactan, intenta apresar con [Fuerte←Fuerte]. II: basta con acertar una sola garra. III: un impacto puede iniciar directamente el arrastre; la víctima no se libera hasta que supere la tirada o la criatura la suelte.",
      tags: ["presa", "arrastre"]
    },
    {
      nombre: "Infeccioso",
      pagina: 167,
      resumen: "Las armas naturales transmiten una enfermedad cuando logran herir.",
      detalle:
        "Todo objetivo dañado por las armas naturales debe superar una tirada de Fuerte o contrae una enfermedad débil, moderada o potente según el nivel del rasgo.",
      tags: ["enfermedad", "arma natural"]
    },
    {
      nombre: "Infestación",
      pagina: 167,
      resumen: "La criatura puede introducirse o dejar larvas dentro del cuerpo de una víctima.",
      detalle:
        "Tras infligir daño, el parásito necesita tiempo para penetrar. La víctima o un aliado puede intentar extraerlo con una acción de combate, arriesgándose a dañarla. A mayor nivel, más difícil resulta evitar o eliminar la infestación y más peligroso es el efecto parasitario posterior.",
      tags: ["parásito", "larvas"]
    },
    {
      nombre: "Invisibilidad",
      pagina: 168,
      resumen: "La criatura se vuelve invisible, aunque aún puede delatarse por huellas, sonido o polvo.",
      detalle:
        "I: no puede ser blanco directo y obliga a localizarla con [Atento←Discreto] o a usar efectos de área y trucos como harina o arena. II: el estado parcialmente visible dura solo un turno. III: la criatura entra y sale de invisibilidad con la máxima soltura táctica.",
      tags: ["sigilo", "detección"]
    },
    {
      nombre: "Lengua apresadora",
      pagina: 168,
      resumen: "La lengua del monstruo ataca a distancia, engancha a la presa y la arrastra hasta el cuerpo a cuerpo.",
      detalle:
        "Funciona como un mordisco a hasta dos acciones de movimiento. Si el objetivo tiene menos Robusto, la criatura puede traerlo hacia sí con [Fuerte←Fuerte] y combinar el arrastre con Devorador, Abrazo aplastante u otros rasgos de presa.",
      tags: ["alcance", "arrastre"]
    },
    {
      nombre: "Lucha a muerte",
      pagina: 168,
      resumen: "La criatura descarga un último estallido de violencia al morir.",
      detalle:
        "I: al morir, realiza un ataque gratuito contra un enemigo adyacente. II: ese ataque cuenta como acción de combate normal y puede usar capacidades activas. III: puede lanzar hasta cinco ataques finales si alcanza a varios enemigos sin moverse.",
      tags: ["muerte", "reacción"]
    },
    {
      nombre: "Metamorfosis",
      pagina: 168,
      resumen: "La criatura modifica su forma para ganar rasgos adaptativos según la escena.",
      detalle:
        "Permite adoptar temporalmente combinaciones de rasgos como Alado, Caparazón, Garras prensiles, Tunelador o Venenoso. I: un rasgo a nivel I. II: dos rasgos a nivel I o uno a nivel II. III: dos rasgos a nivel II o uno a nivel III. Forma verdadera puede anular la adaptación.",
      tags: ["cambiaformas", "adaptación"]
    },
    {
      nombre: "Múltiples cabezas",
      pagina: 168,
      resumen: "La criatura cuenta con varias cabezas o miembros coordinados por mentes separadas.",
      detalle:
        "Cada parte actúa con cierta independencia y permite ampliar ataques, reacciones o cobertura sensorial. El daño puede repartirse entre cabezas o extremidades concretas, lo que complica neutralizar por completo a la criatura.",
      tags: ["multiataque", "hidra"]
    },
    {
      nombre: "Muro de raíces",
      pagina: 168,
      resumen: "La criatura levanta barreras de raíces para bloquear movimiento, visión o retirada.",
      detalle:
        "El rasgo permite controlar terreno y encerrar enemigos con obstáculos vegetales. A mayor nivel, la barrera es más extensa o resistente y sirve mejor para separar al grupo y fijar víctimas.",
      tags: ["flora", "control de zona"]
    },
    {
      nombre: "Observador",
      pagina: 169,
      resumen: "La criatura percibe su entorno en todas direcciones y no puede ser flanqueada.",
      detalle:
        "Los enemigos que la rodean no obtienen ventaja por flanquearla. El rasgo representa sentidos físicos o sobrenaturales capaces de vigilar 360 grados.",
      tags: ["sentidos", "flanqueo"]
    },
    {
      nombre: "Poder colectivo",
      pagina: 169,
      resumen: "Un colectivo de criaturas accede a poderes místicos al reunir suficientes miembros.",
      detalle:
        "El grupo puede lanzar un poder místico por turno además de las acciones individuales. La iniciativa usada es la más alta del colectivo y romper la concentración exige afectar a varios miembros en el mismo turno, lo que vuelve muy estable la magia grupal.",
      tags: ["colectivo", "magia"]
    },
    {
      nombre: "Recio",
      pagina: 169,
      resumen: "La criatura posee mucha más Resistencia de la que indica su Fuerte.",
      detalle:
        "I/II/III: la Resistencia pasa a ser Fuerte ×1,5 / ×2 / ×3, sin alterar el Umbral de dolor habitual. Representa vitalidad extraordinaria de origen natural o corrupto.",
      tags: ["resistencia", "durabilidad"]
    },
    {
      nombre: "Resistencia mística",
      pagina: 169,
      resumen: "Los poderes místicos tienen muchas más dificultades para afectar a la criatura.",
      detalle:
        "I: quien intente herirla o afectarla con magia debe superar dos tiradas de éxito. II: un fallo puede desviar el poder hacia otro objetivo visible al azar. III: la resistencia y el rebote mágico son aún más peligrosos para el lanzador.",
      tags: ["magia", "resistencia"]
    },
    {
      nombre: "Sed de sangre",
      pagina: 170,
      resumen: "La criatura hipnotiza a la víctima y le drena la sangre para dañarla o curarse.",
      detalle:
        "I: embelesa con [Tenaz←Tenaz] y extrae 2 Resistencia por turno ignorando armadura mientras mantenga el trance. II: además se cura la misma cantidad. III: el drenaje y la curación suben a 3 por turno y la víctima necesita ayuda externa para romper el control.",
      tags: ["hipnosis", "drenaje"]
    },
    {
      nombre: "Sensible a la corrupción",
      pagina: 170,
      resumen: "La criatura detecta brotes de corrupción y, a altos niveles, puede rastrear su origen.",
      detalle:
        "I: con Atento percibe brotes cercanos y la dirección general según la intensidad. II: localiza el punto exacto. III: puede seguir durante un día el rastro etéreo dejado por la fuente del brote.",
      tags: ["corrupción", "rastreo"]
    },
    {
      nombre: "Sentir vida",
      pagina: 170,
      resumen: "La criatura percibe seres vivos incluso a través de obstáculos y tierra.",
      detalle:
        "I: detecta vibraciones y obliga a esconderse con [Discreto←Atento]. II: puede atacar objetivos detectados a través de barreras si tiene modo de atravesarlas. III: incluso usa poderes místicos como si esos enemigos estuvieran en línea de visión.",
      tags: ["sentidos", "rastreo"]
    },
    {
      nombre: "Sucesor vengativo",
      pagina: 170,
      resumen: "La muerte de la criatura hace aparecer vengadores ligados a su especie o corrupción.",
      detalle:
        "Solo para criaturas al menos complicadas. I/II/III: al morir se manifiestan una, dos o tres criaturas vengadoras, normalmente de un nivel de desafío inferior y coherentes con la naturaleza del monstruo caído.",
      tags: ["muerte", "refuerzos"]
    },
    {
      nombre: "Tunelador",
      pagina: 171,
      resumen: "La criatura se desplaza bajo tierra y usa el subsuelo tanto para moverse como para atacar.",
      detalle:
        "I: se mueve bajo tierra a media velocidad y evita ataques gratuitos. II: entra y sale del suelo durante el mismo turno para atacar y esconderse. III: puede crear sumideros que derriban a grupos y le conceden ataques gratuitos contra quienes caen.",
      tags: ["movilidad", "subsuelo"]
    },
    {
      nombre: "Veloz",
      pagina: 171,
      resumen: "La criatura encadena ataques extra como reacción a sus propios impactos.",
      detalle:
        "I: al golpear con una acción de combate, hace un ataque gratuito adicional. II: si el ataque inicial causa daño, puede lanzar dos ataques gratuitos. III: siempre puede hacer esos dos ataques extra, incluso si el primero no impacta.",
      tags: ["multiataque", "velocidad"]
    },
    {
      nombre: "Veneno paralizante",
      pagina: 171,
      resumen: "El veneno de la criatura aturde, bloquea reacciones o deja totalmente inmóvil al objetivo.",
      detalle:
        "I: cada herida obliga a tirar Fuerte; un fracaso deja al objetivo reducido a reacciones con dos oportunidades de fallar. II: el bloqueo puede durar 1D4 turnos. III: la resistencia pasa a [Fuerte −5] y un fallo paraliza por completo durante 1D8 turnos.",
      tags: ["veneno", "control"]
    },
    {
      nombre: "Visión nocturna",
      pagina: 171,
      resumen: "La criatura percibe el entorno mediante ecolocalización y actúa con normalidad en oscuridad total.",
      detalle:
        "Gracias a pulsos acústicos, detecta objetos, seres invisibles y movimiento sin depender de la vista. La oscuridad total no la perjudica mientras conserve esa percepción sonora.",
      tags: ["sentidos", "oscuridad"]
    }
  ];

  return traits.map((trait) => ({
    id: `rasgo-${slugify(trait.nombre)}`,
    tipo: "rasgo",
    nombre: trait.nombre,
    resumen: trait.resumen,
    detalle: trait.detalle,
    fuente: trait.fuente ?? "Códice de monstruos",
    pagina: trait.pagina,
    tags: ["rasgo", "monstruo", trait.fuente === "Libro Básico" ? "libro básico" : "código de monstruos", ...(trait.tags ?? [])]
  }));
}

function buildMonsterRuleEntries(): CompendiumEntry[] {
  return [
    {
      id: "regla-monstruos-categorias",
      tipo: "regla",
      nombre: "Categorías de monstruo",
      resumen: "El Códice divide las criaturas en seis categorías: abominaciones, bestias, fenómenos, flora, muertos vivientes y seres civilizados.",
      detalle:
        "Las categorías no son solo taxonomía narrativa: también determinan rasgos habituales, interacciones con habilidades como Versado en criaturas y reglas compartidas, como inmunidades, visión en oscuridad o ausencia de Umbral de dolor.",
      fuente: "Códice de monstruos",
      pagina: 162,
      tags: ["monstruos", "categorías", "bestiario"]
    },
    {
      id: "regla-monstruos-abominaciones",
      tipo: "regla",
      nombre: "Abominaciones",
      resumen: "Las abominaciones están consumidas por corrupción y comparten muchos rasgos con los muertos vivientes.",
      detalle:
        "Suelen usar rasgos como Ataque ácido, Acaparador de corrupción, Aura nociva, Regeneración, Robusto o Tunelador. No duermen, no comen ni beben, no se ahogan, son inmunes a venenos y enfermedades comunes, ven en oscuridad total y las energías sagradas o curativas las dañan en lugar de sanarlas.",
      fuente: "Códice de monstruos",
      pagina: 162,
      tags: ["monstruos", "abominaciones", "corrupción"]
    },
    {
      id: "regla-monstruos-bestias",
      tipo: "regla",
      nombre: "Bestias",
      resumen: "Las bestias abarcan animales salvajes, domesticados y depredadores guiados sobre todo por el instinto.",
      detalle:
        "Todas cuentan con el rasgo Montés y la mayoría ven bien en penumbra. Entre sus rasgos más comunes están Abrazo aplastante, Alado, Caparazón, Devorador, Embestida, Lengua apresadora, Regeneración, Tunelador, Veloz, Veneno paralizante y Venenoso.",
      fuente: "Códice de monstruos",
      pagina: 163,
      tags: ["monstruos", "bestias", "instinto"]
    },
    {
      id: "regla-monstruos-fenomenos",
      tipo: "regla",
      nombre: "Fenómenos",
      resumen: "Los fenómenos son seres o presencias difíciles de clasificar, a veces más cercanos a un estado o lugar maligno que a un animal.",
      detalle:
        "Pueden mezclar rasgos muy distintos entre sí y, por esa ambigüedad, no sirven como especialización válida para Versado en criaturas. Son la categoría más libre y extraña del sistema.",
      fuente: "Códice de monstruos",
      pagina: 163,
      tags: ["monstruos", "fenómenos", "clasificación"]
    },
    {
      id: "regla-monstruos-flora",
      tipo: "regla",
      nombre: "Flora",
      resumen: "La flora monstruosa usa control del terreno, raíces, venenos y cuerpos vegetales muy resistentes.",
      detalle:
        "Suelen combinar Duro, Descomunal, Abrazo aplastante, Lengua apresadora, Múltiples cabezas, Muro de raíces, Regeneración, Recio y Veneno paralizante. No tienen Umbral de dolor, no duermen y son inmunes a venenos y enfermedades corrientes.",
      fuente: "Códice de monstruos",
      pagina: 163,
      tags: ["monstruos", "flora", "control"]
    },
    {
      id: "regla-monstruos-muertos-vivientes",
      tipo: "regla",
      nombre: "Muertos vivientes",
      resumen: "La categoría incluye tanto espíritus como cadáveres andantes poseídos por un espíritu activo.",
      detalle:
        "Todos los muertos vivientes no duermen, no comen, no beben, no se ahogan y no sufren corrupción adicional porque ya están consumidos por ella. Ven en oscuridad total, carecen de Umbral de dolor y la magia sagrada o curativa les daña, mientras la energía impía los sana.",
      fuente: "Códice de monstruos",
      pagina: 163,
      tags: ["monstruos", "muertos vivientes", "espíritus"]
    },
    {
      id: "regla-monstruos-seres-civilizados",
      tipo: "regla",
      nombre: "Seres civilizados",
      resumen: "Humanos, elfos, ogros, trasgos y otras razas inteligentes entran aquí y usan sobre todo habilidades y poderes normales.",
      detalle:
        "Sus rasgos de monstruo, cuando existen, dependen de su raza y no de la categoría. Se organizan socialmente y suelen parecerse más a personajes jugadores o PNJ desarrollados que a bestias puras.",
      fuente: "Códice de monstruos",
      pagina: 163,
      tags: ["monstruos", "civilizados", "pnj"]
    },
    {
      id: "regla-monstruos-rasgos",
      tipo: "regla",
      nombre: "Rasgos de monstruo",
      resumen: "Los rasgos de monstruo son talentos extraordinarios, normalmente con tres niveles y redactados desde la perspectiva de PNJ.",
      detalle:
        "La sección asume niveles I, II y III para cada rasgo. Si un personaje jugador adquiere uno, el grupo debe reformular su texto igual que hace con habilidades de PNJ. El capítulo también lista qué rasgos nuevos vienen del Códice y cuáles remiten al Libro Básico.",
      fuente: "Códice de monstruos",
      pagina: 164,
      tags: ["monstruos", "rasgos", "niveles"]
    },
    {
      id: "regla-monstruos-modelar-la-carne",
      tipo: "regla",
      nombre: "Modelar la carne y rasgos compatibles",
      resumen: "El ritual Modelar la carne puede esculpir varios rasgos de monstruo concretos.",
      detalle:
        "El Códice amplía el ritual para cubrir Alado, Anfibio, Arma natural, Ataque de Corrupción, Caparazón, Duro, Escupitajo venenoso, Lengua apresadora, Regeneración, Robusto, Tunelador y Venenoso.",
      fuente: "Códice de monstruos",
      pagina: 164,
      tags: ["monstruos", "ritual", "modelar la carne"]
    },
    {
      id: "regla-monstruos-creacion",
      tipo: "regla",
      nombre: "La creación de monstruos",
      resumen: "Crear monstruos sigue la lógica de crear personajes, pero priorizando manejo fácil en mesa y una función táctica clara.",
      detalle:
        "El capítulo recomienda diseñar criaturas que añadan algo nuevo al juego, tengan al menos una debilidad explotable y usen una estrategia principal fácil de ejecutar por el director de juego durante combates de cinco o seis turnos.",
      fuente: "Códice de monstruos",
      pagina: 174,
      tags: ["monstruos", "diseño", "director de juego"]
    },
    {
      id: "regla-monstruos-creacion-lo-esencial",
      tipo: "regla",
      nombre: "Lo esencial al crear monstruos",
      resumen: "Empieza por debilidad, raza/categoría, nivel de desafío, atributos y mezcla de rasgos y habilidades.",
      detalle:
        "El Códice aconseja dar siempre un talón de Aquiles a la criatura, favorecer rasgos pasivos sobre demasiadas acciones reactivas y repartir 80 puntos de atributos igual que un PJ, normalmente usando una plantilla 5, 7, 9, 10, 10, 11, 13, 15. También sugiere centrar el monstruo en una táctica dominante.",
      fuente: "Códice de monstruos",
      pagina: 174,
      tags: ["monstruos", "diseño", "atributos"]
    },
    {
      id: "regla-monstruos-desafio-y-experiencia",
      tipo: "regla",
      nombre: "Desafío y experiencia de monstruos",
      resumen: "El nivel de desafío marca cuánta experiencia gasta la criatura en rasgos y habilidades.",
      detalle:
        "La tabla del Códice usa seis niveles: Sencillo 0 XP, Normal 50, Complicado 150, Difícil 300, Mortal 600 y Legendario 1200. Las distribuciones rápidas propuestas van desde sin habilidades hasta veinte capacidades a nivel maestro para criaturas legendarias.",
      fuente: "Códice de monstruos",
      pagina: 175,
      tags: ["monstruos", "desafío", "experiencia"]
    },
    {
      id: "regla-monstruos-creacion-complementos",
      tipo: "regla",
      nombre: "Complementos al crear monstruos",
      resumen: "Tras elegir base y poderes, calcula armas, armadura, defensa y resistencia como control de calidad del diseño.",
      detalle:
        "El capítulo recuerda separar efectos pasivos de activos, revisar qué atributo usa cada ataque o defensa y tener presentes interacciones clave como Combate con armadura, Berserker y Robusto al fijar protección, Resistencia y Umbral de dolor.",
      fuente: "Códice de monstruos",
      pagina: 176,
      tags: ["monstruos", "armas", "armadura", "defensa"]
    },
    {
      id: "regla-monstruos-creacion-toques-finales",
      tipo: "regla",
      nombre: "Toques finales del monstruo",
      resumen: "Conducta, botín, sombra y tácticas convierten un bloque mecánico en una criatura memorable.",
      detalle:
        "El Códice propone definir cómo se comporta el monstruo, qué objetos o restos valiosos podría portar o haber tragado, qué muestra su sombra a Ojo místico y qué táctica sigue según un papel similar al de cazador, guerrero, místico o maleante.",
      fuente: "Códice de monstruos",
      pagina: 177,
      tags: ["monstruos", "conducta", "tácticas", "sombra"]
    },
    {
      id: "regla-monstruos-combate-equilibrado",
      tipo: "regla",
      nombre: "Desafío de combate equilibrado",
      resumen: "El Códice combina nivel de competencia, dificultad prevista y entorno para estimar encuentros razonables.",
      detalle:
        "No es una fórmula exacta: depende del estilo del grupo, de cómo gasten experiencia y de cómo combinen poderes y rasgos. Aun así, ofrece una base práctica para decidir qué oposición usar en cada fase de campaña.",
      fuente: "Códice de monstruos",
      pagina: 178,
      tags: ["monstruos", "encuentros", "equilibrio"]
    },
    {
      id: "regla-monstruos-nivel-de-competencia",
      tipo: "regla",
      nombre: "Nivel de competencia",
      resumen: "El libro divide a los grupos en novatos, experimentados, veteranos y héroes según experiencia, equipo y alcance de sus aventuras.",
      detalle:
        "Novatos rondan 50 XP y afrontan aventuras limitadas; experimentados, unas 100 XP y retos locales; veteranos, unas 200 XP y amenazas regionales; héroes, 300 XP o más, con artefactos abundantes y conflictos globales.",
      fuente: "Códice de monstruos",
      pagina: 178,
      tags: ["monstruos", "campaña", "competencia"]
    },
    {
      id: "regla-monstruos-competencia-y-desafio",
      tipo: "regla",
      nombre: "Competencia y desafío",
      resumen: "El Códice ofrece una tabla de encuentros fáciles y difíciles según el nivel del grupo.",
      detalle:
        "Un combate fácil debería favorecer a los PJ; uno difícil funciona mejor como clímax incierto. La tabla relaciona cada nivel con cantidades orientativas de enemigos sencillos, normales, complicados, difíciles, mortales o legendarios, además de líderes apropiados.",
      fuente: "Códice de monstruos",
      pagina: 180,
      tags: ["monstruos", "encuentros", "dificultad"]
    },
    {
      id: "regla-monstruos-competencia-y-entorno",
      tipo: "regla",
      nombre: "Competencia y entorno",
      resumen: "El entorno también escala el peligro: Ambria es relativamente segura y Davokar se vuelve letal cuanto más profundo se entra.",
      detalle:
        "Las pautas sugieren novatos principalmente en Ambria y Davokar la Luminosa, experimentados con incursiones crecientes en la Oscura, veteranos habituados a la Luminosa pero probados en la Oscura, y héroes enfrentados a zonas completamente consumidas por corrupción.",
      fuente: "Códice de monstruos",
      pagina: 180,
      tags: ["monstruos", "Davokar", "entorno"]
    }
  ];
}

export const MANUAL_RULES: CompendiumEntry[] = [
  {
    id: "regla-manual-1-creacion-inicial-de-personaje",
    tipo: "regla",
    nombre: "Creaci\u00f3n inicial de personaje",
    resumen: "La creaci\u00f3n est\u00e1 cerrada a personajes iniciales; el progreso posterior ir\u00e1 por campa\u00f1as, no por niveles.",
    detalle: "Todos los personajes creados en UMBRA se validan como fichas iniciales. No existe nivel de personaje en la creaci\u00f3n actual y el avance posterior se implementar\u00e1 aparte dentro del m\u00f3dulo de campa\u00f1as.",
    fuente: "Reglas UMBRA",
    tags: ["creacion", "personaje", "mvp"]
  },
  {
    id: "regla-manual-2-atributos-de-creacion",
    tipo: "regla",
    nombre: "Atributos de creaci\u00f3n",
    resumen: "Los ocho atributos deben sumar 80, estar entre 5 y 15 y solo uno puede alcanzar 15.",
    detalle: "En la creaci\u00f3n, \u00c1gil, Atento, Discreto, Diestro, Fuerte, Inteligente, Persuasivo y Tenaz deben respetar los l\u00edmites oficiales. UMBRA bloquea cualquier combinaci\u00f3n fuera de 80 puntos o con m\u00e1s de un 15.",
    fuente: "Libro B\u00e1sico",
    pagina: 104,
    tags: ["creacion", "atributos", "oficial"]
  },
  {
    id: "regla-manual-3-patrones-iniciales-de-habilidades",
    tipo: "regla",
    nombre: "Patrones iniciales de habilidades",
    resumen: "La creaci\u00f3n solo acepta 5 habilidades novato o 2 novato + 1 adepto; maestro no est\u00e1 permitido.",
    detalle: "UMBRA valida los patrones iniciales de capacidades durante la creaci\u00f3n: o bien cinco habilidades a nivel novato, o bien dos a nivel novato y una a nivel adepto. No se permite nivel maestro en creaci\u00f3n.",
    fuente: "Libro B\u00e1sico",
    pagina: 104,
    tags: ["creacion", "habilidades", "novato", "adepto"]
  },
  {
    id: "regla-manual-4-requisitos-de-poderes-y-rituales",
    tipo: "regla",
    nombre: "Requisitos de poderes y rituales",
    resumen: "Los poderes m\u00edsticos exigen habilidad m\u00edstica base; los rituales exigen la habilidad Rituales.",
    detalle: "Para registrar poderes m\u00edsticos debes incluir una base v\u00e1lida como Poder m\u00edstico, Magia, Te\u00fargia, Brujer\u00eda o Hechicer\u00eda. Para registrar rituales debes tener la habilidad Rituales. UMBRA valida ambos casos en frontend y backend.",
    fuente: "Reglas UMBRA",
    tags: ["magia", "poderes", "rituales", "requisitos"]
  },
];

export const RULE_SUMMARY_ENTRIES: CompendiumEntry[] = [
  {
    id: "regla-resumen-1-combate",
    tipo: "regla",
    nombre: "Combate",
    resumen: "El combate se va a llevar a cabo tal se describe aqui a excepci\u00f3n de la defensa, que no van a hacerse tiradas de defensa, solo de ataque, a menos que se diga lo contrario.",
    detalle: "El combate se va a llevar a cabo tal se describe aqui a excepci\u00f3n de la defensa, que no van a hacerse tiradas de defensa, solo de ataque, a menos que se diga lo contrario. Adem\u00e1s hay varios a\u00f1adidos al combate basico mas abajo en reglas especiales ( ).",
    fuente: "Resumen de Reglas",
    tags: ["combate"]
  },
  {
    id: "regla-resumen-2-luchar-a-ciegas",
    tipo: "regla",
    nombre: "Luchar a ciegas",
    resumen: "Resulta dif\u00edcil combatir a ciegas o con malas condiciones de visi\u00f3n, como en la oscuridad, con humo o con niebla densa.",
    detalle: "Resulta dif\u00edcil combatir a ciegas o con malas condiciones de visi\u00f3n, como en la oscuridad, con humo o con niebla densa. Si ambos bandos se ven perjudicados, no se aplica ning\u00fan ajuste; de lo contrario, el bando afectado tiene dos oportunidades para fallar sus tiradas: el jugador tira dos veces y elige el peor o el mejor resultado, dependiendo de si quien est\u00e1 afectado es su personaje o el enemigo, respectivamente.",
    fuente: "Resumen de Reglas",
    tags: ["luchar-a-ciegas", "luchar", "a", "ciegas"]
  },
  {
    id: "regla-resumen-3-destrabarse-del-combate",
    tipo: "regla",
    nombre: "Destrabarse del combate",
    resumen: "Destrabarse de un combate cuerpo a cuerpo cuesta una acci\u00f3n de movimiento y puede hacerse durante la iniciativa del personaje.",
    detalle: "Destrabarse de un combate cuerpo a cuerpo cuesta una acci\u00f3n de movimiento y puede hacerse durante la iniciativa del personaje. El enemigo tiene derecho a un ataque gratuito contra el personaje. Esta regla tambi\u00e9n se aplica cuando se combate contra varios oponentes, en cuyo caso cada uno tiene derecho a un ataque gratuito contra el personaje que decida destrabarse.",
    fuente: "Resumen de Reglas",
    tags: ["destrabarse-del-combate", "destrabarse", "del", "combate"]
  },
  {
    id: "regla-resumen-4-usar-aplicar-un-elixir",
    tipo: "regla",
    nombre: "Usar/aplicar un elixir",
    resumen: "Usar o aplicar un elixir sobre uno mismo o sobre el equipo cuenta como una acci\u00f3n de movimiento.",
    detalle: "Usar o aplicar un elixir sobre uno mismo o sobre el equipo cuenta como una acci\u00f3n de movimiento. Usarlo o aplicarlo sobre otra persona cuesta una acci\u00f3n de combate.",
    fuente: "Resumen de Reglas",
    tags: ["usar-aplicar-un-elixir", "usar", "aplicar", "un", "elixir"]
  },
  {
    id: "regla-resumen-5-primeros-auxilios",
    tipo: "regla",
    nombre: "Primeros auxilios",
    resumen: "Practicar primeros auxilios sobre una persona herida cuenta como una acci\u00f3n de combate y requiere el gasto de unas hierbas curativas o el uso de la habilidad de Medicus o de un poder curativo.",
    detalle: "Practicar primeros auxilios sobre una persona herida cuenta como una acci\u00f3n de combate y requiere el gasto de unas hierbas curativas o el uso de la habilidad de Medicus o de un poder curativo. El efecto de los primeros auxilios se explic\u00f3 en la secci\u00f3n anterior.",
    fuente: "Resumen de Reglas",
    tags: ["primeros-auxilios", "primeros", "auxilios"]
  },
  {
    id: "regla-resumen-6-levantarse",
    tipo: "regla",
    nombre: "Levantarse",
    resumen: "Pelear desde el suelo es posible pero desaconsejable, ya que los adversarios que est\u00e9n en pie y trabados cuerpo a cuerpo obtienen ventaja (ver Ventaja, a continuaci\u00f3n).",
    detalle: "Pelear desde el suelo es posible pero desaconsejable, ya que los adversarios que est\u00e9n en pie y trabados cuerpo a cuerpo obtienen ventaja (ver Ventaja, a continuaci\u00f3n). Si el personaje en el suelo supera una tirada de \u00c1gil, solo necesita una acci\u00f3n de movimiento para ponerse de pie. De lo contrario necesita el turno entero, lo que significa que no puede usar una acci\u00f3n de combate mientras se levanta.",
    fuente: "Resumen de Reglas",
    tags: ["levantarse"]
  },
  {
    id: "regla-resumen-7-linea-de-vision",
    tipo: "regla",
    nombre: "L\u00ednea de visi\u00f3n",
    resumen: "Las armas a distancia no pueden atravesar a otros combatientes, por lo que el tirador (o el m\u00edstico) pueden verse obligados a maniobrar para obtener una l\u00ednea de visi\u00f3n.",
    detalle: "Las armas a distancia no pueden atravesar a otros combatientes, por lo que el tirador (o el m\u00edstico) pueden verse obligados a maniobrar para obtener una l\u00ednea de visi\u00f3n. Como regla general, si el tirador o m\u00edstico est\u00e1 colocado tras un aliado de tal forma que su objetivo sufrir\u00eda un ataque gratuito si intentase llegar hasta \u00e9l, entonces la l\u00ednea de visi\u00f3n a dicho enemigo est\u00e1 bloqueada por el aliado del tirador.",
    fuente: "Resumen de Reglas",
    tags: ["linea-de-vision", "linea", "de", "vision"]
  },
  {
    id: "regla-resumen-8-escudo",
    tipo: "regla",
    nombre: "Escudo",
    resumen: "Las armas a distancia no pueden atravesar a otros combatientes, por lo que el tirador (o el m\u00edstico) pueden verse obligados a maniobrar para obtener una l\u00ednea de visi\u00f3n.",
    detalle: "Las armas a distancia no pueden atravesar a otros combatientes, por lo que el tirador (o el m\u00edstico) pueden verse obligados a maniobrar para obtener una l\u00ednea de visi\u00f3n. Como regla general, si el tirador o m\u00edstico est\u00e1 colocado tras un aliado de tal forma que su objetivo sufrir\u00eda un ataque gratuito si intentase llegar hasta \u00e9l, entonces la l\u00ednea de visi\u00f3n a dicho enemigo est\u00e1 bloqueada por el aliado del tirador.",
    fuente: "Resumen de Reglas",
    tags: ["escudo"]
  },
  {
    id: "regla-resumen-9-flanquear",
    tipo: "regla",
    nombre: "Flanquear",
    resumen: "Rodear al enemigo es una estrategia de combate muy eficaz.",
    detalle: "Rodear al enemigo es una estrategia de combate muy eficaz. Si dos personas flanquean a un enemigo, ambas obtienen una ventaja contra este. El m\u00e1ximo de personas que puede rodear a una persona o criatura es de cuatro. Recuerda que aunque pasar junto a un enemigo provoca un ataque gratuito, es posible evitar dicho ataque si el personaje elige transformar su acci\u00f3n de combate de ese turno en una acci\u00f3n adicional de movimiento, lo que permite rodear al enemigo sin acercarse.",
    fuente: "Resumen de Reglas",
    tags: ["flanquear"]
  },
  {
    id: "regla-resumen-10-sorpresa",
    tipo: "regla",
    nombre: "Sorpresa",
    resumen: "Sorprender a un enemigo o preparar una emboscada es una acci\u00f3n activa que requiere de una tirada con \u00e9xito de [Discreto\u2190Atento].",
    detalle: "Sorprender a un enemigo o preparar una emboscada es una acci\u00f3n activa que requiere de una tirada con \u00e9xito de [Discreto\u2190Atento]. Atacar a un enemigo que no sea consciente de la situaci\u00f3n permite realizar un ataque gratuito con ventaja en el primer turno del combate. Posteriormente se sigue el orden normal del turno, seg\u00fan lo \u00c1gil que sea cada combatiente.",
    fuente: "Resumen de Reglas",
    tags: ["sorpresa"]
  },
  {
    id: "regla-resumen-11-ventaja",
    tipo: "regla",
    nombre: "Ventaja",
    resumen: "A veces uno de los bandos en combate obtiene una ventaja sobre el otro.",
    detalle: "A veces uno de los bandos en combate obtiene una ventaja sobre el otro. Un personaje que se deslice sigilosamente tras un enemigo tiene ventaja, al igual que si el objetivo estuviera en el suelo o intentando escalar hacia tu posici\u00f3n. Para crear una ventaja durante un combate en una superficie lisa y firme es necesario usar acciones, ataques o movimientos. Un personaje con ventaja en combate recibe un +2 a las tiradas del atributo relevante e inflige +1D4 puntos de da\u00f1o con su ataque. Las siguientes situaciones dan ventaja: \u25c6 Atacar a un enemigo que no sea consciente del ataque. Por lo general, es necesario que el atacante supere previamente una tirada de [Discreto\u2190Atento]. \u25c6 Todos los ataques de cuerpo a cuerpo contra un enemigo flanqueado reciben ventaja. Un objetivo se considera flanqueado si dos enemigos se colocan en lados opuestos del mismo. Por lo general, es necesario gastar una acci\u00f3n de movimiento en rodear al enemigo para flanquearlo. De igual forma, un personaje puede usar una acci\u00f3n de movimiento para escapar de un flanqueo, aunque cada enemigo obtiene un ataque gratuito como consecuencia. \u25c6 Todos los ataques cuerpo a cuerpo contra un enemigo en el suelo. Los ataques a distancia no se benefician de esta situaci\u00f3n. \u25c6 Todos los ataques contra enemigos en una posici\u00f3n inferior, como al golpear desde una muralla a un objetivo que trepa por una escalera. Esto se aplica tanto a ataques cuerpo a cuerpo como a distancia.",
    fuente: "Resumen de Reglas",
    tags: ["ventaja"]
  },
  {
    id: "regla-resumen-12-umbral-de-dolor",
    tipo: "regla",
    nombre: "Umbral de dolor",
    resumen: "El Umbral de dolor de un personaje es igual a la mitad de su valor de Fuerte redondeado hacia arriba.",
    detalle: "El Umbral de dolor de un personaje es igual a la mitad de su valor de Fuerte redondeado hacia arriba. Cuando una criatura sufre un da\u00f1o igual o superior a su Umbral de dolor en un solo ataque (despu\u00e9s de restar la protecci\u00f3n de la armadura), el jugador debe elegir uno de los siguientes efectos. F\u00edjate que el jugador elige en ambos casos, tanto si es su personaje quien sufre el da\u00f1o como si se lo inflige al enemigo. \u25c6 El defensor cae al suelo y debe gastar una o m\u00e1s acciones para levantarse (ver p\u00e1gina 159). \u25c6 El atacante obtiene un ataque gratuito contra el defensor.",
    fuente: "Resumen de Reglas",
    tags: ["umbral-de-dolor", "umbral", "de", "dolor"]
  },
  {
    id: "regla-resumen-13-personajes-moribundos",
    tipo: "regla",
    nombre: "Personajes moribundos",
    resumen: "A menos que el director de juego diga lo contrario, los monstruos y personajes no jugadores mueren en cuanto su Resistencia cae a 0.",
    detalle: "A menos que el director de juego diga lo contrario, los monstruos y personajes no jugadores mueren en cuanto su Resistencia cae a 0. En cualquier caso, las reglas para personajes jugadores son diferentes. Un personaje jugador se derrumba cuando su Resistencia llega a 0. Se considera que est\u00e1 moribundo y que no puede hacer nada por curarse a s\u00ed mismo. En cada turno posterior, el jugador debe hacer una tirada de muerte (ver columna lateral) con 1D20, durante la iniciativa de su personaje. La tirada debe repetirse hasta que alguien estabilice al personaje mediante una curaci\u00f3n m\u00edstica, hierbas curativas o la habilidad Medicus; hasta que el jugador saque un 1 y se levante; o hasta que obtenga un 20 en el dado y muera. Si un PJ est\u00e1 envenenado mientras est\u00e1 moribundo, las tiradas de muerte cambian, cada tirada de muerte de 1-19 tiene el efecto de 11-19 y el 20 sigue igual.",
    fuente: "Resumen de Reglas",
    tags: ["personajes-moribundos", "personajes", "moribundos"]
  },
  {
    id: "regla-resumen-14-conflictos-entre-personajes-jugadores",
    tipo: "regla",
    nombre: "Conflictos entre personajes jugadores",
    resumen: "Symbaroum est\u00e1 dise\u00f1ado para facilitar la colaboraci\u00f3n de los jugadores entre s\u00ed y con el director de juego.",
    detalle: "Symbaroum est\u00e1 dise\u00f1ado para facilitar la colaboraci\u00f3n de los jugadores entre s\u00ed y con el director de juego. El sistema de reglas se basa en la premisa de que los personajes pueden tener sus diferencias, pero que no van a atacarse entre ellos. De lo contrario, el esp\u00edritu del juego morir\u00eda. Sin embargo, en caso de un enfrentamiento entre personajes jugadores, recomendamos al director de juego que intervenga y pregunte a los jugadores c\u00f3mo creen que deber\u00eda resolverse la situaci\u00f3n. Aunque es posible que acabe con un combate, es mejor recurrir a una narraci\u00f3n sin tiradas de dados, sin que muera ning\u00fan personaje. Por otro lado, pueden aparecer situaciones en las que los personajes jugadores tienen un enfrentamiento enconado o donde intentan enga\u00f1arse o confundirse entre ellos usando las reglas. En ese caso, el jugador activo realiza la tirada, mientras que el pasivo la modifica. Un ejemplo t\u00edpico ser\u00eda cuando un personaje jugador intenta robar, enga\u00f1ar o actuar sigilosamente a espaldas de otro personaje del grupo; en ese caso, y aunque ambos jugadores son conscientes de lo que ocurre, la situaci\u00f3n se resuelve con una tirada de [Discreto\u2190Atento]",
    fuente: "Resumen de Reglas",
    tags: ["conflictos-entre-personajes-jugadores", "conflictos", "entre", "personajes", "jugadores"]
  },
  {
    id: "regla-resumen-15-dano-por-veneno-o-acido",
    tipo: "regla",
    nombre: "Da\u00f1o por veneno o \u00e1cido",
    resumen: "Una vez que tiene efecto, el veneno hace da\u00f1o cada asalto (ignorando armadura) hasta que finaliza su duraci\u00f3n o alguien le administra un ant\u00eddoto a la v\u00edctima y supera una tirada de Inteligente.",
    detalle: "Una vez que tiene efecto, el veneno hace da\u00f1o cada asalto (ignorando armadura) hasta que finaliza su duraci\u00f3n o alguien le administra un ant\u00eddoto a la v\u00edctima y supera una tirada de Inteligente. El \u00e1cido tambi\u00e9n ataca cada asalto, pero antes de hacer da\u00f1o debe penetrar la armadura. Para eliminar el \u00e1cido de un cuerpo o armadura es necesario que alguien gaste una acci\u00f3n de combate y supere una tirada de Inteligente para lavar el \u00e1cido con agua, arena o algo similar",
    fuente: "Resumen de Reglas",
    tags: ["dano-por-veneno-o-acido", "dano", "por", "veneno", "o"]
  },
  {
    id: "regla-resumen-16-dano-por-caida",
    tipo: "regla",
    nombre: "Da\u00f1o por ca\u00edda",
    resumen: "Un personaje que caiga desde una altura considerable sufre un da\u00f1o igual al n\u00famero de metros de la ca\u00edda.",
    detalle: "Un personaje que caiga desde una altura considerable sufre un da\u00f1o igual al n\u00famero de metros de la ca\u00edda. Una tirada con \u00e9xito de \u00c1gil le permite aterrizar mejor o amortiguar el golpe de alg\u00fan modo, lo que reduce el da\u00f1o en 3 puntos. El agua y el terreno blando tambi\u00e9n suavizan la ca\u00edda y restan 5 puntos de da\u00f1o. La armadura protege de manera normal.",
    fuente: "Resumen de Reglas",
    tags: ["dano-por-caida", "dano", "por", "caida"]
  },
  {
    id: "regla-resumen-17-reglas-alternativas-a-discutir-por-el-grupo",
    tipo: "regla",
    nombre: "Reglas alternativas: (a discutir por el grupo)",
    resumen: "Modificaciones a la corrupci\u00f3n: Las reglas de lo que ocurre al ganar corrupci\u00f3n por encima de tu umbral de corrupci\u00f3n se van a modificar para dar m\u00e1s tensi\u00f3n y diversi\u00f3n a los m\u00edsticos.",
    detalle: "Modificaciones a la corrupci\u00f3n: Las reglas de lo que ocurre al ganar corrupci\u00f3n por encima de tu umbral de corrupci\u00f3n se van a modificar para dar m\u00e1s tensi\u00f3n y diversi\u00f3n a los m\u00edsticos.",
    fuente: "Resumen de Reglas",
    tags: ["reglas-alternativas-a-discutir-por-el-grupo", "reglas", "alternativas", "a", "discutir"]
  },
  {
    id: "regla-resumen-18-umbral-de-corrupcion",
    tipo: "regla",
    nombre: "Umbral de corrupci\u00f3n",
    resumen: "Cuando ganas corrupci\u00f3n y alcanzas tu umbral de corrupci\u00f3n, haces una tirada de Tenaz, si fallas transformas 1D4 de corrupci\u00f3n temporal en corrupci\u00f3n permanente, y ganas un estigma f\u00edsico temporal.",
    detalle: "Cuando ganas corrupci\u00f3n y alcanzas tu umbral de corrupci\u00f3n, haces una tirada de Tenaz, si fallas transformas 1D4 de corrupci\u00f3n temporal en corrupci\u00f3n permanente, y ganas un estigma f\u00edsico temporal. Cuando tu corrupci\u00f3n permanente alcanza tu umbral de corrupci\u00f3n, ganas Sangre Oscura y Bestial sin opci\u00f3n a rechazarlo. Si bajas la corrupci\u00f3n de alguna manera estos rasgos desaparecen.",
    fuente: "Resumen de Reglas",
    tags: ["umbral-de-corrupcion", "umbral", "de", "corrupcion"]
  },
  {
    id: "regla-resumen-19-corrupcion-maxima",
    tipo: "regla",
    nombre: "Corrupci\u00f3n m\u00e1xima",
    resumen: "Cuando ganas corrupci\u00f3n para alcanzar tu m\u00e1ximo de corrupci\u00f3n, transformas inmediatamente 1D4 de corrupci\u00f3n temporal a permanente.",
    detalle: "Cuando ganas corrupci\u00f3n para alcanzar tu m\u00e1ximo de corrupci\u00f3n, transformas inmediatamente 1D4 de corrupci\u00f3n temporal a permanente. A partir de ahora en cada turno y en cada fuente de corrupci\u00f3n tiras Tenaz, si superas la prueba tu corrupci\u00f3n permanente se reduce en uno, si sacas un 1  se reduce en 1D4 y si sacas un 20 te conviertes en abominaci\u00f3n. Si tu corrupci\u00f3n permanente alcanza tu corrupci\u00f3n m\u00e1xima, Un 1 te salva de convertirte en abominaci\u00f3n y reduce tu corrupci\u00f3n permanente en 1, pero cualquier otro resultado te transforma en abominaci\u00f3n.",
    fuente: "Resumen de Reglas",
    tags: ["corrupcion-maxima", "corrupcion", "maxima"]
  },
  {
    id: "regla-resumen-20-cambio-a-las-tradiciones",
    tipo: "regla",
    nombre: "Cambio a las tradiciones",
    resumen: "Todas las habilidades de tradiciones que dicen que solo se gana 1 de corrupci\u00f3n se aplica solo a los hechizos que se lancen con \u00e9xito.",
    detalle: "Todas las habilidades de tradiciones que dicen que solo se gana 1 de corrupci\u00f3n se aplica solo a los hechizos que se lancen con \u00e9xito. Si se falla se sigue ganando 1D4 de corrupci\u00f3n temporal.",
    fuente: "Resumen de Reglas",
    tags: ["cambio-a-las-tradiciones", "cambio", "a", "las", "tradiciones"]
  },
  {
    id: "regla-resumen-21-cambio-a-talento-mistico-superior",
    tipo: "regla",
    nombre: "Cambio a Talento m\u00edstico superior",
    resumen: "En adepto, el umbral de corrupci\u00f3n m\u00e1xima se establece en Tenaz+5 en vez de en Tenaz*2.",
    detalle: "En adepto, el umbral de corrupci\u00f3n m\u00e1xima se establece en Tenaz+5 en vez de en Tenaz*2.",
    fuente: "Resumen de Reglas",
    tags: ["cambio-a-talento-mistico-superior", "cambio", "a", "talento", "mistico"]
  },
  {
    id: "regla-resumen-22-muerte-instantanea",
    tipo: "regla",
    nombre: "Muerte instant\u00e1nea",
    resumen: "Las reglas de muerte funcionan igual, excepto si el personaje llega o queda por debajo de cero puntos de Resistencia tras un ataque que infligi\u00f3 un da\u00f1o igual o superior a su Umbral de dolor.",
    detalle: "Las reglas de muerte funcionan igual, excepto si el personaje llega o queda por debajo de cero puntos de Resistencia tras un ataque que infligi\u00f3 un da\u00f1o igual o superior a su Umbral de dolor. Un impacto de ese calibre mata al personaje al instante, que solo tiene tiempo de murmurar unas \u00faltimas palabras memorables antes de fallecer.",
    fuente: "Resumen de Reglas",
    tags: ["muerte-instantanea", "muerte", "instantanea"]
  },
  {
    id: "regla-resumen-23-modificadores-por-dano-critico",
    tipo: "regla",
    nombre: "Modificadores por da\u00f1o cr\u00edtico",
    resumen: "Cuando una criatura sufre un da\u00f1o superior a su Umbral de dolor, todas sus tiradas tienen una segunda oportunidad de fallo hasta el final de la escena.",
    detalle: "Cuando una criatura sufre un da\u00f1o superior a su Umbral de dolor, todas sus tiradas tienen una segunda oportunidad de fallo hasta el final de la escena. As\u00ed, un jugador que recibe un da\u00f1o cr\u00edtico repite todas sus tiradas y elige el peor resultado posible (el n\u00famero superior); si la v\u00edctima del da\u00f1o cr\u00edtico es un enemigo, el jugador tira dos veces y elige el mejor resultado (el n\u00famero inferior). Los efectos del da\u00f1o cr\u00edtico duran hasta que la criatura recupera o se cura al menos 1 punto de Resistencia. F\u00edjate que los muertos vivientes, al no tener Umbral de dolor, son inmunes al da\u00f1o cr\u00edtico. Por tanto, esta regla los convierte en monstruos m\u00e1s poderosos, ya que hace m\u00e1s vulnerables a todos los dem\u00e1s.",
    fuente: "Resumen de Reglas",
    tags: ["modificadores-por-dano-critico", "modificadores", "por", "dano", "critico"]
  },
  {
    id: "regla-resumen-24-tiradas-a-cambio-de-experiencia",
    tipo: "regla",
    nombre: "Tiradas a cambio de experiencia",
    resumen: "Cualquier jugador puede gastar, de forma permanente, un punto de experiencia a cambio de repetir una tirada cualquiera.",
    detalle: "Cualquier jugador puede gastar, de forma permanente, un punto de experiencia a cambio de repetir una tirada cualquiera. Solo se permite repetir una tirada por acci\u00f3n. Esta regla aumenta las posibilidades de supervivencia de los personajes, lo que puede resultar especialmente positivo si se usa en combinaci\u00f3n con las reglas opcionales de \u00abMuerte instant\u00e1nea\u00bb o las de \u00abGolpes cr\u00edticos y pifias en defensa\u00bb. En ese caso, el grupo debe decidir qu\u00e9 tiradas pueden repetirse y cu\u00e1les no. \u25c6 \u00bfSe pueden repetir las tiradas de muerte? (Recomendaci\u00f3n: No) \u25c6 \u00bfSe puede repetir una pifia en Defensa? (Recomendaci\u00f3n: No)",
    fuente: "Resumen de Reglas",
    tags: ["tiradas-a-cambio-de-experiencia", "tiradas", "a", "cambio", "de"]
  },
  {
    id: "regla-resumen-25-tiradas-a-cambio-de-corrupcion",
    tipo: "regla",
    nombre: "Tiradas a cambio de corrupci\u00f3n",
    resumen: "Esta opci\u00f3n hace del abuso de la oscuridad un asunto que afecta a todos, ya que los personajes no m\u00edsticos y sin acceso a artefactos tienen ahora la opci\u00f3n de deslizarse hacia su perdici\u00f3n a cambio de beneficios a cor...",
    detalle: "Esta opci\u00f3n hace del abuso de la oscuridad un asunto que afecta a todos, ya que los personajes no m\u00edsticos y sin acceso a artefactos tienen ahora la opci\u00f3n de deslizarse hacia su perdici\u00f3n a cambio de beneficios a corto plazo. Esta regla permite repetir cualquier tirada al coste de un punto de Corrupci\u00f3n permanente. Solo se permite repetir una tirada por acci\u00f3n.",
    fuente: "Resumen de Reglas",
    tags: ["tiradas-a-cambio-de-corrupcion", "tiradas", "a", "cambio", "de"]
  },
  {
    id: "regla-resumen-26-criticos-y-pifias-en-combate",
    tipo: "regla",
    nombre: "Cr\u00edticos y pifias en combate",
    resumen: "Golpe cr\u00edtico (1 en 1D20 al atacar): El personaje jugador hace +1D6 puntos de da\u00f1o.",
    detalle: "\u25c6 Golpe cr\u00edtico (1 en 1D20 al atacar): El personaje jugador hace +1D6 puntos de da\u00f1o. \u25c6 Pifia en ataque (20 en 1D20 al atacar): El enemigo gana un ataque gratuito contra el personaje jugador. \u25c6 Defensa cr\u00edtica (1 en 1D20 al tirar Defensa): El personaje jugador gana un ataque gratuito contra su enemigo. \u25c6 Pifia en Defensa (20 en 1D20 al tirar Defensa): El enemigo hace +3 puntos de da\u00f1o.",
    fuente: "Resumen de Reglas",
    tags: ["criticos-y-pifias-en-combate", "criticos", "y", "pifias", "en"]
  },
  {
    id: "regla-resumen-27-objetivos-vitales",
    tipo: "regla",
    nombre: "Objetivos vitales",
    resumen: "Los objetivos vitales encajan mejor con las aventuras cl\u00e1sicas que los personales, porque dichas aventuras suelen motivarse m\u00e1s por un compromiso que por un deseo a corto plazo.",
    detalle: "Los objetivos vitales encajan mejor con las aventuras cl\u00e1sicas que los personales, porque dichas aventuras suelen motivarse m\u00e1s por un compromiso que por un deseo a corto plazo. Durante una aventura, un jugador puede actuar siguiendo el objetivo vital de su personaje, lo que enriquecer\u00e1 la experiencia de juego de todo el grupo. Los objetivos vitales pueden usarse en combinaci\u00f3n con los personales y los del grupo, lo que podr\u00eda provocar interesantes complicaciones y roces dentro del grupo. Por ejemplo, el grupo podr\u00eda estar de acuerdo en sus metas, pero disentir en la forma de lograrlo y en el coste moral que est\u00e1n dispuestos a asumir (da\u00f1os colaterales, etc\u00e9tera). Lo importante de los objetivos vitales es que enriquezcan la partida y la experiencia de juego: los roces dentro del grupo pueden ser divertidos, pero las discusiones enquistadas y los enfados irreconciliables pueden llegar a aburrir. Por tanto, elegid los objetivos vitales en grupo y aseguraos de que ayudan a crear una din\u00e1mica activa en vez de una destructiva o tediosa. El objetivo vital de un personaje puede cambiar entre aventuras; es muy probable que tanto el personaje como su visi\u00f3n del mundo se transformen a lo largo de sus andanzas.",
    fuente: "Resumen de Reglas",
    tags: ["objetivos-vitales", "objetivos", "vitales"]
  },
  {
    id: "regla-resumen-28-el-camino-de-la-misericordia",
    tipo: "regla",
    nombre: "El camino de la misericordia",
    resumen: "Perdonar al enemigo rendido u olvidar las ofensas de alguien que nos ha hecho mal es parte fundamental del bien.",
    detalle: "Perdonar al enemigo rendido u olvidar las ofensas de alguien que nos ha hecho mal es parte fundamental del bien. Todo el mundo merece una segunda oportunidad. Los valores del personaje se ponen a prueba cuando sus principios chocan con emociones negativas de gran intensidad, como el odio o las ansias de venganza. La cuesti\u00f3n es demostrar si eres una bestia salvaje o una persona con piedad y dignidad en su coraz\u00f3n. Fama: A todos nos llega la muerte, lo \u00fanico que queda es tu nombre y tu reputaci\u00f3n. Las grandes haza\u00f1as pueden traer grandes beneficios, incluso en vida. Cuando mueras, tus hijos seguir\u00e1n llevando tu nombre, para bien o para mal; de hecho, la fama es lo m\u00e1s parecido que hay a la inmortalidad. O comes o te comen: La vida es sencilla: cada cual mira por lo suyo. No se trata de hacer lo correcto, sino que no te pillen. Algunos se escudan tras hermosas palabras sobre valores y principios para poder dormir de noche, pero cuando la situaci\u00f3n se tuerce, es un s\u00e1lvese quien pueda. Y aunque a veces conviene trabajar en grupo, solo resulta \u00fatil mientras no te dejes lastrar por los mediocres. La bendici\u00f3n de lo sencillo: Aquel que renuncia a falsos sue\u00f1os y necesidades imaginarias descubre lo f\u00e1cil que es la vida: trabaja cuando puedas, come cuando tengas hambre y duerme cuando est\u00e9s cansado, no hace falta m\u00e1s. La aut\u00e9ntica felicidad se encuentra en una vida sencilla. Lazos familiares: La sangre lo es todo, es m\u00e1s importante que cualquier otro lazo. Puedes jurar lealtad a una causa o un se\u00f1or, pero al final solo cuenta con qui\u00e9n compartes tu sangre. No importa si est\u00e1s de acuerdo con tus familiares o si son buenas personas siquiera. La familia es lo primero. \u00bfEn qui\u00e9n puedes confiar sino en tu sangre? Estilo y elegancia: El camino m\u00e1s f\u00e1cil no es para ti. Consideras que el estilo y la elegancia son m\u00e1s importantes que el \u00e9xito. Si no vas a hacer algo a la perfecci\u00f3n, mejor ni intentarlo, porque someterse a la gris rutina de la vida es como morir un poquito todos los d\u00edas. Aspiras a vivir una existencia m\u00e1s elevada, a engrandecer tu esp\u00edritu y enriquecer tu vida con belleza y elegancia. El imperativo de la libertad: La libertad individual est\u00e1 por encima de todo. El deber y los juramentos de lealtad son el escudo de los que tienen miedo a la vida. Para ti, vivir sin meterte en los asuntos de los dem\u00e1s y sin preocuparte de las opiniones y presiones de nadie es el camino hacia la felicidad y (quiz\u00e1s) hacia un mundo mejor. Lo m\u00e1s importante es que cuando est\u00e9s en tu lecho de muerte puedas decir que has sido libre y que seguiste a tu propio coraz\u00f3n. La ley de la generosidad: Compartir lo que tienes es esencial para ti. El nivel de bondad de una sociedad se mide por la forma en que trata a sus miembros m\u00e1s d\u00e9biles. Lo mismo ocurre con cada uno de nosotros: \u00bferes una buena persona o un simple par\u00e1sito? Si vives en la abundancia, comp\u00e1rtela con los dem\u00e1s. Obsesionado por la venganza: Ojo por ojo y diente por diente, esa es la ley de la naturaleza; todo lo dem\u00e1s es mentira, un error o una debilidad moral. Si no te vengas de ninguna de las afrentas sufridas, \u00bfqui\u00e9n ser\u00edas en realidad? Solo quedar\u00edan palabras vac\u00edas. Lo \u00fanico que cuenta son los hechos. El conocimiento trae la luz: El prop\u00f3sito de la vida es comprender la existencia. El conocimiento debe ser reunido, reverenciado, cultivado y difundido. Resulta f\u00e1cil vivir simplemente aceptando el d\u00eda a d\u00eda, esclavizado por el deber, los prejuicios o la locura. Irse a la cama siendo m\u00e1s sabio que la ma\u00f1ana anterior y saber que, cuando mueras, habr\u00e1s llevado la antorcha del conocimiento un poco m\u00e1s all\u00e1 de las tinieblas: esa es la obra de una vida significativa. El poder de una promesa: La val\u00eda de una persona se mide por el valor de su palabra y de las promesas que realiza. La confianza es lo \u00fanico que importa. Cuando yazcas en tu fr\u00eda tumba, \u00bfqu\u00e9 se dir\u00e1 de ti? \u00bfQue fuiste alguien noble en quien confiar? \u00bfO que solo dec\u00edas lo que otros quer\u00edan o\u00edr, siempre en busca de tu propio beneficio? La naturaleza es sagrada: La naturaleza es el origen de todo, por lo que debe ser respetada. No tomes m\u00e1s de lo necesario y aseg\u00farate de devolver lo que puedas. Pensar que no formamos parte de la naturaleza es tan absurdo como peligroso. Y la naturaleza debe defenderse de quienes pretenden explotarla impulsados por su ego\u00edsmo y estupidez. El orden es una necesidad: Las leyes y normas existen por una raz\u00f3n y deben ser obedecidas. Aunque a veces pueden parecen un obst\u00e1culo, solo lo son temporalmente: a la larga, la ley y el orden son la \u00fanica manera para salvar del caos a ti y a tus descendientes. El deber ante todo: El juramento que has realizado es la cosa m\u00e1s importante de tu vida. Jam\u00e1s romper\u00e1s tu promesa, ni siquiera si tu se\u00f1or demuestra ser indigno o estar lleno de vicios. El problema del mundo es que hay muchos que olvidan su deber y pocos que mantienen su palabra. Sin sentido del deber, una persona no es m\u00e1s que un esclavo de su lujuria y su vanidad, pero un juramento mantenido tiene su eco en la eternidad. La sublimaci\u00f3n de la riqueza: Hay muchos que se esfuerzan por obtener la gloria, la fama o la virtud, cuando lo \u00fanico realmente trascendente est\u00e1 justo delante de ellos: las tierras y el oro, los negocios, las mansiones, los objetos de valor. Las riquezas son lo que mueven el mundo, engrandecen a su propietario y dan un atisbo de significado a esta m\u00edsera existencia, ya sea gast\u00e1ndolas en vida o guard\u00e1ndolas para las siguientes generaciones.",
    fuente: "Resumen de Reglas",
    tags: ["el-camino-de-la-misericordia", "el", "camino", "de", "la"]
  },
  {
    id: "regla-resumen-29-movimiento-a-escala",
    tipo: "regla",
    nombre: "Movimiento a escala",
    resumen: "En Symbaroum el movimiento es una cosa abstracta, que tiene m\u00e1s valor como acci\u00f3n que como una medida de una distancia espec\u00edfica.",
    detalle: "En Symbaroum el movimiento es una cosa abstracta, que tiene m\u00e1s valor como acci\u00f3n que como una medida de una distancia espec\u00edfica. Algunos grupos prefieren determinar a cu\u00e1nto equivale cada acci\u00f3n de movimiento, empleando una escala que les permita usar miniaturas o marcas en una cuadr\u00edcula. En ese caso, recomendamos que una acci\u00f3n de movimiento equivalga a 5 casillas (de 2 metros cada una). Se considera que las criaturas en casillas contiguas est\u00e1n trabadas en combate y que si hay una o m\u00e1s casillas entre dos rivales s\u00f3lo podr\u00e1n atacarse a distancia. La ventaja del movimiento a escala es que resulta m\u00e1s f\u00e1cil ver las posibilidades de tiro, qui\u00e9n est\u00e1 peleando con qui\u00e9n y los ataques gratuitos provocados por el movimiento. El inconveniente es que se consume m\u00e1s tiempo en planear cada turno.",
    fuente: "Resumen de Reglas",
    tags: ["movimiento-a-escala", "movimiento", "a", "escala"]
  },
  {
    id: "regla-resumen-30-tiradas-para-atributos",
    tipo: "regla",
    nombre: "Tiradas para atributos",
    resumen: "Para los grupos de la vieja escuela, o a los que le guste ese estilo, siempre est\u00e1 la opci\u00f3n de olvidarse del reparto de puntos y tirar los dados para generar los valores de sus atributos.",
    detalle: "Para los grupos de la vieja escuela, o a los que le guste ese estilo, siempre est\u00e1 la opci\u00f3n de olvidarse del reparto de puntos y tirar los dados para generar los valores de sus atributos. El m\u00e9todo m\u00e1s sencillo es tirar 2D6+3 ocho veces (una por atributo) y distribuir los resultados seg\u00fan el tipo de personaje que se tenga en mente.",
    fuente: "Resumen de Reglas",
    tags: ["tiradas-para-atributos", "tiradas", "para", "atributos"]
  },
  {
    id: "regla-resumen-31-usar-persuasivo-entre-jugadores",
    tipo: "regla",
    nombre: "Usar Persuasivo entre jugadores",
    resumen: "El grupo puede decidir que los personajes jugadores usen tiradas de [Persuasivo\u2190Tenaz] entre ellos.",
    detalle: "El grupo puede decidir que los personajes jugadores usen tiradas de [Persuasivo\u2190Tenaz] entre ellos. Nuestro consejo es que se\u00e1is flexibles: permitid que los personajes usen Persuasivo entre ellos en momentos cruciales de la partida. Gritar \u00ab\u00a1No la mates!\u00bb es un momento crucial, pero decir \u00abDame tu parte del bot\u00edn\u00bb no lo es. Un sistema razonable ser\u00eda tener unas normas que determinen en qu\u00e9 momentos puede usarse, pero que los jugadores sobre los que se quiera aplicar la regla tengan derecho de veto.",
    fuente: "Resumen de Reglas",
    tags: ["usar-persuasivo-entre-jugadores", "usar", "persuasivo", "entre", "jugadores"]
  },
  {
    id: "regla-resumen-32-armas-alquimicas",
    tipo: "regla",
    nombre: "Armas alqu\u00edmicas",
    resumen: "Cualquiera puede usar un arma alqu\u00edmica, pero solo aquellos con el entrenamiento apropiado pueden hacerlo sin correr riesgos.",
    detalle: "Cualquiera puede usar un arma alqu\u00edmica, pero solo aquellos con el entrenamiento apropiado pueden hacerlo sin correr riesgos. Adem\u00e1s, las armas m\u00e1s avanzadas no pueden utilizarse sin el entrenamiento apropiado. A continuaci\u00f3n hay un resumen de los requisitos m\u00ednimos:",
    fuente: "Resumen de Reglas",
    tags: ["armas-alquimicas", "armas", "alquimicas"]
  },
  {
    id: "regla-resumen-33-tubo-de-fuego-alquimico-portatil",
    tipo: "regla",
    nombre: "Tubo de fuego alqu\u00edmico (port\u00e1til)",
    resumen: "Se necesita Experto en asedios (adepto) para usarlo sin correr riesgos.",
    detalle: "Se necesita Experto en asedios (adepto) para usarlo sin correr riesgos.",
    fuente: "Resumen de Reglas",
    tags: ["tubo-de-fuego-alquimico-portatil", "tubo", "de", "fuego", "alquimico"]
  },
  {
    id: "regla-resumen-34-tubo-de-fuego-alquimico-fijo",
    tipo: "regla",
    nombre: "Tubo de fuego alqu\u00edmico (fijo)",
    resumen: "Se necesita Alquimista, Experto en asedios o Pirotecnia para usarla sin correr riesgos.",
    detalle: "Se necesita Alquimista, Experto en asedios o Pirotecnia para usarla sin correr riesgos.",
    fuente: "Resumen de Reglas",
    tags: ["tubo-de-fuego-alquimico-fijo", "tubo", "de", "fuego", "alquimico"]
  },
  {
    id: "regla-resumen-35-granada-alquimica",
    tipo: "regla",
    nombre: "Granada alqu\u00edmica",
    resumen: "Se necesita Alquimista, Experto en asedios o Pirotecnia para usarla sin correr riesgos.",
    detalle: "Se necesita Alquimista, Experto en asedios o Pirotecnia para usarla sin correr riesgos. Mina alqu\u00edmica: se requiere Trampero o Pirotecnia para poder usarla.",
    fuente: "Resumen de Reglas",
    tags: ["granada-alquimica", "granada", "alquimica"]
  },
  {
    id: "regla-resumen-36-olla-explosiva",
    tipo: "regla",
    nombre: "Olla explosiva",
    resumen: "Cualquiera puede usarla, pero solo una persona con la habilidad Experto en asedios o Pirotecnia puede hacerlo sin correr riesgos",
    detalle: "Cualquiera puede usarla, pero solo una persona con la habilidad Experto en asedios o Pirotecnia puede hacerlo sin correr riesgos",
    fuente: "Resumen de Reglas",
    tags: ["olla-explosiva", "olla", "explosiva"]
  },
  {
    id: "regla-resumen-37-categorias-de-distancia",
    tipo: "regla",
    nombre: "Categor\u00edas de distancia",
    resumen: "Algunos grupos de juego consideran que las reglas b\u00e1sicas para las armas a distancia son demasiado simples, ya que no tienen en cuenta la distancia (la persona que dispara simplemente debe poder ver al oponente y tene...",
    detalle: "Algunos grupos de juego consideran que las reglas b\u00e1sicas para las armas a distancia son demasiado simples, ya que no tienen en cuenta la distancia (la persona que dispara simplemente debe poder ver al oponente y tener una l\u00ednea de visi\u00f3n clara). Si tu grupo de juego quiere reglas m\u00e1s precisas y t\u00e1cticamente relevantes, pod\u00e9is emplear la siguiente gu\u00eda: Cada encuentro de combate comienza a una distancia determinada por la situaci\u00f3n y el terreno (a decidir por el DJ). Las categor\u00edas de distancia modifican el da\u00f1o y la posibilidad de golpear en cantidad proporcional al n\u00famero de acciones de movimiento necesarias para que los combatientes se enfrenten entre s\u00ed en un combate cuerpo a cuerpo (ver p\u00e1gina siguiente). Ten en cuenta que esta regla no afecta a los poderes m\u00edsticos. Un efecto obvio de esta regla es que los personajes con armas a distancia no pueden luchar de manera efectiva a corta distancia, por lo que tienen que moverse (y sufrir ataques gratuitos) o cambiar de arma. Como consecuencia de esto, habilidades como Acr\u00f3bata, Pu\u00f1o de flecha y Arco veloz se vuelven a\u00fan m\u00e1s valiosas.",
    fuente: "Resumen de Reglas",
    tags: ["categorias-de-distancia", "categorias", "de", "distancia"]
  },
  {
    id: "regla-resumen-38-convertirse-en-muerto-viviente-en-vez-de-abominacion-por-corrupcion",
    tipo: "regla",
    nombre: "Convertirse en muerto viviente en vez de abominaci\u00f3n por corrupci\u00f3n",
    resumen: "Un hecho impl\u00edcito en Symbaroum es que algunas criaturas pueden ser completamente corruptas sin perder por completo su voluntad.",
    detalle: "Un hecho impl\u00edcito en Symbaroum es que algunas criaturas pueden ser completamente corruptas sin perder por completo su voluntad. Si el grupo de juego lo desea, lo mismo puede aplicarse a los hechiceros: en lugar de convertirse en una abominaci\u00f3n renacida cuando est\u00e1n completamente corruptos, pueden realizar una prueba de Tenaz para convertirse en un muerto viviente, seg\u00fan la nueva raza de esta Gu\u00eda avanzada.",
    fuente: "Resumen de Reglas",
    tags: ["convertirse-en-muerto-viviente-en-vez-de-abominacion-por-corrupcion", "convertirse", "en", "muerto", "viviente"]
  },
  {
    id: "regla-resumen-39-hazanas",
    tipo: "regla",
    nombre: "Haza\u00f1as",
    resumen: "La introducci\u00f3n de reglas para las haza\u00f1as puede ser una opci\u00f3n interesante para los grupos de juego que desean que los personajes se parezcan m\u00e1s a los h\u00e9roes tradicionales.",
    detalle: "La introducci\u00f3n de reglas para las haza\u00f1as puede ser una opci\u00f3n interesante para los grupos de juego que desean que los personajes se parezcan m\u00e1s a los h\u00e9roes tradicionales. En resumen, las haza\u00f1as son acciones que solo individuos especialmente heroicos pueden lograr. Sin embargo, debe tenerse en cuenta que pone a disposici\u00f3n de los personajes acciones que inclinan seriamente el equilibrio del juego a su favor. Por supuesto, en los juegos heroicos este es el objetivo. Activar una haza\u00f1a cuesta (1) punto de experiencia o (1) punto de corrupci\u00f3n permanente:",
    fuente: "Resumen de Reglas",
    tags: ["hazanas"]
  },
  {
    id: "regla-resumen-40-golpe-limpio",
    tipo: "regla",
    nombre: "Golpe limpio",
    resumen: "El h\u00e9roe realiza un ataque normal y cualquier golpe o golpes con \u00e9xito causan el m\u00e1ximo da\u00f1o.",
    detalle: "El h\u00e9roe realiza un ataque normal y cualquier golpe o golpes con \u00e9xito causan el m\u00e1ximo da\u00f1o.",
    fuente: "Resumen de Reglas",
    tags: ["golpe-limpio", "golpe", "limpio"]
  },
  {
    id: "regla-resumen-41-sin-miedo",
    tipo: "regla",
    nombre: "Sin miedo",
    resumen: "El h\u00e9roe ignora los efectos de terror, como por el rasgo monstruoso Terror\u00edfico.",
    detalle: "El h\u00e9roe ignora los efectos de terror, como por el rasgo monstruoso Terror\u00edfico.",
    fuente: "Resumen de Reglas",
    tags: ["sin-miedo", "sin", "miedo"]
  },
  {
    id: "regla-resumen-42-ignorar-la-corrupcion",
    tipo: "regla",
    nombre: "Ignorar la corrupci\u00f3n",
    resumen: "Durante el resto del turno, la corrupci\u00f3n acumulada del personaje no importa; todas las pruebas se realizan como si no tuviera corrupci\u00f3n.",
    detalle: "Durante el resto del turno, la corrupci\u00f3n acumulada del personaje no importa; todas las pruebas se realizan como si no tuviera corrupci\u00f3n. Sin embargo, puede seguir ganando corrupci\u00f3n como de costumbre, que entrar\u00e1 en juego en el siguiente turno.",
    fuente: "Resumen de Reglas",
    tags: ["ignorar-la-corrupcion", "ignorar", "la", "corrupcion"]
  },
  {
    id: "regla-resumen-43-defensa-perfecta",
    tipo: "regla",
    nombre: "Defensa perfecta",
    resumen: "El h\u00e9roe detiene o esquiva un ataque exitoso que de otra manera lo habr\u00eda golpeado.",
    detalle: "El h\u00e9roe detiene o esquiva un ataque exitoso que de otra manera lo habr\u00eda golpeado. Solo puede usarse una vez por turno.",
    fuente: "Resumen de Reglas",
    tags: ["defensa-perfecta", "defensa", "perfecta"]
  },
  {
    id: "regla-resumen-44-golpe-rapido",
    tipo: "regla",
    nombre: "Golpe r\u00e1pido",
    resumen: "El h\u00e9roe ataca primero en el turno.",
    detalle: "El h\u00e9roe ataca primero en el turno. Si alguien m\u00e1s est\u00e1 usando Golpe r\u00e1pido, el orden de la iniciativa se establece de manera normal.",
    fuente: "Resumen de Reglas",
    tags: ["golpe-rapido", "golpe", "rapido"]
  },
  {
    id: "regla-resumen-45-resistencia",
    tipo: "regla",
    nombre: "Resistencia",
    resumen: "+1D4 de armadura durante el resto del turno.",
    detalle: "+1D4 de armadura durante el resto del turno.",
    fuente: "Resumen de Reglas",
    tags: ["resistencia"]
  },
  {
    id: "regla-resumen-46-mirada-de-acero",
    tipo: "regla",
    nombre: "Mirada de acero",
    resumen: "La mirada del h\u00e9roe hace que un oponente retroceda y se abstenga de atacar al h\u00e9roe.",
    detalle: "La mirada del h\u00e9roe hace que un oponente retroceda y se abstenga de atacar al h\u00e9roe. Si el combate ya empez\u00f3, el oponente puede elegir atacar a otra criatura. Si a\u00fan no ha comenzado, el oponente no atacar\u00e1 antes de que otra persona d\u00e9 el primer golpe.",
    fuente: "Resumen de Reglas",
    tags: ["mirada-de-acero", "mirada", "de", "acero"]
  },
  {
    id: "regla-resumen-47-ataque-torbellino",
    tipo: "regla",
    nombre: "Ataque torbellino",
    resumen: "En una acci\u00f3n de combate, el h\u00e9roe realiza un ataque contra cada oponente involucrado en el combate cuerpo a cuerpo.",
    detalle: "En una acci\u00f3n de combate, el h\u00e9roe realiza un ataque contra cada oponente involucrado en el combate cuerpo a cuerpo.",
    fuente: "Resumen de Reglas",
    tags: ["ataque-torbellino", "ataque", "torbellino"]
  },
  {
    id: "regla-resumen-48-carga",
    tipo: "regla",
    nombre: "Carga",
    resumen: "Un personaje puede llevar una carga igual a su valor de Fuerte sin verse afectado negativamente.",
    detalle: "Un personaje puede llevar una carga igual a su valor de Fuerte sin verse afectado negativamente. Si el valor es superior, cada elemento adicional otorga una modificaci\u00f3n de -1 a Defensa, al igual que la cualidad de Inc\u00f3moda de la armadura. Un personaje puede llevar un m\u00e1ximo de objetos igual a Fuerte \u00d72. Si tiene m\u00e1s de este total, no puede moverse m\u00e1s que en tramos de distancias cortas. A efectos de este c\u00e1lculo, la bendici\u00f3n Mula de carga aumenta su Fuerte \u00d7 1.5, redondeando hacia abajo. Adem\u00e1s de estos conceptos b\u00e1sicos, se aplica lo siguiente: \u25c6 La ropa, los cinturones y las botas no cuentan como art\u00edculos de carga. \u25c6 Las mochilas, los sacos, las bandoleras y otros contenedores ligeros no cuentan como art\u00edculos, solo su contenido. \u25c6 Los barriles, los cofres, las cajas y otros contenedores voluminosos cuentan como un punto de carga por derecho propio, lo que se suma a su contenido. \u25c6 Los objetos m\u00e1s peque\u00f1os (monedas, colgantes, joyas) no pesan nada a menos que se lleve mucha cantidad; cuentan como un art\u00edculo de carga por cada 50 piezas. \u25c6 La armadura puesta para protegerse no cuenta; tiene una cualidad de Inc\u00f3moda en su lugar. Una armadura puesta pero que no se use para protegerse supone una carga igual a su valor de Inc\u00f3moda. \u25c6 Las armas en las manos de un personaje no cuentan como carga (pero con una se\u00f1al de hostilidad). Las armas que se llevan en mochila, vaina o similares cuentan como carga. \u25c6 Las armas con la cualidad Gigantesca cuentan como dos puntos de carga. Un personaje que lleve m\u00e1s de lo permitido tambi\u00e9n tendr\u00e1 dificultades para mantener el ritmo durante las marchas m\u00e1s largas: las categor\u00edas de marcha empeoran un nivel cuando un personaje lleva demasiado. Un personaje con exceso de peso no puede viajar a ritmo de marcha extenuante. Adem\u00e1s, la carga pesada otorga una modificaci\u00f3n de -1 por elemento adicional a la tirada de Fuerte para ver si una marcha extenuante resulta en 1 o 1+1D6 de da\u00f1o por cada d\u00eda de viaje",
    fuente: "Resumen de Reglas",
    tags: ["carga"]
  },
  {
    id: "regla-resumen-49-investigacion-en-archivos",
    tipo: "regla",
    nombre: "Investigaci\u00f3n en archivos",
    resumen: "Cualquiera puede buscar informaci\u00f3n en archivos y bibliotecas, pero para encontrar algo \u00fatil se necesita buscar en lugares donde se pueda encontrar la informaci\u00f3n deseada (en otras palabras, buscar direcciones que lle...",
    detalle: "Cualquiera puede buscar informaci\u00f3n en archivos y bibliotecas, pero para encontrar algo \u00fatil se necesita buscar en lugares donde se pueda encontrar la informaci\u00f3n deseada (en otras palabras, buscar direcciones que lleven a Symbar en los archivos de la ciudad de Fuerte Espina es in\u00fatil). Saber d\u00f3nde buscar puede requerir una tirada con \u00e9xito de Inteligente adem\u00e1s de tener los Contactos adecuados. En la pr\u00e1ctica, la b\u00fasqueda se resume en que los personajes plantean una pregunta a la colecci\u00f3n de documentos. Si el director de juego considera que los documentos pueden contener informaci\u00f3n relevante, un personaje con la habilidad Estudioso tira contra Inteligente mientras que el resto realiza una tirada de [Inteligente \u20135]. Un personaje con la bendici\u00f3n de Archivista obtiene una segunda oportunidad de pasar todas las tiradas al examinar colecciones de documentos. Cada personaje que participa en la investigaci\u00f3n puede tirar; comienza el que tiene la mejor oportunidad de tener \u00e9xito, luego sigue el resto en orden descendente. Cada fallo es definitivo y ese personaje tiene que continuar buscando en otro lugar, pero si alguien pasa la prueba el director de juego deber\u00eda responder la pregunta. Si la respuesta se encuentra dentro de un campo de conocimiento espec\u00edfico comprendido por alguna otra habilidad, es posible usarla en lugar de Estudioso al investigar: habilidades como Alquimista, Elaboraci\u00f3n de artefactos, Venenos, Medicus, Versado en criaturas y diversas versiones de las tradiciones m\u00edsticas pueden ser relevantes en este contexto. Si la respuesta a la pregunta es compleja, estas habilidades tambi\u00e9n pueden proporcionar informaci\u00f3n m\u00e1s profunda.",
    fuente: "Resumen de Reglas",
    tags: ["investigacion-en-archivos", "investigacion", "en", "archivos"]
  },
  {
    id: "regla-resumen-50-experiencia-inicial",
    tipo: "regla",
    nombre: "Experiencia inicial",
    resumen: "La experiencia inicial significa que cada jugador obtiene 50 puntos de experiencia para usarlos con su personaje.",
    detalle: "La experiencia inicial significa que cada jugador obtiene 50 puntos de experiencia para usarlos con su personaje. La cantidad puede variar al escoger cargas o al gastar puntos para adquirir bendiciones, habilidades y rasgos. Sin embargo, la experiencia tambi\u00e9n se puede guardar para repetir tiradas si el grupo usa la regla opcional Tiradas a cambio de experiencia.",
    fuente: "Resumen de Reglas",
    tags: ["experiencia-inicial", "experiencia", "inicial"]
  },
  {
    id: "regla-resumen-51-rituales-maximos-a-nivel-maestro",
    tipo: "regla",
    nombre: "Rituales m\u00e1ximos a nivel maestro",
    resumen: "La habilidad Rituales tiene un l\u00edmite de seis rituales al alcanzar el nivel maestro.",
    detalle: "La habilidad Rituales tiene un l\u00edmite de seis rituales al alcanzar el nivel maestro. Para los grupos de juego que realmente disfrutan de ellos y piensan que media docena es muy poco para un verdadero maestro en los Rituales, se recomienda la siguiente regla alternativa: Los maestros en Rituales pueden aprender rituales adicionales al coste de 10 puntos de experiencia por ritual. Solo alguien con el nivel maestro puede adquirir m\u00e1s de esta forma. Los m\u00edsticos menos competentes se ci\u00f1en a la descripci\u00f3n de su nivel de habilidad.",
    fuente: "Resumen de Reglas",
    tags: ["rituales-maximos-a-nivel-maestro", "rituales", "maximos", "a", "nivel"]
  },
  {
    id: "regla-resumen-52-persecuciones",
    tipo: "regla",
    nombre: "Persecuciones",
    resumen: "Cuando un personaje intente escapar de alguien o de algo que lo est\u00e1 persiguiendo, se sugiere que el director de juego resuelva la situaci\u00f3n empleando el atributo \u00c1gil.",
    detalle: "Cuando un personaje intente escapar de alguien o de algo que lo est\u00e1 persiguiendo, se sugiere que el director de juego resuelva la situaci\u00f3n empleando el atributo \u00c1gil. Si son varios personajes y deciden permanecer juntos, el que tenga el valor m\u00e1s bajo en \u00c1gil debe realizar una tirada modificada por el \u00c1gil del perseguido m\u00e1s r\u00e1pido. Si se separan, todos deben hacer una tirada modificada una vez m\u00e1s por el \u00c1gil del cazador m\u00e1s r\u00e1pido. Si es al rev\u00e9s y son los personajes quienes persiguen, se usa la misma f\u00f3rmula, pero usando el modificador de la presa m\u00e1s lenta. Se hace una tirada por turno de persecuci\u00f3n: si la presa tiene \u00e9xito, se aleja un paso; si la falla, el cazador se acerca un paso. Para escapar, la presa debe alcanzar una ventaja de 3, en otras palabras, debe tener \u00e9xito en tres tiradas m\u00e1s de las que falle. S\u00ed falla en tres tiradas m\u00e1s de las que tiene \u00e9xito, es atrapada.",
    fuente: "Resumen de Reglas",
    tags: ["persecuciones"]
  },
  {
    id: "regla-resumen-53-trampas",
    tipo: "regla",
    nombre: "Trampas",
    resumen: "Los personajes con experiencia o sin ella pueden montar trampas para proteger un lugar o ralentizar a un oponente.",
    detalle: "Los personajes con experiencia o sin ella pueden montar trampas para proteger un lugar o ralentizar a un oponente. A continuaci\u00f3n aparecen las reglas sobre las trampas port\u00e1tiles y aquellas que se pueden montar en el lugar. Las trampas espec\u00edficas se describen en el cap\u00edtulo de Equipo de la p\u00e1gina 127.",
    fuente: "Resumen de Reglas",
    tags: ["trampas"]
  },
  {
    id: "regla-resumen-54-poner-una-trampa",
    tipo: "regla",
    nombre: "Poner una trampa",
    resumen: "Con una tirada exitosa de Inteligente, el personaje puede poner una trampa que ya est\u00e9 preparada.",
    detalle: "Con una tirada exitosa de Inteligente, el personaje puede poner una trampa que ya est\u00e9 preparada. Un personaje sin experiencia (es decir, sin la habilidad Trampero) solo puede montar trampas mec\u00e1nicas, lo que requiere una tirada con \u00e9xito de Inteligente. Si el resultado da 20, hace saltar la trampa en su cara. Un personaje con experiencia puede preparar tanto trampas mec\u00e1nicas como minas alqu\u00edmicas con una acci\u00f3n de combate adem\u00e1s de crear trampas improvisadas. Para ello, se requiere la habilidad Trampero (o Pirotecnia, si solo se usan minas alqu\u00edmicas).",
    fuente: "Resumen de Reglas",
    tags: ["poner-una-trampa", "poner", "una", "trampa"]
  },
  {
    id: "regla-resumen-55-descubrir-una-trampa",
    tipo: "regla",
    nombre: "Descubrir una trampa",
    resumen: "Cualquier persona en riesgo de activar una trampa la descubre con una tirada con \u00e9xito de [Atento\u2190Discreto].",
    detalle: "Cualquier persona en riesgo de activar una trampa la descubre con una tirada con \u00e9xito de [Atento\u2190Discreto].",
    fuente: "Resumen de Reglas",
    tags: ["descubrir-una-trampa", "descubrir", "una", "trampa"]
  },
  {
    id: "regla-resumen-56-evitar-una-trampa",
    tipo: "regla",
    nombre: "Evitar una trampa",
    resumen: "Se puede evitar una trampa que ha sido descubierta de dos formas: Se puede saltar por encima de ella como parte de una acci\u00f3n de movimiento, lo que requiere una tirada de [\u00c1gil\u2190Inteligente].",
    detalle: "Se puede evitar una trampa que ha sido descubierta de dos formas: Se puede saltar por encima de ella como parte de una acci\u00f3n de movimiento, lo que requiere una tirada de [\u00c1gil\u2190Inteligente]. Si se falla la tirada, la trampa salta y el personaje queda atrapado en ella, lo que interrumpe su movimiento. Si el terreno lo permite, siempre se puede ignorar una trampa al rodearla. Esto cuesta una acci\u00f3n de movimiento adicional, o m\u00e1s, dependiendo del terreno.",
    fuente: "Resumen de Reglas",
    tags: ["evitar-una-trampa", "evitar", "una", "trampa"]
  },
  {
    id: "regla-resumen-57-desactivar-una-trampa",
    tipo: "regla",
    nombre: "Desactivar una trampa",
    resumen: "Tambi\u00e9n se puede desactivar una trampa que se ha descubierto.",
    detalle: "Tambi\u00e9n se puede desactivar una trampa que se ha descubierto. Una persona sin experiencia no puede desarmar una trampa, tiene que inutilizarla tir\u00e1ndole algo o toc\u00e1ndola con un instrumento largo (cualidad Larga). Esto cuenta como una acci\u00f3n de combate y requiere una tirada con \u00e9xito de [Diestro\u2190Inteligente]. Alguien con la habilidad Trampero puede realizar una tirada de [Inteligente\u2190Inteligente] para desactivar una trampa, sin necesidad de tener un instrumento con la cualidad Larga.",
    fuente: "Resumen de Reglas",
    tags: ["desactivar-una-trampa", "desactivar", "una", "trampa"]
  },
  {
    id: "regla-resumen-58-liberarse-de-una-trampa",
    tipo: "regla",
    nombre: "Liberarse de una trampa",
    resumen: "Las trampas a menudo causan da\u00f1o.",
    detalle: "Las trampas a menudo causan da\u00f1o. La cantidad viene especificada en la descripci\u00f3n de la trampa, o en el caso de trampas improvisadas, en la descripci\u00f3n de la habilidad Trampero. Adem\u00e1s, la trampa puede tener alguna cualidad que retenga a la v\u00edctima en el lugar. Si es as\u00ed, vendr\u00e1 mencionado en la descripci\u00f3n junto con la forma de liberarse",
    fuente: "Resumen de Reglas",
    tags: ["liberarse-de-una-trampa", "liberarse", "de", "una", "trampa"]
  },
  {
    id: "regla-resumen-59-venta-de-bienes-usados",
    tipo: "regla",
    nombre: "Venta de bienes usados",
    resumen: "A veces, los personajes querr\u00e1n vender armas y armaduras usadas.",
    detalle: "A veces, los personajes querr\u00e1n vender armas y armaduras usadas. Los comerciantes comprar\u00e1n con mucho gusto dichos art\u00edculos de segunda mano por la mitad del precio indicado (luego los pulir\u00e1n y los revender\u00e1n a precio completo). Los art\u00edculos con cualidades m\u00edsticas tienden a mantener su valor a lo largo del tiempo y siempre se venden a un precio correspondiente al indicado. Adem\u00e1s, los art\u00edculos comerciales normales se venden al precio de compra indicado, lo que convierte estos hallazgos en tesoros voluminosos pero valiosos.",
    fuente: "Resumen de Reglas",
    tags: ["venta-de-bienes-usados", "venta", "de", "bienes", "usados"]
  },
  {
    id: "regla-resumen-60-ingresos-por-bendiciones",
    tipo: "regla",
    nombre: "Ingresos por bendiciones",
    resumen: "Para los grupos de juego a los que les gusta ver a los personajes aprovechar el tiempo entre aventuras, las bendiciones pueden usarse como fuente de ingresos.",
    detalle: "Para los grupos de juego a los que les gusta ver a los personajes aprovechar el tiempo entre aventuras, las bendiciones pueden usarse como fuente de ingresos. Las bendiciones Cart\u00f3grafo, Cuentacuentos, Escapismo, Espejismo, Jugador, M\u00e9dium, M\u00fasico, Suplantador y Tah\u00far son las opciones m\u00e1s obvias, pero se pueden usar otras bendiciones y habilidades para ganar t\u00e1leros siempre que el jugador d\u00e9 una explicaci\u00f3n razonable de c\u00f3mo lo hace. Una vez por aventura (o entre aventuras), el jugador puede realizar una tirada contra el atributo relacionado con la bendici\u00f3n/habilidad. Si no existe tal atributo, se usa Inteligente o Persuasivo, lo que tenga m\u00e1s alto. Una tirada con \u00e9xito genera un ingreso de 1D10 taleros.",
    fuente: "Resumen de Reglas",
    tags: ["ingresos-por-bendiciones", "ingresos", "por", "bendiciones"]
  },
  {
    id: "regla-resumen-61-maniobras-de-combate-combates-mas-tacticos",
    tipo: "regla",
    nombre: "Maniobras de combate (combates m\u00e1s t\u00e1cticos)",
    resumen: "Un inconveniente de esto es que hace mucho m\u00e1s complicadas las escenas de combate, tanto por el n\u00famero de elecciones a disposici\u00f3n de los jugadores como al seguimiento que debe hacer el director de juego.",
    detalle: "Un inconveniente de esto es que hace mucho m\u00e1s complicadas las escenas de combate, tanto por el n\u00famero de elecciones a disposici\u00f3n de los jugadores como al seguimiento que debe hacer el director de juego. B\u00e1sicamente, llevar\u00e1 m\u00e1s tiempo jugar una escena de combate. Algunos grupos de juego ven esto como una ventaja, otros no. En algunos casos las maniobras funcionan de manera similar a las habilidades y pueden desdibujar los l\u00edmites entre las habilidades y las opciones t\u00e1cticas disponibles para todo el mundo. Es verdad que las habilidades siempre son mucho m\u00e1s poderosas, pero a\u00fan as\u00ed deber\u00edais tomaros un tiempo para discutir si quer\u00e9is a\u00f1adir esta mec\u00e1nica o no. Algunas de las maniobras solo ser\u00e1n \u00fatiles si el grupo de juego tambi\u00e9n usa la regla opcional Movimiento a escala o si, al menos, est\u00e1is dispuestos a jugar con un mapa de combate simplificado (p\u00e1gina 160 del Libro B\u00e1sico). A continuaci\u00f3n hay una lista de maniobras que todos los combatientes pueden emplear con la esperanza de mejorar su propia posici\u00f3n o para hacer las cosas m\u00e1s dif\u00edciles para el oponente.",
    fuente: "Resumen de Reglas",
    tags: ["maniobras-de-combate-combates-mas-tacticos", "maniobras", "de", "combate", "combates"]
  },
  {
    id: "regla-resumen-62-apuntar-con-cuidado",
    tipo: "regla",
    nombre: "Apuntar con cuidado",
    resumen: "Te tomas tu tiempo para apuntar con cuidado un arma a distancia, por lo que obtienes una segunda oportunidad para realizar la tirada de ataque.",
    detalle: "Te tomas tu tiempo para apuntar con cuidado un arma a distancia, por lo que obtienes una segunda oportunidad para realizar la tirada de ataque. Apuntar consume una acci\u00f3n de movimiento, lo que significa que no puedes moverte durante el turno.",
    fuente: "Resumen de Reglas",
    tags: ["apuntar-con-cuidado", "apuntar", "con", "cuidado"]
  },
  {
    id: "regla-resumen-63-embestir",
    tipo: "regla",
    nombre: "Embestir",
    resumen: "Para embestir contra un oponente debes hacer un doble movimiento hacia este (en l\u00ednea recta) m\u00e1s una acci\u00f3n de combate cuerpo a cuerpo.",
    detalle: "Para embestir contra un oponente debes hacer un doble movimiento hacia este (en l\u00ednea recta) m\u00e1s una acci\u00f3n de combate cuerpo a cuerpo. Si la tirada de ataque falla, el objetivo puede realizar un ataque gratuito.",
    fuente: "Resumen de Reglas",
    tags: ["embestir"]
  },
  {
    id: "regla-resumen-64-retrasar-la-iniciativa",
    tipo: "regla",
    nombre: "Retrasar la iniciativa",
    resumen: "Eliges retrasar tu iniciativa durante el turno para que otra persona vaya primero.",
    detalle: "Eliges retrasar tu iniciativa durante el turno para que otra persona vaya primero. Cuando sea tu momento de actuar, especifica qui\u00e9n actuar\u00e1 antes que t\u00fa. En el siguiente turno vuelves a tu posici\u00f3n original en el orden de la iniciativa.",
    fuente: "Resumen de Reglas",
    tags: ["retrasar-la-iniciativa", "retrasar", "la", "iniciativa"]
  },
  {
    id: "regla-resumen-65-desarmar",
    tipo: "regla",
    nombre: "Desarmar",
    resumen: "Atacas el arma o el escudo del oponente con la esperanza de que lo suelte [Diestro\u2190Fuerte].",
    detalle: "Atacas el arma o el escudo del oponente con la esperanza de que lo suelte [Diestro\u2190Fuerte]. El ataque no causa da\u00f1o y, si fallas la tirada, te expones a un ataque gratuito del oponente.",
    fuente: "Resumen de Reglas",
    tags: ["desarmar"]
  },
  {
    id: "regla-resumen-66-defensa-completa",
    tipo: "regla",
    nombre: "Defensa completa",
    resumen: "Te concentras \u00fanicamente en defenderte, por lo que tienes una segunda oportunidad de pasar todas las pruebas de Defensa durante el turno.",
    detalle: "Te concentras \u00fanicamente en defenderte, por lo que tienes una segunda oportunidad de pasar todas las pruebas de Defensa durante el turno. No puedes realizar ning\u00fan ataque.",
    fuente: "Resumen de Reglas",
    tags: ["defensa-completa", "defensa", "completa"]
  },
  {
    id: "regla-resumen-67-ofensiva-total",
    tipo: "regla",
    nombre: "Ofensiva total",
    resumen: "Te concentras \u00fanicamente en atacar, lo que te da una segunda oportunidad para tirar todos los ataques de cuerpo a cuerpo.",
    detalle: "Te concentras \u00fanicamente en atacar, lo que te da una segunda oportunidad para tirar todos los ataques de cuerpo a cuerpo. Debido a esto, tambi\u00e9n tienes una segunda oportunidad de fallar tus pruebas de Defensa durante el turno.",
    fuente: "Resumen de Reglas",
    tags: ["ofensiva-total", "ofensiva", "total"]
  },
  {
    id: "regla-resumen-68-presa",
    tipo: "regla",
    nombre: "Presa",
    resumen: "Atacas con una llave de lucha para inmovilizar al objetivo [Fuerte\u2190Fuerte].",
    detalle: "Atacas con una llave de lucha para inmovilizar al objetivo [Fuerte\u2190Fuerte]. El rasgo Robusto otorga una bonificaci\u00f3n a la tirada (+2 en el nivel I, +4 a nivel II y +8 a nivel III). La modificaci\u00f3n se aplica tanto a quien realiza el agarre como al objetivo si este tambi\u00e9n es Robusto. Se hace una prueba por turno para mantener la presa. Si se falla, el objetivo puede realizar un ataque gratuito. Adem\u00e1s, ten en cuenta que no puedes realizar ninguna acci\u00f3n mientras mantienes una presa.",
    fuente: "Resumen de Reglas",
    tags: ["presa"]
  },
  {
    id: "regla-resumen-69-dejar-inconsciente",
    tipo: "regla",
    nombre: "Dejar inconsciente",
    resumen: "Si tienes ventaja sobre el objetivo, puedes intentar dejarlo inconsciente.",
    detalle: "Si tienes ventaja sobre el objetivo, puedes intentar dejarlo inconsciente. El ataque se hace como de costumbre, pero en vez de infligir da\u00f1o se tira 1D12 contra el valor del da\u00f1o; si el resultado es menor que el valor, el objetivo cae inconsciente. Si se falla el ataque, pierdes la ventaja sobre el objetivo.",
    fuente: "Resumen de Reglas",
    tags: ["dejar-inconsciente", "dejar", "inconsciente"]
  },
  {
    id: "regla-resumen-70-veneno-en-las-armas",
    tipo: "regla",
    nombre: "Veneno en las armas",
    resumen: "Puedes utilizar una acci\u00f3n de combate para aplicar veneno a tu arma mediante una tirada con \u00e9xito de Inteligente.",
    detalle: "Puedes utilizar una acci\u00f3n de combate para aplicar veneno a tu arma mediante una tirada con \u00e9xito de Inteligente. Si el resultado es 20, algo va mal y t\u00fa mismo te envenenas. El veneno solo dura para un solo golpe, luego se debe aplicar una nueva dosis.",
    fuente: "Resumen de Reglas",
    tags: ["veneno-en-las-armas", "veneno", "en", "las", "armas"]
  },
  {
    id: "regla-resumen-71-hacer-retroceder",
    tipo: "regla",
    nombre: "Hacer retroceder",
    resumen: "Te lanzas al objetivo con la intenci\u00f3n de empujarlo hacia atr\u00e1s: fuera de una habitaci\u00f3n, al borde de un acantilado o similar.",
    detalle: "Te lanzas al objetivo con la intenci\u00f3n de empujarlo hacia atr\u00e1s: fuera de una habitaci\u00f3n, al borde de un acantilado o similar. Debes comenzar el turno con el empuj\u00f3n, lo que consume tanto tu acci\u00f3n de movimiento como la de combate. Una tirada de ataque con \u00e9xito causa la mitad de da\u00f1o, pero tambi\u00e9n empuja al objetivo medio movimiento hacia atr\u00e1s (cinco metros). Si se falla, el objetivo puede realizar un ataque gratuito.",
    fuente: "Resumen de Reglas",
    tags: ["hacer-retroceder", "hacer", "retroceder"]
  },
  {
    id: "regla-resumen-72-placaje",
    tipo: "regla",
    nombre: "Placaje",
    resumen: "Atacas con la esperanza de derribar al objetivo [Fuerte\u2190Fuerte].",
    detalle: "Atacas con la esperanza de derribar al objetivo [Fuerte\u2190Fuerte]. El riesgo es que t\u00fa tambi\u00e9n puedes caer, tengas \u00e9xito con el placaje o no; una tirada con \u00e9xito de \u00c1gil te permite permanecer de pie. El placaje cuenta como tu acci\u00f3n de combate. Si eres Robusto puedes sumar un +2 a la tirada de Fuerte por cada nivel del rasgo.",
    fuente: "Resumen de Reglas",
    tags: ["placaje"]
  },
  {
    id: "regla-resumen-73-tomar-la-iniciativa",
    tipo: "regla",
    nombre: "Tomar la iniciativa",
    resumen: "Realizas una tirada de Tenaz con la esperanza de ganar la iniciativa.",
    detalle: "Realizas una tirada de Tenaz con la esperanza de ganar la iniciativa. Si se tiene \u00e9xito, ganas una bonificaci\u00f3n de +5 cuando decidas tu lugar en el orden de la iniciativa. La desventaja es que tu velocidad afecta negativamente a tu precisi\u00f3n: tienes una segunda oportunidad de fallar todas las tiradas de acci\u00f3n durante el turno, sin importar si tuviste \u00e9xito o no en la tirada de Tenaz. En el siguiente turno vuelves a tu posici\u00f3n original en el orden de la iniciativa.",
    fuente: "Resumen de Reglas",
    tags: ["tomar-la-iniciativa", "tomar", "la", "iniciativa"]
  },
  {
    id: "regla-resumen-74-monstruos-y-trofeos",
    tipo: "regla",
    nombre: "Monstruos y trofeos",
    resumen: "La caza y recolecci\u00f3n de trofeos de monstruos es un negocio lucrativo, aunque la adquisici\u00f3n de las piezas m\u00e1s valiosas puede resultar complicada a la gente inexperta, ya que la putrefacci\u00f3n arruina por completo mucha...",
    detalle: "La caza y recolecci\u00f3n de trofeos de monstruos es un negocio lucrativo, aunque la adquisici\u00f3n de las piezas m\u00e1s valiosas puede resultar complicada a la gente inexperta, ya que la putrefacci\u00f3n arruina por completo muchas piezas y baja el precio de las dem\u00e1s. Se requiere una prueba de Inteligente para poder recolectar un trofeo; si se falla no se consigue nada. Para obtener un trofeo en buen estado se necesita una tirada con \u00e9xito de Inteligente con la habilidad Versado en criaturas o la bendici\u00f3n Mont\u00e9s. Si se falla la prueba, se recolecta un trofeo en mal estado.",
    fuente: "Resumen de Reglas",
    tags: ["monstruos-y-trofeos", "monstruos", "y", "trofeos"]
  },
  {
    id: "regla-resumen-75-objetos-magistrales",
    tipo: "regla",
    nombre: "Objetos magistrales",
    resumen: "Durante sus aventuras, los personajes pueden hallar armas y armaduras elaboradas por maestros.",
    detalle: "Durante sus aventuras, los personajes pueden hallar armas y armaduras elaboradas por maestros. Tambi\u00e9n pueden invertir objetos de valor o monedas en comprar art\u00edculos fabricados por herreros especialmente calificados. El herrero maestro tiene la habilidad de a\u00f1adir una o m\u00e1s cualidades al objeto en cuesti\u00f3n o de eliminar cualidades negativas. El precio de lista del art\u00edculo se incrementa acumulativamente en \u00d75 por cada cualidad agregada o eliminada. Las cualidades m\u00edsticas incrementan el precio acumulativamente en \u00d710.",
    fuente: "Resumen de Reglas",
    tags: ["objetos-magistrales", "objetos", "magistrales"]
  },
  {
    id: "regla-resumen-76-pactos",
    tipo: "regla",
    nombre: "Pactos",
    resumen: "Hacer un pacto con uno de los antiguos poderes del mundo puede ser un atajo para alcanzar conocimiento y poder, pero no es una opci\u00f3n libre de peligros.",
    detalle: "Hacer un pacto con uno de los antiguos poderes del mundo puede ser un atajo para alcanzar conocimiento y poder, pero no es una opci\u00f3n libre de peligros. Para los plebeyos no hay mucha diferencia entre hacer pactos y practicar la hechicer\u00eda. Y aunque hay muchos hechiceros que usan los pactos como medio para hacerse m\u00e1s poderosos, cualquier persona lo suficientemente valiente o desesperada puede sellar uno. Para hacer pactos es necesario cerrar un acuerdo con un ser poderoso que est\u00e9 interesado en convertirse en el protector y tutor del personaje; generalmente un esp\u00edritu de la naturaleza o un muerto viviente. En resumen, este ser imbuye al personaje con algo de su poder para ganar un agente leal con el que llegar a lugares donde \u00e9l no puede, o con el objetivo (a m\u00e1s largo plazo) de consumir la fuerza espiritual del personaje cuando este finalmente se convierta en una abominaci\u00f3n renacida, o a veces ambos. En el primer caso, el personaje se ver\u00e1 obligado a actuar de forma que favorezca los deseos de su se\u00f1or; en el segundo caso, el ser intentar\u00e1 tentar al personaje para que atraiga y acumule corrupci\u00f3n de cualquier forma posible.",
    fuente: "Resumen de Reglas",
    tags: ["pactos"]
  },
  {
    id: "regla-resumen-77-ventajas-del-pacto",
    tipo: "regla",
    nombre: "Ventajas del pacto",
    resumen: "El personaje puede ganar Experiencia a cambio de aceptar corrupci\u00f3n permanente; cada punto de corrupci\u00f3n permanente otorga 1D12 puntos de Experiencia.",
    detalle: "El personaje puede ganar Experiencia a cambio de aceptar corrupci\u00f3n permanente; cada punto de corrupci\u00f3n permanente otorga 1D12 puntos de Experiencia. Esto ocurre al hacer el pacto. M\u00e1s tarde solo se puede aceptar un m\u00e1ximo de 1 punto de corrupci\u00f3n permanente por aventura. El jugador decide si se hace este intercambio y cu\u00e1ndo. El personaje tiene acceso a todos los rasgos monstruosos, habilidades, poderes m\u00edsticos y rituales del ser. Debe pagar por estos dones con Experiencia, como de costumbre. El personaje tambi\u00e9n puede tener acceso a otros rasgos y habilidades adem\u00e1s de los que posea el ser. En ese caso debe pagar por el don 1 punto de corrupci\u00f3n permanente, punto que no proporciona Experiencia adicional. Una vez ha pagado por el don, debe adquirirlo gastando Experiencia, como de costumbre.",
    fuente: "Resumen de Reglas",
    tags: ["ventajas-del-pacto", "ventajas", "del", "pacto"]
  },
  {
    id: "regla-resumen-78-precio-del-pacto",
    tipo: "regla",
    nombre: "Precio del pacto",
    resumen: "El personaje debe aceptar uno de los objetivos del ser como si fuera propio y esforzarse por alcanzarlo.",
    detalle: "El personaje debe aceptar uno de los objetivos del ser como si fuera propio y esforzarse por alcanzarlo. Este objetivo puede reemplazar uno de los objetivos propios del personaje o ser aceptado como uno adicional. En cualquier caso, se determina el objetivo cuando se forja el pacto. El personaje ya no puede tener objetivos personales que contradigan los objetivos del ser. Esto tambi\u00e9n se aclara cuando se sella el pacto y es un requisito para llegar a un acuerdo. Si el personaje empieza a desviarse o act\u00faa en desacuerdo con los objetivos y metas del ser, este lo sabr\u00e1. Al principio, se advertir\u00e1 al personaje a trav\u00e9s de pesadillas, molestias f\u00edsicas o algo similar. Si el personaje no cambia su comportamiento, las cosas ir\u00e1n de mal en peor. El ser le negar\u00e1 al personaje la opci\u00f3n de intercambiar corrupci\u00f3n por Experiencia y lo maldecir\u00e1, ya sea duplicando toda la corrupci\u00f3n obtenida por el personaje o impidi\u00e9ndole que pueda sanar naturalmente y que las otras formas de curaci\u00f3n se reduzcan a la mitad. Otra opci\u00f3n es que todas las tiradas que el perjuro haga con su atributo m\u00e1s utilizado tengan una segunda oportunidad de fallar. El ser escoger\u00e1 la alternativa m\u00e1s perjudicial para el personaje.",
    fuente: "Resumen de Reglas",
    tags: ["precio-del-pacto", "precio", "del", "pacto"]
  },
  {
    id: "regla-resumen-79-romper-un-pacto",
    tipo: "regla",
    nombre: "Romper un pacto",
    resumen: "No se conoce ninguna manera de romper este tipo de pactos.",
    detalle: "No se conoce ninguna manera de romper este tipo de pactos. Puedes esconderte temporalmente del pacto y de la maldici\u00f3n en un c\u00edrculo de bruja, un c\u00edrculo m\u00e1gico o dentro de un santuario (ver los rituales en cuesti\u00f3n para m\u00e1s detalles). Sin embargo, tan pronto como el personaje salga del \u00e1rea protegida, la maldici\u00f3n regresa con toda su fuerza.",
    fuente: "Resumen de Reglas",
    tags: ["romper-un-pacto", "romper", "un", "pacto"]
  },
  {
    id: "regla-resumen-80-dano-a-edificios",
    tipo: "regla",
    nombre: "Da\u00f1o a edificios",
    resumen: "Es probable que haya momentos en que los personajes tengan prisa por derribar un obst\u00e1culo f\u00edsico (o que los oponentes necesiten hacer lo mismo para llegar hasta los personajes).",
    detalle: "Es probable que haya momentos en que los personajes tengan prisa por derribar un obst\u00e1culo f\u00edsico (o que los oponentes necesiten hacer lo mismo para llegar hasta los personajes). Las reglas para da\u00f1o a edificios introducen algunos conceptos nuevos:",
    fuente: "Resumen de Reglas",
    tags: ["dano-a-edificios", "dano", "a", "edificios"]
  },
  {
    id: "regla-resumen-81-resistencia",
    tipo: "regla",
    nombre: "Resistencia",
    resumen: "Cuando la Resistencia de un edificio llega a cero, el atacante puede penetrar en el lugar (la fortificaci\u00f3n se desmorona, se cae un muro, etc\u00e9tera).",
    detalle: "Cuando la Resistencia de un edificio llega a cero, el atacante puede penetrar en el lugar (la fortificaci\u00f3n se desmorona, se cae un muro, etc\u00e9tera). La brecha es lo suficientemente grande como para que entren 1D4 atacantes por turno; los defensores pueden colocarse frente a la apertura en formaci\u00f3n de cuatro, uno al lado del otro.",
    fuente: "Resumen de Reglas",
    tags: ["resistencia"]
  },
  {
    id: "regla-resumen-82-punto-critico",
    tipo: "regla",
    nombre: "Punto cr\u00edtico",
    resumen: "Si un edificio recibe en un solo turno la mitad de su Resistencia (es decir, se excede el punto cr\u00edtico), se rompe de inmediato.",
    detalle: "Si un edificio recibe en un solo turno la mitad de su Resistencia (es decir, se excede el punto cr\u00edtico), se rompe de inmediato. Ten en cuenta que esto incluye todo el da\u00f1o causado durante el turno, no de un solo ataque como en el caso del Umbral de dolor. Por tanto, con catapultas suficientes, los muros de un castillo pueden te\u00f3ricamente romperse en un solo turno.",
    fuente: "Resumen de Reglas",
    tags: ["punto-critico", "punto", "critico"]
  },
  {
    id: "regla-resumen-83-fortificacion",
    tipo: "regla",
    nombre: "Fortificaci\u00f3n",
    resumen: "B\u00e1sicamente, la Fortificaci\u00f3n es la armadura del edificio.",
    detalle: "B\u00e1sicamente, la Fortificaci\u00f3n es la armadura del edificio. Las armas con la cualidad Demoledora ignoran el valor de la Fortificaci\u00f3n; las dem\u00e1s deben penetrar el valor de la Fortificaci\u00f3n antes de da\u00f1ar la estructura. Las habilidades con efecto de penetraci\u00f3n de armadura no tienen tal efecto contra edificios.",
    fuente: "Resumen de Reglas",
    tags: ["fortificacion"]
  },
  {
    id: "regla-resumen-84-incendiar-edificios",
    tipo: "regla",
    nombre: "Incendiar edificios",
    resumen: "Una t\u00e1ctica usada frecuentemente durante los asedios es incendiar edificios de madera.",
    detalle: "Una t\u00e1ctica usada frecuentemente durante los asedios es incendiar edificios de madera. Esto requiere alg\u00fan tipo de ingenio inflamable, como una granada alqu\u00edmica, un bote de aceite en llamas o un simple fuego hecho de ramas secas y yesca. Cuando el edificio ha sido expuesto a las llamas, se realiza una tirada de [Inteligente\u2013 Fortificaci\u00f3n] para ver si se incendia. Si es as\u00ed, las llamas infligen 1D4 de da\u00f1o y cuentan como si tuvieran la cualidad Demoledora. Ten en cuenta que quien enciende el fuego se convertir\u00e1 en el blanco de los ataques a distancia, siempre que el edificio en cuesti\u00f3n tenga ventanas o arqueros en el tejado. La gente dentro de un edificio en llamas corre el riesgo de sufrir da\u00f1o cada turno que el edificio contin\u00fae ardiendo: se requiere una tirada con \u00e9xito de Fuerte por turno, o sino la persona comienza a recibir 1D4 de da\u00f1o (ignorando armadura) por turno debido al humo y al calor. Tras fallar una tirada de Fuerte el da\u00f1o contin\u00faa autom\u00e1ticamente; la \u00fanica manera de pararlo es abandonar el edificio o encontrar alguna forma de protegerse. Apagar el fuego una vez que ha comenzado a extenderse requiere el uso de grandes cantidades de agua, arena o similares. El fuego se apaga cuando alguien tiene \u00e9xito en una tirada de [Inteligente\u2013 el n\u00famero de turnos que el fuego se ha propagado despu\u00e9s del primero]. Cualquiera que apague el fuego de esta forma probablemente se convertir\u00e1 en blanco de los ataques a distancia.",
    fuente: "Resumen de Reglas",
    tags: ["incendiar-edificios", "incendiar", "edificios"]
  },
  {
    id: "regla-resumen-85-recuperar-virotes-o-flechas",
    tipo: "regla",
    nombre: "Recuperar virotes o flechas",
    resumen: "Algunos grupos pueden encontrar realista y atractivo que las flechas y los virotes disparados en combate puedan romperse.",
    detalle: "Algunos grupos pueden encontrar realista y atractivo que las flechas y los virotes disparados en combate puedan romperse. Esto hace que los arqueros se piensen cada disparo (los proyectiles se convierten en un recurso) y tambi\u00e9n que valga la pena gastar algo de tiempo en buscar proyectiles intactos despu\u00e9s de la batalla, murmurando enfurru\u00f1ado cada vez que se encuentra una flecha rota o arruinada de alguna otra forma. Los grupos que quieran reglas para recuperar proyectiles usados pueden utilizar las siguientes: \u25c6 Un proyectil normal resulta da\u00f1ado si el jugador saca m\u00e1s de 10 con 1D20. Esto se aplica a todos los proyectiles sin cualidades. \u25c6 Un proyectil con alg\u00fan tipo de cualidad (por ejemplo, Equilibrado o Impacto agravado) resulta da\u00f1ado si el jugador saca m\u00e1s de 15 con 1D20. \u25c6 Los proyectiles con cualidades m\u00edsticas resultan da\u00f1ados si el jugador saca m\u00e1s de 17 con 1D20.",
    fuente: "Resumen de Reglas",
    tags: ["recuperar-virotes-o-flechas", "recuperar", "virotes", "o", "flechas"]
  },
  {
    id: "regla-resumen-86-los-secretos-de-las-tradiciones",
    tipo: "regla",
    nombre: "Los secretos de las tradiciones",
    resumen: "Las tradiciones m\u00edsticas esconden secretos que son reacias a compartir con los no iniciados.",
    detalle: "Las tradiciones m\u00edsticas esconden secretos que son reacias a compartir con los no iniciados. Las reglas sobre alquimia y artefactos no tienen en cuenta este secretismo, pero los grupos de juego que deseen utilizar estas habilidades de creaci\u00f3n de acuerdo con las tradiciones del mundo del juego pueden utilizar las siguientes reglas. Las recetas y procedimientos secretos son conocidos solo por los personajes iniciados en las diferentes tradiciones, pero pueden ser utilizados por cualquiera que haya obtenido acceso a ellos durante el juego, ya sea porque recibi\u00f3 las ense\u00f1anzas de un tutor, porque hall\u00f3 textos misteriosos sobre el tema o porque compr\u00f3 el secreto en el mercado negro de Fuerte Espina u otra ciudad. Si se utiliza esta regla, cada alquimista o artesano de artefactos debe elegir a qu\u00e9 tradici\u00f3n pertenece. Ten en cuenta que la bendici\u00f3n Conocimiento prohibido puede dar acceso al personaje a los secretos de todas las tradiciones desde el principio.",
    fuente: "Resumen de Reglas",
    tags: ["los-secretos-de-las-tradiciones", "los", "secretos", "de", "las"]
  },
  {
    id: "regla-resumen-87-golpes-localizados",
    tipo: "regla",
    nombre: "Golpes localizados",
    resumen: "Esta regla opcional permite golpear partes espec\u00edficas del oponente.",
    detalle: "Esta regla opcional permite golpear partes espec\u00edficas del oponente. Un ataque as\u00ed hace que el da\u00f1o igual o mayor que el Umbral de dolor tenga diferentes efectos dependiendo de d\u00f3nde se ha golpeado al oponente. Adem\u00e1s, la armadura puede dividirse en partes, por lo que el personaje puede tener diferentes tipos de armadura en diferentes partes del cuerpo.",
    fuente: "Resumen de Reglas",
    tags: ["golpes-localizados", "golpes", "localizados"]
  },
  {
    id: "regla-resumen-88-apuntar-alto-o-bajo",
    tipo: "regla",
    nombre: "Apuntar alto o bajo",
    resumen: "El personaje puede elegir apuntar alto o bajo para golpear partes desprotegidas del objetivo o para causar un efecto en particular; por ejemplo, que el objetivo pierda una acci\u00f3n de movimiento o que deje caer algo.",
    detalle: "El personaje puede elegir apuntar alto o bajo para golpear partes desprotegidas del objetivo o para causar un efecto en particular; por ejemplo, que el objetivo pierda una acci\u00f3n de movimiento o que deje caer algo. Apuntar alto o bajo otorga un \u22122 a la tirada de ataque.",
    fuente: "Resumen de Reglas",
    tags: ["apuntar-alto-o-bajo", "apuntar", "alto", "o", "bajo"]
  },
  {
    id: "regla-resumen-89-apuntar-a-una-parte-del-cuerpo",
    tipo: "regla",
    nombre: "Apuntar a una parte del cuerpo",
    resumen: "El personaje puede apuntar a una parte concreta del cuerpo del oponente con la esperanza de golpear una zona menos protegida o de conseguir un efecto en particular.",
    detalle: "El personaje puede apuntar a una parte concreta del cuerpo del oponente con la esperanza de golpear una zona menos protegida o de conseguir un efecto en particular. Apuntar a una parte concreta del cuerpo otorga un \u20135 a la tirada de ataque.",
    fuente: "Resumen de Reglas",
    tags: ["apuntar-a-una-parte-del-cuerpo", "apuntar", "a", "una", "parte"]
  },
  {
    id: "regla-resumen-90-partes-de-la-armadura",
    tipo: "regla",
    nombre: "Partes de la armadura",
    resumen: "El personaje puede utilizar distintas armaduras en diferentes partes del cuerpo, ya sea para ahorrar dinero o para reducir el nivel de incomodidad a la vez que protege las partes m\u00e1s vitales tanto como sea posible.",
    detalle: "El personaje puede utilizar distintas armaduras en diferentes partes del cuerpo, ya sea para ahorrar dinero o para reducir el nivel de incomodidad a la vez que protege las partes m\u00e1s vitales tanto como sea posible. Un trozo de armadura cuesta una porci\u00f3n del precio de una armadura completa y conserva parte del valor de la cualidad Inc\u00f3moda de esta. La incomodidad se redondea hacia arriba, as\u00ed que 0,5 se convierte en 1.",
    fuente: "Resumen de Reglas",
    tags: ["partes-de-la-armadura", "partes", "de", "la", "armadura"]
  },
  {
    id: "regla-resumen-91-reputacion",
    tipo: "regla",
    nombre: "Reputaci\u00f3n",
    resumen: "En el mundo de Symbaroum hay muchos aventureros, algunos de los cuales viven lo suficiente como para alcanzar la fama (o la infamia).",
    detalle: "En el mundo de Symbaroum hay muchos aventureros, algunos de los cuales viven lo suficiente como para alcanzar la fama (o la infamia). Sin embargo, esta reputaci\u00f3n es una espada de doble filo: es verdad que ser famoso da ciertos beneficios sociales, pero tambi\u00e9n hace que viajar o pasar desapercibido sea m\u00e1s dif\u00edcil. Tambi\u00e9n est\u00e1n la multitud de rumores que circulan sobre los hechos y aventuras del personaje. Con independencia de si son ciertos o no, la gente tratar\u00e1 al personaje de forma diferente: ser famoso casi nunca es exclusivamente bueno. De igual forma, ser infame resulta de utilidad entre cierto tipo de personas. El valor de Reputaci\u00f3n determina cu\u00e1n conocido es el personaje y tiene los siguientes efectos: \u25c6 Penaliza Discreto cuando el personaje intenta evitar la atenci\u00f3n. \u25c6 Penaliza Persuasivo cuando el personaje intenta influenciar a un simpatizante de una facci\u00f3n hostil si este reconoce e identifica al personaje debido a su reputaci\u00f3n. \u25c6 Bonifica Persuasivo si el personaje menciona su nombre y haza\u00f1as cuando intenta conseguir favores sociales.",
    fuente: "Resumen de Reglas",
    tags: ["reputacion"]
  },
  {
    id: "regla-resumen-92-cambios-en-la-reputacion",
    tipo: "regla",
    nombre: "Cambios en la reputaci\u00f3n",
    resumen: "El personaje puede influir en su reputaci\u00f3n principalmente al irse de aventuras, pero tambi\u00e9n ayuda a difundir rumores, canciones e historias.",
    detalle: "El personaje puede influir en su reputaci\u00f3n principalmente al irse de aventuras, pero tambi\u00e9n ayuda a difundir rumores, canciones e historias. Por otro lado, el personaje tambi\u00e9n puede hacer un esfuerzo para actuar de forma discreta con la esperanza de evitar la fama. Siempre hay personajes a los que no les interesa ser reconocidos.",
    fuente: "Resumen de Reglas",
    tags: ["cambios-en-la-reputacion", "cambios", "en", "la", "reputacion"]
  },
  {
    id: "regla-resumen-93-tipo-de-reputacion",
    tipo: "regla",
    nombre: "Tipo de reputaci\u00f3n",
    resumen: "Aparte del valor num\u00e9rico, la reputaci\u00f3n del personaje debe reflejarse adecuadamente mediante un ep\u00edteto y una o dos frases cortas.",
    detalle: "Aparte del valor num\u00e9rico, la reputaci\u00f3n del personaje debe reflejarse adecuadamente mediante un ep\u00edteto y una o dos frases cortas. Como dijimos previamente, los detalles de una reputaci\u00f3n pueden complicar las cosas, dependiendo de con qui\u00e9n se interact\u00fae: el ep\u00edteto \u00abla salvadora de Fuerte Espina\u00bb probablemente cause una reacci\u00f3n diferente a \u00abel rompejuramentos\u00bb y seguramente inspire sentimientos muy diversos entre las personas de diferentes facciones. Una reputaci\u00f3n como \u00abasesino de brujas\u00bb le dar\u00e1 al personaje una c\u00e1lida bienvenida en Templorrecio y ciertas partes de Yndaros, mientras que la bienvenida ser\u00eda muy diferente en Karvosti o al encontrarse con brujas en el interior de Davokar. En resumen: la reputaci\u00f3n del personaje afectar\u00e1 a la reacci\u00f3n y a la manera de comportarse de la gente.",
    fuente: "Resumen de Reglas",
    tags: ["tipo-de-reputacion", "tipo", "de", "reputacion"]
  },
  {
    id: "regla-resumen-94-superposicion-de-efectos",
    tipo: "regla",
    nombre: "Superposici\u00f3n de efectos",
    resumen: "Cuando un personaje act\u00faa de una forma que produce efectos que se superponen entre s\u00ed, se aplica lo siguiente: Una segunda oportunidad de pasar/fallar una tirada de acci\u00f3n: Solo se hace una tirada adicional, no import...",
    detalle: "Cuando un personaje act\u00faa de una forma que produce efectos que se superponen entre s\u00ed, se aplica lo siguiente: \u25c6 Una segunda oportunidad de pasar/fallar una tirada de acci\u00f3n: Solo se hace una tirada adicional, no importa cu\u00e1ntos de esos efectos est\u00e1n en juego y de qu\u00e9 regla provengan. \u25c6 Una segunda oportunidad de pasar y otra de fallar, simult\u00e1neas: Los efectos se anulan entre s\u00ed y solo se realiza una tirada adicional si el personaje tiene m\u00e1s de un efecto que del otro. \u25c6 M\u00faltiples modificaciones positivas y negativas a la misma tirada de acci\u00f3n: Estas se suman. \u25c6 Nivel de dado aumentado: Los efectos que incrementan el nivel del dado de las tiradas de efecto pueden como mucho incrementarlo hasta 1D12. Despu\u00e9s de eso, cada incremento adicional solo a\u00f1ade un +1 al resultado.",
    fuente: "Resumen de Reglas",
    tags: ["superposicion-de-efectos", "superposicion", "de", "efectos"]
  },
];

export const CORE_RULES: CompendiumEntry[] = [...MANUAL_RULES, ...RULE_SUMMARY_ENTRIES];

export const ALL_ENTRIES: CompendiumEntry[] = [
  ...CORE_RULES,
  ...buildMonsterRuleEntries(),
  ...buildMonsterTraitEntries(),
  ...SYMBAROUM_CAPABILITIES.map(buildCapabilityEntry),
  ...buildRaceEntries(),
  ...buildCultureEntries(),
  ...buildArchetypeEntries(),
  ...buildTraditionEntries()
];

export const COMPENDIUM_STATS = {
  totalEntries: ALL_ENTRIES.length,
  traits: buildMonsterTraitEntries().length,
  abilities: SYMBAROUM_ABILITIES.length,
  powers: SYMBAROUM_MYSTIC_POWERS.length,
  rituals: SYMBAROUM_RITUALS.length
};

export function findCompendiumCapabilityEntryId(
  tipo: Extract<EntryType, "habilidad" | "poder_mistico" | "ritual">,
  nombre: string
): string | null {
  const targetSlug = slugify(nombre);
  const entry = ALL_ENTRIES.find((item) => item.tipo === tipo && slugify(item.nombre) === targetSlug);
  return entry?.id ?? null;
}

const SOURCE_CANONICAL_MAP: Record<string, string> = {
  "Libro Basico": "Libro B\u00e1sico",
  "Libro B\u00e1sico": "Libro B\u00e1sico",
  "Guia Avanzada del Jugador": "Gu\u00eda Avanzada del Jugador",
  "Gu\u00eda Avanzada del Jugador": "Gu\u00eda Avanzada del Jugador",
  "Guia del Jugador": "Gu\u00eda del Jugador",
  "Gu\u00eda del Jugador": "Gu\u00eda del Jugador",
  "Guia DM": "Gu\u00eda DM",
  "Gu\u00eda DM": "Gu\u00eda DM",
  "Mundo de symbaroum": "Mundo de Symbaroum",
  "Mundo de Symbaroum": "Mundo de Symbaroum",
  "Codice de monstruos": "C\u00f3dice de monstruos",
  "C\u00f3dice de monstruos": "C\u00f3dice de monstruos",
  "Symbaroum_Errata_v1.14": "Symbaroum Errata v1.14",
  "Symbaroum Errata v1.14": "Symbaroum Errata v1.14",
};

export function canonicalizeCompendiumSourceName(source: string): string {
  return SOURCE_CANONICAL_MAP[source] ?? source;
}

const SOURCE_PDF_PATHS: Record<string, string> = {
  "Libro B\u00e1sico": "/books/libro-basico.pdf",
  "Gu\u00eda Avanzada del Jugador": "/books/guia-avanzada-del-jugador.pdf",
  "Gu\u00eda del Jugador": "/books/guia-del-jugador.pdf",
  "Gu\u00eda DM": "/books/guia-dm.pdf",
  "Mundo de Symbaroum": "/books/mundo-de-symbaroum.pdf",
  "C\u00f3dice de monstruos": "/books/codice-de-monstruos.pdf",
  "Symbaroum Errata v1.14": "/books/symbaroum-errata-v1-14.pdf",
};

const SUMMARY_DOC_PATHS = {
  rules: "/summaries/Reglas.pdf",
  capabilities: "/summaries/Habilidades, poderes y rituales.pdf",
  market: "/summaries/Mercado.pdf",
  materials: "/summaries/Materiales.pdf",
  tools: "/summaries/Guía de Utensilios.pdf",
  errata: "/summaries/Errata Sueca Traducida.pdf"
} as const;

const SUMMARY_PDF_PAGE_OVERRIDES = {
  rules: {
    "Reglas b?sicas": 4,
    "Combate": 4,
    "Acciones especiales de combate": 5,
    "Luchar a ciegas": 5,
    "Destrabarse del combate": 5,
    "Usar/aplicar un elixir": 5,
    "Primeros auxilios": 5,
    "Levantarse": 5,
    "L?nea de visi?n": 5,
    "Escudo": 6,
    "Flanquear": 6,
    "Sorpresa": 6,
    "Ventaja": 6,
    "Da?o y curaci?n": 7,
    "Umbral de dolor": 7,
    "Personajes moribundos": 7,
    "Reglas especiales": 7,
    "Conflictos entre personajes jugadores": 7,
    "Da?o por veneno o ?cido": 8,
    "Da?o por ca?da": 8,
    "Reglas alternativas: (a discutir por el grupo)": 8,
    "Modificaciones a la corrupci?n": 8,
    "Umbral de corrupci?n": 8,
    "Corrupci?n m?xima": 8,
    "Cambio a las tradiciones": 9,
    "Cambio a Talento m?stico superior": 9,
    "Muerte instant?nea": 9,
    "Modificadores por da?o cr?tico": 9,
    "Tiradas a cambio de experiencia": 9,
    "Tiradas a cambio de corrupci?n": 9,
    "Cr?ticos y pifias en combate": 10,
    "Objetivos vitales": 10,
    "Ejemplos de objetivos vitales": 10,
    "El camino de la misericordia": 10,
    "Movimiento a escala": 12,
    "Tiradas para atributos": 12,
    "Usar Persuasivo entre jugadores": 12,
    "Armas alqu?micas": 13,
    "Tubo de fuego alqu?mico (port?til)": 13,
    "Tubo de fuego alqu?mico (fijo)": 13,
    "Granada alqu?mica": 13,
    "Olla explosiva": 13,
    "Categor?as de distancia": 13,
    "Convertirse en muerto viviente en vez de abominaci?n por corrupci?n": 14,
    "Haza?as": 14,
    "Golpe limpio": 14,
    "Sin miedo": 14,
    "Ignorar la corrupci?n": 14,
    "Defensa perfecta": 14,
    "Golpe r?pido": 14,
    "Resistencia": 22,
    "Mirada de acero": 15,
    "Ataque torbellino": 15,
    "Categor?as de marcha": 15,
    "Carga": 15,
    "Investigaci?n en archivos": 16,
    "Experiencia inicial": 16,
    "Rituales m?ximos a nivel maestro": 16,
    "Persecuciones": 17,
    "Trampas": 17,
    "Poner una trampa": 17,
    "Descubrir una trampa": 17,
    "Evitar una trampa": 17,
    "Desactivar una trampa": 18,
    "Liberarse de una trampa": 18,
    "Venta de bienes usados": 18,
    "Ingresos por bendiciones": 18,
    "Maniobras de combate (combates m?s t?cticos)": 18,
    "Apuntar con cuidado": 19,
    "Embestir": 19,
    "Retrasar la iniciativa": 19,
    "Desarmar": 19,
    "Defensa completa": 19,
    "Ofensiva total": 19,
    "Presa": 19,
    "Dejar inconsciente": 20,
    "Veneno en las armas": 20,
    "Hacer retroceder": 20,
    "Placaje": 20,
    "Tomar la iniciativa": 20,
    "Monstruos y trofeos": 20,
    "Objetos magistrales": 21,
    "Pactos": 21,
    "Ventajas del pacto": 22,
    "Precio del pacto": 22,
    "Romper un pacto": 22,
    "Da?o a edificios": 22,
    "Punto cr?tico": 23,
    "Fortificaci?n": 23,
    "Incendiar edificios": 23,
    "Recuperar virotes o flechas": 24,
    "Los secretos de las tradiciones": 24,
    "Golpes localizados": 25,
    "Apuntar alto o bajo": 25,
    "Apuntar a una parte del cuerpo": 25,
    "Partes de la armadura": 25,
    "Reputaci?n": 26,
    "Cambios en la reputaci?n": 26,
    "Tipo de reputaci?n": 26,
    "Superposici?n de efectos": 27
  },
  capabilities: {
    "Habilidades para todos": 1,
    "Acr?bata": 1,
    "Alquimista": 1,
    "Arco veloz": 2,
    "Armas a dos manos": 2,
    "Armas de asta": 2,
    "Armas de presa": 3,
    "Ataque con dos armas": 3,
    "Ataque traicionero": 4,
    "Atributo excepcional": 4,
    "Berserker": 4,
    "Brujer?a": 5,
    "Canalizaci?n": 5,
    "Canto troll": 6,
    "Combate con armadura": 6,
    "Combate con arma larga": 7,
    "Combate con armas de cadena": 7,
    "Combate con escudo": 7,
    "Combate sin armas": 8,
    "Cuchillo r?pido": 8,
    "Disparo Magistral": 9,
    "Dominaci?n": 10,
    "Esgrima sagrada": 10,
    "Esp?ritu combativo": 11,
    "Estrangulador": 11,
    "Estudioso": 12,
    "Experto en asedios": 12,
    "Finta": 13,
    "Golpe bajo": 13,
    "Golpe de hierro": 14,
    "Guardaespaldas": 14,
    "Hechicer?a": 14,
    "Herrero": 15,
    "Inquebrantable": 15,
    "Instinto de cazador": 16,
    "Jinete": 16,
    "L?der": 17,
    "Lucha": 17,
    "Maestro del hacha": 18,
    "Magia": 19,
    "Mano veloz": 19,
    "Martillo ariete": 19,
    "Medicus": 20,
    "Ojo m?stico": 20,
    "Oportunista": 21,
    "Pu?o de flecha": 21,
    "Recuperaci?n": 22,
    "Reflejos r?pidos": 22,
    "Sexto sentido": 22,
    "Simbolismo": 23,
    "T?ctico": 24,
    "Talento m?stico superior": 24,
    "Tatuaje r?nico": 25,
    "Teurgia": 25,
    "Tirador": 25,
    "Trampero": 26,
    "Venenos": 27,
    "Versado en criaturas": 27,
    "Viento de acero": 28,
    "Poderes m?sticos": 29,
    "Tradiciones de los poderes": 29,
    "Aliento negro": 29,
    "Anatema": 30,
    "Arma danzante": 30,
    "Aura imp?a": 30,
    "Aura sagrada": 31,
    "Cambiaformas": 31,
    "Cascada de azufre": 31,
    "Confusi?n": 32,
    "Empuje mental": 32,
    "Enredadera veloz": 33,
    "Erupci?n de larvas": 33,
    "Escudo bendito": 34,
    "Esfera de protecci?n": 34,
    "Forma verdadera": 35,
    "Glifo vamp?rico": 35,
    "Golpe espectral": 36,
    "Herida compartida": 36,
    "Himno de batalla": 37,
    "Himno debilitante": 37,
    "Himno heroico": 38,
    "Imperceptible": 38,
    "Imposici?n de manos": 38,
    "Levitaci?n": 39,
    "Maldici?n": 39,
    "Martillo de monstruos": 40,
    "Modificaci?n ilusoria": 40,
    "Muro de llamas": 40,
    "Nube de venganza": 41,
    "Prisma ardiente de prios": 42,
    "Rayo negro": 42,
    "Refugio terrestre": 43,
    "Runas de protecci?n": 43,
    "Sello de expulsi?n": 43,
    "S?mbolo cegador": 44,
    "Someter voluntad": 44,
    "Tormenta de flechas": 45,
    "Transformaci?n regresiva": 45,
    "Rituales": 46,
    "Tradiciones de los rituales": 46,
    "Adivinaci?n": 46,
    "Alzar muertos vivientes": 47,
    "Cadenas de juicio": 47,
    "C?rculo de bruja": 47,
    "C?rculo m?gico": 48,
    "Conjurar terreno vengativo": 48,
    "Clarividencia": 48,
    "Crecimiento acelerado": 49,
    "Decretar confesi?n": 49,
    "Esclavizar": 49,
    "Escritura lejana": 49,
    "Esp?ritu protector": 49,
    "Exorcismo": 50,
    "Familiar": 50,
    "Forma ilusoria": 51,
    "Fuego purificador": 51,
    "Grilletes del destino": 51,
    "Guardi?n r?nico": 52,
    "Humo sagrado": 52,
    "Ilusi?n": 52,
    "Intercambiar sombra": 52,
    "Interrogatorio mental": 53,
    "Invocaci?n": 53,
    "Manipulaci?n atmosf?rica": 53,
    "Moldear la carne": 53,
    "Nana del bosque": 54,
    "Nigromancia": 54,
    "Or?culo": 54,
    "Paisaje hipn?tico": 54,
    "Piedra de esp?ritu": 54,
    "Posesi?n": 55,
    "Pr?stamo animal": 55,
    "Prisi?n espiritual": 56,
    "Prolongar la vida": 56,
    "Rastro her?tico": 56,
    "Rastro invisible": 56,
    "Recipiente vital": 56,
    "Recuperar objeto": 57,
    "Relato de cenizas": 57,
    "Reparar": 57,
    "Rito de bendici?n": 57,
    "Rito de profanaci?n": 57,
    "Rito de sellado/apertura": 58,
    "Romper conexi?n": 58,
    "Santuario": 58,
    "Siervo flam?gero": 58,
    "Tatuar runa": 59,
    "Terreno ilusorio": 59,
    "Tormento": 59,
    "Tortura resonante": 59,
    "Trampa m?stica": 60,
    "Ungir": 60,
    "Vida falsa": 60,
    "V?nculo de sangre": 60,
    "Zancada de siete leguas": 61,
    "Profesiones y sus habilidades": 61,
    "Ladr?n de guante blanco": 61,
    "Capa danzante": 61,
    "Guardia de la Furia": 61,
    "Combate sangriento": 62,
    "Juramentado de hierro": 62,
    "Danza de batalla": 62,
    "Artesano de artefactos": 63,
    "Elaboraci?n de artefactos": 63,
    "Mago del b?culo": 63,
    "Magia del b?culo": 63,
    "B?culo arrojadizo": 64,
    "Terremoto": 65,
    "Tormenta de sangre": 65,
    "Templario": 66,
    "M?stico acorazado": 66,
    "Esp?a de la reina": 66,
    "Pirotecnia": 66,
    "N?mada de la sangre - El camino rojo de las brujas": 67,
    "Cacer?a salvaje": 67,
    "Compa?ero bestial": 68,
    "Espiritista - El camino blanco de las brujas": 68,
    "Adivinaci?n nigrom?ntica": 68,
    "Nigromante": 68,
    "Esp?ritus atormentadores": 69,
    "Forma espiritual": 69,
    "Se?or de la muerte": 70,
    "Demon?logo": 70,
    "Expulsar a los abismos": 70,
    "Teletransportaci?n": 71,
    "Invocar demonio": 72,
    "Siervo demon?aco": 75,
    "Ilusionista": 75,
    "Imagen especular": 75,
    "Fata morgana": 75,
    "Confesor": 76,
    "Manantial de vida": 76,
    "Expiaci?n": 76,
    "Tejedora verde": 76,
    "Manto de espinas": 76,
    "Fortaleza viviente": 77,
    "Inquisidor": 77,
    "Purgatorio": 77,
    "Mirada penetrante": 78,
    "Piromante": 78,
    "Esp?ritu ?gneo": 78,
    "Gemelos flam?geros": 78,
    "Mentalista": 78,
    "Golpe ps?quico": 79,
    "T?nel m?stico": 79
  },
  errata: {
    "Armadura (valores de los monstruos)": 1,
    "Armas (valores de los monstruos)": 1,
    "V?nculo de sangre (Ritual)": 2,
    "Berserker (Habilidad)": 2,
    "Experiencia": 2,
    "Sirviente Flam?gero (Ritual)": 2,
    "Habilidades que sustituyen un rasgo por otro": 2,
    "Defensa (Valores de monstruos)": 2,
    "Cambiaformas (Poder m?stico)": 3,
    "Renta": 3,
    "Golpe de Hierro (Habilidad)": 3,
    "Arma arrojadiza": 3,
    "L?der (Habilidad)": 3,
    "Elixir de vida (Elixir alqu?mico)": 3,
    "Larga (Cualidad)": 4,
    "Concentrado m?gico (Elixir alqu?mico)": 4,
    "Material para usar poderes": 4,
    "Versado en criaturas (Habilidad)": 4,
    "Ataque de monstruos": 4,
    "Tabla": 5,
    "Fuego purificador (Ritual)": 6,
    "Jefe ladr?n": 6,
    "Piedra de alma (Ritual)": 7,
    "Da?o de dados superiores a 1D12": 7
  }
} as const;

const SUMMARY_PDF_PAGE_LOOKUPS: Partial<Record<keyof typeof SUMMARY_DOC_PATHS, Record<string, number>>> = {
  rules: {
    "acciones-especiales-de-combate": 5,
    "apuntar-a-una-parte-del-cuerpo": 25,
    "apuntar-alto-o-bajo": 25,
    "apuntar-con-cuidado": 19,
    "armas-alquimicas": 13,
    "ataque-torbellino": 15,
    "cambio-a-las-tradiciones": 9,
    "cambio-a-talento-mistico-superior": 9,
    "cambios-en-la-reputacion": 26,
    "carga": 15,
    "categorias-de-distancia": 13,
    "categorias-de-marcha": 15,
    "combate": 4,
    "conflictos-entre-personajes-jugadores": 7,
    "convertirse-en-muerto-viviente-en-vez-de-abominacion-por-corrupcion": 14,
    "corrupcion-maxima": 8,
    "criticos-y-pifias-en-combate": 10,
    "dano-a-edificios": 22,
    "dano-por-caida": 8,
    "dano-por-veneno-o-acido": 8,
    "dano-y-curacion": 7,
    "defensa-completa": 19,
    "defensa-perfecta": 14,
    "dejar-inconsciente": 20,
    "desactivar-una-trampa": 18,
    "desarmar": 19,
    "descubrir-una-trampa": 17,
    "destrabarse-del-combate": 5,
    "ejemplos-de-objetivos-vitales": 10,
    "el-camino-de-la-misericordia": 10,
    "embestir": 19,
    "escudo": 6,
    "evitar-una-trampa": 17,
    "experiencia-inicial": 16,
    "flanquear": 6,
    "fortificacion": 23,
    "golpe-limpio": 14,
    "golpe-rapido": 14,
    "golpes-localizados": 25,
    "granada-alquimica": 13,
    "hacer-retroceder": 20,
    "hazanas": 14,
    "ignorar-la-corrupcion": 14,
    "incendiar-edificios": 23,
    "ingresos-por-bendiciones": 18,
    "investigacion-en-archivos": 16,
    "levantarse": 5,
    "liberarse-de-una-trampa": 18,
    "linea-de-vision": 5,
    "los-secretos-de-las-tradiciones": 24,
    "luchar-a-ciegas": 5,
    "maniobras-de-combate-combates-mas-tacticos": 18,
    "mirada-de-acero": 15,
    "modificaciones-a-la-corrupcion": 8,
    "modificadores-por-dano-critico": 9,
    "monstruos-y-trofeos": 20,
    "movimiento-a-escala": 12,
    "muerte-instantanea": 9,
    "objetivos-vitales": 10,
    "objetos-magistrales": 21,
    "ofensiva-total": 19,
    "olla-explosiva": 13,
    "pactos": 21,
    "partes-de-la-armadura": 25,
    "persecuciones": 17,
    "personajes-moribundos": 7,
    "placaje": 20,
    "poner-una-trampa": 17,
    "precio-del-pacto": 22,
    "presa": 19,
    "primeros-auxilios": 5,
    "punto-critico": 23,
    "recuperar-virotes-o-flechas": 24,
    "reglas-alternativas-a-discutir-por-el-grupo": 8,
    "reglas-basicas": 4,
    "reglas-especiales": 7,
    "reputacion": 26,
    "resistencia": 22,
    "retrasar-la-iniciativa": 19,
    "rituales-maximos-a-nivel-maestro": 16,
    "romper-un-pacto": 22,
    "sin-miedo": 14,
    "sorpresa": 6,
    "superposicion-de-efectos": 27,
    "tipo-de-reputacion": 26,
    "tiradas-a-cambio-de-corrupcion": 9,
    "tiradas-a-cambio-de-experiencia": 9,
    "tiradas-para-atributos": 12,
    "tomar-la-iniciativa": 20,
    "trampas": 17,
    "tubo-de-fuego-alquimico-fijo": 13,
    "tubo-de-fuego-alquimico-portatil": 13,
    "umbral-de-corrupcion": 8,
    "umbral-de-dolor": 7,
    "usar-aplicar-un-elixir": 5,
    "usar-persuasivo-entre-jugadores": 12,
    "veneno-en-las-armas": 20,
    "venta-de-bienes-usados": 18,
    "ventaja": 6,
    "ventajas-del-pacto": 22
  },
  capabilities: {
    "acrobata": 1,
    "adivinacion": 46,
    "adivinacion-nigromantica": 68,
    "aliento-negro": 29,
    "alquimista": 1,
    "alzar-muertos-vivientes": 47,
    "anatema": 30,
    "arco-veloz": 2,
    "arma-danzante": 30,
    "armas-a-dos-manos": 2,
    "armas-de-asta": 2,
    "armas-de-presa": 3,
    "artesano-de-artefactos": 63,
    "ataque-con-dos-armas": 3,
    "ataque-traicionero": 4,
    "atributo-excepcional": 4,
    "aura-impia": 30,
    "aura-sagrada": 31,
    "baculo-arrojadizo": 64,
    "berserker": 4,
    "brujeria": 5,
    "caceria-salvaje": 67,
    "cadenas-de-juicio": 47,
    "cambiaformas": 31,
    "canalizacion": 5,
    "canto-troll": 6,
    "capa-danzante": 61,
    "cascada-de-azufre": 31,
    "circulo-de-bruja": 47,
    "circulo-magico": 48,
    "clarividencia": 48,
    "combate-con-arma-larga": 7,
    "combate-con-armadura": 6,
    "combate-con-armas-de-cadena": 7,
    "combate-con-escudo": 7,
    "combate-sangriento": 62,
    "combate-sin-armas": 8,
    "companero-bestial": 68,
    "confesor": 76,
    "confusion": 32,
    "conjurar-terreno-vengativo": 48,
    "crecimiento-acelerado": 49,
    "cuchillo-rapido": 8,
    "danza-de-batalla": 62,
    "decretar-confesion": 49,
    "demonologo": 70,
    "disparo-magistral": 9,
    "dominacion": 10,
    "elaboracion-de-artefactos": 63,
    "empuje-mental": 32,
    "enredadera-veloz": 33,
    "erupcion-de-larvas": 33,
    "esclavizar": 49,
    "escritura-lejana": 49,
    "escudo-bendito": 34,
    "esfera-de-proteccion": 34,
    "esgrima-sagrada": 10,
    "espia-de-la-reina": 66,
    "espiritista-el-camino-blanco-de-las-brujas": 68,
    "espiritu-combativo": 11,
    "espiritu-igneo": 78,
    "espiritu-protector": 49,
    "espiritus-atormentadores": 69,
    "estrangulador": 11,
    "estudioso": 12,
    "exorcismo": 50,
    "experto-en-asedios": 12,
    "expiacion": 76,
    "expulsar-a-los-abismos": 70,
    "familiar": 50,
    "fata-morgana": 75,
    "finta": 13,
    "forma-espiritual": 69,
    "forma-ilusoria": 51,
    "forma-verdadera": 35,
    "fortaleza-viviente": 77,
    "fuego-purificador": 51,
    "gemelos-flamigeros": 78,
    "glifo-vampirico": 35,
    "golpe-bajo": 13,
    "golpe-de-hierro": 14,
    "golpe-espectral": 36,
    "golpe-psiquico": 79,
    "grilletes-del-destino": 51,
    "guardaespaldas": 14,
    "guardia-de-la-furia": 61,
    "guardian-runico": 52,
    "habilidades-para-todos": 1,
    "hechiceria": 14,
    "herida-compartida": 36,
    "herrero": 15,
    "himno-de-batalla": 37,
    "himno-debilitante": 37,
    "himno-heroico": 38,
    "humo-sagrado": 52,
    "ilusion": 52,
    "ilusionista": 75,
    "imagen-especular": 75,
    "imperceptible": 38,
    "imposicion-de-manos": 38,
    "inquebrantable": 15,
    "inquisidor": 77,
    "instinto-de-cazador": 16,
    "intercambiar-sombra": 52,
    "interrogatorio-mental": 53,
    "invocacion": 53,
    "invocar-demonio": 72,
    "jinete": 16,
    "juramentado-de-hierro": 62,
    "ladron-de-guante-blanco": 61,
    "levitacion": 39,
    "lider": 17,
    "lucha": 17,
    "maestro-del-hacha": 18,
    "magia": 19,
    "magia-del-baculo": 63,
    "mago-del-baculo": 63,
    "maldicion": 39,
    "manantial-de-vida": 76,
    "manipulacion-atmosferica": 53,
    "mano-veloz": 19,
    "manto-de-espinas": 76,
    "martillo-ariete": 19,
    "martillo-de-monstruos": 40,
    "medicus": 20,
    "mentalista": 78,
    "mirada-penetrante": 78,
    "mistico-acorazado": 66,
    "modificacion-ilusoria": 40,
    "moldear-la-carne": 53,
    "muro-de-llamas": 40,
    "nana-del-bosque": 54,
    "nigromancia": 54,
    "nigromante": 68,
    "nomada-de-la-sangre-el-camino-rojo-de-las-brujas": 67,
    "nube-de-venganza": 41,
    "ojo-mistico": 20,
    "oportunista": 21,
    "oraculo": 54,
    "paisaje-hipnotico": 54,
    "piedra-de-espiritu": 54,
    "piromante": 78,
    "pirotecnia": 66,
    "poderes-misticos": 29,
    "posesion": 55,
    "prestamo-animal": 55,
    "prision-espiritual": 56,
    "prisma-ardiente-de-prios": 42,
    "profesiones-y-sus-habilidades": 61,
    "prolongar-la-vida": 56,
    "puno-de-flecha": 21,
    "purgatorio": 77,
    "rastro-heretico": 56,
    "rastro-invisible": 56,
    "rayo-negro": 42,
    "recipiente-vital": 56,
    "recuperacion": 22,
    "recuperar-objeto": 57,
    "reflejos-rapidos": 22,
    "refugio-terrestre": 43,
    "relato-de-cenizas": 57,
    "reparar": 57,
    "rito-de-bendicion": 57,
    "rito-de-profanacion": 57,
    "rito-de-sellado-apertura": 58,
    "rituales": 46,
    "romper-conexion": 58,
    "runas-de-proteccion": 43,
    "santuario": 58,
    "sello-de-expulsion": 43,
    "senor-de-la-muerte": 70,
    "sexto-sentido": 22,
    "siervo-demoniaco": 75,
    "siervo-flamigero": 58,
    "simbolismo": 23,
    "simbolo-cegador": 44,
    "someter-voluntad": 44,
    "tactico": 24,
    "talento-mistico-superior": 24,
    "tatuaje-runico": 25,
    "tatuar-runa": 59,
    "tejedora-verde": 76,
    "teletransportacion": 71,
    "templario": 66,
    "terremoto": 65,
    "terreno-ilusorio": 59,
    "teurgia": 25,
    "tirador": 25,
    "tormenta-de-flechas": 45,
    "tormenta-de-sangre": 65,
    "tormento": 59,
    "tortura-resonante": 59,
    "tradiciones-de-los-poderes": 29,
    "tradiciones-de-los-rituales": 46,
    "trampa-mistica": 60,
    "trampero": 26,
    "transformacion-regresiva": 45,
    "tunel-mistico": 79,
    "ungir": 60,
    "venenos": 27,
    "versado-en-criaturas": 27,
    "vida-falsa": 60,
    "viento-de-acero": 28,
    "vinculo-de-sangre": 60,
    "zancada-de-siete-leguas": 61
  },
  errata: {
    "arma-arrojadiza": 3,
    "armadura-valores-de-los-monstruos": 1,
    "armas-valores-de-los-monstruos": 1,
    "ataque-de-monstruos": 4,
    "berserker-habilidad": 2,
    "cambiaformas-poder-mistico": 3,
    "concentrado-magico-elixir-alquimico": 4,
    "dano-de-dados-superiores-a-1d12": 7,
    "defensa-valores-de-monstruos": 2,
    "elixir-de-vida-elixir-alquimico": 3,
    "experiencia": 2,
    "fuego-purificador-ritual": 6,
    "golpe-de-hierro-habilidad": 3,
    "habilidades-que-sustituyen-un-rasgo-por-otro": 2,
    "jefe-ladron": 6,
    "larga-cualidad": 4,
    "lider-habilidad": 3,
    "material-para-usar-poderes": 4,
    "piedra-de-alma-ritual": 7,
    "renta": 3,
    "sirviente-flamigero-ritual": 2,
    "tabla": 5,
    "versado-en-criaturas-habilidad": 4,
    "vinculo-de-sangre-ritual": 2
  }
};

const SOURCE_PDF_PAGE_OFFSETS: Record<string, number> = {
  "Libro B\u00e1sico": 1,
  "Gu\u00eda Avanzada del Jugador": 2,
  "Gu\u00eda del Jugador": -68,
  "Gu\u00eda DM": -162,
  "Mundo de Symbaroum": -10,
  "C\u00f3dice de monstruos": 2
};

const ADVANCED_GUIDE_ENTRY_PAGE_OVERRIDES: Record<string, number> = {
  "Arco veloz": 60,
  "Armas de presa": 60,
  "CanalizaciÃ³n": 62,
  "Capa danzante": 62,
  "Combate con arma larga": 63,
  "Combate con armas de cadena": 63,
  "Combate sangriento": 63,
  "Cuchillo rÃ¡pido": 64,
  "Danza de batalla": 64,
  "Disparo magistral": 64,
  "ElaboraciÃ³n de artefactos": 66,
  "Esgrima sagrada": 66,
  "EspÃ­ritu combativo": 66,
  "Experto en asedios": 67,
  "Golpe bajo": 67,
  "Herrero": 67,
  "Instinto de cazador": 68,
  "Lucha": 68,
  "Magia del bÃ¡culo": 69,
  "Martillo ariete": 70,
  "Maestro del hacha": 68,
  "MÃ­stico acorazado": 70,
  "Oportunista": 70,
  "Pirotecnia": 70,
  "PuÃ±o de flecha": 71,
  "Reflejos rÃ¡pidos": 71,
  "Simbolismo": 72,
  "Talento mÃ­stico superior": 72,
  "Tatuaje rÃºnico": 73,
  "Trampero": 73,
  "Aliento negro": 78,
  "Arma danzante": 78,
  "BÃ¡culo arrojadizo": 80,
  "CacerÃ­a salvaje": 80,
  "Esfera de protecciÃ³n": 80,
  "EspÃ­ritu Ã­gneo": 81,
  "EspÃ­ritus atormentadores": 81,
  "Expulsar a los abismos": 81,
  "Forma espiritual": 82,
  "Glifo vampÃ­rico": 82,
  "Golpe psÃ­quico": 83,
  "Himno de batalla": 83,
  "Himno debilitante": 83,
  "Himno heroico": 83,
  "Imagen especular": 84,
  "Manantial de vida": 84,
  "Manto de espinas": 84,
  "Nube de venganza": 84,
  "Purgatorio": 86,
  "Rayo negro": 86,
  "Runas de protecciÃ³n": 86,
  "Sello de expulsiÃ³n": 87,
  "SÃ­mbolo cegador": 87,
  "TeletransportaciÃ³n": 87
};

function resolveCompendiumPdfPage(source: string, page?: number, searchTerm?: string): number | undefined {
  if (!page) {
    return undefined;
  }

  const canonicalSource = canonicalizeCompendiumSourceName(source);
  let resolvedPage = page;

  if (canonicalSource === "Gu\u00eda Avanzada del Jugador") {
    const exactPage = searchTerm ? ADVANCED_GUIDE_ENTRY_PAGE_OVERRIDES[searchTerm.trim()] : undefined;
    if (exactPage) {
      resolvedPage = exactPage;
    } else if (searchTerm?.trim()) {
      if (page >= 64 && page <= 67) {
        resolvedPage = 60;
      } else if (page >= 80 && page <= 81) {
        resolvedPage = 78;
      } else if (page >= 90 && page <= 91) {
        resolvedPage = 88;
      }
    }
  }

  const pdfPage = resolvedPage + (SOURCE_PDF_PAGE_OFFSETS[canonicalSource] ?? SOURCE_PDF_PAGE_OFFSETS[source] ?? 0);
  return pdfPage >= 1 ? pdfPage : undefined;
}

function buildCompendiumPdfUrl(basePath: string, page?: number): string {
  if (!page) {
    return basePath;
  }

  return `${basePath}#page=${page}`;
}

export function getCompendiumSourcePdfUrl(source: string, page?: number, searchTerm?: string): string | null {
  const canonicalSource = canonicalizeCompendiumSourceName(source);
  const basePath = SOURCE_PDF_PATHS[canonicalSource] ?? SOURCE_PDF_PATHS[source];
  if (!basePath) {
    return null;
  }

  const adjustedPage = resolveCompendiumPdfPage(canonicalSource, page, searchTerm);
  return buildCompendiumPdfUrl(basePath, adjustedPage);
}

export function getCompendiumSummaryLink(entry: CompendiumEntry): CompendiumSummaryLink | null {
  const buildSummaryUrl = (documentKey: keyof typeof SUMMARY_DOC_PATHS, sectionLabel: string): string => {
    const basePath = SUMMARY_DOC_PATHS[documentKey];
    const page = SUMMARY_PDF_PAGE_LOOKUPS[documentKey]?.[slugify(sectionLabel)];
    return buildCompendiumPdfUrl(basePath, page);
  };

  if (entry.fuente === "Resumen de Reglas") {
    return {
      url: buildSummaryUrl("rules", entry.nombre),
      documentLabel: "Resumen: Reglas",
      sectionLabel: entry.nombre
    };
  }

  if (entry.tipo === "habilidad" || entry.tipo === "poder_mistico" || entry.tipo === "ritual" || entry.tipo === "tradicion") {
    return {
      url: buildSummaryUrl("capabilities", entry.nombre),
      documentLabel: "Resumen: Habilidades, poderes y rituales",
      sectionLabel: entry.nombre
    };
  }

  if (entry.tipo === "raza" || entry.tipo === "cultura" || entry.tipo === "arquetipo") {
    return {
      url: buildSummaryUrl("errata", entry.nombre),
      documentLabel: "Resumen relacionado",
      sectionLabel: entry.nombre
    };
  }

  return null;
}

