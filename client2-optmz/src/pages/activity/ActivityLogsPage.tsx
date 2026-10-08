import { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { ActivityLogRecord, User } from "../../types";
import {
  AnimatedBackground,
  EmptyState,
  GlassCard,
  PageAction,
  PageContainer,
  PageSkeleton,
  PERMISSION_GROUPS,
  StatCard,
  useNavHeader,
  usePermission,
  useToast,
  type ViewMode,
} from "../shared";
import { ActivityList } from "./ActivityList";
import { ActivityForm } from "./ActivityForm";
import { ActivityFilters } from "./ActivityFilters";

export function ActivityLogsPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const isAdmin = perm.isAdmin;
  const isManager = perm.has(PERMISSION_GROUPS.activityLog.view);
  const canViewAll = perm.has(PERMISSION_GROUPS.activityLog.view);
  const canCreateActivity = perm.has(PERMISSION_GROUPS.activityLog.create);

  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("card");
  const [formOpen, setFormOpen] = useState(false);

  // Filters
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Activity Logs",
      description: "Audit trail of user activity across your organization",
      ...(canCreateActivity
        ? {
            actions: [
              { label: "Log activity", icon: "note_add", onClick: () => setFormOpen(true) },
            ],
          }
        : {}),
    });
  }, [setNavHeader, canCreateActivity]);

  const loadData = () => {
    if (!auth) return;
    setLoading(true);

    const loadUsers = canViewAll ? api.getUsers(auth.token) : Promise.resolve([]);

    // Determine which logs to fetch based on role
    let logsRequest;
    if (isAdmin) {
      // SuperAdmin sees all logs
      logsRequest = selectedUserId
        ? api.getUserActivityLogs(auth.token, selectedUserId)
        : api.getAllActivityLogs(auth.token).catch(() => api.getMyActivityLogs(auth.token));
    } else if (isManager) {
      // ProjectManager/DepartmentHead sees team/project logs
      logsRequest = selectedUserId
        ? api.getUserActivityLogs(auth.token, selectedUserId)
        : api.getTeamActivityLogs(auth.token).catch(() => api.getMyActivityLogs(auth.token));
    } else {
      // Regular users see only their own logs
      logsRequest = api.getMyActivityLogs(auth.token);
    }

    Promise.all([loadUsers, logsRequest])
      .then(([userData, logData]) => {
        setUsers(userData as User[]);
        setLogs(logData);
      })
      .catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to load activity logs.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [auth, selectedUserId]);

  // Get unique activity types for filter
  const activityTypes = useMemo(
    () => [...new Set(logs.map((l) => l.activityType).filter(Boolean))],
    [logs]
  );

  // Per-type counts for the filter chips (derived from the loaded logs)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      if (log.activityType) counts[log.activityType] = (counts[log.activityType] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (selectedType) {
      result = result.filter((l) => l.activityType === selectedType);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter((l) => {
        const user = users.find((u) => u.id === l.userId);
        const matchesUser =
          !!user &&
          (user.fullName.toLowerCase().includes(search) ||
            user.email.toLowerCase().includes(search));
        const matchesLogUser = !!l.userName && l.userName.toLowerCase().includes(search);
        return (
          l.activityType.toLowerCase().includes(search) ||
          (l.description && l.description.toLowerCase().includes(search)) ||
          matchesUser ||
          matchesLogUser
        );
      });
    }

    if (dateRange.from) {
      result = result.filter((l) => new Date(l.timestamp) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.timestamp) <= toDate);
    }

    return result;
  }, [logs, users, selectedType, searchTerm, dateRange]);

  // KPI stats derived from the loaded logs
  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    let today = 0;
    let created = 0;
    let updated = 0;
    for (const log of logs) {
      if (new Date(log.timestamp).toDateString() === todayKey) today += 1;
      const type = log.activityType.toLowerCase();
      if (type.includes("create") || type.includes("add")) created += 1;
      if (type.includes("update") || type.includes("edit")) updated += 1;
    }
    return { total: logs.length, today, created, updated };
  }, [logs]);

  const hasActiveFilters = !!(selectedUserId || selectedType || searchTerm || dateRange.from || dateRange.to);

  const handleCreateLog = async (form: { activityType: string; description: string; metadata: string }) => {
    if (!auth) return false;
    try {
      await api.createActivityLog(auth.token, {
        activityType: form.activityType,
        description: form.description,
        metadata: JSON.parse(form.metadata || "{}"),
      });
      addToast("Activity logged successfully.");
      loadData();
      return true;
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Failed to log activity"}`, "error");
      return false;
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Total events" value={stats.total} color="indigo" icon="receipt_long" />
            <StatCard label="Today" value={stats.today} color="emerald" icon="today" />
            <StatCard label="Created" value={stats.created} color="violet" icon="add_circle" />
            <StatCard label="Updated" value={stats.updated} color="amber" icon="edit" />
          </>
        }
        filters={
          <ActivityFilters
            users={users}
            activityTypes={activityTypes}
            selectedUserId={selectedUserId}
            selectedType={selectedType}
            searchTerm={searchTerm}
            dateRange={dateRange}
            onUserChange={setSelectedUserId}
            onTypeChange={setSelectedType}
            onSearchChange={setSearchTerm}
            onDateRangeChange={setDateRange}
            canViewAll={canViewAll}
            typeCounts={typeCounts}
            totalEvents={logs.length}
            resultCount={filteredLogs.length}
            view={view}
            onViewChange={setView}
            canCreateActivity={canCreateActivity}
            onLogActivity={() => setFormOpen(true)}
          />
        }
      >
        {filteredLogs.length === 0 ? (
          <GlassCard className="view-fade">
            <EmptyState
              icon="history"
              title="No activity found"
              description="Nothing matches the current filters. Adjust or clear the filters, or log a new activity to see it here."
              accent="primary"
              action={
                hasActiveFilters || canCreateActivity ? (
                  <div className="flex items-center justify-center gap-2">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId("");
                          setSelectedType("");
                          setSearchTerm("");
                          setDateRange({ from: "", to: "" });
                        }}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                      >
                        Clear filters
                      </button>
                    )}
                    {canCreateActivity && (
                      <PageAction label="Log activity" icon="add" onClick={() => setFormOpen(true)} />
                    )}
                  </div>
                ) : undefined
              }
            />
          </GlassCard>
        ) : (
          <div key={view} className="view-fade">
            <ActivityList logs={filteredLogs} users={users} view={view} />
          </div>
        )}
      </PageContainer>

      {canCreateActivity && (
        <ActivityForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreateLog}
        />
      )}
    </div>
  );
}
