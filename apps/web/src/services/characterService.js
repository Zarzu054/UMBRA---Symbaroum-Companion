import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
export async function fetchCharacters(accessToken) {
    const response = await fetch("/api/characters", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function createCharacter(input, accessToken) {
    const response = await fetch("/api/characters", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function importCharacter(input, accessToken) {
    const response = await fetch("/api/characters/import", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function updateCharacter(characterId, input, accessToken) {
    const response = await fetch(`/api/characters/${characterId}`, {
        method: "PUT",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function duplicateCharacter(characterId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteCharacter(characterId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
