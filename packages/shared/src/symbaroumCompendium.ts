export type SymbaroumCapabilityType = "habilidad" | "poder_mistico" | "ritual";

export type SymbaroumCapability = {
  id: string;
  nombre: string;
  tipo: SymbaroumCapabilityType;
  tradiciones: string[];
  libro: string;
  pagina: number;
  efectoResumen: string;
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

function normalizeSummaryMap(summaries: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(summaries).map(([name, summary]) => [slugify(name), summary])
  );
}

const NORMALIZED_ABILITY_SUMMARIES = normalizeSummaryMap(ABILITY_SUMMARIES);
const NORMALIZED_MYSTIC_POWER_SUMMARIES = normalizeSummaryMap(MYSTIC_POWER_SUMMARIES);

function makeCapability(
  tipo: SymbaroumCapabilityType,
  nombre: string,
  libro: string,
  pagina: number,
  tradiciones: string[] = [],
  efectoResumen?: string
): SymbaroumCapability {
  const normalizedName = slugify(nombre);
  const generatedSummary =
    tipo === "habilidad" && NORMALIZED_ABILITY_SUMMARIES[normalizedName]
      ? `${NORMALIZED_ABILITY_SUMMARIES[normalizedName]} Ref: ${libro}, p.${pagina}.`
      : tipo === "poder_mistico" && NORMALIZED_MYSTIC_POWER_SUMMARIES[normalizedName]
        ? `${NORMALIZED_MYSTIC_POWER_SUMMARIES[normalizedName]} Ref: ${libro}, p.${pagina}.`
      : undefined;

  return {
    id: `${tipo}-${slugify(nombre)}`,
    nombre,
    tipo,
    tradiciones,
    libro,
    pagina,
    efectoResumen:
      efectoResumen ?? generatedSummary ?? `Consulta ${libro}, p.${pagina} para el efecto completo por niveles (novato/adepto/maestro).`
  };
}

const LIBRO_BASICO = "Libro Básico";
const GUIA_AVANZADA = "Guía Avanzada del Jugador";

