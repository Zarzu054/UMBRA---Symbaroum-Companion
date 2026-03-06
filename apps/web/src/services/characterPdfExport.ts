import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Character, SkillLevel } from "@umbra/shared";

const TEMPLATE_PATH = "/templates/symbaroum-sheet.pdf";

type CapabilityItem = {
  nombre: string;
  tipo: string;
  efecto: string;
  nivel: SkillLevel;
};

type ContactCard = {
  nombre: string;
  raza: string;
  ocupacion: string;
  jugador: string;
};

type ArtifactCard = {
  nombre: string;
  poderes: string;
  corrupcion: string;
};

export async function exportCharacterSheetPdf(character: Character): Promise<void> {
  const bytes = await fetchTemplate();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fieldNames = new Set(form.getFields().map((field) => field.getName()));
  let writtenFields = 0;

  const availableXp = Math.max(0, character.sheet.progreso.experienciaTotal - character.sheet.progreso.experienciaGastada);
  const corruptionTotal = character.sheet.corrupcion.temporal + character.sheet.corrupcion.permanente;

  writtenFields += setText(form, fieldNames, "Jugador", character.sheet.identidad.nombreJugador);
  writtenFields += setText(form, fieldNames, "Nombre", character.name);
  writtenFields += setText(form, fieldNames, "Raza", character.race);
  writtenFields += setText(form, fieldNames, "Ocupacion", character.profession || character.archetype);
  writtenFields += setText(form, fieldNames, "Sombra", character.sheet.identidad.sombra);
  writtenFields += setText(form, fieldNames, "Cita", character.sheet.identidad.cita);
  writtenFields += setText(form, fieldNames, "Experiencia", String(character.sheet.progreso.experienciaTotal));
  writtenFields += setText(form, fieldNames, "PorGastar", String(availableXp));
  writtenFields += setText(form, fieldNames, "UmbralDolor", String(character.sheet.combate.umbralDolor));
  writtenFields += setText(form, fieldNames, "Resistencia", String(character.sheet.combate.robustezActual));
  writtenFields += setText(form, fieldNames, "Maximo", String(character.sheet.combate.robustezMax));
  writtenFields += setText(form, fieldNames, "Corrupcion", String(corruptionTotal));
  writtenFields += setText(form, fieldNames, "Permanente", String(character.sheet.corrupcion.permanente));
  writtenFields += setText(form, fieldNames, "UmbralCorrupcion", String(character.sheet.corrupcion.umbral));

  writtenFields += setText(form, fieldNames, "Agil", String(character.sheet.atributos.agil));
  writtenFields += setText(form, fieldNames, "Atento", String(character.sheet.atributos.atento));
  writtenFields += setText(form, fieldNames, "Discreto", String(character.sheet.atributos.discreto));
  writtenFields += setText(form, fieldNames, "Diestro", String(character.sheet.atributos.diestro));
  writtenFields += setText(form, fieldNames, "Fuerte", String(character.sheet.atributos.fuerte));
  writtenFields += setText(form, fieldNames, "Inteligente", String(character.sheet.atributos.inteligente));
  writtenFields += setText(form, fieldNames, "Persuasivo", String(character.sheet.atributos.persuasivo));
  writtenFields += setText(form, fieldNames, "Tenaz", String(character.sheet.atributos.tenaz));

  writtenFields += setText(form, fieldNames, "Defensa1", character.sheet.combate.defensaBase);
  writtenFields += setText(form, fieldNames, "Defensa2", String(character.sheet.combate.defensaMod));

  writtenFields += setText(form, fieldNames, "Arma1", character.sheet.combate.armaPrincipal);
  writtenFields += setText(form, fieldNames, "Daño1", character.sheet.combate.danioPrincipal);
  writtenFields += setText(form, fieldNames, "Cualidad1", character.sheet.combate.armaPrincipalCualidad);
  writtenFields += setText(form, fieldNames, "Atributo1", character.sheet.combate.armaPrincipalAtributo);
  writtenFields += setText(form, fieldNames, "Arma2", character.sheet.combate.armaSecundaria);
  writtenFields += setText(form, fieldNames, "Daño2", character.sheet.combate.danioSecundaria);
  writtenFields += setText(form, fieldNames, "Atributo2", character.sheet.combate.armaSecundariaAtributo);
  writtenFields += setText(form, fieldNames, "Arma3", character.sheet.combate.armaTerciaria);
  writtenFields += setText(form, fieldNames, "Daño3", character.sheet.combate.danioTerciaria);
  writtenFields += setText(form, fieldNames, "Cualidad3", character.sheet.combate.armaTerciariaCualidad);
  writtenFields += setText(form, fieldNames, "Atributo3", character.sheet.combate.armaTerciariaAtributo);
  writtenFields += setText(form, fieldNames, "Arma4", character.sheet.combate.armaCuaternaria);
  writtenFields += setText(form, fieldNames, "Daño4", character.sheet.combate.danioCuaternaria);
  writtenFields += setText(form, fieldNames, "Cualidad4", character.sheet.combate.armaCuaternariaCualidad);
  writtenFields += setText(form, fieldNames, "Atributo4", character.sheet.combate.armaCuaternariaAtributo);

  writtenFields += setText(form, fieldNames, "Armadura1", character.sheet.combate.armadura);
  writtenFields += setText(form, fieldNames, "Proteccion1", character.sheet.combate.armaduraProteccion);
  writtenFields += setText(form, fieldNames, "Cualidad2", character.sheet.combate.armaduraCualidad);
  writtenFields += setText(form, fieldNames, "Armadura2", character.sheet.combate.armaduraSecundaria);
  writtenFields += setText(form, fieldNames, "Proteccion2", character.sheet.combate.armaduraSecundariaProteccion);

  writtenFields += setText(form, fieldNames, "Edad", character.sheet.identidad.edad);
  writtenFields += setText(form, fieldNames, "Altura", character.sheet.identidad.altura);
  writtenFields += setText(form, fieldNames, "Peso", character.sheet.identidad.peso);
  writtenFields += setText(form, fieldNames, "Apariencia", character.sheet.identidad.apariencia);
  writtenFields += setText(form, fieldNames, "ObjetivoPersonal", character.sheet.identidad.objetivoPersonal);
  writtenFields += setText(form, fieldNames, "Trasfondo", character.sheet.identidad.trasfondo);
  writtenFields += setText(form, fieldNames, "Texto2", character.sheet.notas);
  writtenFields += setText(form, fieldNames, "Dinero", character.sheet.recursos.dinero);
  writtenFields += setText(form, fieldNames, "OtrosRecursos", character.sheet.recursos.otros);
  writtenFields += setText(form, fieldNames, "NombreGrupo", character.sheet.grupo.nombre);
  writtenFields += setText(form, fieldNames, "ObjetivoGrupo", character.sheet.grupo.objetivo);

  const capabilities = buildCapabilities(character).slice(0, 12);
  capabilities.forEach((item, idx) => {
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    const slot = `${row}${col}`;
    writtenFields += setText(form, fieldNames, `Nombre${slot}`, item.nombre);
    writtenFields += setText(form, fieldNames, `Tipo${slot}`, item.tipo);
    writtenFields += setText(form, fieldNames, `Efecto${slot}`, item.efecto);
    writtenFields += checkLevel(form, fieldNames, row, col, item.nivel);
  });

  const equipment = character.sheet.equipo.slice(0, 21);
  equipment.forEach((entry, idx) => {
    writtenFields += setText(form, fieldNames, `Equipo${idx + 1}`, entry);
  });

  const contacts = buildContactCards(character);
  contacts.forEach((contact, idx) => {
    const slot = idx + 1;
    writtenFields += setText(form, fieldNames, `NombreAmigo${slot}`, contact.nombre);
    writtenFields += setText(form, fieldNames, `RazaAmigo${slot}`, contact.raza);
    writtenFields += setText(form, fieldNames, `OcupacionAmigo${slot}`, contact.ocupacion);
    writtenFields += setText(form, fieldNames, `JugadorAmigo${slot}`, contact.jugador);
  });

  const artifacts = buildArtifactCards(character);
  artifacts.forEach((artifact, idx) => {
    const slot = idx + 1;
    writtenFields += setText(form, fieldNames, `NombreArtefacto${slot}`, artifact.nombre);
    writtenFields += setText(form, fieldNames, `PoderesArtefacto${slot}`, artifact.poderes);
    writtenFields += setText(form, fieldNames, `CorrupcionArtefacto${slot}`, artifact.corrupcion);
  });

  if (writtenFields === 0) {
    throw new Error("No se pudo mapear ningun campo del PDF de plantilla");
  }

  form.updateFieldAppearances(font);
  const output = await pdf.save();
  downloadBytes(output, `${sanitizeFileName(character.name || "personaje")}-symbaroum.pdf`);
}

