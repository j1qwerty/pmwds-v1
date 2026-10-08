import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import { PERMISSION_GROUPS, usePermission } from "./RoleGate";
import { Icon } from "../../components/ui/Icon";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  group: string;
  keywords?: string;
  shortcut?: string;
  perform: () => void;
}

interface CommandGroup {
  title: string;
  items: CommandItem[];
}

function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  // Subsequence match (fuzzy)
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return 0;
    streak = idx === ti ? streak + 1 : 1;
    score += 2 + streak;
    ti = idx + 1;
  }
  return score;
}

/**
 * Global command palette (Ctrl/Cmd + K).
 *
 * Groups:
 *  - Pages        — every route the current user can access
 *  - Actions      — quick global actions (refresh data, new project…)
 *  - Projects     — lazy entity search against already-loaded workspace data
 *  - People       — user search (permission-gated)
 *
 * Keyboard: Ctrl/Cmd+K open · Esc close · ↑/↓ navigate · Enter execute.
 * The browser default for Ctrl/Cmd+K is prevented.
 */
export function CommandPalette({
  open,
  onClose,
  actions = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Page-level extra actions injected by the current screen (optional) */
  actions?: CommandItem[];
}) {
  const { auth } = useAuth();
  const { data: appData } = useAppData();
  const perm = usePermission();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // visible/exiting mirror the Modal.tsx pattern: open=false → exiting=true →
  // unmount after the 0.12s exit animation finishes.
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync open state with internal visibility for the exit animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the query each time the palette opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after paint so the input is mounted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Esc closes even when the input has lost focus (document-level, like Modal)
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !exiting) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, exiting, onClose]);

  const can = useCallback(
    (permission: string | string[] | undefined) =>
      !permission || (Array.isArray(permission) ? permission.some((p) => perm.has(p)) : perm.has(permission)),
    [perm],
  );

  // ── Build the command set ───────────────────────────────────────────
  const pageCommands = useMemo<CommandItem[]>(() => {
    const pages: CommandItem[] = [
      { id: "page-dashboard", label: "Dashboard", icon: "dashboard", group: "Pages", keywords: "home overview", perform: () => navigate("/") },
      { id: "page-projects", label: "Projects", icon: "folder", group: "Pages", keywords: "portfolio delivery work", perform: () => navigate("/projects") },
      { id: "page-notifications", label: "Notifications", icon: "bell", group: "Pages", keywords: "alerts inbox", perform: () => navigate("/notificationsPage") },
      { id: "page-ai", label: "AI Insights", icon: "auto_awesome", group: "Pages", keywords: "neural predictions risk burnout chat", perform: () => navigate("/ai") },
    ];
    if (can(PERMISSION_GROUPS.organization.view))
      pages.push({ id: "page-org", label: "Organizations", icon: "corporate_fare", group: "Pages", keywords: "structure org company", perform: () => navigate("/organizationStructure") });
    if (can(PERMISSION_GROUPS.department.view))
      pages.push({ id: "page-departments", label: "Departments", icon: "apartment", group: "Pages", keywords: "teams units", perform: () => navigate("/departmentsPage") });
    if (can(PERMISSION_GROUPS.user.view)) {
      pages.push({ id: "page-users", label: "Users", icon: "group", group: "Pages", keywords: "people members staff team", perform: () => navigate("/users") });
      pages.push({ id: "page-profiles", label: "Profiles", icon: "badge", group: "Pages", keywords: "people details account", perform: () => navigate("/profiles") });
    }
    if (can(PERMISSION_GROUPS.report.view))
      pages.push({ id: "page-reports", label: "Reports", icon: "description", group: "Pages", keywords: "export documents generate", perform: () => navigate("/reports") });
    if (can(PERMISSION_GROUPS.role.view))
      pages.push({ id: "page-roles", label: "Roles & Permissions", icon: "admin_panel_settings", group: "Pages", keywords: "access control rbac admin", perform: () => navigate("/roles") });
    if (can(PERMISSION_GROUPS.activityLog.view))
      pages.push({ id: "page-activity", label: "Activity Logs", icon: "history", group: "Pages", keywords: "audit trail history changes", perform: () => navigate("/activity-logs") });
    if (perm.has(PERMISSION_GROUPS.system.manage))
      pages.push({ id: "page-settings", label: "Settings", icon: "settings", group: "Pages", keywords: "configuration system ai preferences", perform: () => navigate("/settings") });
    return pages;
  }, [can, perm]);

  const actionCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      ...actions,
    ];
    return items;
  }, [actions]);

  const projectCommands = useMemo<CommandItem[]>(() => {
    if (!query) return [];
    return appData.projects.slice(0, 8).map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      hint: p.status,
      icon: "folder_open",
      group: "Projects",
      keywords: `${p.name} ${p.status} ${p.description ?? ""}`,
      perform: () => navigate(`/projects/${p.id}`),
    }));
  }, [appData.projects, query, navigate]);

  const peopleCommands = useMemo<CommandItem[]>(() => {
    if (!query || !can(PERMISSION_GROUPS.user.view)) return [];
    return appData.users.slice(0, 8).map((u) => ({
      id: `user-${u.id}`,
      label: u.fullName,
      hint: u.email,
      icon: "person",
      group: "People",
      keywords: `${u.fullName} ${u.email}`,
      perform: () => navigate(`/profiles?user=${u.id}`),
    }));
  }, [appData.users, query, can, navigate]);

  const groups = useMemo<CommandGroup[]>(() => {
    const all: CommandGroup[] = [
      { title: "Actions", items: actionCommands },
      { title: "Pages", items: pageCommands },
      { title: "Projects", items: projectCommands },
      { title: "People", items: peopleCommands },
    ];

    if (!query.trim()) return all.filter((g) => g.items.length > 0).map((g) => ({
      ...g,
      items: g.items.slice(0, g.title === "Pages" ? 8 : 6),
    }));

    const scored = all.map((g) => ({
      ...g,
      items: g.items
        .map((item) => {
          const s = Math.max(
            fuzzyScore(query, item.label),
            item.keywords ? fuzzyScore(query, item.keywords) * 0.8 : 0,
            item.hint ? fuzzyScore(query, item.hint) * 0.5 : 0,
          );
          return { item, s };
        })
        .filter(({ s }) => s > 0)
        .sort((a, b) => b.s - a.s)
        .map(({ item }) => item),
    }));
    return scored.filter((g) => g.items.length > 0);
  }, [actionCommands, pageCommands, projectCommands, peopleCommands, query]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keep the active item inside the viewport
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const runItem = useCallback(
    (item: CommandItem) => {
      onClose();
      // Let the palette close before the action navigates/opens UI
      setTimeout(() => item.perform(), 10);
    },
    [onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) runItem(item);
    }
  };

  if (!visible) return null;

  let itemCounter = -1;

  // Portal to document.body: escapes any ancestor transform/contain stacking
  // context that would collapse `fixed inset-0` / width to a containing block.
  return createPortal(
    <div
      className={`fixed inset-0 z-[1100] flex items-start justify-center pt-[12vh] px-4 ${
        exiting ? "cmdk-backdrop-exit" : "cmdk-backdrop-enter"
      }`}
      style={{
        background: "rgba(15, 23, 42, 0.5)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !exiting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className={`w-[min(42rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200/80 overflow-hidden ${
          exiting ? "cmdk-panel-exit" : "cmdk-panel-enter"
        }`}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Icon name="search" size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search pages, projects, people, actions…"
            className="flex-1 h-13 py-3.5 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center h-5.5 px-1.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div className="py-10 text-center">
              <Icon name="search_off" size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No results for “{query}”</p>
              <p className="text-xs text-slate-400 mt-1">Try a different term, or search projects and people by name.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="mb-1">
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  itemCounter += 1;
                  const idx = itemCounter;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-cmd-index={idx}
                      onMouseMove={() => setActiveIndex(idx)}
                      onClick={() => runItem(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active ? "bg-indigo-50/80" : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <Icon name={item.icon ?? "chevron-right"} size={15} />
                      </div>
                      <span className={`flex-1 min-w-0 text-sm font-medium truncate ${active ? "text-indigo-900" : "text-slate-700"}`}>
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="text-xs text-slate-400 truncate max-w-[160px] hidden sm:block">{item.hint}</span>
                      )}
                      {item.shortcut && (
                        <kbd className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500">
                          {item.shortcut}
                        </kbd>
                      )}
                      {active && <Icon name="arrow-forward" size={14} className="text-indigo-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 text-[10px] font-medium text-slate-400">
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex items-center h-4.5 px-1 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500">⌘K</kbd>
            <span className="text-slate-300">/</span>
            <kbd className="inline-flex items-center h-4.5 px-1 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-500">Ctrl K</kbd>
            to open
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex items-center h-4.5 px-1 rounded bg-white border border-slate-200 text-[9px] font-bold text-slate-500">↑↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex items-center h-4.5 px-1 rounded bg-white border border-slate-200 text-[9px] font-bold text-slate-500">↵</kbd>
            open
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="inline-flex items-center h-4.5 px-1 rounded bg-white border border-slate-200 text-[9px] font-bold text-slate-500">esc</kbd>
            close
          </span>
          <span className="ml-auto hidden sm:inline">
            {location.pathname !== "/" ? "Search everything, everywhere" : "PMWDS Workspace"}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
