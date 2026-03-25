const JSON_HEADERS = { "Content-Type": "application/json" };
async function parseError(response) {
    try {
        const payload = (await response.json());
        return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
    }
    catch {
        return `Fallo de solicitud (${response.status})`;
    }
}
async function request(url, accessToken, init) {
    const response = await fetch(url, {
        ...init,
        headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
    return (await response.json());
}
export async function fetchCampaigns(accessToken) { return (await request("/api/campaigns", accessToken)).data; }
export async function fetchCampaignChatMessages(campaignId, accessToken) { return (await request(`/api/campaigns/${campaignId}/chat-messages`, accessToken)).data; }
export async function createCampaign(input, accessToken) { return (await request("/api/campaigns", accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function createCampaignChatMessage(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/chat-messages`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
export async function updateCampaign(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data; }
export async function addCampaignMember(campaignId, input, accessToken) { return (await request(`/api/campaigns/${campaignId}/members`, accessToken, { method: "POST", body: JSON.stringify(input) })).data; }
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
