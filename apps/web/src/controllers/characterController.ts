import { useEffect, useMemo, useState } from "react";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  SYMBAROUM_ABILITIES,
  SYMBAROUM_ARCHETYPES,
  SYMBAROUM_MYSTIC_POWERS,
  SYMBAROUM_RITUALS,
  SYMBAROUM_CULTURES,
  SYMBAROUM_RACES,
  createEmptyCharacterSheet,
  parseCharacterSheet,
  type Character,
  type CharacterSheet,
  type SymbaroumCapability,
  type CreateCharacterInput
} from "@umbra/shared";
import { createCharacter, fetchCharacters, updateCharacter } from "../services/characterService";

export type CharacterFormState = CreateCharacterInput;

const defaultForm: CharacterFormState = {
  name: "",
  archetype: "Guerrero",
  race: "Humano",
  culture: "Ambriano",
  profession: "",
  level: 1,
  sheet: createEmptyCharacterSheet()
};

export function useCharacterController(ensureAccessToken: () => Promise<string>) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterFormState>(defaultForm);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
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

  useEffect(() => {
    void refresh();
  }, []);

  const isEditing = selectedCharacterId !== null;

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await ensureAccessToken();
      const list = await fetchCharacters(token);
      setCharacters(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista de personajes");
    } finally {
      setIsLoading(false);
    }
  }

  function updateTopLevel<K extends keyof CharacterFormState>(field: K, value: CharacterFormState[K]): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateSheet(path: string, value: string | number): void {
    setForm((prev) => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let cursor: Record<string, unknown> = next.sheet as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i += 1) {
        cursor = cursor[parts[i]] as Record<string, unknown>;
      }
      cursor[parts[parts.length - 1]] = value;
      return { ...next, sheet: parseCharacterSheet(next.sheet) };
    });
  }

  function addSimpleItem(section: "rasgos" | "equipo" | "contactos"): void {
    const text = listInput[section].trim();
    if (!text) return;
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section] = [...next.sheet[section], text];
      return next;
    });
    setListInput((prev) => ({ ...prev, [section]: "" }));
  }

  function removeSimpleItem(section: "rasgos" | "equipo" | "contactos", index: number): void {
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section] = next.sheet[section].filter((_, i) => i !== index);
      return next;
    });
  }

  function addRatedItem(section: "habilidades" | "poderesMisticos" | "rituales", sourceInput: "habilidades" | "poderes" | "rituales"): void {
    const text = listInput[sourceInput].trim();
    if (!text) return;
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section] = [...next.sheet[section], { nombre: text, nivel: "novato", fuente: "", notas: "" }];
      return { ...next, sheet: parseCharacterSheet(next.sheet) };
    });
    setListInput((prev) => ({ ...prev, [sourceInput]: "" }));
  }

  function addCatalogRatedItem(
    section: "habilidades" | "poderesMisticos" | "rituales",
    entry: SymbaroumCapability | undefined
  ): void {
    if (!entry) return;
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section] = [
        ...next.sheet[section],
        {
          nombre: entry.nombre,
          nivel: "novato",
          fuente: entry.libro,
          pagina: entry.pagina,
          notas: entry.efectoResumen
        }
      ];
      return { ...next, sheet: parseCharacterSheet(next.sheet) };
    });
  }

  function removeRatedItem(section: "habilidades" | "poderesMisticos" | "rituales", index: number): void {
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section] = next.sheet[section].filter((_, i) => i !== index);
      return next;
    });
  }

  function updateRatedItem(
    section: "habilidades" | "poderesMisticos" | "rituales",
    index: number,
    field: "nombre" | "nivel" | "fuente" | "notas" | "pagina",
    value: string | number
  ): void {
    setForm((prev) => {
      const next = structuredClone(prev);
      next.sheet[section][index][field] = value as never;
      return { ...next, sheet: parseCharacterSheet(next.sheet) };
    });
  }

  function selectCharacter(characterId: string): void {
    const character = characters.find((c) => c.id === characterId);
    if (!character) return;

    setSelectedCharacterId(character.id);
    setForm({
      name: character.name,
      archetype: character.archetype,
      race: character.race,
      culture: character.culture,
      profession: character.profession,
      level: character.level,
      sheet: parseCharacterSheet(character.sheet)
    });
  }

  function newCharacter(): void {
    setSelectedCharacterId(null);
    setForm(structuredClone(defaultForm));
  }

  async function submit(): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const token = await ensureAccessToken();
      const payload: CreateCharacterInput = {
        ...form,
        level: form.sheet.progreso.nivel,
        name: form.name.trim(),
        archetype: form.sheet.identidad.arquetipo,
        race: form.sheet.identidad.raza,
        culture: form.sheet.identidad.cultura,
        profession: form.sheet.identidad.profesion
      };

      if (selectedCharacterId) {
        await updateCharacter(selectedCharacterId, payload, token);
      } else {
        await createCharacter(payload, token);
      }

      await refresh();
      if (!selectedCharacterId) {
        newCharacter();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el personaje");
    } finally {
      setIsSaving(false);
    }
  }

  const availableXp = Math.max(0, form.sheet.progreso.experienciaTotal - form.sheet.progreso.experienciaGastada);
  const corruptionTotal = form.sheet.corrupcion.temporal + form.sheet.corrupcion.permanente;

  return useMemo(
    () => ({
      characters,
      isLoading,
      isSaving,
      isEditing,
      error,
      form,
      listInput,
      catalogSelection,
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
      availableXp,
      corruptionTotal,
      refresh,
      submit,
      newCharacter,
      selectCharacter,
      updateTopLevel,
      updateSheet,
      setListInput,
      setCatalogSelection,
      addSimpleItem,
      removeSimpleItem,
      addRatedItem,
      addCatalogRatedItem,
      removeRatedItem,
      updateRatedItem
    }),
    [characters, isLoading, isSaving, isEditing, error, form, listInput, catalogSelection, selectedCharacterId, availableXp, corruptionTotal]
  );
}

export function getRoleLabel(role: "player" | "gm" | "superadmin"): string {
  if (role === "gm") return "Director de Juego";
  if (role === "superadmin") return "Superadmin";
  return "Jugador";
}

export function cloneSheet(sheet: CharacterSheet): CharacterSheet {
  return parseCharacterSheet(structuredClone(sheet));
}
