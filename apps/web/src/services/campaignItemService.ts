import type {
  AssignCampaignItemOwnerInput,
  CampaignItemTemplate,
  CreateCampaignItemInput,
  UpdateCampaignItemInput
} from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return (await response.json()) as T;
}

export async function fetchCampaignItems(campaignId: string, accessToken: string): Promise<CampaignItemTemplate[]> {
  return (await request<{ data: CampaignItemTemplate[] }>(`/api/campaigns/${campaignId}/items`, accessToken)).data;
}

export async function createCampaignItem(campaignId: string, input: CreateCampaignItemInput, accessToken: string): Promise<CampaignItemTemplate> {
  return (await request<{ data: CampaignItemTemplate }>(`/api/campaigns/${campaignId}/items`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}

export async function updateCampaignItem(itemId: string, input: UpdateCampaignItemInput, accessToken: string): Promise<CampaignItemTemplate> {
  return (await request<{ data: CampaignItemTemplate }>(`/api/campaign-items/${itemId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}

export async function assignCampaignItemOwner(itemId: string, input: AssignCampaignItemOwnerInput, accessToken: string): Promise<CampaignItemTemplate> {
  return (await request<{ data: CampaignItemTemplate }>(`/api/campaign-items/${itemId}/owner`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}

export async function archiveCampaignItem(itemId: string, accessToken: string): Promise<CampaignItemTemplate> {
  return (await request<{ data: CampaignItemTemplate }>(`/api/campaign-items/${itemId}`, accessToken, { method: "DELETE" })).data;
}

export async function restoreCampaignItem(itemId: string, accessToken: string): Promise<CampaignItemTemplate> {
  return (await request<{ data: CampaignItemTemplate }>(`/api/campaign-items/${itemId}/restore`, accessToken, { method: "POST" })).data;
}