export const SYMBAROUM_ABILITIES: SymbaroumCapability[] = [
  makeCapability("habilidad", "Acróbata", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Alquimista", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Arco veloz", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Armas a dos manos", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Armas de asta", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Armas de presa", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Ataque con dos armas", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Ataque traicionero", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Atributo excepcional", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Berserker", LIBRO_BASICO, 114),
  makeCapability("habilidad", "Brujería", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Canalización", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Canto Troll", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Capa danzante", GUIA_AVANZADA, 64),
  makeCapability("habilidad", "Combate con arma larga", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Combate con armadura", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Combate con armas de cadena", GUIA_AVANZADA, 65),
  makeCapability("habilidad", "Combate con escudo", LIBRO_BASICO, 115),
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
  makeCapability("habilidad", "Finta", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Golpe bajo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Golpe de hierro", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Guardaespaldas", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Hechicería", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Herrero", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Inquebrantable", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Instinto de cazador", GUIA_AVANZADA, 67),
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
  makeCapability("habilidad", "Poder místico", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Puño de flecha", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Recuperación", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Reflejos rápidos", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Rituales", LIBRO_BASICO, 115),
  makeCapability("habilidad", "Sexto sentido", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Simbolismo", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Táctico", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Talento místico superior", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Tatuaje rúnico", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Teúrgia", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Tirador", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Trampero", GUIA_AVANZADA, 67),
  makeCapability("habilidad", "Venenos", LIBRO_BASICO, 113),
  makeCapability("habilidad", "Versado en criaturas", LIBRO_BASICO, 116),
  makeCapability("habilidad", "Viento de acero", LIBRO_BASICO, 116)
];

export const SYMBAROUM_MYSTIC_POWERS: SymbaroumCapability[] = [
  makeCapability("poder_mistico", "Aliento negro", GUIA_AVANZADA, 80, ["Hechicería"]),
  makeCapability("poder_mistico", "Anatema", GUIA_AVANZADA, 81, ["Magia", "Magia del báculo", "Teúrgia"]),
  makeCapability("poder_mistico", "Arma danzante", GUIA_AVANZADA, 80, ["Magia del báculo", "Canto Troll"]),
  makeCapability("poder_mistico", "Aura impía", GUIA_AVANZADA, 81, ["Hechicería"]),
  makeCapability("poder_mistico", "Aura sagrada", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Báculo arrojadizo", GUIA_AVANZADA, 80, ["Magia del báculo"]),
  makeCapability("poder_mistico", "Cacería salvaje", GUIA_AVANZADA, 81, ["Nómadas de la sangre"]),
  makeCapability("poder_mistico", "Cambiaformas", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Cascada de azufre", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Confusión", GUIA_AVANZADA, 81, ["Magia", "Canto Troll"]),
  makeCapability("poder_mistico", "Empuje mental", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Enredadera veloz", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Erupción de larvas", GUIA_AVANZADA, 81, ["Brujería", "Hechicería"]),
  makeCapability("poder_mistico", "Escudo bendito", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Esfera de protección", GUIA_AVANZADA, 80, ["Magia del báculo"]),
  makeCapability("poder_mistico", "Espíritu ígneo", GUIA_AVANZADA, 81, ["Piromantes"]),
  makeCapability("poder_mistico", "Espíritus atormentadores", GUIA_AVANZADA, 81, ["Espiritistas", "Nigromantes"]),
  makeCapability("poder_mistico", "Expulsar a los abismos", GUIA_AVANZADA, 81, ["Demonólogos"]),
  makeCapability("poder_mistico", "Forma espiritual", GUIA_AVANZADA, 81, ["Nigromantes"]),
  makeCapability("poder_mistico", "Forma verdadera", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Glifo vampírico", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Golpe espectral", GUIA_AVANZADA, 81, ["Hechicería"]),
  makeCapability("poder_mistico", "Golpe psíquico", GUIA_AVANZADA, 81, ["Mentalistas"]),
  makeCapability("poder_mistico", "Herida compartida", GUIA_AVANZADA, 81, ["Brujería", "Teúrgia"]),
  makeCapability("poder_mistico", "Himno de batalla", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Himno debilitante", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Himno heroico", GUIA_AVANZADA, 81, ["Canto Troll"]),
  makeCapability("poder_mistico", "Imagen especular", GUIA_AVANZADA, 81, ["Ilusionistas"]),
  makeCapability("poder_mistico", "Imperceptible", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Imposición de manos", GUIA_AVANZADA, 81, ["Brujería", "Teúrgia"]),
  makeCapability("poder_mistico", "Levitación", GUIA_AVANZADA, 81, ["Magia", "Teúrgia"]),
  makeCapability("poder_mistico", "Maldición", GUIA_AVANZADA, 81, ["Brujería", "Hechicería"]),
  makeCapability("poder_mistico", "Manantial de vida", GUIA_AVANZADA, 81, ["Confesores"]),
  makeCapability("poder_mistico", "Manto de espinas", GUIA_AVANZADA, 81, ["Tejedoras verdes"]),
  makeCapability("poder_mistico", "Martillo de monstruos", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Modificación ilusoria", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Muro de llamas", GUIA_AVANZADA, 81, ["Magia"]),
  makeCapability("poder_mistico", "Nube de venganza", GUIA_AVANZADA, 81, ["Hechicería", "Canto Troll"]),
  makeCapability("poder_mistico", "Prisma ardiente de Prios", GUIA_AVANZADA, 81, ["Teúrgia"]),
  makeCapability("poder_mistico", "Purgatorio", GUIA_AVANZADA, 81, ["Inquisidores"]),
  makeCapability("poder_mistico", "Rayo negro", GUIA_AVANZADA, 81, ["Hechicería"]),
  makeCapability("poder_mistico", "Refugio terrestre", GUIA_AVANZADA, 81, ["Brujería"]),
  makeCapability("poder_mistico", "Runas de protección", GUIA_AVANZADA, 81, ["Magia del báculo", "Simbolismo"]),
  makeCapability("poder_mistico", "Sello de expulsión", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Símbolo cegador", GUIA_AVANZADA, 81, ["Simbolismo"]),
  makeCapability("poder_mistico", "Someter voluntad", GUIA_AVANZADA, 81, ["Brujería", "Magia", "Hechicería"]),
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
