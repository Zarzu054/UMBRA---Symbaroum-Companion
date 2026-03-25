const JSON_HEADERS = { "Content-Type": "application/json" };
async function parseError(response) {
    try {
        const payload = (await response.json());
        const details = Array.isArray(payload.details)
            ? payload.details
                .map((item) => (item.path ? `${item.path}: ${item.message ?? "Valor invalido"}` : item.message ?? "Valor invalido"))
                .filter(Boolean)
            : [];
        if (details.length > 0) {
            return `${payload.message ?? payload.error ?? "Validacion fallida"}\n${details.join("\n")}`;
        }
        return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
    }
    catch {
        return `Fallo de solicitud (${response.status})`;
    }
}
export async function fetchCharacters(accessToken) {
    const response = await fetch("/api/characters", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function duplicateCharacter(characterId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteCharacter(characterId, accessToken) {
    const response = await fetch(`/api/characters/${characterId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
}
