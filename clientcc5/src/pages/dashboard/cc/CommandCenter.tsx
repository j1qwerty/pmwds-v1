import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { NotificationItem, Project, ProjectDashboardData, Task, TaskDashboardStats } from "../../../types";
import { formatLakhs } from "../../../lib/formatters";
import { Icon } from "../../../components/ui/Icon";

export interface ActivityPoint {
  day: string;
  value: number;
  events: { label: string; count: number }[];
}

interface CommandCenterProps {
  userName: string;
  projects: Project[];
  dashboard: ProjectDashboardData | null;
  taskStats: TaskDashboardStats | null;
  escalatedTasks: Task[];
  unread: NotificationItem[];
  activity: ActivityPoint[];
  onOpenTask: (task: Task) => void;
  onOpenNotification: (item: NotificationItem) => void;
}

// ─── helpers ──────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  InProgress: "In progress",
  OnHold: "On hold",
  Completed: "Completed",
  Delayed: "Delayed",
  Planning: "Planning",
  Planned: "Planned",
  Active: "Active",
};

const STATUS_TONE: Record<string, string> = {
  Delayed: "text-rose-700 bg-rose-50 ring-rose-200",
  Completed: "text-emerald-700 bg-emerald-50 ring-emerald-200",
  OnHold: "text-amber-700 bg-amber-50 ring-amber-200",
};

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** The API stores delay risk as 0..1; tolerate values already expressed as 0..100. */
function toPercent(score: number) {
  const value = Number.isFinite(score) ? score : 0;
  return Math.round(Math.min(100, Math.max(0, value <= 1 ? value * 100 : value)));
}

function riskBand(rawScore: number) {
  const score = toPercent(rawScore);
  if (score >= 70) return { label: "High", tone: "text-rose-700", bar: "bg-rose-500" };
  if (score >= 35) return { label: "Medium", tone: "text-amber-700", bar: "bg-amber-500" };
  return { label: "Low", tone: "text-emerald-700", bar: "bg-emerald-500" };
}

function isDelayed(p: Project) {
  if (p.status === "Delayed") return true;
  if (p.status === "Completed" || p.progressPercentage >= 100) return false;
  return Boolean(p.plannedEndDate && new Date(p.plannedEndDate).getTime() < Date.now());
}

