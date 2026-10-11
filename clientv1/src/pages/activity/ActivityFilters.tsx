import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "../../types";
import {
  FilterBar,
  FilterDropdown,
  PageAction,
  ViewToggle,
  type FilterChipOption,
  type ViewMode,
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
  /** New (optional): per-type event counts for the chips, and the unfiltered total for the "All" chip. */
  typeCounts?: Record<string, number>;
  totalEvents?: number;
  /** New (optional): count label shown next to the search box. */
  resultCount?: number;
  /** New (optional): card/list switch + create action rendered on the right. */
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  canCreateActivity?: boolean;
  onLogActivity?: () => void;
}

const MAX_TYPE_CHIPS = 6;

const DATE_INPUT_CLASS =
  "w-full h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all";

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
  typeCounts,
  totalEvents,
  resultCount,
  view,
  onViewChange,
  canCreateActivity,
  onLogActivity,
}: ActivityFiltersProps) {
  const [datesOpen, setDatesOpen] = useState(false);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const [datePos, setDatePos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  // The date popover renders through a portal on document.body with fixed
  // positioning (same pattern as FilterBar's FilterDropdown) so it can never
  // open behind the content cards below the filter bar.
  useLayoutEffect(() => {
    if (!datesOpen) {
      setDatePos(null);
      return;
    }
    const update = () => {
      const trigger = dateBtnRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuH = dateMenuRef.current?.offsetHeight ?? 0;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom;
      const above = spaceBelow < menuH + gap + 8 && rect.top > menuH + gap + 8;
      setDatePos({
        top: above ? rect.top - gap : rect.bottom + gap,
        left: rect.right,
        above,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [datesOpen]);

  const hasFilters = !!(selectedUserId || selectedType || searchTerm || dateRange.from || dateRange.to);
  const dateActiveCount = (dateRange.from ? 1 : 0) + (dateRange.to ? 1 : 0);

  const userOptions = [
    { value: "__my__", label: "My Activity" },
    ...users
      .filter((u) => u.isActive !== false)
      .map((u) => ({ value: u.id, label: u.fullName })),
  ];

  // Most-used types first; everything past the cap stays reachable via the dropdown.
  const sortedTypes = useMemo(
    () => [...activityTypes].sort((a, b) => (typeCounts?.[b] ?? 0) - (typeCounts?.[a] ?? 0)),
    [activityTypes, typeCounts]
  );
  const chipTypes = sortedTypes.slice(0, MAX_TYPE_CHIPS);
  const overflowTypes = sortedTypes.slice(MAX_TYPE_CHIPS);

  const typeChips: FilterChipOption[] = [
    { value: "", label: "All", count: totalEvents },
    ...chipTypes.map((type) => ({ value: type, label: type, count: typeCounts?.[type] ?? 0 })),
  ];
  const allTypeOptions = sortedTypes.map((type) => ({ value: type, label: type }));

  const clearFilters = () => {
    onUserChange("");
    onTypeChange("");
    onSearchChange("");
    onDateRangeChange({ from: "", to: "" });
  };

  return (
    <FilterBar
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search description, user, or type…"
      leftExtras={
        resultCount !== undefined ? (
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
            {resultCount} {resultCount === 1 ? "event" : "events"}
          </span>
        ) : undefined
      }
      chipGroups={[
        {
          key: "type",
          label: "Type",
          options: typeChips,
          value: selectedType,
          onChange: onTypeChange,
        },
      ]}
      actions={
        <>
          {overflowTypes.length > 0 && (
            <FilterDropdown
              value={selectedType}
              onChange={onTypeChange}
              options={allTypeOptions}
              label="Type"
              icon="layers"
              width="min-w-[150px]"
            />
          )}

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

          {/* Date-range popover */}
          <div className="relative">
            <button
              ref={dateBtnRef}
              type="button"
              onClick={() => setDatesOpen((v) => !v)}
              aria-expanded={datesOpen}
              aria-label="Filter by date range"
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all ${
                datesOpen || dateActiveCount > 0
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <Icon name="calendar_today" size={14} />
              Date
              {dateActiveCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {dateActiveCount}
                </span>
              )}
            </button>

            {datesOpen &&
              createPortal(
                <>
                  <div className="fixed inset-0 z-[1049]" onClick={() => setDatesOpen(false)} />
                  <div
                    ref={dateMenuRef}
                    style={{
                      position: "fixed",
                      top: datePos?.top ?? -9999,
                      left: datePos?.left ?? -9999,
                      transform: datePos ? `translate(-100%, ${datePos.above ? "-100%" : "0"})` : undefined,
                      visibility: datePos ? "visible" : "hidden",
                    }}
                    className="z-[1050] w-72 p-4 bg-white rounded-xl border border-slate-200/80 shadow-xl view-fade"
                  >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="activity-date-from"
                        className="block mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                      >
                        From date
                      </label>
                      <input
                        id="activity-date-from"
                        type="date"
                        aria-label="From date"
                        value={dateRange.from}
                        onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
                        className={DATE_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="activity-date-to"
                        className="block mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                      >
                        To date
                      </label>
                      <input
                        id="activity-date-to"
                        type="date"
                        aria-label="To date"
                        value={dateRange.to}
                        onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
                        className={DATE_INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => onDateRangeChange({ from: "", to: "" })}
                      className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      Reset dates
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatesOpen(false)}
                      className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                    >
                      Done
                    </button>
                  </div>
                  </div>
                </>,
                document.body
              )}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              title="Clear all filters"
              aria-label="Clear all filters"
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Icon name="filter_alt_off" size={14} />
            </button>
          )}

          {onViewChange && view && (
            <ViewToggle value={view} onChange={onViewChange} available={["card", "list"]} />
          )}

          {canCreateActivity && onLogActivity && (
            <PageAction label="Log activity" icon="add" onClick={onLogActivity} />
          )}
        </>
      }
    />
  );
}
