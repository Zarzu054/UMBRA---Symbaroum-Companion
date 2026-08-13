import { PDFDocument, StandardFonts } from "pdf-lib";
import { SYMBAROUM_ABILITIES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, importCharacterSchema, createEmptyCharacterSheet } from "@umbra/shared";
import { ALL_ENTRIES } from "../models/compendiumEntries";
import { getCharacterExperienceSummary } from "../models/characterExperience";
const TEMPLATE_PATH = "/templates/symbaroum-sheet.pdf";
export async function exportCharacterSheetPdf(character) {
    const bytes = await fetchTemplate();
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fieldNames = new Set(form.getFields().map((field) => field.getName()));
    let writtenFields = 0;
    const availableXp = getCharacterExperienceSummary(character.sheet).effectiveAvailable;
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
        throw new Error("No se pudo mapear ningún campo del PDF de plantilla");
    }
    form.updateFieldAppearances(font);
    const output = await pdf.save();
    downloadBytes(output, `${sanitizeFileName(character.name || "personaje")}-symbaroum.pdf`);
}
export async function importCharacterSheetPdf(file) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const fields = new Map(form.getFields().map((field) => [field.getName(), field]));
    if (fields.size === 0) {
        throw new Error("El PDF no contiene campos editables de la plantilla de Symbaroum.");
    }
    const sheet = createEmptyCharacterSheet();
    const name = readText(fields, "Nombre") || "Personaje importado";
    const race = readText(fields, "Raza") || sheet.identidad.raza;
    const profession = readText(fields, "Ocupacion");
    sheet.identidad.nombreJugador = readText(fields, "Jugador");
    sheet.identidad.raza = race;
    sheet.identidad.profesion = profession;
    sheet.identidad.sombra = readText(fields, "Sombra");
    sheet.identidad.cita = readText(fields, "Cita");
    sheet.identidad.edad = readText(fields, "Edad");
    sheet.identidad.altura = readText(fields, "Altura");
    sheet.identidad.peso = readText(fields, "Peso");
    sheet.identidad.apariencia = readText(fields, "Apariencia");
    sheet.identidad.objetivoPersonal = readText(fields, "ObjetivoPersonal");
    sheet.identidad.trasfondo = readText(fields, "Trasfondo");
    const experienciaTotal = readInt(fields, "Experiencia", sheet.progreso.experienciaTotal);
    const experienciaDisponible = readInt(fields, "PorGastar", Math.max(0, experienciaTotal - sheet.progreso.experienciaGastada));
    sheet.progreso.experienciaTotal = experienciaTotal;
    sheet.progreso.experienciaGastada = Math.max(0, experienciaTotal - experienciaDisponible);
    sheet.combate.umbralDolor = readInt(fields, "UmbralDolor", sheet.combate.umbralDolor);
    sheet.combate.robustezActual = readInt(fields, "Resistencia", sheet.combate.robustezActual);
    sheet.combate.robustezMax = readInt(fields, "Maximo", sheet.combate.robustezMax);
    sheet.combate.defensaBase = readText(fields, "Defensa1");
    sheet.combate.defensaMod = readInt(fields, "Defensa2", sheet.combate.defensaMod);
    sheet.corrupcion.permanente = readInt(fields, "Permanente", sheet.corrupcion.permanente);
    sheet.corrupcion.umbral = readInt(fields, "UmbralCorrupcion", sheet.corrupcion.umbral);
    const corruptionTotal = readInt(fields, "Corrupcion", sheet.corrupcion.temporal + sheet.corrupcion.permanente);
    sheet.corrupcion.temporal = Math.max(0, corruptionTotal - sheet.corrupcion.permanente);
    sheet.atributos.agil = readInt(fields, "Agil", sheet.atributos.agil);
    sheet.atributos.atento = readInt(fields, "Atento", sheet.atributos.atento);
    sheet.atributos.discreto = readInt(fields, "Discreto", sheet.atributos.discreto);
    sheet.atributos.diestro = readInt(fields, "Diestro", sheet.atributos.diestro);
    sheet.atributos.fuerte = readInt(fields, "Fuerte", sheet.atributos.fuerte);
    sheet.atributos.inteligente = readInt(fields, "Inteligente", sheet.atributos.inteligente);
    sheet.atributos.persuasivo = readInt(fields, "Persuasivo", sheet.atributos.persuasivo);
    sheet.atributos.tenaz = readInt(fields, "Tenaz", sheet.atributos.tenaz);
    sheet.combate.armaPrincipal = readText(fields, "Arma1");
    sheet.combate.danioPrincipal = readText(fields, "Daño1");
    sheet.combate.armaPrincipalCualidad = readText(fields, "Cualidad1");
    sheet.combate.armaPrincipalAtributo = readText(fields, "Atributo1");
    sheet.combate.armaSecundaria = readText(fields, "Arma2");
    sheet.combate.danioSecundaria = readText(fields, "Daño2");
    sheet.combate.armaSecundariaAtributo = readText(fields, "Atributo2");
    sheet.combate.armaTerciaria = readText(fields, "Arma3");
    sheet.combate.danioTerciaria = readText(fields, "Daño3");
    sheet.combate.armaTerciariaCualidad = readText(fields, "Cualidad3");
    sheet.combate.armaTerciariaAtributo = readText(fields, "Atributo3");
    sheet.combate.armaCuaternaria = readText(fields, "Arma4");
    sheet.combate.danioCuaternaria = readText(fields, "Daño4");
    sheet.combate.armaCuaternariaCualidad = readText(fields, "Cualidad4");
    sheet.combate.armaCuaternariaAtributo = readText(fields, "Atributo4");
    sheet.combate.armadura = readText(fields, "Armadura1");
    sheet.combate.armaduraProteccion = readText(fields, "Proteccion1");
    sheet.combate.armaduraCualidad = readText(fields, "Cualidad2");
    sheet.combate.armaduraSecundaria = readText(fields, "Armadura2");
    sheet.combate.armaduraSecundariaProteccion = readText(fields, "Proteccion2");
    sheet.notas = readText(fields, "Texto2");
    sheet.recursos.dinero = readText(fields, "Dinero");
    sheet.recursos.otros = readText(fields, "OtrosRecursos");
    sheet.grupo.nombre = readText(fields, "NombreGrupo");
    sheet.grupo.objetivo = readText(fields, "ObjetivoGrupo");
    sheet.equipo = Array.from({ length: 21 }, (_, idx) => readText(fields, `Equipo${idx + 1}`)).filter(Boolean);
    sheet.contactosHoja = Array.from({ length: 5 }, (_, idx) => ({
        nombre: readText(fields, `NombreAmigo${idx + 1}`),
        raza: readText(fields, `RazaAmigo${idx + 1}`),
        ocupacion: readText(fields, `OcupacionAmigo${idx + 1}`),
        jugador: readText(fields, `JugadorAmigo${idx + 1}`)
    }));
    sheet.contactos = sheet.contactosHoja.map((entry) => entry.nombre).filter(Boolean);
    sheet.artefactos = Array.from({ length: 4 }, (_, idx) => ({
        nombre: readText(fields, `NombreArtefacto${idx + 1}`),
        poderes: readText(fields, `PoderesArtefacto${idx + 1}`),
        corrupcion: readText(fields, `CorrupcionArtefacto${idx + 1}`)
    }));
    const importedCapabilities = importCapabilities(fields);
    sheet.habilidades = importedCapabilities.habilidades;
    sheet.poderesMisticos = importedCapabilities.poderesMisticos;
    sheet.rituales = importedCapabilities.rituales;
    sheet.bendiciones = importedCapabilities.bendiciones;
    sheet.cargas = importedCapabilities.cargas;
    sheet.rasgos = importedCapabilities.rasgos;
    const inferredArchetype = inferArchetype(sheet, profession);
    sheet.identidad.arquetipo = inferredArchetype;
    const payload = {
        name,
        archetype: inferredArchetype,
        race,
        culture: sheet.identidad.cultura,
        profession,
        level: 1,
        sheet: sanitizeImportSheetForValidation(sheet)
    };
    const validation = importCharacterSchema.safeParse(payload);
    if (!validation.success) {
        throw new Error(`El PDF se ha leído, pero la ficha importada no es válida: ${validation.error.issues
            .map((issue) => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
            .join(" | ")}`);
    }
    return validation.data;
}
async function fetchTemplate() {
    const response = await fetch(TEMPLATE_PATH);
    if (!response.ok) {
        throw new Error("No se pudo cargar la plantilla PDF de Symbaroum");
    }
    return response.arrayBuffer();
}
function buildCapabilities(character) {
    const fromHabilidades = character.sheet.habilidades.map((item) => ({
        nombre: item.nombre,
        tipo: item.tipo || "Habilidad",
        efecto: selectCapabilityLevelEffect(item.efecto || item.notas || "", item.nivel),
        nivel: item.nivel
    }));
    const fromPowers = character.sheet.poderesMisticos.map((item) => ({
        nombre: item.nombre,
        tipo: item.tipo || "Poder místico",
        efecto: selectCapabilityLevelEffect(item.efecto || item.notas || "", item.nivel),
        nivel: item.nivel
    }));
    const fromRituals = character.sheet.rituales.map((item) => ({
        nombre: item.nombre,
        tipo: item.tipo || "Ritual",
        efecto: selectCapabilityLevelEffect(item.efecto || item.notas || "", item.nivel),
        nivel: item.nivel
    }));
    const fromBlessings = (character.sheet.bendiciones ?? []).map((item) => ({
        nombre: item,
        tipo: "Bendición",
        efecto: "",
        nivel: "principiante"
    }));
    const fromBurdens = (character.sheet.cargas ?? []).map((item) => ({
        nombre: item,
        tipo: "Carga",
        efecto: "",
        nivel: "principiante"
    }));
    const fromTraits = (character.sheet.rasgos ?? []).map((item) => ({
        nombre: item,
        tipo: "Rasgo",
        efecto: "",
        nivel: "principiante"
    }));
    return [...fromHabilidades, ...fromPowers, ...fromRituals, ...fromBlessings, ...fromBurdens, ...fromTraits];
}
function selectCapabilityLevelEffect(effect, level) {
    const text = String(effect ?? "").trim();
    if (!text)
        return "";
    const levelHeading = /\b(Principiante|Adepto|Maestro)\s*:/giu;
    const matches = [...text.matchAll(levelHeading)];
    if (matches.length === 0) {
        return text;
    }
    const targetLevel = level === "principiante" ? "principiante" : level.toLocaleLowerCase("es");
    const targetIndex = matches.findIndex((match) => {
        const parsedLevel = match[1]?.toLocaleLowerCase("es");
        return (parsedLevel === "principiante" ? "principiante" : parsedLevel) === targetLevel;
    });
    if (targetIndex < 0) {
        return text;
    }
    const start = matches[targetIndex].index ?? 0;
    const end = matches[targetIndex + 1]?.index ?? text.length;
    return text.slice(start, end).trim();
}
function buildContactCards(character) {
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
function buildArtifactCards(character) {
    return character.sheet.artefactos.map((entry) => ({
        nombre: entry.nombre,
        poderes: entry.poderes,
        corrupcion: entry.corrupcion
    }));
}
function importCapabilities(fields) {
    const abilityCatalog = new Map(SYMBAROUM_ABILITIES.map((entry) => [normalizeCapabilityName(entry.nombre), entry]));
    const powerCatalog = new Map(SYMBAROUM_MYSTIC_POWERS.map((entry) => [normalizeCapabilityName(entry.nombre), entry]));
    const ritualCatalog = new Map(SYMBAROUM_RITUALS.map((entry) => [normalizeCapabilityName(entry.nombre), entry]));
    const traitCatalog = new Map(ALL_ENTRIES
        .filter((entry) => entry.tipo === "rasgo")
        .map((entry) => [normalizeCapabilityName(entry.nombre), entry.nombre]));
    const habilidades = [];
    const poderesMisticos = [];
    const rituales = [];
    const bendiciones = [];
    const cargas = [];
    const rasgos = [];
    for (let row = 1; row <= 4; row += 1) {
        for (let col = 1; col <= 3; col += 1) {
            const slot = `${row}${col}`;
            const nombre = readText(fields, `Nombre${slot}`);
            if (!nombre)
                continue;
            const tipo = readText(fields, `Tipo${slot}`);
            const efecto = readText(fields, `Efecto${slot}`);
            const nivel = readLevel(fields, row, col);
            const normalizedName = normalizeCapabilityName(nombre);
            const explicitType = normalizeCapabilityType(tipo);
            const ability = abilityCatalog.get(normalizedName);
            const power = powerCatalog.get(normalizedName);
            const ritual = ritualCatalog.get(normalizedName);
            const resolvedType = explicitType ??
                (power ? "poder_mistico" : ritual ? "ritual" : "habilidad");
            const fromCatalog = resolvedType === "poder_mistico" ? power : resolvedType === "ritual" ? ritual : ability;
            if (resolvedType === "bendicion") {
                bendiciones.push(nombre);
                continue;
            }
            if (resolvedType === "carga") {
                cargas.push(nombre);
                continue;
            }
            if (resolvedType === "rasgo") {
                rasgos.push(resolveImportedTraitName(nombre, traitCatalog));
                continue;
            }
            const canonicalEffect = truncateImportedCapabilityText(fromCatalog?.efectoResumen || "", 1200);
            const canonicalNotes = truncateImportedCapabilityText(fromCatalog?.efectoResumen || "", 800);
            const importedEffect = truncateImportedCapabilityText(efecto, 1200);
            const importedNotes = truncateImportedCapabilityText(efecto, 800);
            const entry = {
                nombre: fromCatalog?.nombre ?? nombre,
                tipo: resolvedType === "poder_mistico" ? "Poder místico" : resolvedType === "ritual" ? "Ritual" : "Habilidad",
                efecto: canonicalEffect || importedEffect,
                nivel,
                fuente: fromCatalog?.libro ?? "",
                pagina: fromCatalog?.pagina,
                notas: canonicalNotes || importedNotes,
                acciones: fromCatalog?.acciones ?? []
            };
            if (resolvedType === "poder_mistico") {
                poderesMisticos.push(entry);
            }
            else if (resolvedType === "ritual") {
                rituales.push(entry);
            }
            else {
                habilidades.push(entry);
            }
        }
    }
    return { habilidades, poderesMisticos, rituales, bendiciones, cargas, rasgos };
}
function truncateImportedCapabilityText(value, maxLength) {
    const text = String(value ?? "").trim();
    if (!text)
        return "";
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}
function sanitizeImportSheetForValidation(sheet) {
    const sanitizeEntries = (entries) => entries.map((entry) => ({
        ...entry,
        efecto: truncateImportedCapabilityText(entry.efecto ?? "", 1200),
        notas: truncateImportedCapabilityText(entry.notas ?? "", 800)
    }));
    return {
        ...sheet,
        habilidades: sanitizeEntries(sheet.habilidades),
        poderesMisticos: sanitizeEntries(sheet.poderesMisticos),
        rituales: sanitizeEntries(sheet.rituales)
    };
}
function resolveImportedTraitName(rawName, traitCatalog) {
    const trimmedName = String(rawName ?? "").trim();
    if (!trimmedName)
        return "";
    const { baseName, levelSuffix } = splitTraitLevelSuffix(trimmedName);
    const canonicalName = traitCatalog.get(normalizeCapabilityName(baseName)) ?? trimmedName;
    if (!levelSuffix) {
        return canonicalName;
    }
    return `${canonicalName} ${levelSuffix}`;
}
function splitTraitLevelSuffix(value) {
    const match = String(value ?? "").trim().match(/^(.*?)(?:\s*[\(\[]?\s*(I{1,3}|1|2|3)\s*[\)\]]?)$/i);
    if (!match) {
        return { baseName: String(value ?? "").trim(), levelSuffix: "" };
    }
    const baseName = String(match[1] ?? "").trim();
    const rawLevel = normalizeCapabilityName(match[2] ?? "");
    const normalizedLevel = rawLevel === "1" || rawLevel === "i"
        ? "I"
        : rawLevel === "2" || rawLevel === "ii"
            ? "II"
            : rawLevel === "3" || rawLevel === "iii"
                ? "III"
                : "";
    return {
        baseName: baseName || String(value ?? "").trim(),
        levelSuffix: normalizedLevel ? `(${normalizedLevel})` : ""
    };
}
function inferArchetype(sheet, profession) {
    if (sheet.poderesMisticos.length > 0) {
        return "Místico";
    }
    const names = new Set(sheet.habilidades.map((entry) => normalizeCapabilityName(entry.nombre)));
    const normalizedProfession = normalizeCapabilityName(profession);
    if (normalizedProfession.includes("bruja") ||
        normalizedProfession.includes("teurgo") ||
        normalizedProfession.includes("hechicero") ||
        names.has("poder mistico") ||
        names.has("teurgia") ||
        names.has("brujeria") ||
        names.has("hechiceria") ||
        names.has("magia") ||
        names.has("ojo mistico")) {
        return "Místico";
    }
    if (normalizedProfession.includes("arquero") ||
        normalizedProfession.includes("explorador") ||
        names.has("tirador") ||
        names.has("jinete") ||
        names.has("versado en criaturas")) {
        return "Cazador";
    }
    if (normalizedProfession.includes("ladron") ||
        normalizedProfession.includes("espia") ||
        names.has("ataque traicionero") ||
        names.has("finta") ||
        names.has("estrangulador") ||
        names.has("venenos")) {
        return "Maleante";
    }
    return "Guerrero";
}
function readLevel(fields, row, col) {
    if (readChecked(fields, `P${row}${col}3`))
        return "maestro";
    if (readChecked(fields, `P${row}${col}2`))
        return "adepto";
    return "principiante";
}
function normalizeCapabilityType(value) {
    const normalized = normalizeCapabilityName(value);
    if (!normalized)
        return null;
    if (normalized.includes("rasgo"))
        return "rasgo";
    if (normalized.includes("bendicion"))
        return "bendicion";
    if (normalized.includes("carga"))
        return "carga";
    if (normalized.includes("ritual"))
        return "ritual";
    if (normalized.includes("poder"))
        return "poder_mistico";
    if (normalized.includes("habilidad"))
        return "habilidad";
    return null;
}
function normalizeCapabilityName(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function checkLevel(form, fieldNames, row, col, level) {
    const suffix = level === "principiante" ? "1" : level === "adepto" ? "2" : "3";
    const checkboxName = resolveFieldName(fieldNames, `P${row}${col}${suffix}`);
    if (!checkboxName)
        return 0;
    try {
        form.getCheckBox(checkboxName).check();
        return 1;
    }
    catch {
        return 0;
    }
}
function setText(form, fieldNames, baseName, value) {
    const fieldName = resolveFieldName(fieldNames, baseName);
    if (!fieldName)
        return 0;
    try {
        form.getTextField(fieldName).setText(value ?? "");
        return 1;
    }
    catch {
        return 0;
    }
}
function readText(fields, baseName) {
    const fieldName = resolveFieldName(new Set(fields.keys()), baseName);
    if (!fieldName)
        return "";
    try {
        const field = fields.get(fieldName);
        return field?.getText?.().trim() ?? "";
    }
    catch {
        return "";
    }
}
function readChecked(fields, baseName) {
    const fieldName = resolveFieldName(new Set(fields.keys()), baseName);
    if (!fieldName)
        return false;
    try {
        const field = fields.get(fieldName);
        return field?.isChecked?.() ?? false;
    }
    catch {
        return false;
    }
}
function readInt(fields, baseName, fallback) {
    const value = readText(fields, baseName).replace(/[^\d-]/g, "");
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function resolveFieldName(fieldNames, baseName) {
    const candidates = [baseName, `.${baseName}`, `undefined.${baseName}`];
    for (const candidate of candidates) {
        if (fieldNames.has(candidate)) {
            return candidate;
        }
    }
    return null;
}
function downloadBytes(bytes, fileName) {
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
function sanitizeFileName(input) {
    return (input
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "") || "personaje");
}