function shortDate(value?: string | null) {
  if (!value) return "No date";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white ${className}`}>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyNote({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Icon name={icon} size={18} />
      </span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="max-w-[16rem] text-xs text-slate-500">{hint}</p>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────
function Kpi({ label, value, hint, tone = "text-slate-900", to }: { label: string; value: number | string; hint?: string; tone?: string; to?: string }) {
  const navigate = useNavigate();
  const body = (
    <>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1.5 h-4 truncate text-xs text-slate-400">{hint}</div>
    </>
  );
  const cls = "block px-5 py-4 text-left transition-colors hover:bg-slate-50";
  return to ? (
    <button type="button" onClick={() => navigate(to)} className={cls}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ─── main ─────────────────────────────────────────────────────────
export function CommandCenter({ userName, projects, dashboard, taskStats, escalatedTasks, unread, activity, onOpenTask, onOpenNotification }: CommandCenterProps) {
  const total = dashboard?.totalProjects ?? projects.length;
  const inProgress = dashboard?.activeProjects ?? projects.filter((p) => p.status === "InProgress").length;
  const delayed = dashboard?.delayedProjects ?? projects.filter(isDelayed).length;
  const highRisk = dashboard?.highRiskProjects ?? projects.filter((p) => toPercent(p.aiDelayRiskScore) >= 70).length;
  const tasksOpen = (taskStats?.inProgressTasks ?? 0) + (taskStats?.onHoldTasks ?? 0);
  const tasksDelayed = taskStats?.delayedTasks ?? 0;

  const budget = dashboard?.totalBudget ?? 0;
  const spent = dashboard?.totalActualCost ?? 0;
  const spentPct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const ranked = useMemo(
    () =>
      [...projects]
        .filter((p) => p.status !== "Completed" && p.progressPercentage < 100)
        .sort((a, b) => Number(isDelayed(b)) - Number(isDelayed(a)) || b.aiDelayRiskScore - a.aiDelayRiskScore)
        .slice(0, 8),
    [projects],
  );

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (delayed > 0) parts.push(`${delayed} project${delayed === 1 ? " is" : "s are"} delayed`);
    if (escalatedTasks.length > 0) parts.push(`${escalatedTasks.length} task${escalatedTasks.length === 1 ? " is" : "s are"} escalated`);
    if (unread.length > 0) parts.push(`${unread.length} unread notification${unread.length === 1 ? "" : "s"}`);
    return parts.length ? parts.join(", ") + "." : "Nothing needs your attention right now.";
  }, [delayed, escalatedTasks.length, unread.length]);

  const maxActivity = Math.max(1, ...activity.map((a) => a.value));
  const weekTotal = activity.reduce((s, a) => s + a.value, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {greeting()}, {userName.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{summary}</p>
      </div>

      {/* KPI strip: one surface, hairline dividers, no per-metric colors */}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        <Kpi label="Projects" value={total} hint={`${inProgress} in progress`} to="/projects" />
        <Kpi label="Delayed projects" value={delayed} tone={delayed ? "text-rose-600" : "text-slate-900"} hint={delayed ? "Past planned end" : "On schedule"} to="/projects" />
        <Kpi label="High delay risk" value={highRisk} tone={highRisk ? "text-amber-600" : "text-slate-900"} hint="AI risk 70% and above" to="/projects" />
        <Kpi label="Open tasks" value={tasksOpen} hint={`${taskStats?.completedTasks ?? 0} completed`} />
        <Kpi label="Delayed tasks" value={tasksDelayed} tone={tasksDelayed ? "text-rose-600" : "text-slate-900"} hint={`${taskStats?.totalTasks ?? 0} tasks in total`} />
        <Kpi label="Budget spent" value={budget > 0 ? `${spentPct}%` : "n/a"} hint={budget > 0 ? `${formatLakhs(spent)} of ${formatLakhs(budget)}` : "No budget set"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Portfolio */}
        <Panel
          title="Projects by urgency"
          className="xl:col-span-8"
          action={<Link to="/projects" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">All projects</Link>}
        >
          {ranked.length === 0 ? (
            <EmptyNote icon="folder_open" title="No active projects" hint="Projects you can access will be ranked here by delay and risk." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-slate-400">
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    <th className="px-2 py-2.5 font-medium">Status</th>
                    <th className="px-2 py-2.5 font-medium">Progress</th>
                    <th className="px-2 py-2.5 font-medium">Delay risk</th>
                    <th className="px-4 py-2.5 text-right font-medium">Planned end</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((p) => {
                    const delayedNow = isDelayed(p);
                    const statusKey = delayedNow ? "Delayed" : p.status;
                    const band = riskBand(p.aiDelayRiskScore);
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-slate-50">
                        <td className="max-w-[260px] px-4 py-3">
                          <Link to={`/projects/${p.id}`} className="block truncate font-medium text-slate-900 group-hover:text-indigo-700">
                            {p.name}
                          </Link>
                          <span className="font-mono text-[11px] text-slate-400">{p.projectCode}</span>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[statusKey] ?? "text-slate-600 bg-slate-50 ring-slate-200"}`}>
                            {STATUS_LABEL[statusKey] ?? statusKey}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, p.progressPercentage))}%` }} />
                            </div>
                            <span className="w-9 text-xs tabular-nums text-slate-600">{Math.round(p.progressPercentage)}%</span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span className={`text-xs font-medium ${band.tone}`}>{band.label}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-slate-400">{toPercent(p.aiDelayRiskScore)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-500">{shortDate(p.plannedEndDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Needs attention */}
        <Panel
          title="Needs attention"
          className="xl:col-span-4"
          action={escalatedTasks.length > 0 ? <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 tabular-nums">{escalatedTasks.length}</span> : undefined}
        >
          {escalatedTasks.length === 0 ? (
            <EmptyNote icon="check_circle" title="No escalations" hint="Escalated tasks appear here so they are never missed." />
          ) : (
            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
              {escalatedTasks.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTask(t)} className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50">
                    <span className="truncate text-sm font-medium text-slate-900">{t.title}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{t.projectName || "General"}</span>
                      <span className="shrink-0 text-slate-300">/</span>
                      <span className="shrink-0 tabular-nums">Due {shortDate(t.dueDate)}</span>
                    </span>
                    {t.assignedToUserName && <span className="text-xs text-slate-400">{t.assignedToUserName}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Activity */}
        <Panel title="Team activity, last 7 days" className="xl:col-span-7" action={<span className="text-xs tabular-nums text-slate-400">{weekTotal} events</span>}>
          {weekTotal === 0 ? (
            <EmptyNote icon="insights" title="No activity this week" hint="Task, milestone and project events will be charted here." />
          ) : (
            <div className="flex h-[200px] items-end gap-3 px-5 pb-4 pt-6">
              {activity.map((a) => (
                <div
                  key={a.day}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center gap-2"
                  title={[`${a.day}: ${a.value} event${a.value === 1 ? "" : "s"}`, ...a.events.map((e) => `${e.label} ${e.count}`)].join("\n")}
                >
                  <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[11px] tabular-nums text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">{a.value}</span>
                    <div
                      className="w-full rounded-t-md bg-indigo-500/80 transition-colors group-hover:bg-indigo-600"
                      style={{ height: `${Math.max(4, (a.value / maxActivity) * 85)}%`, minHeight: 4 }}
                    />
                  </div>
                  <span className="truncate text-[11px] text-slate-500">{a.day}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Notifications */}
        <Panel title="Unread notifications" className="xl:col-span-5" action={<Link to="/notificationsPage" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open inbox</Link>}>
          {unread.length === 0 ? (
            <EmptyNote icon="notifications_off" title="All caught up" hint="New notifications will appear here." />
          ) : (
            <ul className="max-h-[260px] divide-y divide-slate-100 overflow-y-auto">
              {unread.slice(0, 8).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onOpenNotification(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">{timeAgo(n.createdDate)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
