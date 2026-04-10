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
export async function fetchMonsterCodex(accessToken) {
    const response = await fetch("/api/monsters/codex", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function fetchCustomMonsters(accessToken) {
    const response = await fetch("/api/monsters", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteMonster(monsterId, accessToken) {
    const response = await fetch(`/api/monsters/${monsterId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
}
