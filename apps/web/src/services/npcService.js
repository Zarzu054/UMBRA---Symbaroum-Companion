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
export async function fetchNpcs(accessToken) {
    const response = await fetch("/api/npcs", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
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
        throw new Error(await parseError(response));
    const payload = (await response.json());
    return payload.data;
}
export async function deleteNpc(npcId, accessToken) {
    const response = await fetch(`/api/npcs/${npcId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await parseError(response));
}
