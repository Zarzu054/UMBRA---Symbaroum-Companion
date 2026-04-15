import { useEffect, useMemo, useState } from "react";
import { createEmptyNpcInput, createNpcSheetSeed, createDefaultMonsterSheet } from "@umbra/shared";
import { createNpc, deleteNpc, fetchNpcs, updateNpc } from "../services/npcService";
function normalizeListValue(value) {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
export function useNpcController(ensureAccessToken) {
    const [npcs, setNpcs] = useState([]);
    const [selectedNpcId, setSelectedNpcId] = useState(null);
    const [draft, setDraft] = useState(() => createEmptyNpcInput());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [formError, setFormError] = useState(null);
    useEffect(() => {
        void refresh();
    }, []);
    async function refresh() {
        setIsLoading(true);
        setLoadError(null);
        try {
            const token = await ensureAccessToken();
            const nextNpcs = await fetchNpcs(token);
            setNpcs(nextNpcs);
            setSelectedNpcId((current) => current && nextNpcs.some((entry) => entry.id === current) ? current : null);
        }
        catch (err) {
            setLoadError(err instanceof Error ? err.message : "No se pudo cargar el archivo de PNJ");
        }
        finally {
            setIsLoading(false);
        }
    }
    function resetDraft(depth = "notes") {
        const nextDraft = createEmptyNpcInput();
        nextDraft.depth = depth;
        if (depth === "stat_block") {
            nextDraft.statBlock = createDefaultMonsterSheet();
        }
        if (depth === "full_sheet") {
            nextDraft.sheet = createNpcSheetSeed(nextDraft);
        }
        setDraft(nextDraft);
        setFormError(null);
    }
    function selectNpc(npcId) {
        setSelectedNpcId(npcId);
    }
    function loadDraftFromNpc(npc) {
        setDraft({
            name: npc.name,
            depth: npc.depth,
            race: npc.race,
            archetype: npc.archetype,
            occupation: npc.occupation,
            faction: npc.faction,
            labels: [...npc.labels],
            summary: npc.summary,
            notes: npc.notes,
            statBlock: npc.statBlock ? structuredClone(npc.statBlock) : null,
            sheet: npc.sheet ? structuredClone(npc.sheet) : null
        });
        setFormError(null);
    }
    function updateField(field, value) {
        setDraft((current) => ({ ...current, [field]: value }));
        setFormError(null);
    }
    function updateDepth(depth) {
        setDraft((current) => ({
            ...current,
            depth,
            statBlock: depth === "notes" ? null : current.statBlock ?? createDefaultMonsterSheet(),
            sheet: depth === "full_sheet" ? current.sheet ?? createNpcSheetSeed(current) : null
        }));
        setFormError(null);
    }
    function updateLabels(value) {
        setDraft((current) => ({
            ...current,
            labels: normalizeListValue(value).slice(0, 20)
        }));
        setFormError(null);
    }
    function updateStatBlockField(field, value) {
        setDraft((current) => ({
            ...current,
            statBlock: {
                ...(current.statBlock ?? createDefaultMonsterSheet()),
                [field]: value
            }
        }));
        setFormError(null);
    }
    function updateStatBlockAttribute(attribute, value) {
        setDraft((current) => ({
            ...current,
            statBlock: {
                ...(current.statBlock ?? createDefaultMonsterSheet()),
                attributes: {
                    ...(current.statBlock?.attributes ?? createDefaultMonsterSheet().attributes),
                    [attribute]: value
                }
            }
        }));
        setFormError(null);
    }
    async function saveDraft() {
        setIsSaving(true);
        setFormError(null);
        try {
            const token = await ensureAccessToken();
            const payload = {
                ...draft,
                name: draft.name.trim(),
                race: draft.race.trim(),
                archetype: draft.archetype.trim(),
                occupation: draft.occupation.trim(),
                faction: draft.faction.trim(),
                summary: draft.summary.trim(),
                notes: draft.notes.trim()
            };
            const saved = selectedNpcId
                ? await updateNpc(selectedNpcId, payload, token)
                : await createNpc(payload, token);
            setNpcs((current) => {
                const index = current.findIndex((entry) => entry.id === saved.id);
                if (index === -1) {
                    return [saved, ...current];
                }
                const next = current.slice();
                next[index] = saved;
                return next;
            });
            setSelectedNpcId(saved.id);
            loadDraftFromNpc(saved);
            return saved;
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : "No se pudo guardar el PNJ");
            return null;
        }
        finally {
            setIsSaving(false);
        }
    }
    async function removeNpc(npcId) {
        setIsSaving(true);
        setLoadError(null);
        try {
            const token = await ensureAccessToken();
            await deleteNpc(npcId, token);
            setNpcs((current) => current.filter((entry) => entry.id !== npcId));
            if (selectedNpcId === npcId) {
                setSelectedNpcId(null);
            }
        }
        catch (err) {
            setLoadError(err instanceof Error ? err.message : "No se pudo eliminar el PNJ");
        }
        finally {
            setIsSaving(false);
        }
    }
    const selectedNpc = useMemo(() => npcs.find((entry) => entry.id === selectedNpcId) ?? null, [npcs, selectedNpcId]);
    return useMemo(() => ({
        npcs,
        selectedNpcId,
        selectedNpc,
        draft,
        isLoading,
        isSaving,
        loadError,
        formError,
        refresh,
        resetDraft,
        selectNpc,
        loadDraftFromNpc,
        updateField,
        updateDepth,
        updateLabels,
        updateStatBlockField,
        updateStatBlockAttribute,
        saveDraft,
        removeNpc,
        setDraft
    }), [npcs, selectedNpcId, selectedNpc, draft, isLoading, isSaving, loadError, formError]);
}
