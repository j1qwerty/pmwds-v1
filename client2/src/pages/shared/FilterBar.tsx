import { useState, type ReactNode } from "react";
import { Icon } from "../../components/ui/Icon";

export interface FilterChipOption<T = string> {
  value: T;
  label: string;
  count?: number;
  /** Optional accent: status colors etc. */
  color?: { dot?: string; text?: string; bg?: string };
}

interface FilterBarProps {
  /** Search box */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Quick chip filters (status, priority, etc.) — single select per group */
  chipGroups?: {
    key: string;
    label?: string;
    options: FilterChipOption[];
    value: string;
    onChange: (value: string) => void;
    multi?: boolean;
  }[];

  /** Right-aligned actions (view toggle, sort dropdown, etc.) */
  actions?: ReactNode;

  /** Optional left-aligned content (e.g. a count label) */
  leftExtras?: ReactNode;

  className?: string;
}

/**
 * Unified filter bar for list/table pages.
 *
 * Layout: [search] ... [chip filters] ... [actions]
 *
 * Visually similar to the AI page header: clean white pill, subtle border,
 * tight spacing.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  chipGroups = [],
  actions,
  leftExtras,
  className = "",
}: FilterBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm ${className}`}
    >
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon name="search" size={15} />
          </span>
          <input
            type="text"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-8 pr-3 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>
      )}

      {leftExtras}

      {chipGroups.map((group) => (
        <ChipGroup key={group.key} group={group} />
      ))}

      <div className="ml-auto flex items-center gap-2">
        {actions}
      </div>
    </div>
  );
}

function ChipGroup({
  group,
}: {
  group: NonNullable<FilterBarProps["chipGroups"]>[number];
}) {
  // Multi-select chips
  if (group.multi) {
    const selected = group.value
      ? group.value.split(",").filter(Boolean)
      : [];
    const toggle = (val: string) => {
      const next = selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val];
      group.onChange(next.join(","));
    };
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {group.label && (
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            {group.label}
          </span>
        )}
        {group.options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all chip-pop ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              {opt.color?.dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${opt.color.dot}`} />
              )}
              {opt.label}
              {opt.count !== undefined && (
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Single-select chips
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {group.label && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
          {group.label}
        </span>
      )}
      {group.options.map((opt) => {
        const active = opt.value === group.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => group.onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all chip-pop ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            {opt.color?.dot && (
              <span className={`w-1.5 h-1.5 rounded-full ${opt.color.dot}`} />
            )}
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Single-select dropdown filter (used when there are too many options for chips) */
export function FilterDropdown({
  value,
  onChange,
  options,
  label,
  icon,
  width = "min-w-[150px]",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; dot?: string }[];
  label?: string;
  icon?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all ${width}`}
      >
        {icon && <Icon name={icon} size={14} className="text-slate-400" />}
        {label && <span className="text-slate-400">{label}:</span>}
        {selected?.dot && <span className={`w-1.5 h-1.5 rounded-full ${selected.dot}`} />}
        <span className="truncate">{selected?.label ?? "All"}</span>
        <Icon
          name="expand_more"
          size={14}
          className={`text-slate-400 transition-transform ml-auto ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+4px)] min-w-full w-max max-w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                !value ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All {label?.toLowerCase() ?? "options"}
            </button>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
                  opt.value === value
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Sort dropdown — convenience wrapper around FilterDropdown */
export function SortDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <FilterDropdown
      value={value}
      onChange={onChange}
      label="Sort"
      icon="sort"
      options={options}
      width="min-w-[180px]"
    />
  );
}
