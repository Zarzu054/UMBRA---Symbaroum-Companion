import type { CreateNpcInput, Npc, UpdateNpcInput } from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

type NpcListResponse = { data: Npc[] };
type NpcSingleResponse = { data: Npc };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchNpcs(accessToken: string): Promise<Npc[]> {
  const response = await fetch("/api/npcs", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as NpcListResponse;
  return payload.data;
}

export async function createNpc(input: CreateNpcInput, accessToken: string): Promise<Npc> {
  const response = await fetch("/api/npcs", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as NpcSingleResponse;
  return payload.data;
}

export async function updateNpc(npcId: string, input: UpdateNpcInput, accessToken: string): Promise<Npc> {
  const response = await fetch(`/api/npcs/${npcId}`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const payload = (await response.json()) as NpcSingleResponse;
  return payload.data;
}

export async function deleteNpc(npcId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/npcs/${npcId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
