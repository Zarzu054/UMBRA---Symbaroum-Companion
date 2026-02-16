import type { Character, CreateCharacterInput } from "@umbra/shared";

export type CharacterListResponse = {
  data: Character[];
};

export type CharacterCreateResponse = {
  data: Character;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function fetchCharacters(accessToken: string): Promise<Character[]> {
  const response = await fetch("/api/characters", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error(await parseError(response));

  const payload = (await response.json()) as CharacterListResponse;
  return payload.data;
}

export async function createCharacter(input: CreateCharacterInput, accessToken: string): Promise<Character> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));

  const payload = (await response.json()) as CharacterCreateResponse;
  return payload.data;
}