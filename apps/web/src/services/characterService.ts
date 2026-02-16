import type { Character, CreateCharacterInput } from "@umbra/shared";

export type CharacterListResponse = {
  data: Character[];
};

export type CharacterCreateResponse = {
  data: Character;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchCharacters(): Promise<Character[]> {
  const response = await fetch("/api/characters");
  if (!response.ok) throw new Error("Failed to load characters");

  const payload = (await response.json()) as CharacterListResponse;
  return payload.data;
}

export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error("Failed to create character");

  const payload = (await response.json()) as CharacterCreateResponse;
  return payload.data;
}