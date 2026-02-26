import { PDFDocument } from "pdf-lib";
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

  const availableXp = Math.max(0, character.sheet.progreso.experienciaTotal - character.sheet.progreso.experienciaGastada);
  const corruptionTotal = character.sheet.corrupcion.temporal + character.sheet.corrupcion.permanente;

  setText(form, ".Jugador", character.sheet.identidad.nombreJugador);
  setText(form, ".Nombre", character.name);
  setText(form, ".Raza", character.race);
  setText(form, ".Ocupacion", character.profession || character.archetype);
  setText(form, ".Sombra", character.sheet.identidad.sombra);
  setText(form, ".Cita", character.sheet.identidad.cita);
  setText(form, ".Experiencia", String(character.sheet.progreso.experienciaTotal));
  setText(form, ".PorGastar", String(availableXp));
  setText(form, ".UmbralDolor", String(character.sheet.combate.umbralDolor));
  setText(form, ".Resistencia", String(character.sheet.combate.robustezActual));
  setText(form, ".Maximo", String(character.sheet.combate.robustezMax));
  setText(form, ".Corrupcion", String(corruptionTotal));
  setText(form, ".Permanente", String(character.sheet.corrupcion.permanente));
  setText(form, ".UmbralCorrupcion", String(character.sheet.corrupcion.umbral));

  setText(form, ".Agil", String(character.sheet.atributos.agil));
  setText(form, ".Atento", String(character.sheet.atributos.atento));
  setText(form, ".Discreto", String(character.sheet.atributos.discreto));
  setText(form, ".Diestro", String(character.sheet.atributos.diestro));
  setText(form, ".Fuerte", String(character.sheet.atributos.fuerte));
  setText(form, ".Inteligente", String(character.sheet.atributos.inteligente));
  setText(form, ".Persuasivo", String(character.sheet.atributos.persuasivo));
  setText(form, ".Tenaz", String(character.sheet.atributos.tenaz));

  setText(form, ".Defensa1", character.sheet.combate.defensaBase);
  setText(form, ".Defensa2", String(character.sheet.combate.defensaMod));

  setText(form, ".Arma1", character.sheet.combate.armaPrincipal);
  setText(form, ".Daño1", character.sheet.combate.danioPrincipal);
  setText(form, "Cualidad1", character.sheet.combate.armaPrincipalCualidad);
  setText(form, ".Atributo1", character.sheet.combate.armaPrincipalAtributo);
  setText(form, ".Arma2", character.sheet.combate.armaSecundaria);
  setText(form, ".Daño2", character.sheet.combate.danioSecundaria);

  setText(form, ".Armadura1", character.sheet.combate.armadura);
  setText(form, ".Proteccion1", character.sheet.combate.armaduraProteccion);
  setText(form, "Cualidad2", character.sheet.combate.armaduraCualidad);

  setText(form, "Edad", character.sheet.identidad.edad);
  setText(form, ".Apariencia", character.sheet.identidad.apariencia);
  setText(form, ".Trasfondo", character.sheet.identidad.trasfondo);
  setText(form, "Texto2", character.sheet.notas);

  const capabilities = buildCapabilities(character).slice(0, 12);
  capabilities.forEach((item, idx) => {
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    const slot = `${row}${col}`;
    setText(form, `.Nombre${slot}`, item.nombre);
    setText(form, `.Tipo${slot}`, item.tipo);
    setText(form, `.Efecto${slot}`, item.efecto);
    checkLevel(form, row, col, item.nivel);
  });

  const equipment = character.sheet.equipo.slice(0, 21);
  equipment.forEach((entry, idx) => {
    setText(form, `.Equipo${idx + 1}`, entry);
  });

  form.flatten();
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
    tipo: item.tipo || "Poder místico",
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

function checkLevel(form: ReturnType<PDFDocument["getForm"]>, row: number, col: number, level: SkillLevel): void {
  const suffix = level === "novato" ? "1" : level === "adepto" ? "2" : "3";
  const checkboxName = `.P${row}${col}${suffix}`;
  try {
    form.getCheckBox(checkboxName).check();
  } catch {
    // Ignore missing checkbox in template variants.
  }
}

function setText(form: ReturnType<PDFDocument["getForm"]>, fieldName: string, value: string): void {
  try {
    form.getTextField(fieldName).setText(value ?? "");
  } catch {
    // Ignore missing fields in template variants.
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
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "personaje";
}
