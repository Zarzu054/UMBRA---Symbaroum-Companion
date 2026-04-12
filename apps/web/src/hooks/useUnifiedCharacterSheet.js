import { useEffect, useMemo, useRef, useState } from "react";
import { parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
const AUTOSAVE_IDLE_MS = 1200;
export function useUnifiedCharacterSheet({ sheet, editable, onSave }) {
    const [draft, setDraft] = useState(() => parseCharacterSheet(sheet));
    const [editMode, setEditMode] = useState(editable);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const autosaveTimerRef = useRef(null);
    const draftRef = useRef(parseCharacterSheet(sheet));
    const isSavingRef = useRef(false);
    const queuedSaveRef = useRef(null);
    const activeSavePromiseRef = useRef(null);
    const lastSavedSnapshotRef = useRef(JSON.stringify(synchronizeCharacterSheet(parseCharacterSheet(sheet))));
    useEffect(() => {
        const parsed = parseCharacterSheet(sheet);
        const incomingNormalized = synchronizeCharacterSheet(parsed);
        const incomingSnapshot = JSON.stringify(incomingNormalized);
        const currentDraftSnapshot = JSON.stringify(synchronizeCharacterSheet(draftRef.current));
        const hasUnsavedLocalChanges = currentDraftSnapshot !== lastSavedSnapshotRef.current;
        if (incomingSnapshot === lastSavedSnapshotRef.current || !hasUnsavedLocalChanges) {
            setDraft(parsed);
            draftRef.current = parsed;
        }
        setEditMode(editable);
    }, [editable, sheet]);
    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);
    async function flushSave(normalized, snapshot) {
        if (!onSave || snapshot === lastSavedSnapshotRef.current) {
            return;
        }
        if (isSavingRef.current) {
            queuedSaveRef.current = { normalized, snapshot };
            return activeSavePromiseRef.current ?? Promise.resolve();
        }
        isSavingRef.current = true;
        setIsSavingLocal(true);
        const savePromise = onSave(normalized)
            .then(() => {
            lastSavedSnapshotRef.current = snapshot;
        })
            .finally(() => {
            isSavingRef.current = false;
            activeSavePromiseRef.current = null;
            const queuedSave = queuedSaveRef.current;
            queuedSaveRef.current = null;
            if (queuedSave && queuedSave.snapshot !== lastSavedSnapshotRef.current) {
                void flushSave(queuedSave.normalized, queuedSave.snapshot);
                return;
            }
            setIsSavingLocal(false);
        });
        activeSavePromiseRef.current = savePromise;
        return savePromise;
    }
    function updateField(path, value) {
        setDraft((current) => {
            const next = structuredClone(current);
            const parts = path.split(".");
            let cursor = next;
            for (let index = 0; index < parts.length - 1; index += 1) {
                cursor = cursor[parts[index]];
            }
            cursor[parts[parts.length - 1]] = value;
            return parseCharacterSheet(next);
        });
    }
    function replaceDraft(next) {
        setDraft(parseCharacterSheet(next));
    }
    async function save() {
        if (!onSave) {
            return;
        }
        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        const normalized = synchronizeCharacterSheet(draftRef.current);
        const snapshot = JSON.stringify(normalized);
        await flushSave(normalized, snapshot);
        setDraft(normalized);
        setEditMode(false);
    }
    const isDirty = useMemo(() => JSON.stringify(synchronizeCharacterSheet(draft)) !== JSON.stringify(synchronizeCharacterSheet(sheet)), [draft, sheet]);
    useEffect(() => {
        if (!onSave || !editable) {
            return;
        }
        const normalizedDraft = synchronizeCharacterSheet(draft);
        const snapshot = JSON.stringify(normalizedDraft);
        if (snapshot === lastSavedSnapshotRef.current) {
            return;
        }
        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
        }
        autosaveTimerRef.current = window.setTimeout(() => {
            autosaveTimerRef.current = null;
            void flushSave(normalizedDraft, snapshot);
        }, AUTOSAVE_IDLE_MS);
        return () => {
            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [draft, editable, onSave]);
    return {
        draft,
        editMode,
        isDirty,
        isSavingLocal,
        setEditMode,
        setDraft: replaceDraft,
        updateField,
        save
    };
}
