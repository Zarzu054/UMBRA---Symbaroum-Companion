import type {
  CreateCampaignInvitationInput,
  AssignCampaignSessionExperienceInput,
  Campaign,
  CampaignCombat,
  CampaignChatMessage,
  CampaignCharacterLinkRequest,
  CampaignInvitation,
  AddCampaignCombatParticipantInput,
  AdvanceCampaignCombatTurnInput,
  CharacterProfessionMembership,
  CreateCampaignChatMessageInput,
  CreateCampaignInput,
  CreateCampaignNpcInput,
  CreateCampaignReferenceInput,
  CreateCampaignSessionInput,
  GrantCampaignExperienceInput,
  ProfessionDecisionInput,
  ReorderCampaignCombatInput,
  UpdateCampaignCombatParticipantInput,
  UpdateCampaignCombatResourcesInput,
  UpdateCampaignCharacterSheetInput,
  UpdateCampaignInput,
  UpdateCampaignNpcInput,
  UpdateCampaignNpcSheetInput,
  UpdateCampaignReferenceInput,
  UpdateCampaignSessionInput
} from "@umbra/shared";
import { readFriendlyApiError } from "./apiError";

type CampaignListResponse = { data: Campaign[] };
type CampaignSingleResponse = { data: Campaign };
type CampaignChatListResponse = { data: CampaignChatMessage[] };
type CampaignInvitationListResponse = { data: CampaignInvitation[] };
type CampaignCharacterLinkRequestListResponse = { data: CampaignCharacterLinkRequest[] };
const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
  return (await response.json()) as T;
}

export async function fetchCampaigns(accessToken: string): Promise<Campaign[]> { return (await request<CampaignListResponse>("/api/campaigns", accessToken)).data; }
export async function fetchCampaignChatMessages(campaignId: string, accessToken: string): Promise<CampaignChatMessage[]> { return (await request<CampaignChatListResponse>(`/api/campaigns/${campaignId}/chat-messages`, accessToken)).data; }
export async function createCampaign(input: CreateCampaignInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>("/api/campaigns", accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignChatMessage(campaignId: string, input: CreateCampaignChatMessageInput, accessToken: string): Promise<CampaignChatMessage> { return (await request<{ data: CampaignChatMessage }>(`/api/campaigns/${campaignId}/chat-messages`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaign(campaignId: string, input: UpdateCampaignInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function sendCampaignInvitation(campaignId: string, input: CreateCampaignInvitationInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/invitations`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function fetchCampaignInvitations(accessToken: string): Promise<CampaignInvitation[]> { return (await request<CampaignInvitationListResponse>("/api/campaign-invitations", accessToken)).data; }
export async function acceptCampaignInvitation(invitationId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-invitations/${invitationId}/accept`, accessToken, { method: "POST" })).data; }
export async function dismissCampaignInvitation(invitationId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/campaign-invitations/${invitationId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
export async function removeCampaignMember(memberId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-members/${memberId}`, accessToken, { method: "DELETE" })).data; }
export async function requestCampaignCharacterLink(campaignId: string, characterId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/character-link-requests`, accessToken, { method: "POST", body: JSON.stringify({ characterId }) })).data; }
export async function fetchCampaignCharacterLinkRequests(accessToken: string): Promise<CampaignCharacterLinkRequest[]> { return (await request<CampaignCharacterLinkRequestListResponse>("/api/campaign-character-link-requests", accessToken)).data; }
export async function acceptCampaignCharacterLinkRequest(requestId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-character-link-requests/${requestId}/accept`, accessToken, { method: "POST" })).data; }
export async function dismissCampaignCharacterLinkRequest(requestId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/campaign-character-link-requests/${requestId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
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
export async function deleteCampaignSession(sessionId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-sessions/${sessionId}`, accessToken, { method: "DELETE" })).data; }
export async function updateCampaignReference(referenceId: string, input: UpdateCampaignReferenceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-references/${referenceId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignReference(referenceId: string, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-references/${referenceId}`, accessToken, { method: "DELETE" })).data; }
export async function assignCampaignSessionExperience(sessionId: string, input: AssignCampaignSessionExperienceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaign-sessions/${sessionId}/xp-awards`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function grantCampaignExperience(campaignId: string, input: GrantCampaignExperienceInput, accessToken: string): Promise<Campaign> { return (await request<CampaignSingleResponse>(`/api/campaigns/${campaignId}/xp-grants`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function decideProfessionRequest(campaignId: string, requestId: string, input: ProfessionDecisionInput, accessToken: string): Promise<CharacterProfessionMembership[]> { return (await request<{ data: CharacterProfessionMembership[] }>(`/api/campaigns/${campaignId}/profession-requests/${requestId}/decision`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }

export async function fetchCampaignCombat(campaignId: string, accessToken: string): Promise<CampaignCombat | null> { return (await request<{ data: CampaignCombat | null }>(`/api/campaigns/${campaignId}/combat`, accessToken)).data; }
export async function startCampaignCombat(campaignId: string, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat`, accessToken, { method: "PUT" })).data; }
export async function finishCampaignCombat(campaignId: string, accessToken: string): Promise<void> {
  const response = await fetch(`/api/campaigns/${campaignId}/combat`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await readFriendlyApiError(response));
}
export async function addCampaignCombatParticipant(campaignId: string, input: AddCampaignCombatParticipantInput, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/participants`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignCombatParticipant(campaignId: string, participantId: string, input: UpdateCampaignCombatParticipantInput, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/participants/${participantId}`, accessToken, { method: "PATCH", body: JSON.stringify(input) })).data; }
export async function removeCampaignCombatParticipant(campaignId: string, participantId: string, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/participants/${participantId}`, accessToken, { method: "DELETE" })).data; }
export async function reorderCampaignCombat(campaignId: string, input: ReorderCampaignCombatInput, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/order`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function advanceCampaignCombatTurn(campaignId: string, input: AdvanceCampaignCombatTurnInput, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/turn`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignCombatResources(campaignId: string, participantId: string, input: UpdateCampaignCombatResourcesInput, accessToken: string): Promise<CampaignCombat> { return (await request<{ data: CampaignCombat }>(`/api/campaigns/${campaignId}/combat/participants/${participantId}/resources`, accessToken, { method: "PATCH", body: JSON.stringify(input) })).data; }
