import { useEffect, useMemo, useState } from "react";
import {
  createEmptyMonsterInput,
  getMonsterAttributeTotal,
  type AuthUser,
  type Monster,
  type MonsterAttributeKey
} from "@umbra/shared";
import { createMonster, deleteMonster, fetchCustomMonsters, fetchMonsterCodex, updateMonster } from "../services/monsterService";

type MonsterDraft = ReturnType<typeof createEmptyMonsterInput>;
type MonsterDraftField = "name" | "category" | "threat" | "summary" | "source";
type MonsterDraftSheetField =
  | "attack"
  | "damage"
  | "defense"
  | "armor"
  | "toughness"
  | "painThreshold"
  | "movement"
  | "tactics"
  | "weakness"
  | "loot";

function normalizeLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function useMonsterController(user: AuthUser, ensureAccessToken: () => Promise<string>) {
  const [codexMonsters, setCodexMonsters] = useState<Monster[]>([]);
  const [customMonsters, setCustomMonsters] = useState<Monster[]>([]);
  const [selectedCodexId, setSelectedCodexId] = useState<string>("");
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MonsterDraft>(() => createEmptyMonsterInput());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [user.id]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const [codex, custom] = await Promise.all([fetchMonsterCodex(token), fetchCustomMonsters(token)]);
      setCodexMonsters(codex);
      setCustomMonsters(custom);
      setSelectedCodexId((current) => current || codex[0]?.id || "");
      setSelectedCustomId((current) => {
        if (current && custom.some((entry) => entry.id === current)) {
          return current;
        }
        return custom[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el módulo de monstruos");
    } finally {
      setIsLoading(false);
    }
  }

  function resetDraft(): void {
    setDraft(createEmptyMonsterInput());
    setError(null);
    setSelectedCustomId(null);
  }

  function selectCustomMonster(monsterId: string): void {
    const target = customMonsters.find((entry) => entry.id === monsterId);
    if (!target) {
      return;
    }

    setSelectedCustomId(monsterId);
    setDraft({
      name: target.name,
      category: target.category,
      threat: target.threat,
      source: target.source,
      summary: target.summary,
      sheet: structuredClone(target.sheet)
    });
    setError(null);
  }

  function updateField(field: MonsterDraftField, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function updateSheetField(field: MonsterDraftSheetField, value: string): void {
    setDraft((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        [field]: value
      }
    }));
    setError(null);
  }

  function updateAttribute(attribute: MonsterAttributeKey, value: number): void {
    setDraft((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        attributes: {
          ...current.sheet.attributes,
          [attribute]: value
        }
      }
    }));
    setError(null);
  }

  function updateListField(field: "traits" | "actions", value: string): void {
    setDraft((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        [field]: normalizeLines(value)
      }
    }));
    setError(null);
  }

  function validateDraft(): string | null {
    if (!draft.name.trim()) {
      return "El monstruo necesita un nombre.";
    }

    if (!draft.summary.trim()) {
      return "Añade un resumen breve para identificar su función en mesa.";
    }

    const total = getMonsterAttributeTotal(draft.sheet);
    if (total <= 0) {
      return "Los atributos del monstruo no parecen válidos.";
    }

    return null;
  }

  async function saveDraft(): Promise<void> {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      ...draft,
      source: "Mis monstruos",
      name: draft.name.trim(),
      summary: draft.summary.trim(),
      sheet: {
        ...draft.sheet,
        tactics: draft.sheet.tactics.trim(),
        weakness: draft.sheet.weakness.trim(),
        loot: draft.sheet.loot.trim()
      }
    };

    setIsSaving(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const saved = selectedCustomId
        ? await updateMonster(selectedCustomId, payload, token)
        : await createMonster(payload, token);
      await refresh();
      setSelectedCustomId(saved.id);
      setDraft({
        name: saved.name,
        category: saved.category,
        threat: saved.threat,
        source: saved.source,
        summary: saved.summary,
        sheet: structuredClone(saved.sheet)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el monstruo");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelected(): Promise<void> {
    if (!selectedCustomId) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      await deleteMonster(selectedCustomId, token);
      await refresh();
      resetDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el monstruo");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCodexMonster = codexMonsters.find((entry) => entry.id === selectedCodexId) ?? codexMonsters[0] ?? null;
  const selectedCustomMonster =
    customMonsters.find((entry) => entry.id === selectedCustomId) ?? (selectedCustomId ? null : null);
  const draftAttributeTotal = getMonsterAttributeTotal(draft.sheet);

  return useMemo(
    () => ({
      codexMonsters,
      customMonsters,
      selectedCodexId,
      selectedCodexMonster,
      selectedCustomId,
      selectedCustomMonster,
      draft,
      draftAttributeTotal,
      error,
      isLoading,
      isSaving,
      refresh,
      setSelectedCodexId,
      selectCustomMonster,
      resetDraft,
      updateField,
      updateSheetField,
      updateAttribute,
      updateListField,
      saveDraft,
      deleteSelected
    }),
    [
      codexMonsters,
      customMonsters,
      selectedCodexId,
      selectedCodexMonster,
      selectedCustomId,
      selectedCustomMonster,
      draft,
      draftAttributeTotal,
      error,
      isLoading,
      isSaving
    ]
  );
}
