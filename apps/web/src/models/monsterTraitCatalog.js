function trait(nombre, fuente, pagina, resumen, introduccion, niveles, tags) {
    return { nombre, fuente, pagina, resumen, introduccion, niveles, tags };
}
function unlevelledTrait(nombre, pagina, resumen, introduccion, tags) {
    return { nombre, fuente: "Códice de monstruos", pagina, resumen, introduccion, tags };
}
/**
 * Catálogo canónico de rasgos de monstruo del Libro Básico (p. 197–200)
 * y del Códice de monstruos (p. 164–171). Los niveles se conservan como
 * reglas independientes para que el compendio y las fichas puedan mostrarlos
 * sin agrupar ni resumir sus diferencias mecánicas.
 */
export const MONSTER_TRAIT_CATALOG = [
    trait("Alado", "Libro Básico", 197, "La criatura posee alas y una capacidad de vuelo cada vez más versátil.", "El rasgo representa alas de ave, insecto u otra naturaleza y las maniobras que la criatura puede realizar con ellas.", {
        I: "Pasiva. Puede volar durante su acción de movimiento y evita los ataques gratuitos al pasar frente a un enemigo.",
        II: "Pasiva. Puede permanecer suspendida en el aire, fuera del alcance de los ataques cuerpo a cuerpo, sin gastar una acción.",
        III: "Pasiva. Puede realizar ataques de barrido: divide su movimiento antes y después del ataque, de modo que golpea cuerpo a cuerpo sin quedar trabada en combate."
    }, ["movilidad", "vuelo"]),
    trait("Arma natural", "Libro Básico", 197, "Garras, colmillos, cuernos o aguijones convierten el cuerpo de la criatura en un arma.", "La habilidad Combate sin armas puede mejorar el Arma natural de una criatura.", {
        I: "Pasiva. Su arma natural inflige 3 puntos de daño en lugar de los 2 habituales de un ataque sin armas.",
        II: "Pasiva. Su arma natural inflige 4 puntos de daño.",
        III: "Pasiva. Su arma natural inflige 5 puntos de daño y obtiene la cualidad Larga, permitiendo un ataque gratuito al inicio del combate contra enemigos sin armas Largas."
    }, ["ataque", "cuerpo a cuerpo"]),
    trait("Ataque ácido", "Libro Básico", 197, "Los ataques naturales están cubiertos de un ácido persistente.", "Si la potencia del ácido supera la armadura del objetivo, causa todo su daño; si no, no causa ninguno. Se elimina gastando una acción y superando Inteligente. Requiere Sangre ácida al mismo nivel o superior.", {
        I: "Reacción. El ácido es débil e inflige 3 puntos de daño durante 3 turnos.",
        II: "Reacción. El ácido es moderadamente fuerte e inflige 4 puntos de daño durante 4 turnos.",
        III: "Reacción. El ácido es potente e inflige 5 puntos de daño durante 5 turnos."
    }, ["ácido", "daño persistente"]),
    trait("Ataque de corrupción", "Libro Básico", 198, "Las armas naturales transmiten Corrupción temporal cuando hieren.", "Solo las criaturas más corruptas pueden transmitir la mancha oscura a través de sus ataques.", {
        I: "Pasiva. Toda víctima que sufra al menos 1 punto de daño de uno de sus ataques recibe además 1D4 de Corrupción temporal.",
        II: "Pasiva. Toda víctima que sufra al menos 1 punto de daño de uno de sus ataques recibe además 1D6 de Corrupción temporal.",
        III: "Pasiva. Toda víctima que sufra al menos 1 punto de daño de uno de sus ataques recibe además 1D8 de Corrupción temporal."
    }, ["corrupción", "abominación"]),
    trait("Daño alternativo", "Libro Básico", 198, "La criatura daña un atributo en lugar de la Resistencia.", "Normalmente afecta a Fuerte o Tenaz; si el perfil no lo indica, lo decide el DJ. El daño penaliza todas las tiradas del atributo, se cura con normalidad y mata si lo reduce a cero. Requiere Forma espiritual.", {
        I: "Pasiva. El arma natural inflige 3 puntos de daño alternativo e ignora armadura.",
        II: "Pasiva. El arma natural inflige 4 puntos de daño alternativo e ignora armadura.",
        III: "Pasiva. El arma natural inflige 5 puntos de daño alternativo e ignora armadura."
    }, ["espíritu", "atributos"]),
    trait("Duro", "Libro Básico", 198, "Piel, escamas o quitina proporcionan armadura natural.", "La armadura natural no es Incómoda y no admite otra protección encima, aunque Combate con armadura sí puede aumentar su valor.", {
        I: "Pasiva. La criatura tiene protección natural 2.",
        II: "Pasiva. La criatura tiene protección natural 3.",
        III: "Pasiva. La criatura tiene protección natural 4."
    }, ["armadura", "durabilidad"]),
    trait("Enjambre", "Libro Básico", 198, "Una mente colectiva se reparte entre numerosos cuerpos.", "El enjambre no queda destruido hasta que se elimina a todos sus integrantes.", {
        I: "Especial. Sufre la mitad del daño de todos los ataques. Si, tras recibir daño, queda a la mitad de su Resistencia, prevalece el instinto individual y huye. Un ataque mental defendido con Tenaz afecta a todos sus integrantes.",
        II: "Especial. Sufre la mitad del daño de todos los ataques. Si un único ataque supera su Umbral de dolor, prevalece el instinto individual y huye. Puede repetir una tirada fallida de Tenaz contra ataques mentales.",
        III: "Especial. Sufre solo una cuarta parte del daño de todos los ataques. La mente colmena decide si huye y puede repetir una tirada fallida de Tenaz contra ataques mentales."
    }, ["grupo", "durabilidad"]),
    trait("Escupitajo venenoso", "Libro Básico", 198, "La criatura proyecta veneno como un ataque a distancia.", "Si impacta, la víctima queda envenenada salvo que supere [Fuerte←Inteligente]. El efecto dura hasta aplicar un antídoto y superar Inteligente. Requiere Venenoso al mismo nivel o superior.", {
        I: "Activa. El veneno es débil e inflige 2 puntos de daño durante 2 turnos.",
        II: "Activa. El veneno es moderado e inflige 3 puntos de daño durante 3 turnos.",
        III: "Activa. El veneno es potente e inflige 4 puntos de daño durante 4 turnos."
    }, ["veneno", "distancia"]),
    trait("Forma corpórea", "Libro Básico", 198, "Un espíritu puede manifestarse físicamente para actuar sobre la materia.", "La criatura domina su Forma espiritual hasta poder adoptar un cuerpo durante periodos cada vez más largos.", {
        I: "Gratuita. Se manifiesta físicamente durante un turno. Puede cruzar agua si basta un movimiento, usar ataques sin armas o armas naturales y recibe cualquier daño que afecte a criaturas físicas.",
        II: "Gratuita. Puede usar las armas y armaduras que portaba al morir y mantener la forma física indefinidamente, aunque no puede cambiar de forma a mitad del turno. Si recupera su forma espectral sobre agua, sale proyectada hacia tierra firme.",
        III: "Especial. Puede interactuar físicamente con sus acciones sin dejar de ser inmaterial ante los demás efectos: ataca como un ser corpóreo y se defiende según Forma espiritual. Puede desplazarse físicamente sin restricciones, incluso viajar en barco."
    }, ["espíritu", "manifestación"]),
    trait("Forma espiritual", "Libro Básico", 199, "La criatura es un espíritu inmaterial difícil de afectar con medios físicos.", "Puede atravesar obstáculos, pero no cruzar masas de agua, ni siquiera por puentes, barcos o el aire. Da acceso a Daño alternativo, Forma corpórea y Terrorífico.", {
        I: "Pasiva. Sufre la mitad del daño de armas. Los poderes místicos, armas mágicas y efectos de armas tratadas con alquimia causan daño completo.",
        II: "Pasiva. Como el nivel I, pero los poderes místicos, armas mágicas y efectos alquímicos también le infligen solo la mitad del daño.",
        III: "Gratuita. Como el nivel II, pero es invulnerable a los efectos de las armas tratadas con alquimia."
    }, ["espíritu", "intangibilidad"]),
    trait("Frío de ultratumba", "Libro Básico", 199, "Un aura helada paraliza a quienes combaten junto a la criatura.", "La criatura proyecta un frío sobrenatural sobre quienes se encuentran a distancia cuerpo a cuerpo.", {
        I: "Gratuita. Los PJ a distancia cuerpo a cuerpo deben superar Tenaz o quedan paralizados. Repiten la tirada cada turno; al superarla actúan normalmente y quedan inmunes durante el resto de la escena.",
        II: "Gratuita. Como el nivel I, pero el frío inflige además 2 puntos de daño que ignoran armadura a las víctimas afectadas.",
        III: "Gratuita. Como el nivel II, pero el frío afecta a quienes fallen una tirada enfrentada de [Tenaz←Tenaz]."
    }, ["aura", "parálisis"]),
    trait("Hipnótico", "Libro Básico", 199, "La mirada o la voz de la criatura anula la voluntad de sus víctimas.", "Las víctimas hipnotizadas son incapaces de actuar hasta que sea demasiado tarde.", {
        I: "Activa. Una víctima debe superar [Tenaz←Tenaz]; si falla, gasta todas las acciones del turno en permanecer inmóvil.",
        II: "Activa. El sonido hipnótico o canto afecta a todas las víctimas, que deben superar [Tenaz←Tenaz] o pierden todas sus acciones permaneciendo inmóviles.",
        III: "Activa. Como el nivel II, pero las víctimas permanecen cautivadas hasta superar [Tenaz←Tenaz]. Cualquier daño rompe el efecto."
    }, ["control", "mente"]),
    trait("Muerto viviente", "Libro Básico", 199, "Un espíritu anima un cadáver que no siente dolor ni sana como un ser vivo.", "El cuerpo carece de Umbral de dolor y el espíritu es expulsado cuando el cadáver queda destruido.", {
        I: "Pasiva. Recibe daño físico normal, pero es inmune a veneno, enfermedad, shock y dolor. No sana naturalmente ni con elixires; la carne o sangre recién obtenidas restauran 2 de Resistencia por cada punto de Resistencia consumido.",
        II: "Pasiva. Como el nivel I, pero recibe la mitad del daño de ataques físicos normales, incluidas armas y daño elemental. Los poderes místicos que ignoran armadura causan daño completo.",
        III: "Pasiva. Como el nivel II, pero también recibe la mitad del daño de efectos místicos y alquímicos. Las armas mágicas y los efectos benditos causan daño completo."
    }, ["muerto viviente", "durabilidad"]),
    trait("Regeneración", "Libro Básico", 199, "La criatura recupera Resistencia automáticamente cada turno.", "Debe tener una debilidad —armas mágicas, fuego o ácido, ataques sagrados o impíos— cuyo daño no puede regenerar, aunque sí puede curarlo por otros medios.", {
        I: "Pasiva. Regenera 2 puntos de Resistencia por turno.",
        II: "Pasiva. Regenera 3 puntos de Resistencia por turno.",
        III: "Pasiva. Regenera 4 puntos de Resistencia por turno."
    }, ["curación", "durabilidad"]),
    trait("Robusto", "Libro Básico", 200, "El gran tamaño absorbe daño, potencia los golpes y penaliza la Defensa.", "La criatura es más grande y fuerte de lo normal y solo puede llevar armadura ligera modificada.", {
        I: "Pasiva. Ignora 2 puntos de daño por golpe además de la armadura. Una vez por turno añade +2 al daño de un ataque cuerpo a cuerpo. Su Defensa usa [Ágil−2] como base.",
        II: "Pasiva. Ignora 3 puntos de daño por golpe además de la armadura. Una vez por turno añade +3 al daño de un ataque cuerpo a cuerpo. Su Defensa usa [Ágil−3] como base.",
        III: "Pasiva. Ignora 4 puntos de daño por golpe además de la armadura. Una vez por turno añade +4 al daño de un ataque cuerpo a cuerpo. Su Defensa usa [Ágil−4] como base."
    }, ["tamaño", "durabilidad"]),
    trait("Sangre ácida", "Libro Básico", 200, "La sangre corrosiva rocía a quien hiere a la criatura cuerpo a cuerpo.", "Quien la hiera en combate cuerpo a cuerpo debe superar Defensa o sufrir el ácido. Se elimina gastando una acción y superando Inteligente para lavarlo.", {
        I: "Reacción. La sangre ácida es débil e inflige 3 puntos de daño durante 3 turnos.",
        II: "Reacción. La sangre ácida es moderadamente fuerte e inflige 4 puntos de daño durante 4 turnos.",
        III: "Reacción. La sangre ácida es potente e inflige 5 puntos de daño durante 5 turnos."
    }, ["ácido", "reacción"]),
    trait("Telaraña", "Libro Básico", 200, "La criatura crea redes resistentes para inmovilizar a sus presas.", "Una víctima atrapada no puede moverse y tira dos veces para realizar cualquier acción; si falla cualquiera de las dos tiradas, la acción fracasa.", {
        I: "Pasiva. Cruzar las hebras exige [Ágil←Inteligente]. Al fallar, la víctima queda atrapada y puede intentar liberarse una vez por turno con [Fuerte←Inteligente].",
        II: "Activa. Además del nivel I, puede lanzar una red. La víctima la esquiva con [Ágil←Diestro]; si queda atrapada, intenta liberarse cada turno con [Fuerte←Inteligente].",
        III: "Activa. La red semiconsciente conserva el efecto pasivo del nivel I y ataca tres veces por turno con los efectos del nivel II."
    }, ["control", "presa"]),
    trait("Terrorífico", "Libro Básico", 200, "La criatura obliga a retroceder o paraliza de miedo a sus víctimas.", "Requiere Forma espiritual. Las víctimas pueden repetir la tirada una vez por turno para librarse del miedo.", {
        I: "Activa. Una víctima debe superar [Tenaz←Tenaz] o gastar sus dos acciones retrocediendo. Si no puede retroceder, se defiende, pero no puede atacar.",
        II: "Activa. El aullido afecta a todas las víctimas cercanas; quienes fallen [Tenaz←Tenaz] gastan sus acciones retrocediendo y, si no pueden, se defienden sin atacar.",
        III: "Gratuita. Como el nivel II, pero quienes no puedan huir quedan encogidos de miedo en el sitio e incapaces de escapar hasta superar la tirada."
    }, ["miedo", "control"]),
    trait("Venenoso", "Libro Básico", 200, "Las armas naturales y ataques sin armas inoculan veneno.", "Cuando el ataque hiere, la víctima evita el veneno con [Fuerte←Inteligente]. El efecto continúa hasta aplicar un antídoto y superar Inteligente.", {
        I: "Pasiva. El veneno es débil e inflige 2 puntos de daño durante 2 turnos.",
        II: "Pasiva. El veneno es moderado e inflige 3 puntos de daño durante 3 turnos.",
        III: "Pasiva. El veneno es potente e inflige 4 puntos de daño durante 4 turnos."
    }, ["veneno", "ataque"]),
    trait("Abrazo aplastante", "Códice de monstruos", 164, "La criatura atrapa y aplasta a quienes hiere con sus armas naturales.", "Tras causar daño con un arma natural, intenta agarrar como reacción. La víctima evita la presa con [Ágil←Diestro] y, si queda atrapada, trata de escapar cada turno con [Fuerte←Fuerte]. Mientras mantiene una presa, la criatura pierde una acción de combate por turno y víctima.", {
        I: "Reacción. La víctima apresada no puede actuar y recibe 2 puntos de daño por turno que ignoran armadura hasta escapar.",
        II: "Reacción. Como el nivel I, pero la presa recibe 3 puntos de daño por turno que ignoran armadura.",
        III: "Reacción. Como el nivel I, pero la presa recibe 4 puntos de daño por turno que ignoran armadura."
    }, ["presa", "arma natural"]),
    trait("Acaparador de corrupción", "Códice de monstruos", 164, "Una criatura consumida almacena corrupción y la gasta para torcer tiradas.", "Puede guardar hasta la mitad de Tenaz, redondeando hacia arriba, y pierde un punto al día. Cada punto gastado como reacción puede forzar que un enemigo repita una tirada para evitar una capacidad, defenderse, atacar o determinar un efecto, quedándose con el peor resultado.", {
        I: "Activa. Drena a una víctima sometida: esta sufre 4 de daño por turno que ignora armadura y la criatura almacena 2 de Corrupción permanente extraída. Puede gastar 1 punto almacenado por turno.",
        II: "Pasiva. Como el nivel I; además, cada herida de sus armas naturales drena 2 de Corrupción permanente. Puede gastar hasta 2 puntos almacenados por turno.",
        III: "Pasiva. Como el nivel II, pero puede gastar cualquier cantidad de corrupción almacenada durante un turno."
    }, ["corrupción", "abominación"]),
    trait("Aliento mortal", "Códice de monstruos", 164, "La criatura exhala fuego, frío, ácido, rayos u otra energía letal.", "Puede combinarse con Daño alternativo, Ataque de corrupción o Venenoso si ese rasgo está al mismo nivel o superior.", {
        I: "Activa. Un objetivo tira [Ágil←Diestro]: si tiene éxito recibe 3 de daño y, si falla, 6.",
        II: "Activa. Como el nivel I; cuando un objetivo falla, el aliento salta a otro objetivo. Continúa encadenándose hasta que uno supere la tirada.",
        III: "Activa. Como el nivel II, pero el aliento continúa tras el primer éxito y solo termina cuando un segundo objetivo supera la tirada."
    }, ["daño", "área"]),
    unlevelledTrait("Anfibio", 164, "La criatura vive y combate con normalidad tanto en el agua como en tierra.", "Respira aire y agua, no sufre penalizadores por combate acuático ni recibe daño por esfuerzo o falta de oxígeno mientras permanece sumergida.", ["movilidad", "agua"]),
    trait("Aparición", "Códice de monstruos", 164, "El espíritu posee cuerpos ajenos y puede saltar a un nuevo huésped al ser derrotado.", "Requiere Forma espiritual I. Exorcismo expulsa a la criatura del huésped.", {
        I: "Reacción. Tras tocar o herir a una víctima, intenta poseerla con [Tenaz←Tenaz]. La víctima repite la tirada tras un día, una semana y un mes; el último fallo vuelve permanente la posesión. No puede obligarla directamente a suicidarse.",
        II: "Reacción. Como el nivel I; al caer a Resistencia 0 puede intentar poseer al enemigo que le dio el golpe final. Si ya está poseído, su cuerpo anterior queda inconsciente y al borde de la muerte durante el resto de la escena.",
        III: "Reacción. Puede usar los efectos de los niveles I y II, pero la posesión lograda es permanente de inmediato hasta que sea exorcizada o abandone voluntariamente el cuerpo."
    }, ["espíritu", "posesión"]),
    trait("Ataque perforante", "Códice de monstruos", 165, "El ataque atraviesa armadura para aplicar veneno, corrupción u otro efecto.", "No causa daño normal. Se compara su valor con la armadura: si la protección es igual o superior, falla; si es menor, se aplica el efecto secundario indicado en el perfil.", {
        I: "Pasiva. El ataque tiene valor perforante 4.",
        II: "Pasiva. El ataque tiene valor perforante 5.",
        III: "Pasiva. El ataque tiene valor perforante 6."
    }, ["armadura", "penetración"]),
    trait("Aura nociva", "Códice de monstruos", 165, "Un aura elemental daña a quienes permanezcan cuerpo a cuerpo con la criatura.", "El aura deja un rastro fácil de seguir. Puede combinarse con Daño alternativo, Ataque de corrupción o Venenoso si el otro rasgo está al mismo nivel o superior.", {
        I: "Pasiva. Todas las criaturas a distancia cuerpo a cuerpo reciben 2 de daño por turno que ignora armadura.",
        II: "Pasiva. Todas las criaturas a distancia cuerpo a cuerpo reciben 3 de daño por turno que ignora armadura.",
        III: "Pasiva. Todas las criaturas a distancia cuerpo a cuerpo reciben 4 de daño por turno que ignora armadura."
    }, ["aura", "daño pasivo"]),
    trait("Caparazón", "Códice de monstruos", 165, "La criatura refuerza su armadura natural protegiéndose con placas o concha.", "Requiere Duro I. Cada nivel permite duplicar la armadura natural en circunstancias más favorables.", {
        I: "Pasiva. Si se encierra en su caparazón, duplica la armadura natural, pero no puede realizar acciones activas durante ese turno.",
        II: "Pasiva. Duplica la armadura natural si durante el turno solo se mueve; también la duplica contra ataques gratuitos provocados al pasar, entrar o salir del cuerpo a cuerpo.",
        III: "Reacción. Ante cada ataque, el atacante debe repetir una tirada exitosa. Si la repetición falla, el ataque impacta igualmente, pero la armadura natural se duplica contra ese golpe."
    }, ["armadura", "defensa"]),
    trait("Compañeros", "Códice de monstruos", 165, "Una criatura poderosa va acompañada por aliados subordinados.", "La criatura principal debe tener desafío Complicado como mínimo. La naturaleza de sus compañeros se decide al crear el perfil.", {
        I: "Pasiva. Está acompañada por una criatura cuyo desafío es dos categorías inferior.",
        II: "Pasiva. Está acompañada por dos criaturas cuyo desafío es dos categorías inferior.",
        III: "Pasiva. Está acompañada por tres criaturas cuyo desafío es dos categorías inferior."
    }, ["grupo", "refuerzos"]),
    trait("Convocante", "Códice de monstruos", 165, "La criatura convoca intrusos demoníacos del Ultramundo.", "Solo está disponible para criaturas consumidas por la corrupción. Los convocados obedecen órdenes audibles y desaparecen al morir la convocante o al terminar la escena.", {
        I: "Activa. Una vez por escena, supera Tenaz para convocar un intruso demoníaco.",
        II: "Reacción. Conserva el uso activo del nivel I y, una vez por turno al ser golpeada por un enemigo, puede superar Tenaz para convocar inmediatamente un intruso junto al atacante.",
        III: "Gratuita. Una vez por turno puede superar Tenaz para convocar un intruso, sustituyendo los usos de niveles inferiores. Si falla, aún conserva el uso activo de una vez por escena del nivel I."
    }, ["demonios", "refuerzos"]),
    trait("Demoledor", "Códice de monstruos", 166, "Los golpes derriban, lanzan por los aires y destrozan fortificaciones.", "Cuando Robusto participa en la tirada enfrentada, tanto atacante como defensor suman +2 a Fuerte por cada nivel que posean.", {
        I: "Reacción. Tras causar daño, puede derribar al objetivo si este falla [Fuerte←Fuerte].",
        II: "Reacción. Como el nivel I; si falla, el objetivo sale despedido 1D6 metros, sufre el daño de caída correspondiente y queda derribado.",
        III: "Pasiva. Sus ataques obtienen la cualidad Demoledora y pueden emplearse eficazmente contra puertas, torres, muros y otras fortificaciones."
    }, ["derribo", "fortificaciones"]),
    trait("Descomunal", "Códice de monstruos", 166, "El tamaño colosal hace a la criatura lenta, devastadora y casi invulnerable.", "Requiere Robusto III.", {
        I: "Pasiva. Atacar consume sus dos acciones, por lo que no puede moverse y atacar. El objetivo tira dos veces la armadura y usa el resultado inferior.",
        II: "Pasiva. Como el nivel I; mientras se mueve no puede reaccionar ni usar Defensa. El objetivo de sus ataques dispone de dos oportunidades para fallar su tirada de Defensa.",
        III: "Pasiva. Como el nivel II; es inmune a armas y proyectiles normales y solo puede recibir daño de poderes o armas místicas."
    }, ["tamaño", "jefe"]),
    trait("Devorador", "Códice de monstruos", 166, "La criatura atrapa, engulle y digiere a sus víctimas.", "Requiere Descomunal I. Puede alojar una víctima, tres con Descomunal II o seis con Descomunal III, y puede escupir una como acción gratuita. Una víctima engullida recibe 2 de daño por turno que ignora armadura.", {
        I: "Activa. Un mordisco que cause daño sujeta a la víctima hasta el siguiente turno. Entonces esta debe superar [Fuerte←Fuerte] o es engullida; mientras está sujeta puede actuar, pero no moverse. Robusto aporta +2 por nivel a ambos lados de la tirada.",
        II: "Activa. Como el nivel I, pero basta con que el mordisco impacte para sujetar a la víctima, aunque no cause daño. El intento de engullir se realiza en el turno siguiente.",
        III: "Reacción. Como el nivel II, pero intenta engullir inmediatamente como parte del ataque inicial."
    }, ["engullir", "mordisco"]),
    unlevelledTrait("Diminuto", 167, "El tamaño insignificante dificulta considerarlo una amenaza prioritaria.", "Mientras haya otros blancos, un enemigo debe superar [Tenaz←Discreto] para atacarlo. No se aplica si es el único objetivo o ya ha herido al atacante, y termina cuando usa una habilidad, poder u otro rasgo que revele claramente el peligro.", ["evasión", "tamaño"]),
    trait("Embestida", "Códice de monstruos", 167, "La criatura arrolla a todo el que se encuentre en su trayectoria.", "Requiere Robusto al mismo nivel. Robusto añade +2 por nivel tanto al daño como a Fuerte para atacante y defensor. Acróbata permite evitarla con [Ágil←Fuerte]; un éxito no detiene la carga.", {
        I: "Movimiento. Quien esté en su trayectoria debe superar [Fuerte←Fuerte] o recibe 2 de daño, modificado normalmente por armadura, y queda derribado. La carga se detiene si alguien resiste con Fuerte.",
        II: "Movimiento. Como el nivel I, pero el daño base es 3.",
        III: "Movimiento. Como el nivel I, pero el daño base es 4."
    }, ["movimiento", "derribo"]),
    unlevelledTrait("Espíritu libre", 167, "La criatura está fuera del conflicto entre Wyrtha, Wielda y Wratha.", "Es inmune a la corrupción y no puede aprender poderes místicos ni rituales. Sí puede utilizar artefactos, y hacerlo no le provoca corrupción.", ["espíritu", "inmunidad"]),
    trait("Garras prensiles", "Códice de monstruos", 167, "Las garras sujetan y arrastran a la presa hacia la criatura.", "Una víctima apresada puede actuar, pero no moverse. En turnos posteriores se resuelve [Fuerte←Fuerte] para arrastrarla o liberarla.", {
        I: "Activa. Realiza dos ataques de garra contra el mismo objetivo. Si ambos impactan, intenta apresarlo con [Fuerte←Fuerte].",
        II: "Activa. Como el nivel I, pero basta con que impacte una de las dos garras para intentar apresar.",
        III: "Activa. Como el nivel II; un impacto y una tirada fallida de [Fuerte←Fuerte] inician el arrastre de inmediato. Si la víctima resiste, sigue apresada y se repite en el turno siguiente; no queda libre hasta que la criatura muera o la suelte."
    }, ["presa", "arrastre"]),
    trait("Infeccioso", "Códice de monstruos", 167, "Las armas naturales de la criatura transmiten enfermedades.", "Toda víctima herida por un arma natural debe superar Fuerte o contrae la enfermedad correspondiente.", {
        I: "Reacción. Transmite una enfermedad débil.",
        II: "Reacción. Transmite una enfermedad moderada.",
        III: "Reacción. Transmite una enfermedad potente."
    }, ["enfermedad", "arma natural"]),
    trait("Infestación", "Códice de monstruos", 167, "La criatura o sus larvas penetran en el cuerpo de la víctima.", "La extracción requiere Medicus y una tirada de Inteligente. Cada intento fallido o invasivo puede herir gravemente a la víctima e ignora armadura.", {
        I: "Reacción. Tras causar daño necesita un turno completo para penetrar. Antes de ello, la víctima o un aliado puede gastar una acción para retirarla, causando 1D8 de daño o 1D4 si supera Inteligente. Una vez dentro, cada intento de extracción causa 1D10.",
        II: "Reacción. Penetra inmediatamente después de causar daño. Cada intento de extracción causa 1D12 de daño que ignora armadura.",
        III: "Reacción. Como el nivel II, pero cada intento de extracción causa 1D20 de daño que ignora armadura."
    }, ["parásito", "larvas"]),
    trait("Invisibilidad", "Códice de monstruos", 168, "La criatura desaparece de la vista, aunque aún deja huellas y ruido.", "No puede ser objetivo directo mientras sea invisible. Puede revelarse con efectos de área, polvo, harina, velas espectrales o Forma verdadera; percibirla exige [Atento←Discreto].", {
        I: "Activa. Se vuelve invisible. Al ser detectada queda parcialmente visible durante el resto de la escena; atacarla exige primero [Atento←Discreto] y después la tirada normal.",
        II: "Activa. Como el nivel I, pero la visibilidad parcial dura un turno; después puede gastar una acción para volver a ser invisible.",
        III: "Gratuita. Es invisible por defecto y no gasta acciones para recuperar el estado. Cuando la revelan, solo queda parcialmente visible durante un turno."
    }, ["sigilo", "detección"]),
    unlevelledTrait("Lengua apresadora", 168, "Una lengua larga muerde, sujeta y arrastra desde lejos.", "Ataca hasta a dos acciones de movimiento de distancia y usa el daño de mordisco. Si la víctima tiene al menos un nivel menos de Robusto, la criatura puede acercarla con [Fuerte←Fuerte]. Puede combinarse con Devorador o Abrazo aplastante.", ["alcance", "arrastre"]),
    trait("Lucha a muerte", "Códice de monstruos", 168, "La criatura realiza un último ataque al morir.", "El efecto se activa como reacción cuando su Resistencia llega a cero.", {
        I: "Reacción. Realiza un ataque gratuito contra un enemigo adyacente.",
        II: "Reacción. Realiza una acción de combate normal contra un enemigo adyacente, pudiendo usar habilidades, poderes o rasgos activos.",
        III: "Reacción. Ataca hasta a cinco enemigos a su alcance, siempre que no necesite moverse."
    }, ["muerte", "reacción"]),
    trait("Metamorfosis", "Códice de monstruos", 168, "La criatura transforma su cuerpo para obtener rasgos adaptativos.", "Puede elegir entre Alado, Aliento mortal, Anfibio, Arma natural, Ataque ácido, Caparazón, Diminuto, Duro, Escupitajo venenoso, Garras prensiles, Lengua apresadora, Robusto, Telaraña, Tunelador y Venenoso. La forma dura hasta cambiarla o sufrir Forma verdadera.", {
        I: "Activa. Obtiene uno de los rasgos permitidos a nivel I.",
        II: "Activa. Obtiene dos rasgos permitidos a nivel I o uno a nivel II.",
        III: "Activa. Obtiene dos rasgos permitidos a nivel II o uno a nivel III."
    }, ["cambiaformas", "adaptación"]),
    trait("Múltiples cabezas", "Códice de monstruos", 168, "Varias cabezas o miembros actúan y reciben daño por separado.", "Cada cabeza dispone de una acción y una reserva de Resistencia propias; es necesario destruirlas todas. El desgaste reduce la eficacia de Duro y Robusto en los niveles superiores.", {
        I: "Pasiva. Tiene dos cabezas y, por tanto, dos acciones independientes.",
        II: "Pasiva. Tiene cuatro cabezas y cuatro acciones independientes. Duro y Robusto se consideran un nivel inferiores.",
        III: "Pasiva. Tiene ocho cabezas y ocho acciones independientes. Duro y Robusto se consideran dos niveles inferiores."
    }, ["multiataque", "hidra"]),
    trait("Muro de raíces", "Códice de monstruos", 169, "La criatura levanta una barrera viva que bloquea y ataca.", "El muro exige dos movimientos para rodearlo o bloquea una abertura. Usa las reglas de edificios con Dureza 10, Rotura 5 y Fortificación 5; dura la escena y, si es destruido, no puede crearse otro hasta el día siguiente.", {
        I: "Activa. Crea o desplaza el muro de raíces. Moverlo requiere otra acción activa.",
        II: "Activa. Como el nivel I; quien se acerque debe superar [Ágil←Diestro] o las ramas le infligen 3 de daño que ignora armadura. Puede evitar el ataque gastando un movimiento adicional.",
        III: "Gratuita. Como el nivel II, pero las ramas infligen 5 de daño. Quien sea herido y falle [Fuerte←Fuerte] queda apresado hasta liberarse, destruir el muro o hacer que la criatura lo mueva."
    }, ["flora", "control de zona"]),
    unlevelledTrait("Observador", 169, "La criatura percibe el entorno en todas direcciones.", "Sus sentidos cubren 360 grados: no puede ser flanqueada y sus enemigos no obtienen ventaja por rodearla.", ["sentidos", "flanqueo"]),
    unlevelledTrait("Poder colectivo", 169, "Un grupo obtiene poderes místicos en función del número de integrantes.", "El colectivo usa un poder por turno además de las acciones individuales, en la iniciativa más alta del grupo. Con 1–3 miembros no tiene poder; con 4–6, uno a Principiante; con 7–10, uno a Adepto; con 11–20, dos a Adepto; y con 21 o más, dos a Maestro. La concentración solo se rompe si pierde tres miembros en el mismo turno.", ["colectivo", "magia"]),
    trait("Recio", "Códice de monstruos", 169, "La criatura posee una reserva de Resistencia extraordinaria.", "El Umbral de dolor sigue siendo Fuerte/2; solo aumenta la Resistencia máxima.", {
        I: "Pasiva. Su Resistencia es Fuerte × 1,5, redondeando hacia arriba.",
        II: "Pasiva. Su Resistencia es Fuerte × 2.",
        III: "Pasiva. Su Resistencia es Fuerte × 3."
    }, ["resistencia", "durabilidad"]),
    trait("Resistencia mística", "Códice de monstruos", 169, "La magia tiene dificultades para afectar a la criatura y puede rebotar.", "Se aplica a cualquier poder místico que intente dañarla o afectarla.", {
        I: "Pasiva. El místico tira dos veces y debe obtener éxito en ambas tiradas para afectar a la criatura.",
        II: "Pasiva. Como el nivel I; si una de las tiradas falla, el poder se redirige a un objetivo visible al azar. El lanzador recibe la Corrupción temporal normal y el efecto reflejado se resuelve como si lo usara la criatura.",
        III: "Pasiva. Como el nivel II, pero la criatura elige el objetivo visible al que se redirige el poder."
    }, ["magia", "resistencia"]),
    trait("Sed de sangre", "Códice de monstruos", 170, "La criatura cautiva, muerde y drena la sangre de una víctima.", "El trance comienza con [Tenaz←Tenaz]. Mientras drena, repite la tirada enfrentada cada turno; herir a la criatura permite romper el efecto con [Tenaz−daño].", {
        I: "Activa. Cautivar y morder consume una acción de combate. La víctima pierde 2 de Resistencia por turno, ignorando armadura.",
        II: "Activa. Como el nivel I, y la criatura recupera tanta Resistencia como drena.",
        III: "Activa. Drena y recupera 3 de Resistencia por turno. La víctima no puede romper el trance por sí misma; otra persona debe herir a la criatura y superar [Tenaz−daño]."
    }, ["hipnosis", "drenaje"]),
    trait("Sensible a la corrupción", "Códice de monstruos", 170, "La criatura percibe brotes de corrupción y puede rastrear su origen.", "La sensibilidad funciona con Atento y mejora con la intensidad del brote.", {
        I: "Reacción. Percibe brotes a unos 500 metros y su dirección. No detecta 1 punto; con 2 tiene −5, con 3 no tiene modificador y con 4 o más obtiene +5.",
        II: "Reacción. Como el nivel I, pero identifica el lugar exacto donde se produjo el brote y percibe su residuo.",
        III: "Reacción. Como el nivel II, y puede seguir durante un día el rastro de la fuente que causó el brote."
    }, ["corrupción", "rastreo"]),
    trait("Sentir vida", "Códice de monstruos", 170, "La criatura detecta seres vivos a través de obstáculos y tierra.", "No detecta muertos vivientes ni espíritus. Una criatura que intente ocultarse debe superar [Discreto←Atento].", {
        I: "Pasiva. Detecta vida tras paredes y puertas sólidas o hasta un metro bajo tierra.",
        II: "Pasiva. Localiza con precisión suficiente para atacar a través de la barrera si posee un medio para atravesarla, como Demoledor, Forma espiritual o Tunelador.",
        III: "Pasiva. Puede dirigir poderes místicos contra seres vivos cercanos detectados como si estuvieran en su línea de visión."
    }, ["sentidos", "rastreo"]),
    trait("Sucesor vengativo", "Códice de monstruos", 170, "Al morir, la criatura deja tras de sí vengadores vinculados a su naturaleza.", "La criatura debe tener desafío Complicado como mínimo. Los sucesores son de la misma clase o una opción coherente y, si son consumidos por la corrupción, el original también debe serlo.", {
        I: "Reacción. Al morir aparece un vengador cuyo desafío es dos categorías inferior.",
        II: "Reacción. Al morir aparecen dos vengadores cuyo desafío es dos categorías inferior.",
        III: "Reacción. Al morir aparecen tres vengadores cuyo desafío es dos categorías inferior."
    }, ["muerte", "refuerzos"]),
    trait("Tunelador", "Códice de monstruos", 171, "La criatura excava, ataca desde el subsuelo y abre sumideros.", "Mientras se desplaza bajo tierra evita los ataques gratuitos al pasar o acercarse.", {
        I: "Pasiva. Se mueve bajo tierra a la mitad de su velocidad normal.",
        II: "Pasiva. Se mueve bajo tierra a velocidad normal y puede dividir el movimiento antes y después de atacar. Contraatacarla exige [Discreto←Atento] o estar protegida por roca, edificio o árbol.",
        III: "Activa. Abre un sumidero bajo hasta cinco objetivos cercanos. Quien falle Ágil cae y provoca un ataque gratuito; salir exige Ágil y una acción de movimiento. Acróbata concede una segunda oportunidad."
    }, ["movilidad", "subsuelo"]),
    trait("Veloz", "Códice de monstruos", 171, "La criatura encadena ataques adicionales a gran velocidad.", "El ataque inicial puede ser cuerpo a cuerpo, a distancia o místico; los ataques adicionales no pueden usar capacidades activas.", {
        I: "Reacción. Cuando impacta con una acción de combate, realiza inmediatamente un ataque cuerpo a cuerpo gratuito, cause o no daño el primero.",
        II: "Reacción. Cuando el ataque inicial causa daño, realiza inmediatamente dos ataques cuerpo a cuerpo gratuitos.",
        III: "Reacción. Cada vez que ataca realiza inmediatamente dos ataques cuerpo a cuerpo gratuitos, aunque el ataque inicial falle."
    }, ["multiataque", "velocidad"]),
    trait("Veneno paralizante", "Códice de monstruos", 171, "Una toxina limita las acciones o paraliza completamente a la víctima.", "Cada ataque que cause daño obliga a tirar Fuerte. El veneno continúa hasta aplicar un antídoto y superar Inteligente.", {
        I: "Pasiva. Con éxito, queda aturdida durante un turno y tira dos veces para acciones y reacciones; con fallo, solo puede usar reacciones y dispone de dos oportunidades de fallarlas.",
        II: "Pasiva. Como el nivel I, pero al fallar solo puede usar reacciones durante 1D4 turnos y dispone de dos oportunidades de fallarlas.",
        III: "Pasiva. La tirada es [Fuerte−5]. Con éxito, solo puede reaccionar durante 1D4 turnos y tira dos veces; con fallo queda totalmente paralizada durante 1D8 turnos."
    }, ["veneno", "control"]),
    unlevelledTrait("Visión nocturna", 171, "La criatura usa ecolocalización y actúa con normalidad en oscuridad total.", "Los pulsos acústicos le permiten percibir objetos, movimiento y seres invisibles sin depender de la vista; la oscuridad no le impone penalizadores mientras conserve este sentido.", ["sentidos", "oscuridad"])
];
export const UNLEVELLED_MONSTER_TRAIT_NAMES = new Set(MONSTER_TRAIT_CATALOG.filter((entry) => !entry.niveles).map((entry) => entry.nombre));
export function formatMonsterTraitDetail(entry) {
    if (!entry.niveles)
        return entry.introduccion;
    return `${entry.introduccion} I: ${entry.niveles.I} II: ${entry.niveles.II} III: ${entry.niveles.III}`;
}