async function fetchTemplate(): Promise<ArrayBuffer> {
  const response = await fetch(TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error("No se pudo cargar la plantilla PDF de Symbaroum");
  }
  return response.arrayBuffer();
}

function buildCapabilities(character: Character): CapabilityItem[] {
  const fromHabilidades = character.sheet.habilidades.map((item) => ({
    nombre: item.nombre,
    tipo: item.tipo || "Habilidad",
    efecto: item.efecto || item.notas || "",
    nivel: item.nivel
  }));
  const fromPowers = character.sheet.poderesMisticos.map((item) => ({
    nombre: item.nombre,
    tipo: item.tipo || "Poder mistico",
    efecto: item.efecto || item.notas || "",
    nivel: item.nivel
  }));
  const fromRituals = character.sheet.rituales.map((item) => ({
    nombre: item.nombre,
    tipo: item.tipo || "Ritual",
    efecto: item.efecto || item.notas || "",
    nivel: item.nivel
  }));
  return [...fromHabilidades, ...fromPowers, ...fromRituals];
}

function buildContactCards(character: Character): ContactCard[] {
  const structured = character.sheet.contactosHoja.map((entry) => ({
    nombre: entry.nombre,
    raza: entry.raza,
    ocupacion: entry.ocupacion,
    jugador: entry.jugador
  }));

  if (structured.some((entry) => Object.values(entry).some((value) => value.trim().length > 0))) {
    return structured;
  }

  return Array.from({ length: 5 }, (_, idx) => ({
    nombre: character.sheet.contactos[idx] ?? "",
    raza: "",
    ocupacion: "",
    jugador: ""
  }));
}

