import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { JSX, ReactNode } from "react";

/**
 * ActionVisibility — app-wide setting for how secondary row/card actions
 * (view, edit, …) are revealed.
 *
 *   "hover"  → secondary actions are hidden until the card/row (or the
 *              actions area itself) is hovered / keyboard-focused
 *   "always" → secondary actions are always visible
 *
 * Stored in localStorage PER USER under "pmwds.actionVisibility.v1:<userId>" as:
 *   { global: ActionVisibilityMode, entities: Partial<Record<ActionVisibilityEntity, ActionVisibilityMode>> }
 *
 * Architecture: the source of truth is a module-level store (single source,
 * persisted write-through) so BOTH the Provider path and the provider-less
 * fallback path of useActionVisibility() stay reactive and in sync. That
 * means HoverActions works on any page even before a provider is mounted
 * app-wide — and the moment a Provider is mounted, it reflects the same
 * shared state.
 */

export type ActionVisibilityEntity =
  | "projects"
  | "milestones"
  | "tasks"
  | "subtasks"
  | "users"
  | "departments"
  | "organizations"
  | "documents"
  | "reports";

export type ActionVisibilityMode = "hover" | "always";

/**
 * Legacy, browser-wide key. Settings used to be shared by everyone who signed in
 * on the same browser; they are now stored per user. The legacy value is copied
 * to the first user who binds after the upgrade, then removed (see migrateLegacy).
 */
export const ACTION_VISIBILITY_STORAGE_KEY = "pmwds.actionVisibility.v1";

/** Same key the AuthProvider persists the session under (auth.tsx). */
const AUTH_STORAGE_KEY = "pmwds-client-auth";

export function actionVisibilityKeyFor(userId: string | null | undefined): string {
  return userId ? `${ACTION_VISIBILITY_STORAGE_KEY}:${userId}` : ACTION_VISIBILITY_STORAGE_KEY;
}

/**
 * The signed-in user's id, read straight from the persisted session. Needed at
 * module load so the very first paint already uses the right user's settings,
 * before React (and therefore useAuth) exists.
 */
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

/** Canonical entity order (used by the settings section and callers). */
export const ACTION_VISIBILITY_ENTITIES: readonly ActionVisibilityEntity[] = [
  "projects",
  "milestones",
  "tasks",
  "subtasks",
  "users",
  "departments",
  "organizations",
  "documents",
  "reports",
];

export interface ActionVisibilitySettings {
  global: ActionVisibilityMode;
  entities: Partial<Record<ActionVisibilityEntity, ActionVisibilityMode>>;
}

export interface ActionVisibilityContextValue {
  /** Effective mode for an entity: entities[entity] ?? global ?? "hover". */
  modeFor: (entity: ActionVisibilityEntity) => ActionVisibilityMode;
  settings: {
    global: ActionVisibilityMode;
    entities: Partial<Record<ActionVisibilityEntity, ActionVisibilityMode>>;
  };
  setGlobal: (mode: ActionVisibilityMode) => void;
  /** null = remove the override and inherit the global mode again. */
  setEntity: (
    entity: ActionVisibilityEntity,
    mode: ActionVisibilityMode | null,
  ) => void;
  reset: () => void;
}

// ─── Parsing / persistence ──────────────────────────────────────────

function freshDefaults(): ActionVisibilitySettings {
  return { global: "hover", entities: {} };
}

function isEntityKey(key: string): key is ActionVisibilityEntity {
  return (ACTION_VISIBILITY_ENTITIES as readonly string[]).includes(key);
}

function isMode(value: unknown): value is ActionVisibilityMode {
  return value === "hover" || value === "always";
}

/** JSON parse with try/catch fallback to defaults; unknown keys/values dropped. */
function parseSettings(raw: string | null): ActionVisibilitySettings {
  if (!raw) return freshDefaults();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return freshDefaults();
    const obj = data as { global?: unknown; entities?: unknown };
    const global = isMode(obj.global) ? obj.global : "hover";
    const entities: Partial<Record<ActionVisibilityEntity, ActionVisibilityMode>> = {};
    if (obj.entities && typeof obj.entities === "object") {
      for (const [key, value] of Object.entries(obj.entities as Record<string, unknown>)) {
        if (isEntityKey(key) && isMode(value)) entities[key] = value;
      }
    }
    return { global, entities };
  } catch {
    return freshDefaults();
  }
}

