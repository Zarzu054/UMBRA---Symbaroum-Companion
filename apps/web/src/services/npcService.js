import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
export async function fetchNpcs(accessToken) {
    const response = await fetch("/api/npcs", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function createNpc(input, accessToken) {
    const response = await fetch("/api/npcs", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function updateNpc(npcId, input, accessToken) {
    const response = await fetch(`/api/npcs/${npcId}`, {
        method: "PUT",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteNpc(npcId, accessToken) {
    const response = await fetch(`/api/npcs/${npcId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
