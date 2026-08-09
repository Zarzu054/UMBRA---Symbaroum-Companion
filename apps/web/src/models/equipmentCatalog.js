const BASIC_ELIXIR_REFERENCE = { source: "Libro Básico", page: 151 };
const ADVANCED_ELIXIR_REFERENCE = { source: "Guía Avanzada del Jugador", page: 120 };
const MINOR_ARTIFACT_REFERENCE = { source: "Guía Avanzada del Jugador", page: 123 };
const TRAP_REFERENCE = { source: "Guía Avanzada del Jugador", page: 127 };
const TOOL_REFERENCE = { source: "Guía Avanzada del Jugador", page: 128 };
const BASIC_EQUIPMENT_REFERENCE = { source: "Libro Básico", page: 152 };
const BASIC_TOOL_REFERENCE = { source: "Libro Básico", page: 153 };
function elixir(id, name, price, summary, detail, references = [ADVANCED_ELIXIR_REFERENCE], extra = {}) {
    return {
        id: `equipment-elixir-${id}`,
        group: "elixir",
        name,
        summary,
        detail,
        price,
        category: "consumable",
        stackable: true,
        slot: "none",
        qualities: ["Alquímico"],
        defaultQuantity: 1,
        usable: true,
        references,
        tags: ["elixir", "alquimia"],
        ...extra
    };
}
const ELIXIR_DEFINITIONS = [
    elixir("aceite-proteccion", "Aceite de protección", "2 táleros", "Concede protección adicional contra un elemento durante una escena.", "Al aplicarlo, proporciona 1D4 de armadura adicional contra fuego, frío, ácido o rayo. El elemento se decide al preparar el aceite.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("agua-bendita", "Agua bendita", "2 táleros", "Cura heridas y reduce la corrupción temporal.", "Funciona como hierbas curativas con +1 a la tirada de efecto; sin Medicus restaura 2 de Robustez. También elimina 1 punto de corrupción temporal."),
    elixir("amistad-espiritual", "Amistad espiritual", "12 táleros", "Concede temporalmente Forma espiritual I.", "Al inhalar sus vapores, el usuario obtiene Forma espiritual I durante 1D4 turnos y recibe la misma cantidad de corrupción temporal."),
    elixir("antidoto", "Antídoto", "Desde 1 tálero", "Reduce la potencia de un veneno activo.", "El antídoto reduce uno o varios niveles de potencia, pero no recupera el daño ya sufrido.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE], {
        variants: [
            { id: "weak", label: "Débil", price: "1 tálero", effect: "Reduce el veneno un nivel." },
            { id: "moderate", label: "Moderado", price: "2 táleros", effect: "Reduce el veneno dos niveles." },
            { id: "strong", label: "Potente", price: "3 táleros", effect: "Reduce el veneno tres niveles, normalmente neutralizándolo." }
        ]
    }),
    elixir("bebedizo-transmutador", "Bebedizo transmutador", "Desde 2 táleros", "Otorga temporalmente un rasgo monstruoso a cambio de corrupción.", "Durante una escena concede Duro, Arma natural, Robusto o Alado. Su comercio es clandestino y el usuario tiene una segunda oportunidad de fallar las pruebas de Persuasivo.", [ADVANCED_ELIXIR_REFERENCE], {
        variants: [
            { id: "weak", label: "Débil", price: "2 táleros", effect: "Rasgo I y 1D4 de corrupción temporal." },
            { id: "moderate", label: "Moderado", price: "4 táleros", effect: "Rasgo II y 1D6 de corrupción temporal." },
            { id: "strong", label: "Potente", price: "6 táleros", effect: "Rasgo III y 1D8 de corrupción temporal." }
        ],
        tags: ["elixir", "alquimia", "mercado negro", "corrupción"]
    }),
    elixir("bestias-espinosas", "Bestias espinosas", "4 táleros", "Invoca pequeñas criaturas espinosas durante una escena.", "Un turno después de arrojar las semillas aparecen 1D4 bestias espinosas. Servirán al usuario durante una escena; utilizarlas causa 1D6 de corrupción temporal."),
    elixir("bomba-esporas", "Bomba de esporas", "3 táleros", "Bomba alquímica vinculada a la habilidad Estrangulador.", "Solo puede aprovecharse mediante las reglas de Estrangulador y dispersa esporas asfixiantes en una zona.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("bomba-humo", "Bomba de humo", "2 táleros", "Cubre una zona con humo alquímico denso.", "Requiere Pirotecnia a nivel adepto. Al romperse llena una habitación o cubre a un grupo trabado en combate cuerpo a cuerpo."),
    elixir("chicle-silvestre", "Chicle silvestre", "1 tálero", "Redistribuye atributos hacia la agresividad durante una escena.", "Mueve 2 puntos de Discreto, Inteligente y Tenaz a Ágil, Fuerte y Diestro. En la escena siguiente impone -2 a todos los atributos y su uso continuado provoca adicción."),
    elixir("concentrado-magico", "Magia concentrada", "1 tálero", "Permite repetir una tirada de Tenaz al usar un poder místico.", "La siguiente vez que el usuario intente activar un poder místico puede repetir su tirada de Tenaz.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE], { tags: ["elixir", "alquimia", "concentrado mágico"] }),
    elixir("elixir-vida", "Elixir de vida", "12 táleros", "Regenera Robustez durante varios turnos a cambio de corrupción.", "Restaura 1D6 de Robustez por turno durante 1D6 turnos. Cada turno de efecto causa 1 punto de corrupción temporal.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("esporas-asfixiantes", "Esporas asfixiantes", "2 táleros", "Preparado exclusivo de la habilidad Estrangulador.", "Estas esporas de setas y líquenes de Davokar se utilizan con las reglas de Estrangulador.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("extracto-elemental", "Extracto elemental", "2 táleros", "Añade daño elemental a armas o proyectiles durante una escena.", "Aplicado a un arma cuerpo a cuerpo, cuatro armas arrojadizas o un carcaj, añade 1D4 de daño de fuego, frío, ácido o rayo durante una escena.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("flecha-rastreadora", "Flecha rastreadora", "2 táleros", "Permite disparar sin una línea de visión completamente despejada.", "La flecha busca al objetivo y sortea obstáculos. El arquero debe ver alguna parte del blanco y superar la tirada de ataque normal."),
    elixir("granada-trueno", "Granada de trueno", "3 táleros", "Carga cegadora utilizada con Pirotecnia.", "Se lanza y detona con un destello repentino. Su uso corresponde al nivel maestro de Pirotecnia."),
    elixir("hierbas-curativas", "Hierbas curativas", "1 tálero", "Curan Robustez y mejoran con Medicus.", "Restauran 1 punto de Robustez cuando se aplican. En manos de un personaje con Medicus resultan más eficaces.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE], { qualities: ["Alquímico", "Curación"] }),
    elixir("homunculo", "Homúnculo", "2 táleros", "Hace brotar un pequeño sirviente durante un mes.", "Un día después de plantar la semilla aparece un criado con atributos 5. Sirve durante un mes; crearlo causa 1D6 de corrupción temporal."),
    elixir("lagrimas-curativas", "Lágrimas curativas", "2 táleros", "Eliminan una ceguera temporal.", "Devuelven inmediatamente la vista a una criatura que haya sido cegada temporalmente.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("luz-reveladora", "Luz reveladora", "2 táleros", "Dificulta que las criaturas vivas permanezcan ocultas.", "Mientras arde, las criaturas vivas cercanas brillan suavemente. Afecta tanto a enemigos como al usuario y sus aliados."),
    elixir("pan-viaje", "Pan de viaje", "1 tálero", "Alimenta a una persona durante una semana.", "Una hogaza basta para mantener alimentada a una persona durante siete días.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE], { qualities: ["Alquímico", "Viaje"] }),
    elixir("pintura-guerra", "Pintura de guerra", "2 táleros", "Mejora Ágil o Fuerte durante una escena.", "Al aplicarla, el guerrero elige obtener +1 a Ágil o +1 a Fuerte durante toda la escena."),
    elixir("polvo-cegador", "Polvo cegador", "1 tálero", "Emite una luz cegadora al ser arrojado.", "Este polvo se emplea mediante el nivel principiante de la habilidad Pirotecnia."),
    elixir("polvo-espectral", "Polvo espectral", "2 táleros", "Obliga a una criatura incorpórea a materializarse.", "Se arroja con [Diestro←Defensa]. Si impacta, una criatura con Forma espiritual permanece material durante una escena.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("rocio-aturdimiento", "Rocío de aturdimiento", "4 táleros", "Duerme o aturde durante una hora.", "Quien lo ingiere debe superar Fuerte. Si falla queda dormido; si tiene éxito queda aturdido, dispone de una sola acción por turno y no puede usar habilidades activas."),
    elixir("savia-morada", "Savia morada", "Desde 8 táleros", "Elimina corrupción temporal.", "No afecta a la corrupción permanente ni a las marcas de corrupción existentes.", [ADVANCED_ELIXIR_REFERENCE], {
        variants: [
            { id: "weak", label: "Débil", price: "8 táleros", effect: "Elimina 1D4 de corrupción temporal." },
            { id: "moderate", label: "Moderada", price: "12 táleros", effect: "Elimina 1D6 de corrupción temporal." },
            { id: "strong", label: "Potente", price: "No indicado", effect: "Elimina 1D8 de corrupción temporal." }
        ]
    }),
    elixir("tinte-sombra", "Tinte de sombra", "No indicado", "Disimula temporalmente la corrupción total del usuario.", "Durante una escena la sombra aparenta un valor de corrupción total 1D6 puntos inferior al real.", [ADVANCED_ELIXIR_REFERENCE], { tags: ["elixir", "alquimia", "mercado negro", "corrupción"] }),
    elixir("tintura-crepuscular", "Tintura crepuscular", "12 táleros", "Oculta temporalmente señales físicas de muerte viviente.", "Devuelve color, temperatura y aliento aparentes a un cadáver animado. La duración depende de una prueba de [Fuerte-Corrupción permanente]."),
    elixir("tintura-ignea", "Tintura ígnea", "1 tálero", "Cambia el color de una llama.", "Las sales permiten enviar señales de colores a distancia o producir efectos de exhibición."),
    elixir("vela-antidoto", "Vela antídoto", "Desde 6 táleros", "Reduce venenos activos en todas las criaturas cercanas.", "Al arder libera gases que actúan como antídoto, sin recuperar el daño ya sufrido.", [ADVANCED_ELIXIR_REFERENCE], {
        variants: [
            { id: "weak", label: "Débil", price: "6 táleros", effect: "Reduce los venenos un nivel." },
            { id: "moderate", label: "Moderada", price: "9 táleros", effect: "Reduce los venenos dos niveles." }
        ]
    }),
    elixir("vela-fantasmal", "Vela fantasmal", "2 táleros", "Revela objetos y criaturas invisibles.", "Mientras arde, vuelve visibles las cosas invisibles presentes en una habitación o localización.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE]),
    elixir("vela-venenosa", "Vela venenosa", "Desde 8 táleros", "Libera veneno en una habitación después de varios turnos.", "La vela tarda 1D4 turnos en liberar el gas y puede descubrirse mediante [Atento←Discreto del alquimista].", [ADVANCED_ELIXIR_REFERENCE], {
        variants: [
            { id: "weak", label: "Débil", price: "8 táleros", effect: "Inflige 2 de daño por turno." },
            { id: "moderate", label: "Moderada", price: "12 táleros", effect: "Inflige 3 de daño por turno." }
        ]
    }),
    elixir("veneno", "Veneno", "Desde 2 táleros", "Causa daño continuado según su potencia.", "El daño se repite cada turno durante un máximo de tantos turnos como indique el dado de potencia.", [BASIC_ELIXIR_REFERENCE, ADVANCED_ELIXIR_REFERENCE], {
        qualities: ["Alquímico", "Veneno"],
        variants: [
            { id: "weak", label: "Débil", price: "2 táleros", effect: "1D4 de daño durante 1D4 turnos." },
            { id: "moderate", label: "Moderado", price: "4 táleros", effect: "1D6 de daño durante 1D6 turnos." },
            { id: "strong", label: "Potente", price: "6 táleros", effect: "1D8 de daño durante 1D8 turnos." }
        ]
    }),
    elixir("virote-aturdidor", "Virote aturdidor", "1 tálero", "Puede derribar al objetivo de una ballesta.", "Quien sea herido debe superar [Fuerte-Daño] o caer al suelo. Robusto añade +2 a Fuerte por nivel en esta prueba.", [ADVANCED_ELIXIR_REFERENCE], { qualities: ["Alquímico", "Munición"] })
];
function artifact(id, name, price, summary, detail, tier, extra = {}) {
    return {
        id: `equipment-minor-artifact-${id}`,
        group: "minor-artifact",
        name,
        summary,
        detail,
        price,
        category: "artifact",
        stackable: false,
        slot: "artifact",
        qualities: ["Místico"],
        usable: true,
        facts: [{ label: "Nivel", value: tier }],
        references: [MINOR_ARTIFACT_REFERENCE],
        tags: ["artefacto menor", tier.toLowerCase()],
        ...extra
    };
}
const MINOR_ARTIFACT_DEFINITIONS = [
    artifact("anillo-mando", "Anillo de mando", "10 táleros", "Mejora poderes y rituales de dominación mental.", "Otorga +1 a las pruebas de Magia relacionadas con afectar o resistir la voluntad de un objetivo.", "Adepto"),
    artifact("arana-curativa", "Araña curativa", "4 táleros", "Restaura lentamente una herida abierta.", "Cura 1D12 de Robustez durante un día y causa 1 de corrupción temporal. No cura venenos ni heridas internas y puede reutilizarse.", "Principiante"),
    artifact("arma-trascendental", "Arma trascendental", "12 táleros", "Permite atacar a distancia como si fuera cuerpo a cuerpo.", "Solo un místico puede utilizarla. Admite habilidades activas con un nivel menos de su nivel conocido y requiere línea de visión.", "Maestro"),
    artifact("baculo-runico", "Báculo rúnico", "12 táleros", "Canaliza Magia del báculo y protege a su dueño.", "En manos de su propietario proporciona +1D4 de armadura y sirve como canal para sus poderes.", "Maestro"),
    artifact("cabeza-baculo", "Cabeza de báculo", "10 táleros", "Mejora poderes que no emplean el báculo como arma.", "Concede +1 a las tiradas de acción de poderes de Magia del báculo que no involucren el báculo como arma.", "Adepto"),
    artifact("capa-marlit", "Capa de marlit", "4 táleros", "Facilita esconderse y moverse sigilosamente.", "Otorga +1 a Discreto en pruebas para escabullirse o esconderse.", "Adepto", { slot: "worn" }),
    artifact("codice-ritual", "Códice de ritual", "4 táleros", "Permite ejecutar una vez un ritual no aprendido.", "Contiene un ritual que otro sectario puede realizar sin haberlo aprendido. Se consume al utilizarlo.", "Principiante", { stackable: true, slot: "none" }),
    artifact("corona-hierro", "Corona de hierro", "10 táleros", "Potencia magia que rompe o manipula el mundo.", "Concede +1 a pruebas de poderes y rituales demonológicos como Expulsar a los abismos, Teletransportación o Invocar demonio.", "Adepto", { slot: "worn" }),
    artifact("foco-ritual", "Foco de ritual", "8 táleros", "Mejora los rituales de una tradición concreta.", "Otorga +1 a las tiradas de acción de rituales pertenecientes a la tradición para la que fue creado.", "Adepto"),
    artifact("foco-mistico", "Foco místico", "12 táleros", "Mejora una vez por escena un poder de una tradición.", "Concede +1 a una prueba relacionada con poderes de su tradición, una vez por escena. Debe ligarse pagando 1 PX o aceptando 1 corrupción permanente.", "Maestro"),
    artifact("mascara-animal", "Máscara animal", "10 táleros", "Mejora el atributo asociado al animal representado.", "Concede +1 a Discreto, Ágil, Inteligente, Fuerte o Atento, decidido según el animal simbolizado.", "Adepto", { slot: "worn" }),
    artifact("mascara-corteza", "Máscara de corteza", "10 táleros", "Permite repetir pruebas relacionadas con plantas.", "Permite repetir una tirada al activar o resistir poderes vinculados con plantas y crecimiento.", "Adepto", { slot: "worn" }),
    artifact("mascara-muerte", "Máscara de la muerte", "10 táleros", "Mejora poderes y rituales relacionados con vida y muerte.", "Otorga +1 a pruebas de poderes y rituales que actúan sobre el límite entre vivos, muertos y espíritus.", "Adepto", { slot: "worn" }),
    artifact("mascara-peste", "Máscara de la peste", "8 táleros", "Permite resistir enfermedad y veneno con Tenaz.", "El portador puede usar Tenaz en lugar de Fuerte para resistir enfermedades y venenos.", "Principiante", { slot: "worn" }),
    artifact("mascara-solar", "Máscara solar", "No indicado", "Ilumina y potencia efectos sagrados o de expulsión.", "Brilla como una antorcha y concede +1 a las tiradas de efecto de poderes sagrados o de expulsión.", "Adepto", { slot: "worn" }),
    artifact("medallon-ordo", "Medallón de la Ordo", "2 táleros", "Identifica el rango de un miembro de la Ordo Mágica.", "Puede abrir accesos restringidos o activar círculos mágicos según las reglas del capítulo de la Ordo.", "Principiante", { slot: "worn" }),
    artifact("moneda-suerte", "Moneda de la suerte", "8 táleros", "Concede +1 a una tirada por escena con riesgo de mala suerte.", "El bono debe anunciarse antes de tirar. Si el resultado modificado es 20, todas las tiradas del portador tienen una segunda oportunidad de fallar durante el resto de la escena.", "Adepto"),
    artifact("mortaja-funeraria", "Mortaja funeraria", "10 táleros", "Mejora la interacción con espíritus.", "Concede +1 a Tenaz para controlar espíritus o resistir rasgos espirituales que utilicen ese atributo.", "Adepto", { slot: "worn" }),
    artifact("pergamino-hechizo", "Pergamino de hechizo", "Desde 2 táleros", "Contiene un poder místico de un solo uso.", "Puede activarlo quien tenga Magia al nivel requerido o Estudioso a nivel adepto. Causa la corrupción normal y se consume.", "Principiante", {
        stackable: true,
        slot: "none",
        variants: [
            { id: "novice", label: "Principiante", price: "2 táleros" },
            { id: "adept", label: "Adepto", price: "4 táleros" },
            { id: "master", label: "Maestro", price: "6 táleros" }
        ]
    }),
    artifact("pie-baculo", "Pie de báculo", "10 táleros", "Mejora ataques y poderes que utilizan el báculo como arma.", "Concede +1 a las tiradas de efecto de ataques y poderes canalizados mediante el báculo.", "Adepto"),
    artifact("piedra-encuentro", "Piedra de encuentro", "2 táleros", "Transmite intuitivamente un lugar de reunión.", "Un místico invitado que toque la piedra sabe dónde le espera su dueño.", "Principiante"),
    artifact("piedra-espiritu", "Piedra de espíritu", "12 táleros", "Componente necesario para el ritual Piedra de espíritu.", "Este artefacto es el objeto requerido para realizar el ritual del mismo nombre.", "Maestro"),
    artifact("piedra-ignicion", "Piedra de ignición", "10 táleros", "Aumenta los dados de efecto de poderes de fuego.", "Los poderes con efectos de fuego ganan +1 al dado de efecto mientras la piedra se sostiene en la mano o en un báculo.", "Adepto"),
    artifact("prisma-mental", "Prisma mental", "10 táleros", "Mejora la creación de ilusiones.", "Concede +1 a todas las tiradas relacionadas con crear ilusiones.", "Adepto"),
    artifact("sapo-guardian", "Sapo guardián", "1 tálero", "Actúa como alarma ante una condición física cercana.", "Un místico susurra una condición; si sucede cerca, la figurita despierta a todos con un fuerte croar.", "Principiante"),
    artifact("sello-ritual", "Sello de ritual", "12 táleros", "Activa un ritual cuando se rompe.", "El creador debe disponer del ritual o trabajar junto a alguien que lo conozca. Quien rompe el sello sufre la corrupción correspondiente y el sello se consume.", "Maestro", { stackable: true, slot: "none" }),
    artifact("sello-mistico", "Sello místico", "Desde 8 táleros", "Activa un poder místico al romperse.", "Quien rompe el sello activa el poder contenido, sufre la corrupción habitual y consume el objeto.", "Adepto", {
        stackable: true,
        slot: "none",
        variants: [
            { id: "novice", label: "Principiante", price: "8 táleros" },
            { id: "adept", label: "Adepto", price: "12 táleros" }
        ]
    }),
    artifact("trenza-bruja", "Trenza de bruja", "No indicado", "Mejora las tiradas de muerte.", "Concede +1 a Fuerte durante las tiradas de muerte; los personajes no jugadores también pueden beneficiarse de ella.", "Adepto", { slot: "worn" })
];
const TRAP_DEFINITIONS = [
    {
        id: "equipment-trap-alchemical-mine",
        group: "trap",
        name: "Mina alquímica",
        summary: "Explota y deja sustancias inflamables ardiendo sobre el objetivo.",
        detail: "Requiere Trampero o Pirotecnia. Apagar las llamas exige una acción de combate y [Ágil←Inteligente] contra el fabricante, o sumergirse en agua.",
        category: "gear",
        stackable: true,
        slot: "none",
        qualities: ["Herramienta", "Alquímico"],
        usable: true,
        variants: [
            { id: "weak", label: "Débil", price: "2 táleros", effect: "Explosión 1D8; después 1D4 de daño durante 1D4 turnos." },
            { id: "moderate", label: "Moderada", price: "4 táleros", effect: "Explosión 1D10; después 1D6 de daño durante 1D6 turnos." },
            { id: "strong", label: "Potente", price: "8 táleros", effect: "Explosión 1D12; después 1D8 de daño durante 1D8 turnos." }
        ],
        references: [TRAP_REFERENCE],
        tags: ["trampa", "mina", "fuego"]
    },
    {
        id: "equipment-trap-mechanical",
        group: "trap",
        name: "Trampa mecánica",
        summary: "Mecanismo dentado que hiere y retiene a la víctima.",
        detail: "Liberarse requiere una acción de combate y [Fuerte←Inteligente] contra el creador de la trampa.",
        category: "gear",
        stackable: true,
        slot: "none",
        qualities: ["Herramienta"],
        usable: true,
        variants: [
            { id: "weak", label: "Débil", price: "1 tálero", effect: "Inflige 1D8 de daño." },
            { id: "moderate", label: "Moderada", price: "2 táleros", effect: "Inflige 1D10 de daño." },
            { id: "strong", label: "Potente", price: "3 táleros", effect: "Inflige 1D12 de daño." }
        ],
        references: [TRAP_REFERENCE],
        tags: ["trampa", "mecánica"]
    }
];
function tool(id, name, summary, detail, extra = {}) {
    return {
        id: `equipment-tool-${id}`,
        group: "tool",
        name,
        summary,
        detail,
        price: "10 táleros",
        category: "gear",
        slot: "none",
        qualities: ["Herramienta"],
        references: [TOOL_REFERENCE],
        tags: ["herramienta", "equipo de oficio"],
        ...extra
    };
}
const ADVANCED_TOOL_DEFINITIONS = [
    tool("cheating-kit", "Aperos de tramposo", "Bonifican las tiradas relacionadas con apuestas amañadas.", "Dados trucados, cartas marcadas y piezas manipuladas conceden +1 a las tiradas de acción al hacer trampas en apuestas."),
    tool("bestiary", "Bestiario", "Ayuda a identificar y combatir criaturas.", "Concede +1 a las tiradas de acción con Versado en criaturas."),
    tool("field-library", "Biblioteca de campo", "Colección portátil para consultas académicas.", "Concede +1 a todas las tiradas de acción con Estudioso."),
    tool("artifact-catalog", "Catálogo de artefactos", "Referencia especializada para artesanos de artefactos.", "Concede +1 a las tiradas de acción con Elaboración de artefactos."),
    tool("climbing-kit", "Equipo de escalada", "Facilita ascensos en terrenos difíciles.", "La versión profesional descrita en la Guía Avanzada concede +1 a todas las tiradas de acción para escalar.", { references: [BASIC_EQUIPMENT_REFERENCE, TOOL_REFERENCE] }),
    tool("field-forge", "Fragua de campo", "Taller portátil para trabajos de herrería.", "Concede +1 a las tiradas de acción con Herrero."),
    tool("cartography-tools", "Herramientas de cartografía", "Permiten dibujar mapas precisos.", "Conceden +1 a las tiradas de acción para elaborar mapas precisos."),
    tool("excavation-tools", "Herramientas de excavación", "Ayudan a localizar tesoros entre ruinas.", "Conceden +1 a las tiradas para encontrar tesoros en ruinas."),
    tool("field-surgery", "Instrumental de cirugía de campo", "Equipo médico para tratar heridas y enfermedades.", "Concede +1 a todas las tiradas de acción con Medicus."),
    tool("field-laboratory", "Laboratorio de campo", "Instrumental portátil para preparar compuestos.", "Concede +1 a todas las tiradas de acción con Alquimista."),
    tool("trap-manual", "Manual de trampas", "Referencia para diseñar y reconocer trampas.", "Concede +1 a todas las tiradas de acción con Trampero."),
    tool("poison-manual", "Manual de venenos", "Referencia para preparar y utilizar toxinas.", "Concede +1 a todas las tiradas de acción con Venenos."),
    tool("forgery-kit", "Material de falsificación", "Permite crear documentos falsos convincentes.", "Concede +1 a las tiradas de acción para engañar mediante documentación falsificada."),
    tool("disguise-kit", "Material para disfraces", "Permite alterar el aspecto del usuario.", "Concede +1 a las tiradas de acción para engañar mediante un disfraz.")
];
const BASIC_EQUIPMENT_ROWS = [
    ["lamp-oil", "Aceite para linterna", "1 orteg"], ["needle-thread", "Aguja e hilo", "1 orteg", "tool"],
    ["torch", "Antorcha", "1 orteg"], ["hook-line", "Anzuelo y sedal", "3 ortegs", "tool"],
    ["harpoon", "Arpeo", "1 tálero", "tool"], ["brass-bell", "Campanilla de latón", "6 chelines"],
    ["spyglass", "Catalejo", "10 táleros", "tool"], ["snare", "Cepo", "3 chelines", "tool"],
    ["drawing-wax", "Ceras para dibujar", "1 orteg", "tool"], ["signal-horn", "Cuerno de llamada", "4 ortegs"],
    ["drinking-horn", "Cuerno para beber", "2 ortegs", "container"], ["adventurer-kit", "Equipo de aventurero", "5 chelines"],
    ["rope", "Cuerda", "1 chelín"], ["firewood", "Leña", "2 ortegs"], ["waterskin", "Odre", "3 chelines", "container"],
    ["bedroll", "Saco de dormir", "5 ortegs"], ["frying-pan", "Sartén", "1 orteg", "tool"],
    ["flint-steel", "Yesca y pedernal", "2 ortegs", "tool"], ["ladder", "Escalera", "7 ortegs", "tool"],
    ["rope-ladder", "Escalera de cuerda", "3 chelines", "tool"], ["pocket-mirror", "Espejo de bolsillo", "7 táleros"],
    ["lockpicks", "Ganzúas", "1 tálero", "tool"], ["soap", "Jabón", "5 ortegs"], ["metal-jug", "Jarra de metal", "1 orteg", "container"],
    ["lantern", "Linterna", "4 ortegs"], ["blanket", "Manta", "2 ortegs"], ["paper", "Papel", "3 ortegs"],
    ["parchment", "Pergamino", "2 ortegs"], ["whetstone", "Piedra de afilar", "4 ortegs", "tool"],
    ["quill-ink", "Pluma y tinta", "1 chelín", "tool"], ["snowshoes", "Raquetas de nieve", "5 chelines", "tool"],
    ["fishing-net", "Red de pesca", "1 chelín", "tool"], ["hourglass", "Reloj de arena", "4 táleros", "tool"],
    ["whistle", "Silbato", "2 chelines"], ["tent", "Tienda", "3 chelines"], ["bear-trap", "Trampa para osos", "5 chelines", "tool"],
    ["weapon-maintenance", "Utensilios para mantenimiento de armas", "5 chelines", "tool"], ["wax-candle", "Vela de cera", "4 ortegs"],
    ["bandages", "Vendas", "5 ortegs"],
    ["saddlebag", "Alforja", "1 chelín", "container"], ["barrel", "Barril", "4 ortegs", "container"],
    ["coin-purse", "Bolsa para monedas", "3 ortegs", "container"], ["decorated-box", "Caja decorada", "2-5 táleros", "container"],
    ["quiver", "Carcaj", "1 chelín", "container"], ["basket", "Cesta", "2 ortegs", "container"],
    ["belt-pouch", "Cinturón bolsa", "5 ortegs", "container"], ["small-chest", "Cofre pequeño", "3 chelines", "container"],
    ["large-chest", "Cofre grande", "1 tálero", "container"], ["clay-jug", "Jarra de arcilla", "5 ortegs", "container"],
    ["backpack", "Mochila", "1 tálero", "container"], ["glass-vial", "Vial de cristal", "1 chelín", "container"],
    ["sack", "Saco", "2 ortegs", "container"],
    ["chain", "Cadena", "1 tálero", "tool"], ["scythe", "Guadaña", "1 tálero", "tool"],
    ["artisan-tools", "Herramientas de artesano", "1 tálero", "tool"], ["hammer", "Martillo", "1 tálero", "tool"],
    ["mallet", "Mazo", "1 tálero", "tool"], ["shovel", "Pala", "3 chelines", "tool"], ["mining-pick", "Pico de minería", "5 chelines", "tool"],
    ["arrows", "10 flechas", "1 tálero", "ammo"], ["bolts", "10 virotes", "1 tálero", "ammo"]
];
const BASIC_EQUIPMENT_DEFINITIONS = BASIC_EQUIPMENT_ROWS.map(([id, name, price, kind]) => ({
    id: `equipment-${kind === "tool" ? "tool" : "gear"}-${id}`,
    group: kind === "tool" ? "tool" : "equipment",
    name,
    summary: kind === "container"
        ? "Receptáculo para transportar o proteger pertenencias."
        : kind === "ammo"
            ? "Munición común para armas a distancia."
            : kind === "tool"
                ? "Herramienta o utensilio de uso práctico."
                : "Equipo habitual para viaje, exploración o vida de campaña.",
    detail: kind === "container"
        ? `${name} se utiliza para guardar o transportar objetos.`
        : kind === "ammo"
            ? `${name} forman un lote de munición con el precio indicado.`
            : `Objeto de equipo común con un valor de ${price}.`,
    price,
    category: kind === "ammo" || ["lamp-oil", "torch", "firewood", "paper", "parchment", "wax-candle", "bandages"].includes(id) ? "consumable" : "gear",
    stackable: kind === "ammo" || ["lamp-oil", "torch", "firewood", "paper", "parchment", "wax-candle", "bandages"].includes(id),
    slot: ["bedroll", "blanket", "snowshoes", "belt-pouch"].includes(id) ? "worn" : "none",
    qualities: kind === "container" ? ["Contenedor"] : kind === "ammo" ? ["Munición"] : kind === "tool" ? ["Herramienta"] : ["Viaje"],
    defaultQuantity: kind === "ammo" ? 10 : 1,
    references: [kind === "tool" && ["chain", "scythe", "artisan-tools", "hammer", "mallet", "shovel", "mining-pick"].includes(id) ? BASIC_TOOL_REFERENCE : BASIC_EQUIPMENT_REFERENCE],
    tags: [kind ?? "equipo", "equipo básico"]
}));
export const EQUIPMENT_CATALOG_DEFINITIONS = [
    ...ELIXIR_DEFINITIONS,
    ...MINOR_ARTIFACT_DEFINITIONS,
    ...TRAP_DEFINITIONS,
    ...ADVANCED_TOOL_DEFINITIONS,
    ...BASIC_EQUIPMENT_DEFINITIONS
];
export function getEquipmentDefinitionInventoryVariants(definition) {
    if (!definition.variants?.length) {
        return [{
                templateId: definition.id,
                name: definition.name,
                price: definition.price ?? "",
                description: definition.detail
            }];
    }
    return definition.variants.map((variant) => ({
        templateId: `${definition.id}-${variant.id}`,
        name: `${definition.name} (${variant.label.toLocaleLowerCase("es")})`,
        price: variant.price,
        description: [definition.detail, variant.effect].filter(Boolean).join(" "),
        variant
    }));
}
