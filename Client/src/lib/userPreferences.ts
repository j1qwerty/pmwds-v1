import { useSyncExternalStore } from "react";

/**
 * Per-user display preferences, kept in this browser.
 *
 *   reduceMotion    – turns off animations and transitions app-wide (adds the
 *                     "reduce-motion" class to <html>; see index.css).
 *   sidebarCompact  – the sidebar starts collapsed to icons.
 *
 * Stored under "pmwds.prefs.v1:<userId>" so people sharing a browser keep their
 * own choices. Same shape of store as ActionVisibilityContext: a module-level
 * source of truth, so any component can read it without a provider.
 */

export interface UserPreferences {
  reduceMotion: boolean;
  sidebarCompact: boolean;
}

const KEY_PREFIX = "pmwds.prefs.v1";
const AUTH_STORAGE_KEY = "pmwds-client-auth";

const DEFAULTS: UserPreferences = { reduceMotion: false, sidebarCompact: false };

function keyFor(userId: string | null | undefined): string {
  return userId ? `${KEY_PREFIX}:${userId}` : KEY_PREFIX;
}

function peekStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown };
    return typeof parsed.userId === "string" && parsed.userId ? parsed.userId : null;
  } catch {
    return null;
  }
}

function parse(raw: string | null): UserPreferences {
  if (!raw) return { ...DEFAULTS };
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof UserPreferences, unknown>>;
    return {
      reduceMotion: data.reduceMotion === true,
      sidebarCompact: data.sidebarCompact === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function read(key: string): UserPreferences {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return { ...DEFAULTS };
  }
}

function applyToDocument(prefs: UserPreferences): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", prefs.reduceMotion);
}

let activeKey = keyFor(peekStoredUserId());
let store: UserPreferences = read(activeKey);
applyToDocument(store);

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function getUserPreferences(): UserPreferences {
  return store;
}

export function setUserPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
  if (store[key] === value) return;
  store = { ...store, [key]: value };
  try {
    localStorage.setItem(activeKey, JSON.stringify(store));
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
  applyToDocument(store);
  notify();
}

export function resetUserPreferences(): void {
  store = { ...DEFAULTS };
  try {
    localStorage.removeItem(activeKey);
  } catch {
    // ignore
  }
  applyToDocument(store);
  notify();
}

/** Follow the signed-in user. Null (signed out) falls back to defaults in memory. */
export function bindUserPreferences(userId: string | null | undefined): void {
  const nextKey = keyFor(userId);
  if (nextKey === activeKey) return;
  activeKey = nextKey;
  store = userId ? read(nextKey) : { ...DEFAULTS };
  applyToDocument(store);
  notify();
}

export function useUserPreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getUserPreferences, getUserPreferences);
}
