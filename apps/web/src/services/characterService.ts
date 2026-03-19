import type { Character, CreateCharacterInput, ImportCharacterInput, UpdateCharacterInput } from "@umbra/shared";

type CharacterListResponse = { data: Character[] };
type CharacterSingleResponse = { data: Character };

const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
      details?: Array<{ path?: string; message?: string }>;
    };
    const details = Array.isArray(payload.details)
      ? payload.details
          .map((item) => (item.path ? `${item.path}: ${item.message ?? "Valor invalido"}` : item.message ?? "Valor invalido"))
          .filter(Boolean)
      : [];

    if (details.length > 0) {
      return `${payload.message ?? payload.error ?? "Validacion fallida"}\n${details.join("\n")}`;
    }

    return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
  } catch {
    return `Fallo de solicitud (${response.status})`;
  }
}

export async function fetchCharacters(accessToken: string): Promise<Character[]> {
  const response = await fetch("/api/characters", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CharacterListResponse;
  return payload.data;
}

export async function createCharacter(input: CreateCharacterInput, accessToken: string): Promise<Character> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function importCharacter(input: ImportCharacterInput, accessToken: string): Promise<Character> {
  const response = await fetch("/api/characters/import", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function updateCharacter(
  characterId: string,
  input: UpdateCharacterInput,
  accessToken: string
): Promise<Character> {
  const response = await fetch(`/api/characters/${characterId}`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function duplicateCharacter(characterId: string, accessToken: string): Promise<Character> {
  const response = await fetch(`/api/characters/${characterId}/duplicate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function deleteCharacter(characterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/characters/${characterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
}
