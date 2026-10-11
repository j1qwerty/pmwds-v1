import type { DatabaseStatus } from "../../types";
import { SectionCard, StatCard, EmptyState } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface DatabaseStatusSectionProps {
  status: DatabaseStatus | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

export function DatabaseStatusSection({
  status,
  loading,
  error,
  onRetry,
}: DatabaseStatusSectionProps) {
  return (
    <SectionCard
      title="Database status"
      description="Connection provider and selection log"
      icon="hi-database"
      actions={
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all"
        >
          <Icon name={loading ? "hourglass_top" : "refresh"} size={14} />
          {loading ? "Loading..." : "Retry"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2.5">
            <Icon name="error" size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Connection error</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading && !status ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : status ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="Provider" value={status.provider} color="indigo" icon="hub" />
              <StatCard label="Connection" value={status.connectionName} color="violet" icon="link" />
              <StatCard
                label="Fallback"
                value={status.isFallback ? "Active" : "Primary"}
                color={status.isFallback ? "amber" : "emerald"}
                icon="swap_horiz"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Data source
              </div>
              <div className="text-sm font-mono text-slate-700 break-all">{status.dataSource}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon name="history" size={14} className="text-slate-400" />
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Selection log
                </div>
              </div>
              <div className="space-y-1.5">
                {status.attempts.map((attempt, index) => (
                  <div
                    key={`${attempt}-${index}`}
                    className="text-xs text-slate-600 flex items-start gap-2"
                  >
                    <span className="text-slate-300 font-mono shrink-0">{String(index + 1).padStart(2, "0")}.</span>
                    <span>{attempt}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : !error ? (
          <EmptyState
            icon="database"
            title="No database status available"
            description="Click Retry to fetch the latest connection information."
            accent="neutral"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
