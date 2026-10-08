import type { ActivityLogRecord, User } from "../../types";
import { Avatar, EmptyState, SectionCard, ViewToggle, type ViewMode } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ActivityListProps {
  logs: ActivityLogRecord[];
  users: User[];
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ICON_MAP: Record<string, string> = {
  login: "login",
  logout: "logout",
  create: "add_circle",
  update: "edit",
  delete: "delete",
  view: "visibility",
  export: "download",
  import: "upload",
  assign: "person_add",
  complete: "check_circle",
  submit: "send",
  approve: "thumb_up",
  reject: "thumb_down",
};

function getActivityIcon(type: string): string {
  const lower = type?.toLowerCase() || "";
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return "radio_button_checked";
}

function getActivityColor(type: string): { bg: string; text: string } {
  const lower = type?.toLowerCase() || "";
  if (lower.includes("create") || lower.includes("login"))
    return { bg: "bg-emerald-50", text: "text-emerald-600" };
  if (lower.includes("delete") || lower.includes("reject"))
    return { bg: "bg-red-50", text: "text-red-600" };
  if (lower.includes("update") || lower.includes("edit"))
    return { bg: "bg-amber-50", text: "text-amber-600" };
  if (lower.includes("view") || lower.includes("export"))
    return { bg: "bg-blue-50", text: "text-blue-600" };
  return { bg: "bg-indigo-50", text: "text-indigo-600" };
}

function formatMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata, null, 2);
}

function compactTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function compactDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", sameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" }
  );
}

export function ActivityList({ logs, users, view, onViewChange }: ActivityListProps) {
  return (
    <SectionCard
      title="Activity Feed"
      description={`${logs.length} ${logs.length === 1 ? "activity" : "activities"}`}
      icon="receipt_long"
      actions={<ViewToggle value={view} onChange={onViewChange} available={["card", "list"]} />}
      bodyClassName="p-0"
    >
      {logs.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No activities found"
          description="Activities will appear here as users interact with the platform."
          accent="primary"
        />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4 view-fade">
          {logs.map((log, idx) => {
            const user = users.find((u) => u.id === log.userId);
            const userName = log.userName ?? user?.fullName;
            const icon = getActivityIcon(log.activityType);
            const color = getActivityColor(log.activityType);
            const metadata =
              typeof log.metadata === "string"
                ? log.metadata
                : formatMetadata(log.metadata as Record<string, unknown>);

            return (
              <div
                key={log.id}
                className="card-stagger rounded-xl border border-slate-200/70 bg-white p-3.5 hover:border-indigo-200 hover:shadow-sm transition-all"
                style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color.bg} ${color.text}`}>
                    <Icon name={icon} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {log.activityType}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {compactTime(log.timestamp)}
                      </span>
                    </div>
                    {log.description && (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-2">
                        {log.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {user && <Avatar person={user} size="xs" className="shadow-none ring-0" />}
                      {userName && (
                        <span className={`text-[10px] truncate ${user?.isActive === false ? "text-red-400" : "text-slate-500"}`}>
                          {userName}
                        </span>
                      )}
                      {log.projectName && (
                        <span className="text-[10px] text-slate-400 truncate">· {log.projectName}</span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                        {compactDate(log.timestamp)}
                      </span>
                    </div>
                    {metadata && (
                      <details className="mt-2">
                        <summary className="text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-600 font-semibold">
                          View metadata
                        </summary>
                        <pre className="mt-1.5 p-2 rounded-lg bg-slate-50 text-[10px] text-slate-600 overflow-x-auto font-mono border border-slate-100">
                          {metadata}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto view-fade">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Activity</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Description</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">User</th>
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Project</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const user = users.find((u) => u.id === log.userId);
                const userName = log.userName ?? user?.fullName;
                const icon = getActivityIcon(log.activityType);
                const color = getActivityColor(log.activityType);
                const metadata =
                  typeof log.metadata === "string"
                    ? log.metadata
                    : formatMetadata(log.metadata as Record<string, unknown>);

                return (
                  <tr key={log.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color.bg} ${color.text}`}>
                          <Icon name={icon} size={16} />
                        </div>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                          {log.activityType}
                        </span>
                        {metadata && (
                          <details>
                            <summary className="text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-600 font-semibold list-none inline-flex">
                              <Icon name="expand_more" size={12} />
                            </summary>
                            <pre className="mt-1 p-2 rounded-lg bg-slate-50 text-[10px] text-slate-600 overflow-x-auto font-mono border border-slate-100">
                              {metadata}
                            </pre>
                          </details>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 line-clamp-1">
                        {log.description || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {user && <Avatar person={user} size="xs" className="shadow-none ring-0" />}
                        <span className={`text-xs ${user?.isActive === false ? "text-red-400" : "text-slate-600"}`}>
                          {userName || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{log.projectName || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs font-semibold text-slate-600">{compactTime(log.timestamp)}</div>
                      <div className="text-[10px] text-slate-400">{compactDate(log.timestamp)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
