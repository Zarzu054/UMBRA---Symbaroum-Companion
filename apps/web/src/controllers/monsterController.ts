import { useEffect, useMemo, useState } from "react";
import {
  createEmptyMonsterInput,
  getMonsterCreationChallenge,
  getMonsterCreationXp,
  getMonsterAttributeTotal,
  removeExceptionalAttributeBonuses,
  synchronizeMonsterCreationValues,
  validateCreationAttributes,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [user.id]);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      const [codex, custom] = await Promise.all([fetchMonsterCodex(token), fetchCustomMonsters(token)]);
      setCodexMonsters(codex);
      setCustomMonsters(custom);
      setSelectedCodexId((current) => current && codex.some((entry) => entry.id === current) ? current : "");
      setSelectedCustomId((current) => {
        if (current && custom.some((entry) => entry.id === current)) {
          return current;
        }
        return null;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar el módulo de monstruos");
    } finally {
      setIsLoading(false);
    }
  }

  function resetDraft(): void {
    setDraft(createEmptyMonsterInput());
    setFormError(null);
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
      sheet: synchronizeMonsterCreationValues(structuredClone(target.sheet))
    });
    setFormError(null);
  }

  function duplicateCodexMonster(monsterId: string): boolean {
    const target = codexMonsters.find((entry) => entry.id === monsterId);
    if (!target) return false;
    const sheet = synchronizeMonsterCreationValues(structuredClone(target.sheet));
    setSelectedCustomId(null);
    setDraft({
      name: target.name,
      category: target.category,
      threat: getMonsterCreationChallenge(sheet),
      source: "Mis monstruos",
      summary: target.summary,
      sheet: {
        ...sheet,
        profileFormat: "custom"
      }
    });
    setFormError(null);
    return true;
  }

  function updateField(field: MonsterDraftField, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function updateSheetField(field: MonsterDraftSheetField, value: string): void {
    setDraft((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        [field]: value
      }
    }));
    setFormError(null);
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
    setFormError(null);
  }

  function updateListField(field: "traits" | "actions", value: string): void {
    setDraft((current) => ({
      ...current,
      sheet: {
        ...current.sheet,
        [field]: normalizeLines(value)
      }
    }));
    setFormError(null);
  }

  function validateDraft(): string | null {
    if (!draft.name.trim()) {
      return "El monstruo necesita un nombre.";
    }

    if (!draft.summary.trim()) {
      return "Añade un resumen breve para identificar su función en mesa.";
    }

    const baseAttributes = removeExceptionalAttributeBonuses(draft.sheet.attributes, draft.sheet.capabilities);
    const attributeValidation = validateCreationAttributes(baseAttributes);
    if (!attributeValidation.valid) {
      return "Los atributos del monstruo no parecen válidos.";
    }

    return null;
  }

  async function saveDraft(): Promise<boolean> {
    const validationError = validateDraft();
    if (validationError) {
      setFormError(validationError);
      return false;
    }

    const synchronizedSheet = synchronizeMonsterCreationValues(draft.sheet);
    const payload = {
      ...draft,
      threat: getMonsterCreationChallenge(synchronizedSheet),
      source: "Mis monstruos",
      name: draft.name.trim(),
      summary: draft.summary.trim(),
      sheet: {
        ...synchronizedSheet,
        tactics: draft.sheet.tactics.trim(),
        weakness: draft.sheet.weakness.trim(),
        loot: draft.sheet.loot.trim()
      }
    };

    setIsSaving(true);
    setFormError(null);
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
      return true;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el monstruo");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelected(monsterId: string | null = selectedCustomId): Promise<void> {
    if (!monsterId) {
      return;
    }

    setIsSaving(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      await deleteMonster(monsterId, token);
      await refresh();
      resetDraft();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo eliminar el monstruo");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedCodexMonster = codexMonsters.find((entry) => entry.id === selectedCodexId) ?? null;
  const selectedCustomMonster =
    customMonsters.find((entry) => entry.id === selectedCustomId) ?? (selectedCustomId ? null : null);
  const draftAttributeTotal = getMonsterAttributeTotal(draft.sheet);
  const draftSpentXp = getMonsterCreationXp(draft.sheet);
  const draftChallenge = getMonsterCreationChallenge(draft.sheet);

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
      draftSpentXp,
      draftChallenge,
      loadError,
      formError,
      isLoading,
      isSaving,
      refresh,
      setSelectedCodexId,
      selectCustomMonster,
      duplicateCodexMonster,
      resetDraft,
      updateField,
      updateSheetField,
      updateAttribute,
      updateListField,
      saveDraft,
      deleteSelected,
      setDraft
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
      draftSpentXp,
      draftChallenge,
      loadError,
      formError,
      isLoading,
      isSaving
    ]
  );
}
