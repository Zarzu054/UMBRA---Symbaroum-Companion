import { fromSession } from "../models/authModel";
import { readFriendlyApiError } from "./apiError";
const JSON_HEADERS = { "Content-Type": "application/json" };
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
        throw new Error(await readFriendlyApiError(response));
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
export async function changePassword(input, accessToken) {
    const session = await postJson("/auth/change-password", input, accessToken);
    return fromSession(session);
}
export async function requestPasswordReset(input) {
    await postJson("/auth/request-password-reset", input);
}
export async function resetPassword(input) {
    await postJson("/auth/reset-password", input);
}
export async function getCurrentUser(accessToken) {
    const response = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await readFriendlyApiError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function fetchSupportUsers(accessToken) {
    const response = await fetch("/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await readFriendlyApiError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function revokeUserSessions(accessToken, userId) {
    await postJson(`/admin/users/${userId}/revoke-sessions`, {}, accessToken);
}