function buildArtifactCards(character: Character): ArtifactCard[] {
  return character.sheet.artefactos.map((entry) => ({
    nombre: entry.nombre,
    poderes: entry.poderes,
    corrupcion: entry.corrupcion
  }));
}

function checkLevel(
  form: ReturnType<PDFDocument["getForm"]>,
  fieldNames: Set<string>,
  row: number,
  col: number,
  level: SkillLevel
): number {
  const suffix = level === "novato" ? "1" : level === "adepto" ? "2" : "3";
  const checkboxName = resolveFieldName(fieldNames, `P${row}${col}${suffix}`);
  if (!checkboxName) return 0;
  try {
    form.getCheckBox(checkboxName).check();
    return 1;
  } catch {
    return 0;
  }
}

function setText(form: ReturnType<PDFDocument["getForm"]>, fieldNames: Set<string>, baseName: string, value: string): number {
  const fieldName = resolveFieldName(fieldNames, baseName);
  if (!fieldName) return 0;
  try {
    form.getTextField(fieldName).setText(value ?? "");
    return 1;
  } catch {
    return 0;
  }
}

function resolveFieldName(fieldNames: Set<string>, baseName: string): string | null {
  const candidates = [
    baseName,
    `.${baseName}`,
    `undefined.${baseName}`
  ];

  for (const candidate of candidates) {
    if (fieldNames.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const blob = new Blob([copied.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "personaje"
  );
}
