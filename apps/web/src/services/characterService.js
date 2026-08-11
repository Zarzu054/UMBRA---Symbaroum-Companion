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
export async function fetchCharacterChangeLog(characterId, accessToken, cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : "?limit=50";
    const response = await fetch(`/api/characters/${characterId}/change-log${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    return (await response.json()).data;
}
export async function markCharacterChangeLogRead(characterId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/change-log/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
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
export async function aspireProfession(characterId, professionId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/aspiration`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    return (await response.json()).data;
}
export async function removeProfessionAspiration(characterId, professionId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/aspiration`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
export async function requestProfessionMembership(characterId, professionId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/professions/${professionId}/request`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    return (await response.json()).data;
}
export async function leaveProfession(characterId, professionId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/professions/${professionId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    return (await response.json()).data;
}
