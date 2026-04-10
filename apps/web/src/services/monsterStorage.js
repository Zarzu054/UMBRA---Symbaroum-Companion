const STORAGE_PREFIX = "umbra_gm_monsters";
function getStorageKey(userId) {
    return `${STORAGE_PREFIX}:${userId}`;
}
export function loadStoredMonsters(userId) {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        localStorage.removeItem(getStorageKey(userId));
        return [];
    }
}
export function saveStoredMonsters(userId, monsters) {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(monsters));
}
