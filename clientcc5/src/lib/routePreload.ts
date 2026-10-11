// Maps a route path to a chunk preloader. Registered by App.tsx.
const registry = new Map<string, () => Promise<unknown>>();

export function registerRoutePreload(path: string, preload: () => Promise<unknown>) {
  registry.set(path, preload);
}

export function preloadRoute(path: string) {
  const key = [...registry.keys()].find((k) => path === k || path.startsWith(k + "/"));
  if (key) void registry.get(key)!().catch(() => undefined);
}
