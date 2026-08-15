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
export async function fetchCampaignItems(campaignId, accessToken) {
    return (await request(`/api/campaigns/${campaignId}/items`, accessToken)).data;
}
export async function createCampaignItem(campaignId, input, accessToken) {
    return (await request(`/api/campaigns/${campaignId}/items`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}
export async function updateCampaignItem(itemId, input, accessToken) {
    return (await request(`/api/campaign-items/${itemId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}
export async function assignCampaignItemOwner(itemId, input, accessToken) {
    return (await request(`/api/campaign-items/${itemId}/owner`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}
export async function archiveCampaignItem(itemId, accessToken) {
    return (await request(`/api/campaign-items/${itemId}`, accessToken, { method: "DELETE" })).data;
}
export async function restoreCampaignItem(itemId, accessToken) {
    return (await request(`/api/campaign-items/${itemId}/restore`, accessToken, { method: "POST" })).data;
}
