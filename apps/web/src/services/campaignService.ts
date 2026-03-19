import type {
  AddCampaignMemberInput,
  AssignCampaignSessionExperienceInput,
  Campaign,
  CampaignChatMessage,
  CreateCampaignChatMessageInput,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  CreateCampaignReferenceInput,
  CreateCampaignSessionInput,
  GrantCampaignExperienceInput,
  UpdateCampaignCharacterSheetInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput,
  UpdateCampaignNpcSheetInput,
  UpdateCampaignReferenceInput,
  UpdateCampaignSessionInput
} from "@umbra/shared";

type CampaignListResponse = { data: Campaign[] };
type CampaignSingleResponse = { data: Campaign };
type CampaignChatListResponse = { data: CampaignChatMessage[] };
const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
  } catch {
    return `Fallo de solicitud (${response.status})`;
  }
}

async function request<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export async function fetchCampaigns(accessToken: string): Promise<Campaign[]> { return (await request<CampaignListResponse>("/api/campaigns", accessToken)).data; }
export async function fetchCampaignChatMessages(campaignId: string, accessToken: string): Promise<CampaignChatMessage[]> { return (await request<CampaignChatListResponse>(`/api/campaigns/${campaignId}/chat-messages`, accessToken)).data; }
export async function createCampaign(input: CreateCampaignInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>("/api/campaigns", accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignChatMessage(campaignId: string, input: CreateCampaignChatMessageInput, accessToken: string): Promise<CampaignChatMessage> { return (await request<{ data: CampaignChatMessage }>(`/api/campaigns/${campaignId}/chat-messages`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaign(campaignId: string, input: UpdateCampaignInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function addCampaignMember(campaignId: string, input: AddCampaignMemberInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/members`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function removeCampaignMember(memberId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-members/${memberId}`, accessToken, { method: "DELETE" })).data; }
export async function linkCampaignCharacter(campaignId: string, characterId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/characters`, accessToken, { method: "POST", body: JSON.stringify({ characterId }) })).data; }
export async function unlinkCampaignCharacter(linkId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-characters/${linkId}`, accessToken, { method: "DELETE" })).data; }
export async function updateCampaignCharacterSheet(linkId: string, input: UpdateCampaignCharacterSheetInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-characters/${linkId}/sheet`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function createCampaignNpc(campaignId: string, input: CreateCampaignNpcInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/npcs`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function generateCampaignNpc(campaignId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/npcs/generate`, accessToken, { method: "POST" })).data; }
export async function updateCampaignNpc(npcId: string, input: UpdateCampaignNpcInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignNpc(npcId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}`, accessToken, { method: "DELETE" })).data; }
export async function createCampaignNpcSheet(npcId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}/sheet`, accessToken, { method: "POST" })).data; }
export async function updateCampaignNpcSheet(npcId: string, input: UpdateCampaignNpcSheetInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-npcs/${npcId}/sheet`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function createCampaignSession(campaignId: string, input: CreateCampaignSessionInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/sessions`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignReference(campaignId: string, input: CreateCampaignReferenceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/references`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignSession(sessionId: string, input: UpdateCampaignSessionInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-sessions/${sessionId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function updateCampaignReference(referenceId: string, input: UpdateCampaignReferenceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-references/${referenceId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignReference(referenceId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-references/${referenceId}`, accessToken, { method: "DELETE" })).data; }
export async function assignCampaignSessionExperience(sessionId: string, input: AssignCampaignSessionExperienceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-sessions/${sessionId}/xp-awards`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function grantCampaignExperience(campaignId: string, input: GrantCampaignExperienceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/xp-grants`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
