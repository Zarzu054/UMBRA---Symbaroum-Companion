import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
async function request(url, accessToken, init) {
    const response = await fetch(url, {
        ...init,
        headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    return (await response.json());
}
export async function fetchCampaigns(accessToken) { return (await request("/api/campaigns", accessToken)).data; }
export async function fetchCampaignChatMessages(campaignId, accessToken) { return (await request(`/api/campaigns/${campaignId}/chat-messages`, accessToken)).data; }
export async function createCampaign(input, accessToken) { return (await request("/api/campaigns", accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignChatMessage(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/chat-messages`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaign(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function sendCampaignInvitation(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/invitations`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function fetchCampaignInvitations(accessToken) { return (await request("/api/campaign-invitations", accessToken)).data; }
export async function acceptCampaignInvitation(invitationId, accessToken) { return (await request(`/api/campaign-invitations/${invitationId}/accept`, accessToken, { method: "POST" })).data; }
export async function dismissCampaignInvitation(invitationId, accessToken) {
    const response = await fetch(`/api/campaign-invitations/${invitationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
export async function removeCampaignMember(memberId, accessToken) { return (await request(`/api/campaign-members/${memberId}`, accessToken, { method: "DELETE" })).data; }
export async function linkCampaignCharacter(campaignId, characterId, accessToken) { return (await request(`/api/campaigns/${campaignId}/characters`, accessToken, { method: "POST", body: JSON.stringify({ characterId }) })).data; }
export async function unlinkCampaignCharacter(linkId, accessToken) { return (await request(`/api/campaign-characters/${linkId}`, accessToken, { method: "DELETE" })).data; }
export async function updateCampaignCharacterSheet(linkId, input, accessToken) { return (await request(`/api/campaign-characters/${linkId}/sheet`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function createCampaignNpc(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/npcs`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function generateCampaignNpc(campaignId, accessToken) { return (await request(`/api/campaigns/${campaignId}/npcs/generate`, accessToken, { method: "POST" })).data; }
export async function updateCampaignNpc(npcId, input, accessToken) { return (await request(`/api/campaign-npcs/${npcId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignNpc(npcId, accessToken) { return (await request(`/api/campaign-npcs/${npcId}`, accessToken, { method: "DELETE" })).data; }
export async function createCampaignNpcSheet(npcId, accessToken) { return (await request(`/api/campaign-npcs/${npcId}/sheet`, accessToken, { method: "POST" })).data; }
export async function updateCampaignNpcSheet(npcId, input, accessToken) { return (await request(`/api/campaign-npcs/${npcId}/sheet`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function createCampaignSession(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/sessions`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignReference(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/references`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignSession(sessionId, input, accessToken) { return (await request(`/api/campaign-sessions/${sessionId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignSession(sessionId, accessToken) { return (await request(`/api/campaign-sessions/${sessionId}`, accessToken, { method: "DELETE" })).data; }
export async function updateCampaignReference(referenceId, input, accessToken) { return (await request(`/api/campaign-references/${referenceId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function deleteCampaignReference(referenceId, accessToken) { return (await request(`/api/campaign-references/${referenceId}`, accessToken, { method: "DELETE" })).data; }
export async function assignCampaignSessionExperience(sessionId, input, accessToken) { return (await request(`/api/campaign-sessions/${sessionId}/xp-awards`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function grantCampaignExperience(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/xp-grants`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function decideProfessionRequest(campaignId, requestId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/profession-requests/${requestId}/decision`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function fetchCampaignCombat(campaignId, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat`, accessToken)).data; }
export async function startCampaignCombat(campaignId, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat`, accessToken, { method: "PUT" })).data; }
export async function finishCampaignCombat(campaignId, accessToken) {
    const response = await fetch(`/api/campaigns/${campaignId}/combat`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
export async function addCampaignCombatParticipant(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/participants`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignCombatParticipant(campaignId, participantId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/participants/${participantId}`, accessToken, { method: "PATCH", body: JSON.stringify(input) })).data; }
export async function removeCampaignCombatParticipant(campaignId, participantId, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/participants/${participantId}`, accessToken, { method: "DELETE" })).data; }
export async function reorderCampaignCombat(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/order`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function advanceCampaignCombatTurn(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/turn`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaignCombatResources(campaignId, participantId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/combat/participants/${participantId}/resources`, accessToken, { method: "PATCH", body: JSON.stringify(input) })).data; }
