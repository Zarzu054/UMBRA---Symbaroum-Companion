import { useEffect, useMemo, useRef, useState } from "react";
import { parseCharacterSheet, synchronizeCharacterSheet, type CharacterSheet } from "@umbra/shared";

type UseUnifiedCharacterSheetOptions = {
  sheet: CharacterSheet;
  editable: boolean;
  onSave?: (sheet: CharacterSheet) => Promise<void>;
};

const AUTOSAVE_IDLE_MS = 1200;

export function useUnifiedCharacterSheet({ sheet, editable, onSave }: UseUnifiedCharacterSheetOptions) {
  const [draft, setDraft] = useState<CharacterSheet>(() => parseCharacterSheet(sheet));
  const [editMode, setEditMode] = useState<boolean>(editable);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const draftRef = useRef<CharacterSheet>(parseCharacterSheet(sheet));
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<{ normalized: CharacterSheet; snapshot: string } | null>(null);
  const activeSavePromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(synchronizeCharacterSheet(parseCharacterSheet(sheet))));

  useEffect(() => {
    const parsed = parseCharacterSheet(sheet);
    const incomingNormalized = synchronizeCharacterSheet(parsed);
    const incomingSnapshot = JSON.stringify(incomingNormalized);
    const currentDraftSnapshot = JSON.stringify(synchronizeCharacterSheet(draftRef.current));
    const matchesCurrentDraft = incomingSnapshot === currentDraftSnapshot;
    const matchesLastConfirmedSave = incomingSnapshot === lastSavedSnapshotRef.current;

    if (matchesCurrentDraft || matchesLastConfirmedSave) {
      setDraft(parsed);
      draftRef.current = parsed;
    }

    setEditMode(editable);
  }, [editable, sheet]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  async function flushSave(normalized: CharacterSheet, snapshot: string): Promise<void> {
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
