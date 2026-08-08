import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
export async function fetchCompendiumLibrary(accessToken) {
    const response = await fetch("/api/compendium/library", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function setCompendiumFavorite(entryId, input, accessToken) {
    const response = await fetch(`/api/compendium/library/${encodeURIComponent(entryId)}/favorite`, {
        method: "PUT",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(input)
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
export async function recordCompendiumView(entryId, accessToken) {
    const response = await fetch(`/api/compendium/library/${encodeURIComponent(entryId)}/view`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
}
