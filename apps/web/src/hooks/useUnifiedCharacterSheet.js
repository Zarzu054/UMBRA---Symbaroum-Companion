import { useEffect, useMemo, useRef, useState } from "react";
import { parseCharacterSheet, synchronizeCharacterSheet } from "@umbra/shared";
export function useUnifiedCharacterSheet({ sheet, editable, onSave }) {
    const [draft, setDraft] = useState(() => parseCharacterSheet(sheet));
    const [editMode, setEditMode] = useState(editable);
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const autosaveTimerRef = useRef(null);
    const lastSavedSnapshotRef = useRef(JSON.stringify(synchronizeCharacterSheet(parseCharacterSheet(sheet))));
    useEffect(() => {
        const parsed = parseCharacterSheet(sheet);
        setDraft(parsed);
        setEditMode(editable);
        lastSavedSnapshotRef.current = JSON.stringify(synchronizeCharacterSheet(parsed));
    }, [editable, sheet]);
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
        setIsSavingLocal(true);
        try {
            const normalized = synchronizeCharacterSheet(draft);
            await onSave(normalized);
            setDraft(normalized);
            setEditMode(false);
        }
        finally {
            setIsSavingLocal(false);
        }
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
            setIsSavingLocal(true);
            void onSave(normalizedDraft)
                .then(() => {
                lastSavedSnapshotRef.current = snapshot;
            })
                .finally(() => {
                setIsSavingLocal(false);
            });
        }, 350);
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
