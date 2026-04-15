import type { CreateNpcInput, Npc, UpdateNpcInput } from "@umbra/shared";

type NpcListResponse = { data: Npc[] };
type NpcSingleResponse = { data: Npc };

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

export async function fetchNpcs(accessToken: string): Promise<Npc[]> {
  const response = await fetch("/api/npcs", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as NpcListResponse;
  return payload.data;
}

export async function createNpc(input: CreateNpcInput, accessToken: string): Promise<Npc> {
  const response = await fetch("/api/npcs", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as NpcSingleResponse;
  return payload.data;
}

export async function updateNpc(npcId: string, input: UpdateNpcInput, accessToken: string): Promise<Npc> {
  const response = await fetch(`/api/npcs/${npcId}`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as NpcSingleResponse;
  return payload.data;
}

export async function deleteNpc(npcId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/npcs/${npcId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
}
