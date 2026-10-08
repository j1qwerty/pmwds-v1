import { useState } from "react";
import type { User } from "../../types";
import {
  FilterBar,
  FilterDropdown,
  type FilterChipOption,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

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
  const [moreOpen, setMoreOpen] = useState(false);

  const hasFilters =
    !!(selectedUserId || selectedType || searchTerm || dateRange.from || dateRange.to);

  const userOptions: FilterChipOption[] = [
    { value: "__my__", label: "My Activity" },
    ...users
      .filter((u) => u.isActive !== false)
      .map((u) => ({ value: u.id, label: u.fullName })),
  ];

  const typeOptions: FilterChipOption[] = activityTypes.map((type) => ({
    value: type,
    label: type,
  }));

  const clearFilters = () => {
    onUserChange("");
    onTypeChange("");
    onSearchChange("");
    onDateRangeChange({ from: "", to: "" });
  };

  const moreActiveCount = (dateRange.from ? 1 : 0) + (dateRange.to ? 1 : 0);

  return (
    <div>
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search activity type or description..."
        actions={
          <>
            {canViewAll && (
              <FilterDropdown
                value={selectedUserId}
                onChange={onUserChange}
                options={userOptions}
                label="User"
                icon="person"
                width="min-w-[160px]"
              />
            )}
            <FilterDropdown
              value={selectedType}
              onChange={onTypeChange}
              options={typeOptions}
              label="Type"
              icon="category"
              width="min-w-[150px]"
            />
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all ${
                moreOpen || moreActiveCount > 0
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Icon name="calendar_today" size={14} />
              Date
              {moreActiveCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {moreActiveCount}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Clear all filters"
              >
                <Icon name="filter_alt_off" size={14} />
              </button>
            )}
          </>
        }
      />

      {moreOpen && (
        <div className="mt-2 p-4 bg-white rounded-xl border border-slate-200/70 shadow-sm view-fade">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                From date
              </p>
              <input
                type="date"
                aria-label="From date"
                value={dateRange.from}
                onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
                className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                To date
              </p>
              <input
                type="date"
                aria-label="To date"
                value={dateRange.to}
                onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
                className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onDateRangeChange({ from: "", to: "" })}
                className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
              >
                Reset dates
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="h-9 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
