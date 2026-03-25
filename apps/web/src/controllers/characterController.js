import { useEffect, useMemo, useState } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, SYMBAROUM_ABILITIES, SYMBAROUM_ARCHETYPES, SYMBAROUM_MYSTIC_POWERS, SYMBAROUM_RITUALS, SYMBAROUM_CULTURES, SYMBAROUM_RACES, createCharacterSchema, createEmptyCharacterSheet, parseCharacterSheet, updateCharacterSchema } from "@umbra/shared";
import { createCharacter, deleteCharacter, duplicateCharacter, fetchCharacters, importCharacter, updateCharacter } from "../services/characterService";
import { computeDerivedStats } from "../models/rulesEngine";
import { generateRandomCharacter } from "../models/randomCharacterGenerator";
import { importCharacterSheetPdf } from "../services/characterPdfExport";
const defaultForm = {
    name: "",
    archetype: "Guerrero",
    race: "Humano",
    culture: "Ambriano",
    profession: "",
    level: 1,
    sheet: createEmptyCharacterSheet()
};
export function useCharacterController(ensureAccessToken) {
    const [characters, setCharacters] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [selectedCharacterId, setSelectedCharacterId] = useState(null);
    const [listInput, setListInput] = useState({
        rasgos: "",
        equipo: "",
        contactos: "",
        habilidades: "",
        poderes: "",
        rituales: ""
    });
    const [catalogSelection, setCatalogSelection] = useState({
        habilidadId: SYMBAROUM_ABILITIES[0]?.id ?? "",
        poderId: SYMBAROUM_MYSTIC_POWERS[0]?.id ?? "",
        ritualId: SYMBAROUM_RITUALS[0]?.id ?? ""
    });
    const [rollState, setRollState] = useState({
        mode: "defensa",
        attribute: "agil",
        situationalMod: 0,
        history: []
    });
    const [simulationCharacterId, setSimulationCharacterId] = useState(null);
    useEffect(() => {
        void refresh();
    }, []);
    const isEditing = selectedCharacterId !== null;
    async function refresh() {
        setIsLoading(true);
        setError(null);
        try {
            const token = await ensureAccessToken();
            const list = await fetchCharacters(token);
            setCharacters(list);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar la lista de personajes");
        }
        finally {
            setIsLoading(false);
        }
    }
    function updateTopLevel(field, value) {
        setValidationErrors([]);
        setForm((prev) => ({ ...prev, [field]: value }));
    }
    function safeSheetForEditing(sheet) {
        try {
            return parseCharacterSheet(sheet);
        }
        catch {
            return sheet;
        }
    }
    function updateSheet(path, value) {
        setValidationErrors([]);
        setForm((prev) => {
            const next = structuredClone(prev);
            const parts = path.split(".");
            let cursor = next.sheet;
            for (let i = 0; i < parts.length - 1; i += 1) {
                cursor = cursor[parts[i]];
            }
            cursor[parts[parts.length - 1]] = value;
            return { ...next, sheet: safeSheetForEditing(next.sheet) };
        });
    }
    function addSimpleItem(section) {
        const text = listInput[section].trim();
        if (!text)
            return;
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section] = [...next.sheet[section], text];
            return next;
        });
        setListInput((prev) => ({ ...prev, [section]: "" }));
    }
    function removeSimpleItem(section, index) {
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section] = next.sheet[section].filter((_, i) => i !== index);
            return next;
        });
    }
    function addRatedItem(section, sourceInput) {
        const text = listInput[sourceInput].trim();
        if (!text)
            return;
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section] = [...next.sheet[section], { nombre: text, tipo: "", efecto: "", nivel: "novato", fuente: "", notas: "", acciones: [] }];
            return { ...next, sheet: safeSheetForEditing(next.sheet) };
        });
        setListInput((prev) => ({ ...prev, [sourceInput]: "" }));
    }
    function addCatalogRatedItem(section, entry) {
        if (!entry)
            return;
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section] = [
                ...next.sheet[section],
                {
                    nombre: entry.nombre,
                    tipo: section === "habilidades" ? "Habilidad" : section === "poderesMisticos" ? "Poder místico" : "Ritual",
                    efecto: entry.efectoResumen,
                    nivel: "novato",
                    fuente: entry.libro,
                    pagina: entry.pagina,
                    notas: entry.efectoResumen,
                    acciones: entry.acciones
                }
            ];
            return { ...next, sheet: safeSheetForEditing(next.sheet) };
        });
    }
    function removeRatedItem(section, index) {
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section] = next.sheet[section].filter((_, i) => i !== index);
            return next;
        });
    }
    function updateRatedItem(section, index, field, value) {
        setForm((prev) => {
            const next = structuredClone(prev);
            next.sheet[section][index][field] = value;
            return { ...next, sheet: safeSheetForEditing(next.sheet) };
        });
    }
    function selectCharacter(characterId) {
        const character = characters.find((c) => c.id === characterId);
        if (!character)
            return;
        const parsedSheet = parseCharacterSheet(character.sheet);
        setSelectedCharacterId(character.id);
        setForm({
            name: character.name,
            archetype: character.archetype,
            race: character.race,
            culture: character.culture,
            profession: character.profession,
            level: 1,
            sheet: {
                ...parsedSheet,
                progreso: {
                    ...parsedSheet.progreso,
                    nivel: 1
                }
            }
        });
    }
    function newCharacter() {
        setSelectedCharacterId(null);
        setForm(structuredClone(defaultForm));
    }
    function openCreateModal() {
        newCharacter();
        setIsFormModalOpen(true);
    }
    function openEditModal(characterId) {
        selectCharacter(characterId);
        setIsFormModalOpen(true);
    }
    function closeFormModal() {
        setIsFormModalOpen(false);
    }
    async function submit() {
        setError(null);
        setValidationErrors([]);
        setIsSaving(true);
        try {
            const payload = {
                ...form,
                level: 1,
                name: form.name.trim(),
                archetype: form.sheet.identidad.arquetipo,
                race: form.sheet.identidad.raza,
                culture: form.sheet.identidad.cultura,
                profession: form.sheet.identidad.profesion,
                sheet: {
                    ...form.sheet,
                    progreso: {
                        ...form.sheet.progreso,
                        nivel: 1
                    }
                }
            };
            const validation = selectedCharacterId
                ? updateCharacterSchema.safeParse(payload)
                : createCharacterSchema.safeParse(payload);
            if (!validation.success) {
                setValidationErrors(validation.error.issues.map((issue) => issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
                setError("Hay errores de validacion en la ficha");
                return;
            }
            const token = await ensureAccessToken();
            if (selectedCharacterId) {
                await updateCharacter(selectedCharacterId, payload, token);
            }
            else {
                await createCharacter(payload, token);
            }
            await refresh();
            closeFormModal();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function createRandomCharacter() {
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            await createCharacter(generateRandomCharacter(), token);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo generar personaje aleatorio");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function importFromPdf(file) {
        setError(null);
        setValidationErrors([]);
        setIsSaving(true);
        try {
            const imported = await importCharacterSheetPdf(file);
            const token = await ensureAccessToken();
            const created = await importCharacter(imported, token);
            await refresh();
            setSelectedCharacterId(created.id);
            setForm({
                name: created.name,
                archetype: created.archetype,
                race: created.race,
                culture: created.culture,
                profession: created.profession,
                level: 1,
                sheet: safeSheetForEditing(created.sheet)
            });
            setIsFormModalOpen(false);
        }
        catch (err) {
            console.error("PDF import failed", err);
            setError(err instanceof Error ? err.message : "No se pudo importar la ficha desde PDF");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function duplicateSelected(characterId) {
        const targetId = characterId ?? selectedCharacterId;
        if (!targetId)
            return;
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            const duplicated = await duplicateCharacter(targetId, token);
            const parsedSheet = parseCharacterSheet(duplicated.sheet);
            setSelectedCharacterId(duplicated.id);
            setForm({
                name: duplicated.name,
                archetype: duplicated.archetype,
                race: duplicated.race,
                culture: duplicated.culture,
                profession: duplicated.profession,
                level: 1,
                sheet: {
                    ...parsedSheet,
                    progreso: {
                        ...parsedSheet.progreso,
                        nivel: 1
                    }
                }
            });
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo duplicar el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function deleteSelected(characterId) {
        const targetId = characterId ?? selectedCharacterId;
        if (!targetId)
            return;
        setError(null);
        setIsSaving(true);
        try {
            const token = await ensureAccessToken();
            await deleteCharacter(targetId, token);
            if (targetId === selectedCharacterId) {
                newCharacter();
                closeFormModal();
            }
            if (targetId === simulationCharacterId) {
                setSimulationCharacterId(null);
                clearRollHistory();
            }
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar el personaje");
        }
        finally {
            setIsSaving(false);
        }
    }
    const derived = computeDerivedStats(form.sheet);
    const simulationCharacter = simulationCharacterId ? characters.find((entry) => entry.id === simulationCharacterId) ?? null : null;
    const simulationSheet = simulationCharacter ? parseCharacterSheet(simulationCharacter.sheet) : null;
    const simulationDerived = simulationSheet ? computeDerivedStats(simulationSheet) : null;
    function selectCharacterForSimulation(characterId) {
        setSimulationCharacterId(characterId);
        clearRollHistory();
    }
    function clearSimulationCharacter() {
        setSimulationCharacterId(null);
        clearRollHistory();
    }
    function runTestRoll() {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const situational = Number(rollState.situationalMod || 0);
        const time = new Date().toLocaleTimeString();
        let label = "";
        let target = 0;
        if (!simulationSheet || !simulationDerived)
            return;
        if (rollState.mode === "defensa") {
            label = "Defensa";
            target = simulationDerived.defensaTotal + situational;
        }
        else if (rollState.mode === "iniciativa") {
            label = "Iniciativa";
            target = simulationDerived.iniciativaTotal + situational;
        }
        else {
            label = `Atributo (${ATTRIBUTE_LABELS[rollState.attribute]})`;
            target = simulationSheet.atributos[rollState.attribute] + situational;
        }
        const success = d20 <= target;
        const log = `${time} | ${label}: d20=${d20} vs ${target} ${success ? "✅ éxito" : "❌ fallo"}`;
        setRollState((prev) => ({
            ...prev,
            history: [log, ...prev.history].slice(0, 12)
        }));
    }
    function clearRollHistory() {
        setRollState((prev) => ({ ...prev, history: [] }));
    }
    return useMemo(() => ({
        characters,
        isLoading,
        isSaving,
        isFormModalOpen,
        isEditing,
        error,
        validationErrors,
        form,
        listInput,
        catalogSelection,
        rollState,
        simulationCharacterId,
        simulationCharacter,
        simulationDerived,
        selectedCharacterId,
        races: SYMBAROUM_RACES,
        cultures: SYMBAROUM_CULTURES,
        archetypes: SYMBAROUM_ARCHETYPES,
        catalog: {
            habilidades: SYMBAROUM_ABILITIES,
            poderes: SYMBAROUM_MYSTIC_POWERS,
            rituales: SYMBAROUM_RITUALS
        },
        attributeKeys: ATTRIBUTE_KEYS,
        attributeLabels: ATTRIBUTE_LABELS,
        derived,
        refresh,
        submit,
        importFromPdf,
        createRandomCharacter,
        duplicateSelected,
        deleteSelected,
        newCharacter,
        openCreateModal,
        openEditModal,
        closeFormModal,
        selectCharacter,
        updateTopLevel,
        updateSheet,
        setListInput,
        setCatalogSelection,
        setRollState,
        selectCharacterForSimulation,
        clearSimulationCharacter,
        runTestRoll,
        clearRollHistory,
        addSimpleItem,
        removeSimpleItem,
        addRatedItem,
        addCatalogRatedItem,
        removeRatedItem,
        updateRatedItem
    }), [
        characters,
        isLoading,
        isSaving,
        isFormModalOpen,
        isEditing,
        error,
        validationErrors,
        form,
        listInput,
        catalogSelection,
        rollState,
        simulationCharacterId,
        selectedCharacterId,
        derived
    ]);
}
export function getRoleLabel(role) {
    if (role === "gm")
        return "Director de Juego";
    if (role === "superadmin")
        return "Superadmin";
    return "Jugador";
}
export function cloneSheet(sheet) {
    return parseCharacterSheet(structuredClone(sheet));
}
