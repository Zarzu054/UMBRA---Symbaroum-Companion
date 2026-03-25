import { fromSession } from "../models/authModel";
const JSON_HEADERS = { "Content-Type": "application/json" };
async function parseError(response) {
    try {
        const payload = (await response.json());
        return payload.message ?? payload.error ?? `Fallo de solicitud (${response.status})`;
    }
    catch {
        return `Fallo de solicitud (${response.status})`;
    }
}
async function postJson(url, body, token) {
    const headers = { ...JSON_HEADERS };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
    if (response.status === 204) {
        return undefined;
    }
    const payload = (await response.json());
    return payload.data;
}
export async function registerUser(input) {
    const session = await postJson("/auth/register", input);
    return fromSession(session);
}
export async function loginUser(input) {
    const session = await postJson("/auth/login", input);
    return fromSession(session);
}
export async function refreshSession(input) {
    const session = await postJson("/auth/refresh", input);
    return fromSession(session);
}
export async function logoutUser(input) {
    await postJson("/auth/logout", input);
}
export async function getCurrentUser(accessToken) {
    const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function fetchSupportUsers(accessToken) {
    const response = await fetch("/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function revokeUserSessions(accessToken, userId) {
    await postJson(`/admin/users/${userId}/revoke-sessions`, {}, accessToken);
}
