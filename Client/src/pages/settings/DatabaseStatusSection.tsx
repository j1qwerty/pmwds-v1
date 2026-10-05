import type { DatabaseStatus } from "../../types";
import { GlassCard } from "../shared";

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
    <GlassCard className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500">database</span>
            Database
          </h3>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Retry"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : status ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DatabaseTile label="Provider" value={status.provider} />
              <DatabaseTile label="Connection" value={status.connectionName} />
              <DatabaseTile label="Fallback" value={status.isFallback ? "Yes" : "No"} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Data Source</div>
              <div className="text-sm font-mono text-slate-700 break-all">{status.dataSource}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Selection Log</div>
              <div className="space-y-1">
                {status.attempts.map((attempt, index) => (
                  <div key={`${attempt}-${index}`} className="text-xs text-slate-600">
                    {attempt}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </GlassCard>
  );
}

function DatabaseTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
