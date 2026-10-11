import { Link } from "react-router-dom";
import { GlassCard } from "./GlassCard";

export function NoAccessPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-[clamp(40px,8vw,96px)]">
      <GlassCard className="max-w-[480px] w-full p-[clamp(24px,4vw,40px)] text-center">
        <div className="mx-auto mb-5 flex h-[clamp(64px,8vw,80px)] w-[clamp(64px,8vw,80px)] items-center justify-center rounded-full bg-error/10">
          <span className="material-symbols-outlined text-error text-[clamp(32px,4vw,40px)]">
            lock
          </span>
        </div>
        <h1 className="text-[clamp(22px,3vw,28px)] font-semibold text-on-surface">
          Page not found
        </h1>
        <p className="mt-3 text-[clamp(13px,1.6vw,15px)] text-on-surface-variant">
          The page you are looking for does not exist or you do not have access to it.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Go to Dashboard
        </Link>
      </GlassCard>
    </div>
  );
}
