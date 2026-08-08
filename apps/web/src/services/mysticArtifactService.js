import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
async function request(url, accessToken, init) {
    const response = await fetch(url, {
        ...init,
        headers: { ...(init?.body ? JSON_HEADERS : {}), ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    if (response.status === 204)
        return undefined;
    return (await response.json());
}
export async function fetchMysticArtifactPresets(accessToken) {
    return (await request("/api/mystic-artifact-presets", accessToken)).data;
}
export async function fetchCampaignMysticArtifacts(campaignId, accessToken) {
    return (await request(`/api/campaigns/${campaignId}/mystic-artifacts`, accessToken)).data;
}
export async function fetchMysticArtifactSource(artifactId, accessToken) {
    const response = await fetch(`/api/mystic-artifacts/${artifactId}/source`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok)
        throw new Error(await readFriendlyApiError(response));
    const pdfPage = Number(response.headers.get("X-Umbra-Pdf-Page"));
    return { objectUrl: URL.createObjectURL(await response.blob()), pdfPage: Number.isFinite(pdfPage) && pdfPage > 0 ? pdfPage : 1 };
}
export async function createCampaignMysticArtifact(campaignId, input, accessToken) {
    return (await request(`/api/campaigns/${campaignId}/mystic-artifacts`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}
export async function updateCampaignMysticArtifact(artifactId, input, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}
export async function deleteCampaignMysticArtifact(artifactId, accessToken) {
    await request(`/api/mystic-artifacts/${artifactId}`, accessToken, { method: "DELETE" });
}
export async function assignMysticArtifactOwner(artifactId, input, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/owner`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}
export async function bindMysticArtifact(artifactId, input, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/bind`, accessToken, { method: "POST", body: JSON.stringify(input) })).data;
}
export async function bindNpcMysticArtifact(artifactId, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/bind-npc`, accessToken, { method: "POST" })).data;
}
export async function unbindMysticArtifact(artifactId, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/unbind`, accessToken, { method: "POST" })).data;
}
export async function updateMysticArtifactResource(artifactId, resourceId, input, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/resources/${resourceId}`, accessToken, { method: "PUT", body: JSON.stringify(input) })).data;
}
export async function useMysticArtifactAbility(artifactId, abilityId, accessToken) {
    return (await request(`/api/mystic-artifacts/${artifactId}/abilities/${abilityId}/use`, accessToken, { method: "POST" })).data;
}
