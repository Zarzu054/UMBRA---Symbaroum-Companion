import { useEffect, useMemo, useState } from "react";
import {
  averageDiceFormula,
  createEmptyNpcInput,
  createNpcSheetSeed,
  createDefaultMonsterSheet,
  synchronizeCharacterSheet,
  synchronizeMonsterCreationValues,
  type ActorCapabilitySelection,
  type CreateNpcInput,
  type Npc,
  type NpcDepth,
  type UpdateNpcInput
} from "@umbra/shared";
import { createNpc, deleteNpc, fetchNpcs, updateNpc } from "../services/npcService";

function normalizeListValue(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function useNpcController(ensureAccessToken: () => Promise<string>) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateNpcInput>(() => createEmptyNpcInput());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      const nextNpcs = await fetchNpcs(token);
      setNpcs(nextNpcs);
      setSelectedNpcId((current) => current && nextNpcs.some((entry) => entry.id === current) ? current : null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar el archivo de PNJ");
    } finally {
      setIsLoading(false);
    }
  }

  function resetDraft(depth: NpcDepth = "notes"): void {
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

  function selectNpc(npcId: string | null): void {
    setSelectedNpcId(npcId);
  }

  function loadDraftFromNpc(npc: Npc): void {
    const legacyStatBlock = npc.depth === "stat_block" && npc.statBlock ? synchronizeMonsterCreationValues(npc.statBlock) : null;
    const legacyCapabilities: ActorCapabilitySelection[] = legacyStatBlock
      ? legacyStatBlock.traits.map((trait, index) => ({
          catalogId: `legacy-trait-${index}-${trait.toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-")}`,
          name: trait.replace(/\s*\(?(?:i{1,3}|[1-3])\)?\s*$/i, "").trim() || trait,
          kind: "rasgo_monstruoso",
          level: /(?:iii|3)\)?$/i.test(trait) ? "maestro" : /(?:ii|2)\)?$/i.test(trait) ? "adepto" : "novato",
          origin: "legado",
          source: "Bloque rápido original",
          legacyData: trait
        }))
      : [];
    const convertedSheet = legacyStatBlock
      ? synchronizeCharacterSheet({
          ...createNpcSheetSeed(npc),
          resolutionMode: "fixed_average",
          atributos: {
            agil: legacyStatBlock.attributes.quick,
            atento: legacyStatBlock.attributes.vigilant,
            discreto: legacyStatBlock.attributes.discreet,
            diestro: legacyStatBlock.attributes.accurate,
            fuerte: legacyStatBlock.attributes.strong,
            inteligente: legacyStatBlock.attributes.cunning,
            persuasivo: legacyStatBlock.attributes.persuasive,
            tenaz: legacyStatBlock.attributes.resolute
          },
          capabilitySelections: legacyCapabilities,
          rasgos: [...legacyStatBlock.traits],
          combate: {
            ...createNpcSheetSeed(npc).combate,
            defensaBase: legacyStatBlock.defense,
            armadura: "Armadura del bloque rápido",
            armaduraProteccion: legacyStatBlock.armor,
            armaPrincipal: "Ataque del bloque rápido",
            danioPrincipal: legacyStatBlock.damage
          },
          gmBackground: {
            tactics: legacyStatBlock.tactics,
            weakness: legacyStatBlock.weakness,
            loot: legacyStatBlock.loot
          },
          notas: [
            npc.notes,
            "## Respaldo legado del bloque rápido",
            `Ataque: ${legacyStatBlock.attack}`,
            `Daño: ${legacyStatBlock.damage}${averageDiceFormula(legacyStatBlock.damage) != null ? ` (valor medio ${averageDiceFormula(legacyStatBlock.damage)})` : ""}`,
            `Armadura: ${legacyStatBlock.armor}${averageDiceFormula(legacyStatBlock.armor) != null ? ` (valor medio ${averageDiceFormula(legacyStatBlock.armor)})` : ""}`,
            legacyStatBlock.actions.length ? `Acciones no reconocidas (legado): ${legacyStatBlock.actions.join("; ")}` : ""
          ].filter(Boolean).join("\n\n")
        })
      : null;
    setDraft({
      name: npc.name,
      depth: npc.depth === "stat_block" ? "full_sheet" : npc.depth,
      race: npc.race,
      archetype: npc.archetype,
      occupation: npc.occupation,
      faction: npc.faction,
      labels: [...npc.labels],
      summary: npc.summary,
      notes: npc.notes,
      statBlock: legacyStatBlock ? structuredClone(legacyStatBlock) : npc.statBlock ? structuredClone(npc.statBlock) : null,
      sheet: npc.sheet ? structuredClone(npc.sheet) : convertedSheet
    });
    setFormError(null);
  }

  function updateField(field: keyof Omit<CreateNpcInput, "labels" | "statBlock" | "sheet">, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function updateDepth(depth: NpcDepth): void {
    setDraft((current) => ({
      ...current,
      depth,
      statBlock: depth === "notes" ? null : current.statBlock ?? createDefaultMonsterSheet(),
      sheet: depth === "full_sheet" ? current.sheet ?? createNpcSheetSeed(current) : null
    }));
    setFormError(null);
  }

  function updateLabels(value: string): void {
    setDraft((current) => ({
      ...current,
      labels: normalizeListValue(value).slice(0, 20)
    }));
    setFormError(null);
  }

  function updateStatBlockField(
    field: keyof NonNullable<CreateNpcInput["statBlock"]>,
    value: string | number | string[]
  ): void {
    setDraft((current) => ({
      ...current,
      statBlock: {
        ...(current.statBlock ?? createDefaultMonsterSheet()),
        [field]: value
      }
    }));
    setFormError(null);
  }

  function updateStatBlockAttribute(attribute: keyof NonNullable<CreateNpcInput["statBlock"]>["attributes"], value: number): void {
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

  async function saveDraft(): Promise<Npc | null> {
    setIsSaving(true);
    setFormError(null);
    try {
      const token = await ensureAccessToken();
      const synchronizedSheet = draft.depth === "full_sheet" && draft.sheet
        ? synchronizeCharacterSheet({
            ...draft.sheet,
            resolutionMode: "fixed_average",
            identidad: {
              ...draft.sheet.identidad,
              nombrePersonaje: draft.name.trim(),
              raza: draft.race.trim() || "Humano",
              arquetipo: draft.archetype.trim() || "Guerrero",
              profesion: draft.occupation.trim(),
              apariencia: draft.summary.trim(),
              trasfondo: draft.notes.trim()
            }
          })
        : null;
      const payload: UpdateNpcInput = {
        ...draft,
        name: draft.name.trim(),
        race: draft.race.trim(),
        archetype: draft.archetype.trim(),
        occupation: draft.occupation.trim(),
        faction: draft.faction.trim(),
        summary: draft.summary.trim(),
        notes: draft.notes.trim(),
        sheet: synchronizedSheet
      };
      const saved = selectedNpcId
        ? await updateNpc(selectedNpcId, payload, token)
        : await createNpc(payload as CreateNpcInput, token);
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el PNJ");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function removeNpc(npcId: string): Promise<void> {
    setIsSaving(true);
    setLoadError(null);
    try {
      const token = await ensureAccessToken();
      await deleteNpc(npcId, token);
      setNpcs((current) => current.filter((entry) => entry.id !== npcId));
      if (selectedNpcId === npcId) {
        setSelectedNpcId(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo eliminar el PNJ");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedNpc = useMemo(
    () => npcs.find((entry) => entry.id === selectedNpcId) ?? null,
    [npcs, selectedNpcId]
  );

  return useMemo(
    () => ({
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
    }),
    [npcs, selectedNpcId, selectedNpc, draft, isLoading, isSaving, loadError, formError]
  );
}
