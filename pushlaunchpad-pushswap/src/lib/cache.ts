// Simple client-side cache utilities for persisting launch history
// Uses localStorage under a namespaced key. Safe no-ops on server/unsupported environments.

export interface CachedLaunches<T> {
    items: T[];
    // Highest block that has been fully scanned and merged into the cache
    latestBlock: number;
    // Last write time (ms)
    updatedAt: number;
}

export function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readCache<T>(key: string): CachedLaunches<T> | null {
    if (!isBrowser()) return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedLaunches<T>;
        if (
            !parsed ||
            typeof parsed !== "object" ||
            !Array.isArray((parsed as any).items) ||
            typeof (parsed as any).latestBlock !== "number"
        ) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function writeCache<T>(key: string, data: CachedLaunches<T>): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(data));
    } catch {
        // Silently ignore quota or serialization issues
    }
}

export function clearCache(key: string): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export function isStale(updatedAt: number, ttlMs: number): boolean {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;
    return Date.now() - updatedAt > ttlMs;
}
