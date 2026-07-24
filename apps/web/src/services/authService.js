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
export async function fetchAdminUsers(accessToken, query) {
    const params = new URLSearchParams({
        query: query.query,
        role: query.role,
        status: query.status,
        page: String(query.page),
        pageSize: String(query.pageSize)
    });
    const response = await fetch(`/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await readFriendlyApiError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function createAdminUser(accessToken, input) {
    return postJson("/admin/users", input, accessToken);
}
export async function deactivateAdminUser(accessToken, userId, input) {
    return postJson(`/admin/users/${userId}/deactivate`, input, accessToken);
}
export async function reactivateAdminUser(accessToken, userId) {
    return postJson(`/admin/users/${userId}/reactivate`, {}, accessToken);
}
export async function revokeUserSessions(accessToken, userId) {
    return postJson(`/admin/users/${userId}/revoke-sessions`, {}, accessToken);
}
export async function fetchAdminUserEvents(accessToken, userId) {
    const response = await fetch(`/admin/users/${userId}/events`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        throw new Error(await readFriendlyApiError(response));
    }
    const payload = (await response.json());
    return payload.data;
}
export async function retryAdminEventEmail(accessToken, userId, eventId) {
    return postJson(`/admin/users/${userId}/events/${eventId}/retry-email`, {}, accessToken);
}
