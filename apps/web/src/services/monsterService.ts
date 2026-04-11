import type { CreateMonsterInput, Monster, UpdateMonsterInput } from "@umbra/shared";

type MonsterListResponse = { data: Monster[] };
type MonsterSingleResponse = { data: Monster };

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

export async function fetchMonsterCodex(accessToken: string): Promise<Monster[]> {
  const response = await fetch("/api/monsters/codex", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as MonsterListResponse;
  return payload.data;
}

export async function fetchCustomMonsters(accessToken: string): Promise<Monster[]> {
  const response = await fetch("/api/monsters", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as MonsterListResponse;
  return payload.data;
}

export async function createMonster(input: CreateMonsterInput, accessToken: string): Promise<Monster> {
  const response = await fetch("/api/monsters", {
    method: "POST",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as MonsterSingleResponse;
  return payload.data;
}

export async function updateMonster(monsterId: string, input: UpdateMonsterInput, accessToken: string): Promise<Monster> {
  const response = await fetch(`/api/monsters/${monsterId}`, {
    method: "PUT",
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(await parseError(response));
  const payload = (await response.json()) as MonsterSingleResponse;
  return payload.data;
}

export async function deleteMonster(monsterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/monsters/${monsterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await parseError(response));
}
