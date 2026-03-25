const STORAGE_KEY = "umbra_auth_state";
export function loadAuthState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}
export function saveAuthState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function clearAuthState() {
    localStorage.removeItem(STORAGE_KEY);
}
