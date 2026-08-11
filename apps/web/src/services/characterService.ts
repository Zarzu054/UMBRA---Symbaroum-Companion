import type { Character, CharacterChangeLogPage, CharacterProfessionMembership, CreateCharacterInput, ImportCharacterInput, UpdateCharacterInput } from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

type CharacterListResponse = { data: Character[] };
type CharacterSingleResponse = { data: Character };
type ProfessionMembershipListResponse = { data: CharacterProfessionMembership[] };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchCharacters(accessToken: string): Promise<Character[]> {
  const response = await fetch("/api/characters", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as CharacterListResponse;
  return payload.data;
}

export async function createCharacter(input: CreateCharacterInput, accessToken: string): Promise<Character> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function importCharacter(input: ImportCharacterInput, accessToken: string): Promise<Character> {
  const response = await fetch("/api/characters/import", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
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

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function fetchCharacterChangeLog(
  characterId: string,
  accessToken: string,
  cursor?: string
): Promise<CharacterChangeLogPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : "?limit=50";
  const response = await fetch(`/api/characters/${characterId}/change-log${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return (await response.json() as { data: CharacterChangeLogPage }).data;
}

export async function markCharacterChangeLogRead(characterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/characters/${characterId}/change-log/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}

export async function duplicateCharacter(characterId: string, accessToken: string): Promise<Character> {
  const response = await fetch(`/api/characters/${characterId}/duplicate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as CharacterSingleResponse;
  return payload.data;
}

export async function deleteCharacter(characterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/characters/${characterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}

export async function aspireProfession(characterId: string, professionId: string, accessToken: string): Promise<CharacterProfessionMembership[]> {
  const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/aspiration`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return ((await response.json()) as ProfessionMembershipListResponse).data;
}

export async function removeProfessionAspiration(characterId: string, professionId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/aspiration`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}

export async function requestProfessionMembership(characterId: string, professionId: string, accessToken: string): Promise<CharacterProfessionMembership[]> {
  const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/request`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return ((await response.json()) as ProfessionMembershipListResponse).data;
}

export async function leaveProfession(characterId: string, professionId: string, accessToken: string): Promise<CharacterProfessionMembership[]> {
  const response = await fetch(`/api/characters/${characterId}/professions/${professionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return ((await response.json()) as ProfessionMembershipListResponse).data;
}
