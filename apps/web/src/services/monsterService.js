import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
export async function fetchMonsterCodex(accessToken) {
    const response = await fetch("/api/monsters/codex", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function fetchCustomMonsters(accessToken) {
    const response = await fetch("/api/monsters", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function createMonster(input, accessToken) {
    const response = await fetch("/api/monsters", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function updateMonster(monsterId, input, accessToken) {
    const response = await fetch(`/api/monsters/${monsterId}`, {
        method: "PUT",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteMonster(monsterId, accessToken) {
    const response = await fetch(`/api/monsters/${monsterId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
