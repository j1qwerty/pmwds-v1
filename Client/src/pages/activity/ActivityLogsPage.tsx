import { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { ActivityLogRecord, User } from "../../types";
import {
  AnimatedBackground,
  Can,
  GlassCard,
  GradientButton,
  LoadingPage,
  PERMISSION_GROUPS,
  useNavHeader,
  usePermission,
  StatCard,
  useToast,
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
  
  // Filters
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "Activity Logs", description: "Track and monitor user activities across the platform" });
  }, [setNavHeader]);

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
  const activityTypes = useMemo(() => 
    [...new Set(logs.map(l => l.activityType).filter(Boolean))],
    [logs]
  );

  // Filter logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (selectedType) {
      result = result.filter(l => l.activityType === selectedType);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(l =>
        l.activityType.toLowerCase().includes(search) ||
        (l.description && l.description.toLowerCase().includes(search))
      );
    }

    if (dateRange.from) {
      result = result.filter(l => new Date(l.timestamp) >= new Date(dateRange.from));
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(l => new Date(l.timestamp) <= toDate);
    }

    return result;
  }, [logs, selectedType, searchTerm, dateRange]);

  // Stats
  const todayLogs = filteredLogs.filter(l => {
    const today = new Date();
    const logDate = new Date(l.timestamp);
    return logDate.toDateString() === today.toDateString();
  }).length;

  const uniqueTypes = [...new Set(filteredLogs.map(l => l.activityType))].length;
  const uniqueUsers = [...new Set(filteredLogs.map(l => l.userId))].length;

  const handleCreateLog = async (form: { activityType: string; description: string; metadata: string }) => {
    if (!auth) return;
    try {
      await api.createActivityLog(auth.token, {
        activityType: form.activityType,
        description: form.description,
        metadata: JSON.parse(form.metadata || "{}"),
      });
      addToast("Activity logged successfully.");
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Failed to log activity"}`, "error");
    }
  };

  if (loading) return <LoadingPage label="Loading activity logs..." />;

  return (
    <div>
      <AnimatedBackground />

      {/* Stats Row */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Activities" value={filteredLogs.length} color="indigo" icon="receipt_long" />
        <StatCard label="Today" value={todayLogs} color="emerald" icon="today" />
        <StatCard label="Activity Types" value={uniqueTypes} color="violet" icon="category" />
        <StatCard label="Active Users" value={uniqueUsers} color="amber" icon="people" />
      </div>

      {/* Main Layout */}
      <div className={`relative z-10 grid grid-cols-1 gap-5 ${
        canCreateActivity ? 'lg:grid-cols-[1fr_380px]' : 'lg:grid-cols-1'
      }`}>
        {/* Left: Activity List */}
        <div className="flex flex-col gap-5">
          {/* Filters */}
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
          />

          {/* Activity List */}
          <ActivityList logs={filteredLogs} users={users} />
        </div>

        {/* Right: Log Activity Form */}
        {canCreateActivity && (
          <div className="lg:sticky lg:top-7 h-fit">
            <ActivityForm onSubmit={handleCreateLog} />
          </div>
        )}
      </div>
    </div>
  );
}