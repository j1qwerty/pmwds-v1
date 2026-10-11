import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type Loader<T extends ComponentType<any>> = () => Promise<{ default: T }>;

export type PreloadableLazy<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<unknown>;
};

/**
 * React.lazy + a preload handle. Call `Component.preload()` on hover/focus/idle
 * so the chunk is already in cache by the time the user clicks.
 */
export function lazyPage<T extends ComponentType<any>>(loader: Loader<T>): PreloadableLazy<T> {
  let cached: Promise<{ default: T }> | null = null;
  // Drop a failed import (e.g. stale chunk after a deploy) so the next try refetches.
  const load = () =>
    (cached ??= loader().catch((err) => {
      cached = null;
      throw err;
    }));
  const Component = lazy(load) as PreloadableLazy<T>;
  Component.preload = load;
  return Component;
}

/** Run `fn` when the browser is idle (falls back to a short timeout). */
export function whenIdle(fn: () => void, timeout = 1500) {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 300);
}
