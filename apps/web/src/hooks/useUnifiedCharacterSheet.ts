import { useEffect, useMemo, useRef, useState } from "react";
import { parseCharacterSheet, synchronizeCharacterSheet, type CharacterSheet } from "@umbra/shared";

type UseUnifiedCharacterSheetOptions = {
  sheet: CharacterSheet;
  editable: boolean;
  onSave?: (sheet: CharacterSheet) => Promise<void>;
};

export function useUnifiedCharacterSheet({ sheet, editable, onSave }: UseUnifiedCharacterSheetOptions) {
  const [draft, setDraft] = useState<CharacterSheet>(() => parseCharacterSheet(sheet));
  const [editMode, setEditMode] = useState<boolean>(editable);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(synchronizeCharacterSheet(parseCharacterSheet(sheet))));

  useEffect(() => {
    const parsed = parseCharacterSheet(sheet);
    setDraft(parsed);
    setEditMode(editable);
    lastSavedSnapshotRef.current = JSON.stringify(synchronizeCharacterSheet(parsed));
  }, [editable, sheet]);

  function updateField(path: string, value: string | number | boolean): void {
    setDraft((current) => {
      const next = structuredClone(current);
      const parts = path.split(".");
      let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let index = 0; index < parts.length - 1; index += 1) {
        cursor = cursor[parts[index]] as Record<string, unknown>;
      }
      cursor[parts[parts.length - 1]] = value;
      return parseCharacterSheet(next);
    });
  }

  function replaceDraft(next: CharacterSheet): void {
    setDraft(parseCharacterSheet(next));
  }

  async function save(): Promise<void> {
    if (!onSave) {
      return;
    }

    setIsSavingLocal(true);
    try {
      const normalized = synchronizeCharacterSheet(draft);
      await onSave(normalized);
      setDraft(normalized);
      setEditMode(false);
    } finally {
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
