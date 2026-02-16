import { useEffect, useMemo, useState } from "react";
import type { Character, CreateCharacterInput } from "@umbra/shared";
import { createCharacter, fetchCharacters } from "../services/characterService";

type CharacterFormState = CreateCharacterInput;

const defaultForm: CharacterFormState = {
  name: "",
  archetype: "",
  race: "",
  level: 1
};

export function useCharacterController() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterFormState>(defaultForm);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchCharacters();
      setCharacters(list);
    } catch {
      setError("Could not load character list");
    } finally {
      setIsLoading(false);
    }
  }

  function updateForm<K extends keyof CharacterFormState>(field: K, value: CharacterFormState[K]): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(): Promise<void> {
    setError(null);
    try {
      await createCharacter(form);
      setForm(defaultForm);
      await refresh();
    } catch {
      setError("Could not create character");
    }
  }

  return useMemo(
    () => ({
      characters,
      isLoading,
      error,
      form,
      updateForm,
      submit,
      refresh
    }),
    [characters, isLoading, error, form]
  );
}