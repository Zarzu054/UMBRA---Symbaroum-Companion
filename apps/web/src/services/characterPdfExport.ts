import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Character, SkillLevel } from "@umbra/shared";

const TEMPLATE_PATH = "/templates/symbaroum-sheet.pdf";

type CapabilityItem = {
  nombre: string;
  tipo: string;
  efecto: string;
  nivel: SkillLevel;
};

export async function exportCharacterSheetPdf(character: Character): Promise<void> {
  const bytes = await fetchTemplate();
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let writtenFields = 0;

  const availableXp = Math.max(0, character.sheet.progreso.experienciaTotal - character.sheet.progreso.experienciaGastada);
  const corruptionTotal = character.sheet.corrupcion.temporal + character.sheet.corrupcion.permanente;

  writtenFields += setText(form, ".Jugador", character.sheet.identidad.nombreJugador);
  writtenFields += setText(form, ".Nombre", character.name);
  writtenFields += setText(form, ".Raza", character.race);
  writtenFields += setText(form, ".Ocupacion", character.profession || character.archetype);
  writtenFields += setText(form, ".Sombra", character.sheet.identidad.sombra);
  writtenFields += setText(form, ".Cita", character.sheet.identidad.cita);
  writtenFields += setText(form, ".Experiencia", String(character.sheet.progreso.experienciaTotal));
  writtenFields += setText(form, ".PorGastar", String(availableXp));
  writtenFields += setText(form, ".UmbralDolor", String(character.sheet.combate.umbralDolor));
  writtenFields += setText(form, ".Resistencia", String(character.sheet.combate.robustezActual));
  writtenFields += setText(form, ".Maximo", String(character.sheet.combate.robustezMax));
  writtenFields += setText(form, ".Corrupcion", String(corruptionTotal));
  writtenFields += setText(form, ".Permanente", String(character.sheet.corrupcion.permanente));
  writtenFields += setText(form, ".UmbralCorrupcion", String(character.sheet.corrupcion.umbral));

  writtenFields += setText(form, ".Agil", String(character.sheet.atributos.agil));
  writtenFields += setText(form, ".Atento", String(character.sheet.atributos.atento));
  writtenFields += setText(form, ".Discreto", String(character.sheet.atributos.discreto));
  writtenFields += setText(form, ".Diestro", String(character.sheet.atributos.diestro));
  writtenFields += setText(form, ".Fuerte", String(character.sheet.atributos.fuerte));
  writtenFields += setText(form, ".Inteligente", String(character.sheet.atributos.inteligente));
  writtenFields += setText(form, ".Persuasivo", String(character.sheet.atributos.persuasivo));
  writtenFields += setText(form, ".Tenaz", String(character.sheet.atributos.tenaz));

  writtenFields += setText(form, ".Defensa1", character.sheet.combate.defensaBase);
  writtenFields += setText(form, ".Defensa2", String(character.sheet.combate.defensaMod));

  writtenFields += setText(form, ".Arma1", character.sheet.combate.armaPrincipal);
  writtenFields += setText(form, ".Daño1", character.sheet.combate.danioPrincipal);
  writtenFields += setText(form, "Cualidad1", character.sheet.combate.armaPrincipalCualidad);
  writtenFields += setText(form, ".Atributo1", character.sheet.combate.armaPrincipalAtributo);
  writtenFields += setText(form, ".Arma2", character.sheet.combate.armaSecundaria);
  writtenFields += setText(form, ".Daño2", character.sheet.combate.danioSecundaria);

  writtenFields += setText(form, ".Armadura1", character.sheet.combate.armadura);
  writtenFields += setText(form, ".Proteccion1", character.sheet.combate.armaduraProteccion);
  writtenFields += setText(form, "Cualidad2", character.sheet.combate.armaduraCualidad);

  writtenFields += setText(form, "Edad", character.sheet.identidad.edad);
  writtenFields += setText(form, ".Apariencia", character.sheet.identidad.apariencia);
  writtenFields += setText(form, ".Trasfondo", character.sheet.identidad.trasfondo);
  writtenFields += setText(form, "Texto2", character.sheet.notas);

  const capabilities = buildCapabilities(character).slice(0, 12);
  capabilities.forEach((item, idx) => {
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    const slot = `${row}${col}`;
    writtenFields += setText(form, `.Nombre${slot}`, item.nombre);
    writtenFields += setText(form, `.Tipo${slot}`, item.tipo);
    writtenFields += setText(form, `.Efecto${slot}`, item.efecto);
    writtenFields += checkLevel(form, row, col, item.nivel);
  });

  const equipment = character.sheet.equipo.slice(0, 21);
  equipment.forEach((entry, idx) => {
    writtenFields += setText(form, `.Equipo${idx + 1}`, entry);
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

function checkLevel(form: ReturnType<PDFDocument["getForm"]>, row: number, col: number, level: SkillLevel): number {
  const suffix = level === "novato" ? "1" : level === "adepto" ? "2" : "3";
  const checkboxName = `.P${row}${col}${suffix}`;
  try {
    form.getCheckBox(checkboxName).check();
    return 1;
  } catch {
    return 0;
  }
}

function setText(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string): number {
  try {
    form.getTextField(fieldName).setText(value ?? "");
    return 1;
  } catch {
    return 0;
  }
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
