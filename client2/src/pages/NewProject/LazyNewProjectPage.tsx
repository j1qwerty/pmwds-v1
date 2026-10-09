import { lazy, Suspense, type ComponentProps } from "react";

// The wizard (page + 7 steps) is only needed after the user clicks "New project",
// so it lives in its own chunk. It is prefetched when the browser is idle so the
// first open is instant instead of waiting on a network round-trip.
const loadWizard = () => import("./NewProjectPage").then((m) => ({ default: m.NewProjectPage }));
const NewProjectPageLazy = lazy(loadWizard);

export function preloadNewProjectWizard() {
  void loadWizard();
}

if (typeof window !== "undefined") {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(preloadNewProjectWizard);
  else window.setTimeout(preloadNewProjectWizard, 1500);
}

export function NewProjectPage(props: ComponentProps<typeof NewProjectPageLazy>) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-2xl bg-white p-16">
          <span className="size-6 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
        </div>
      }
    >
      <NewProjectPageLazy {...props} />
    </Suspense>
  );
}
