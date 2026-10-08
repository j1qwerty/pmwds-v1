import { Suspense, useEffect, type ReactNode } from "react";
import { lazyPage, whenIdle } from "../../lib/lazyPage";

/** The wizard is large and only needed on click, so it ships as its own chunk. */
export const LazyNewProjectPage = lazyPage(() =>
  import("./NewProjectPage").then((m) => ({ default: m.NewProjectPage })),
);

export const preloadWizard = () => void LazyNewProjectPage.preload();

/** Warm the wizard chunk shortly after the host page is idle. */
export function useWarmWizard() {
  useEffect(() => {
    whenIdle(preloadWizard, 3000);
  }, []);
}

/** Same footprint as the wizard card so opening it never shifts the layout. */
export function WizardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 min-h-[360px]" aria-busy="true">
      <div className="h-5 w-48 rounded bg-slate-100 animate-pulse mb-6" />
      <div className="h-9 w-full rounded-lg bg-slate-100 animate-pulse mb-3" />
      <div className="h-24 w-full rounded-lg bg-slate-100 animate-pulse" />
    </div>
  );
}

export function WizardBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<WizardSkeleton />}>{children}</Suspense>;
}