/**
 * One-time upgrade: hand the old browser-wide value to the first user who needs
 * it, then delete it so the next user on this browser starts from defaults
 * instead of inheriting someone else's choices.
 */
function migrateLegacy(userKey: string): string | null {
  if (userKey === ACTION_VISIBILITY_STORAGE_KEY) return null;
  try {
    const legacy = localStorage.getItem(ACTION_VISIBILITY_STORAGE_KEY);
    if (!legacy) return null;
    localStorage.setItem(userKey, legacy);
    localStorage.removeItem(ACTION_VISIBILITY_STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

function readStoredSettings(key: string): ActionVisibilitySettings {
  try {
    const raw = localStorage.getItem(key) ?? migrateLegacy(key);
    return parseSettings(raw);
  } catch {
    return freshDefaults();
  }
}

/** Storage key of the user the module store is currently bound to. */
let activeKey = actionVisibilityKeyFor(peekStoredUserId());

function persist(next: ActionVisibilitySettings): void {
  try {
    localStorage.setItem(activeKey, JSON.stringify(next));
  } catch {
    // localStorage unavailable / full — in-memory state still updates for this session
  }
}

// ─── Module-level store (single source of truth) ────────────────────

let store: ActionVisibilitySettings = readStoredSettings(activeKey);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ActionVisibilitySettings {
  return store;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function updateStore(
  updater: (prev: ActionVisibilitySettings) => ActionVisibilitySettings,
): void {
  const next = updater(store);
  if (next === store) return;
  store = next;
  persist(next);
  notify();
}

// Stable module-level setters — shared by the Provider and the fallback API.

function setGlobal(mode: ActionVisibilityMode): void {
  updateStore((prev) =>
    prev.global === mode
      ? prev
      : { global: mode, entities: prev.entities },
  );
}

function setEntity(
  entity: ActionVisibilityEntity,
  mode: ActionVisibilityMode | null,
): void {
  updateStore((prev) => {
    const current = prev.entities[entity];
    if (mode === null ? current === undefined : current === mode) return prev;
    const entities = { ...prev.entities };
    if (mode === null) delete entities[entity];
    else entities[entity] = mode;
    return { global: prev.global, entities };
  });
}

function reset(): void {
  updateStore(() => freshDefaults());
}

/**
 * Point the store at a user. Call whenever the signed-in user changes (login,
 * logout, account switch) so one person's settings never leak into another's
 * session on a shared browser. Passing null (signed out) resets to defaults
 * in memory without touching anyone's saved settings.
 */
export function bindActionVisibilityUser(userId: string | null | undefined): void {
  const nextKey = actionVisibilityKeyFor(userId);
  if (nextKey === activeKey) return;
  activeKey = nextKey;
  store = userId ? readStoredSettings(nextKey) : freshDefaults();
  notify();
}

// Cross-tab sync (nice-to-have): react to writes from other tabs.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== activeKey) return;
    store = event.newValue ? parseSettings(event.newValue) : freshDefaults();
    notify();
  });
}

// ─── React bindings ─────────────────────────────────────────────────

const ActionVisibilityContext = createContext<ActionVisibilityContextValue | null>(null);

export function ActionVisibilityProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const value = useMemo<ActionVisibilityContextValue>(
    () => ({
      settings,
      modeFor: (entity) => settings.entities[entity] ?? settings.global ?? "hover",
      setGlobal,
      setEntity,
      reset,
    }),
    [settings],
  );

  return (
    <ActionVisibilityContext.Provider value={value}>
      {children}
    </ActionVisibilityContext.Provider>
  );
}

/**
 * Works with OR without a mounted ActionVisibilityProvider:
 * - with a Provider → the context value
 * - without → the same reactive module store (still persisted + cross-tab)
 * so HoverActions is safe to drop into any page/card immediately.
 */
export function useActionVisibility(): ActionVisibilityContextValue {
  const ctx = useContext(ActionVisibilityContext);
  const storeSettings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo<ActionVisibilityContextValue>(() => {
    if (ctx) return ctx;
    const settings = storeSettings;
    return {
      settings,
      modeFor: (entity) => settings.entities[entity] ?? settings.global ?? "hover",
      setGlobal,
      setEntity,
      reset,
    };
  }, [ctx, storeSettings]);
}
