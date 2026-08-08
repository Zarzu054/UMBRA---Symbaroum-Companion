import type {
  AssignMysticArtifactOwnerInput,
  BindMysticArtifactInput,
  CreateCampaignMysticArtifactInput,
  MysticArtifact,
  UpdateCampaignMysticArtifactInput,
  UpdateMysticArtifactResourceInput,
  UseMysticArtifactAbilityResult
} from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchMysticArtifactPresets(accessToken: string): Promise<MysticArtifact[]> {
  return (await request<{ data: MysticArtifact[] }>("/api/mystic-artifact-presets", accessToken)).data;
}

export async function fetchCampaignMysticArtifacts(campaignId: string, accessToken: string): Promise<MysticArtifact[]> {
  return (await request<{ data: MysticArtifact[] }>(`/api/campaigns/${campaignId}/mystic-artifacts`, accessToken)).data;
}

export async function fetchMysticArtifactSource(artifactId: string, accessToken: string): Promise<{ objectUrl: string; pdfPage: number }> {
  const response = await fetch(`/api/mystic-artifacts/${artifactId}/source`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  const pdfPage = Number(response.headers.get("X-Umbra-Pdf-Page"));
  return { objectUrl: URL.createObjectURL(await response.blob()), pdfPage: Number.isFinite(pdfPage) && pdfPage > 0 ? pdfPage : 1 };
}

export async function createCampaignMysticArtifact(campaignId: string, input: CreateCampaignMysticArtifactInput, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/campaigns/${campaignId}/mystic-artifacts`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}

export async function updateCampaignMysticArtifact(artifactId: string, input: UpdateCampaignMysticArtifactInput, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}

export async function deleteCampaignMysticArtifact(artifactId: string, accessToken: string): Promise<void> {
  await request<void>(`/api/mystic-artifacts/${artifactId}`, accessToken, { method: "DELETE" });
}

export async function assignMysticArtifactOwner(artifactId: string, input: AssignMysticArtifactOwnerInput, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}/owner`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}

export async function bindMysticArtifact(artifactId: string, input: BindMysticArtifactInput, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}/bind`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}

export async function bindNpcMysticArtifact(artifactId: string, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}/bind-npc`, accessToken, { method: "POST" })).data;
}

export async function unbindMysticArtifact(artifactId: string, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}/unbind`, accessToken, { method: "POST" })).data;
}

export async function updateMysticArtifactResource(artifactId: string, resourceId: string, input: UpdateMysticArtifactResourceInput, accessToken: string): Promise<MysticArtifact> {
  return (await request<{ data: MysticArtifact }>(`/api/mystic-artifacts/${artifactId}/resources/${resourceId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}

export async function useMysticArtifactAbility(artifactId: string, abilityId: string, accessToken: string): Promise<UseMysticArtifactAbilityResult> {
  return (await request<{ data: UseMysticArtifactAbilityResult }>(`/api/mystic-artifacts/${artifactId}/abilities/${abilityId}/use`, accessToken, { method: "POST" })).data;
}
