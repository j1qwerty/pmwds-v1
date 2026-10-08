import { Icon } from "../../../components/ui/Icon";
import { getStatusColor } from "../../shared/index";
import { formatLakhs } from "../../../lib/formatters";

const statusHexColors: Record<string, string> = {
  Planning: "#06b6d4",
  Active: "#3b82f6",
  Total: "#0ea5e9",
  Pending: "#94a3b8",
  NotStarted: "#94a3b8",
  Todo: "#94a3b8",
  InProgress: "#3b82f6",
  Completed: "#10b981",
  Delayed: "#f59e0b",
  OnHold: "#a855f7",
  Cancelled: "#ef4444",
};

function hexFromStatus(status: string): string {
  return statusHexColors[status] || "#94a3b8";
}

function getHealthColor(score: number): string {
  if (score >= 80) return "emerald";
  if (score >= 60) return "cyan";
  if (score >= 40) return "amber";
  if (score >= 20) return "rose";
  return "red";
}

function getRiskColor(score: number): string {
  if (score <= 20) return "emerald";
  if (score <= 40) return "cyan";
  if (score <= 60) return "amber";
  if (score <= 80) return "rose";
  return "red";
}

const gaugeHexMap: Record<string, string> = {
  emerald: "#10b981",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  rose: "#f43f5e",
  red: "#ef4444",
};

export function AIGauge({
  label,
  value,
  subtitle,
  type = "health",
}: {
  label: string;
  value: number;
  subtitle?: string;
  type?: "health" | "risk";
}) {
  const score = Math.max(0, Math.min(100, value));
  const colorKey = type === "health" ? getHealthColor(score) : getRiskColor(score);
  const strokeColor = gaugeHexMap[colorKey];
  const circ = Math.PI * 50;
  const offset = circ - (score / 100) * circ;

  const bgClasses: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className={`rounded-2xl border p-4 flex flex-col items-center ${bgClasses[colorKey]}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{label}</span>
      <svg width="140" height="90" viewBox="0 0 140 100">
        <path d="M 20 80 A 50 50 0 1 1 120 80" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M 20 80 A 50 50 0 1 1 120 80"
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="text-2xl font-bold mt-1" style={{ color: strokeColor }}>{Math.round(score)}</span>
      {subtitle && <span className="text-[10px] text-slate-500 mt-0.5">{subtitle}</span>}
    </div>
  );
}

export function TaskStatusDonut({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-xs">No tasks</div>;
  }

  const radius = 65;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const len = (d.count / total) * circ;
      const seg = { ...d, len, offset: -offset };
      offset += len;
      return seg;
    });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx="80" cy="80" r={radius}
            fill="none"
            stroke={hexFromStatus(seg.status)}
            strokeWidth="18"
            strokeDasharray={`${seg.len} ${circ - seg.len}`}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
          />
        ))}
        <text x="80" y="76" textAnchor="middle" className="text-lg font-bold" fill="#334155">{total}</text>
        <text x="80" y="92" textAnchor="middle" className="text-[9px]" fill="#94a3b8">Total</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments.map((seg) => {
          const c = getStatusColor(seg.status);
          return (
            <div key={seg.status} className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className="text-slate-500">{seg.status}</span>
              <span className="font-semibold text-slate-700">{seg.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MilestoneTimeline({
  milestones,
  startDate,
  endDate,
  onNavigate,
}: {
  milestones: { id: string; name: string; dueDate: string; status: string; progressPercentage: number }[];
  startDate: string;
  endDate: string;
  onNavigate?: (id: string) => void;
}) {
  if (!milestones.length) {
    return <div className="text-center text-slate-400 text-xs py-8">No milestones defined</div>;
  }

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const range = end - start || 1;
  const now = Date.now();

  return (
    <div className="space-y-3">
      {milestones.map((m) => {
        const due = new Date(m.dueDate).getTime();
        const overdue = m.status !== "Completed" && due < now;
        const color = getStatusColor(m.status);

        return (
          <div
            key={m.id}
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() => onNavigate?.(m.id)}
          >
            <div className="w-8 text-right shrink-0">
              <div className={`w-2 h-2 rounded-full mx-auto ${color.dot} ${overdue ? "animate-pulse" : ""}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                  {m.name}
                </span>
                {m.status === "Completed" && (
                  <Icon name="check-circle" size={12} className="text-emerald-500 shrink-0" />
                )}
                {overdue && (
                  <span className="text-[9px] font-semibold text-red-500 shrink-0">OVERDUE</span>
                )}
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color.bg}`}
                  style={{ width: `${Math.min(m.progressPercentage, 100)}%` }}
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-400 shrink-0 text-right w-20">
              {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BudgetBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{formatLakhs(value)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
