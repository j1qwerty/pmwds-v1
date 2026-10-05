import type { ActivityLogRecord, User } from "../../types";
import { Avatar, GlassCard } from "../shared";

interface ActivityListProps {
  logs: ActivityLogRecord[];
  users: User[];
}

export function ActivityList({ logs, users }: ActivityListProps) {
  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, string> = {
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
    const lowerType = type?.toLowerCase() || "";
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerType.includes(key)) return icon;
    }
    return "radio_button_checked";
  };

  const getActivityColor = (type: string) => {
    const lowerType = type?.toLowerCase() || "";
    if (lowerType.includes("create") || lowerType.includes("login")) return "text-emerald-500 bg-emerald-50";
    if (lowerType.includes("delete") || lowerType.includes("reject")) return "text-red-500 bg-red-50";
    if (lowerType.includes("update") || lowerType.includes("edit")) return "text-amber-500 bg-amber-50";
    if (lowerType.includes("view") || lowerType.includes("export")) return "text-blue-500 bg-blue-50";
    return "text-indigo-500 bg-indigo-50";
  };

  const formatMetadata = (metadata: Record<string, unknown> | null) => {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return JSON.stringify(metadata, null, 2);
  };

  return (
    <GlassCard className="overflow-hidden flex flex-col max-h-[calc(100vh-335px)]">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Activity Feed</h3>
          <p className="text-xs text-slate-400">{logs.length} activities</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">receipt_long</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">No activities found</h4>
            <p className="text-xs text-slate-400">
              Activities will appear here as users interact with the platform
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const user = users.find(u => u.id === log.userId);
              const userName = log.userName ?? user?.fullName;
              const icon = getActivityIcon(log.activityType);
              const colorClass = getActivityColor(log.activityType);
              const metadata = typeof log.metadata === 'string' 
                ? log.metadata 
                : formatMetadata(log.metadata as Record<string, unknown>);

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Activity Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                      <span className="material-symbols-outlined text-lg">{icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Activity Header */}
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {log.activityType}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Description */}
                      {log.description && (
                        <p className="text-sm text-slate-600 mb-1.5">{log.description}</p>
                      )}

                      {/* User Info */}
                      {userName && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {user && <Avatar person={user} size="xs" className="shadow-none ring-0" />}
                          <span className={`text-[10px] ${user?.isActive === false ? "text-red-400" : "text-slate-400"}`}>{userName}</span>
                          {log.projectName && (
                            <span className="text-[10px] text-slate-400">/ {log.projectName}</span>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      {metadata && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-600 font-medium">
                            View metadata
                          </summary>
                          <pre className="mt-1.5 p-2 rounded-lg bg-slate-50 text-[11px] text-slate-600 overflow-x-auto font-mono">
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
        )}
      </div>
    </GlassCard>
  );
}
