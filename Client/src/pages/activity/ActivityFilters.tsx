import type { User } from "../../types";
import { GlassCard } from "../shared";

interface ActivityFiltersProps {
  users: User[];
  activityTypes: string[];
  selectedUserId: string;
  selectedType: string;
  searchTerm: string;
  dateRange: { from: string; to: string };
  onUserChange: (userId: string) => void;
  onTypeChange: (type: string) => void;
  onSearchChange: (term: string) => void;
  onDateRangeChange: (range: { from: string; to: string }) => void;
  canViewAll: boolean;
}

export function ActivityFilters({
  users,
  activityTypes,
  selectedUserId,
  selectedType,
  searchTerm,
  dateRange,
  onUserChange,
  onTypeChange,
  onSearchChange,
  onDateRangeChange,
  canViewAll,
}: ActivityFiltersProps) {
  const hasFilters = selectedUserId || selectedType || searchTerm || dateRange.from || dateRange.to;

  const clearFilters = () => {
    onUserChange("");
    onTypeChange("");
    onSearchChange("");
    onDateRangeChange({ from: "", to: "" });
  };

  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* User Filter */}
        {canViewAll && (
          <select
            value={selectedUserId}
            onChange={(e) => onUserChange(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">All Users</option>
            <option value="__my__">My Activity</option>
            <option value="" disabled>──</option>
            {users.filter((u) => u.isActive !== false).map((user) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </select>
        )}

        {/* Type Filter */}
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        >
          <option value="">All Types</option>
          {activityTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 bg-white outline-none focus:border-indigo-300 transition-all"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 bg-white outline-none focus:border-indigo-300 transition-all"
          />
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </GlassCard>
  );
}