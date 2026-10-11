import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
 * The bar wraps (flex-wrap) so the search field, chips, ViewToggle and sort
 * dropdown always stay visible; the search input is flex-1 with a 220px
 * floor so its placeholder is NEVER truncated. The root is a solid glass
 * card, and dropdown menus render through a portal (see FilterDropdown) so
 * they can never open behind card grids.
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
      className={`flex flex-wrap items-center gap-2.5 p-2.5 bg-white/97  rounded-xl border border-slate-200/70 shadow-sm ${className}`}
    >
      {onSearchChange && (
        <div className="relative flex-1 min-w-[220px]">
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

      <div className="ml-auto flex items-center gap-2 flex-wrap">
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

/**
 * Single-select dropdown filter (used when there are too many options for chips).
 *
 * The open menu is rendered through a portal on document.body with fixed
 * positioning computed from the trigger rect, so it ALWAYS paints above card
 * grids / glass cards regardless of ancestor stacking contexts. Flips above
 * the trigger when there is no room below. Closes on outside click, Esc,
 * and follows the trigger on scroll/resize.
 */
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
    alignRight: boolean;
    above: boolean;
  } | null>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const menuW = menu?.offsetWidth ?? 0;
    const menuH = menu?.offsetHeight ?? 0;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < menuH + gap + 8 && rect.top > menuH + gap + 8;
    // Right-align to the trigger when there is room; otherwise left-align so
    // the menu never slides off the left edge of the viewport.
    const alignRight = rect.right - Math.max(menuW, rect.width) >= 8;
    setPos({
      top: above ? rect.top - gap : rect.bottom + gap,
      left: alignRight ? rect.right : rect.left,
      minWidth: rect.width,
      alignRight,
      above,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();

    const handleReposition = () => updatePosition();
    const handlePointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Capture phase: keep ancestor modals/sheets from also handling Esc
        event.stopPropagation();
        setOpen(false);
      }
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              transform: pos
                ? `translate(${pos.alignRight ? "-100%" : "0"}, ${pos.above ? "-100%" : "0"})`
                : undefined,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[1050]"
          >
            <div
              style={{ minWidth: pos?.minWidth ?? undefined }}
              className="w-max max-w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden py-1 max-h-72 overflow-y-auto dropdown-menu-enter"
            >
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
          </div>,
          document.body
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
      icon="unfold_more"
      options={options}
      width="min-w-[180px]"
    />
  );
}
