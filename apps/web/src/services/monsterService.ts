import type { CreateMonsterInput, Monster, UpdateMonsterInput } from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

type MonsterListResponse = { data: Monster[] };
type MonsterSingleResponse = { data: Monster };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchMonsterCodex(accessToken: string): Promise<Monster[]> {
  const response = await fetch("/api/monsters/codex", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as MonsterListResponse;
  return payload.data;
}

export async function fetchCustomMonsters(accessToken: string): Promise<Monster[]> {
  const response = await fetch("/api/monsters", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as MonsterListResponse;
  return payload.data;
}

export async function createMonster(input: CreateMonsterInput, accessToken: string): Promise<Monster> {
  const response = await fetch("/api/monsters", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as MonsterSingleResponse;
  return payload.data;
}

export async function updateMonster(monsterId: string, input: UpdateMonsterInput, accessToken: string): Promise<Monster> {
  const response = await fetch(`/api/monsters/${monsterId}`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as MonsterSingleResponse;
  return payload.data;
}

export async function deleteMonster(monsterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/monsters/${monsterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
