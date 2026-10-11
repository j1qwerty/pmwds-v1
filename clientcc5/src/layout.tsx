import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { preloadRoute } from "./lib/routePreload";
import { useAppData } from "./appData";
import { onStatusChanged, type RealtimeStatus } from "./realtime";
import { Avatar, NavHeaderProvider, NavHeader, NavActionButton, usePermission, BgRenderer, CommandPaletteProvider, useCommandPalette } from "./pages/shared";
import { PERMISSION_GROUPS } from "./permissions";
import { SHOW_CHAT_BUTTON, SHOW_SKILLS_PAGE } from "./featureFlags";
import { roleDisplayNames } from "./permissions";

import {
  HiOutlineHome,
  HiOutlineFolder,
  HiOutlineClipboardList,
  HiOutlineUserGroup,
  HiOutlineOfficeBuilding,
  HiOutlineCog,
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineCube,
  HiOutlineFlag,
  HiOutlineChatAlt2,
  HiOutlineSearch,
  HiOutlineBell,
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineRefresh,
} from "react-icons/hi";
import { Icon } from "./components/ui/Icon";

import { VscSymbolProperty } from "react-icons/vsc";

import {
  RiBrainLine,
  RiGitBranchLine,
  RiWebhookLine,
  RiDashboard3Line,
  RiGitRepositoryLine,
  RiBugLine,
} from "react-icons/ri";
import { ProjectsGroup } from "./pages/shared/ProjectsGroup";


// ─── Helpers ──────────────────────────────────────────────────────
function classNames(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

const iconClass = "h-[18px] w-[18px] shrink-0";

const iconMap: Record<string, React.ReactNode> = {
  home: <HiOutlineHome className={iconClass} />,
  projects: <HiOutlineFolder className={iconClass} />,
  milestones: <HiOutlineFlag className={iconClass} />,
  tasks: <HiOutlineClipboardList className={iconClass} />,
  users: <HiOutlineUserGroup className={iconClass} />,
  departments: <HiOutlineOfficeBuilding className={iconClass} />,
  organization: <RiGitRepositoryLine className={iconClass} />,
  dashboard: <RiDashboard3Line className={iconClass} />,
  integration: <RiGitBranchLine className={iconClass} />,
  webhook: <RiWebhookLine className={iconClass} />,
  skill: <HiOutlineAcademicCap className={iconClass} />,
  knowledge: <HiOutlineBookOpen className={iconClass} />,
  activity: <HiOutlineClock className={iconClass} />,
  inbox: <HiOutlineBell className={iconClass} />,
  chat: <HiOutlineChatAlt2 className={iconClass} />,
  search: <HiOutlineSearch className={iconClass} />,
  ai: <RiBrainLine className={iconClass} />,
  reports: <HiOutlineChartBar className={iconClass} />,
  settings: <HiOutlineCog className={iconClass} />,
  roles: <VscSymbolProperty className={iconClass} />,
  permissions: <HiOutlineCube className={iconClass} />,
  test: <RiBugLine className={iconClass} />,
};

/**
 * Single dark rail theme. Active state is a lifted surface plus a short accent
 * bar, never a per-section rainbow, so color only ever means "you are here".
 */
const railTheme = {
  active: "bg-white/[0.08] text-white font-medium",
  hover: "hover:bg-white/[0.05] hover:text-white",
  bgHover: "hover:bg-white/[0.05]",
  borderActive: "",
  textActive: "text-white",
  textHover: "hover:text-white",
  textDefault: "text-slate-400",
  iconActive: "text-indigo-300",
  iconDefault: "text-slate-500",
  dot: "bg-indigo-400",
  initialBg: "bg-white/[0.07]",
  initialText: "text-slate-300",
  initialActiveBg: "bg-indigo-500",
  initialActiveText: "text-white",
};

const RAIL_EXPANDED = "md:w-[256px]";
const RAIL_COMPACT = "md:w-[72px]";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="shrink-0 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">
      {children}
    </kbd>
  );
}

/** Cmd/Ctrl+K search trigger. */
function TopbarSearchButton() {
  const { openPalette } = useCommandPalette();
  return (
    <button
      onClick={openPalette}
      aria-label="Open command palette"
      title="Search everything (Ctrl K)"
      className="group hidden md:flex h-9 min-w-[220px] lg:min-w-[280px] items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-400 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-600"
    >
      <HiOutlineSearch className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">Search projects, people, tasks</span>
      <Kbd>Ctrl K</Kbd>
    </button>
  );
}

function TopbarSearchIconButton() {
  const { openPalette } = useCommandPalette();
  return (
    <button
      onClick={openPalette}
      aria-label="Open command palette"
      className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
    >
      <HiOutlineSearch className="h-[18px] w-[18px]" />
    </button>
  );
}

const topbarIconBtn =
  "relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50";

function RailLink({
  to,
  label,
  icon,
  active,
  compact,
  badge,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  compact: boolean;
  badge?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onMouseEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
      onClick={onNavigate}
      title={compact ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={classNames(
        "group relative flex h-9 items-center rounded-lg text-[13px] transition-colors duration-150",
        compact ? "justify-center" : "gap-3 px-3",
        active ? railTheme.active : `${railTheme.textDefault} ${railTheme.hover}`,
      )}
    >
      {active && !compact && (
        <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-400" />
      )}
      <span className={classNames("shrink-0 transition-colors", active ? railTheme.iconActive : `${railTheme.iconDefault} group-hover:text-slate-200`)}>
        {icon}
      </span>
      {!compact && <span className="truncate">{label}</span>}
      {badge && (
        <span
          className={classNames(
            "h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#0c0f14]",
            compact ? "absolute right-2 top-1.5" : "ml-auto",
          )}
          aria-label="Unread"
        />
      )}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { auth, logout } = useAuth();
  const perm = usePermission();
  const { data, refresh, loading } = useAppData();

  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Live-update status. Starts at "connecting" so a page load never paints the
  // offline dot before a single attempt has been made.
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  useEffect(() => onStatusChanged(setRealtimeStatus), []);

  const realtimeConnected = realtimeStatus === "connected";
  const realtimeOffline = realtimeStatus === "disconnected" || realtimeStatus === "reconnecting";

  const unreadCount = useMemo(
    () => data.notifications.filter((notification) => !notification.isRead).length,
    [data.notifications],
  );

  // matchMedia fires only when a breakpoint is crossed, unlike a resize listener.
  useEffect(() => {
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const apply = () => {
      if (tabletQuery.matches) setSidebarCompact(true);
    };
    apply();
    tabletQuery.addEventListener("change", apply);
    return () => tabletQuery.removeEventListener("change", apply);
  }, []);

  const navGroups: Array<{
    title: string;
    items: Array<{ path: string; label: string; icon: string; permissions: string[] }>;
  }> = [
    {
      title: "People and structure",
      items: [
        { path: "/organizationStructure", label: "Organizations", icon: "organization", permissions: [PERMISSION_GROUPS.organization.view] },
        { path: "/departmentsPage", label: "Departments", icon: "departments", permissions: [PERMISSION_GROUPS.department.view] },
        { path: "/users", label: "Users", icon: "users", permissions: [PERMISSION_GROUPS.user.view] },
        { path: "/profiles", label: "Profiles", icon: "users", permissions: [PERMISSION_GROUPS.user.view] },
        // Skills page is temporarily hidden for all roles - see SHOW_SKILLS_PAGE.
        ...(SHOW_SKILLS_PAGE
          ? [{ path: "/skills", label: "Skills", icon: "skill", permissions: [PERMISSION_GROUPS.user.edit] }]
          : []),
      ],
    },
    {
      title: "Insight",
      items: [
        { path: "/reports", label: "Reports", icon: "reports", permissions: [PERMISSION_GROUPS.report.view] },
        { path: "/ai", label: "AI Insights", icon: "ai", permissions: [PERMISSION_GROUPS.ai.view] },
      ],
    },
    {
      title: "Administration",
      items: [
        { path: "/roles", label: "Roles", icon: "roles", permissions: [PERMISSION_GROUPS.role.view] },
        { path: "/activity-logs", label: "Activity Logs", icon: "activity", permissions: [PERMISSION_GROUPS.activityLog.view] },
        { path: "/settings", label: "Settings", icon: "settings", permissions: [PERMISSION_GROUPS.system.manage] },
      ],
    },
  ];

  const isActive = (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));
  const closeMobile = () => setMobileSidebarOpen(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const roleLabel = roleDisplayNames(auth?.roles).join(", ");

  return (
    <CommandPaletteProvider>
      <NavHeaderProvider>
        <div className="flex min-h-[100dvh] bg-[#f3f4f7] text-on-surface font-sans antialiased">
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-[90] bg-slate-950/60 md:hidden"
              onClick={closeMobile}
              aria-hidden="true"
            />
          )}

          {/* ── Rail ───────────────────────────────────────────── */}
          <nav
            aria-label="Primary"
            className={classNames(
              "fixed left-0 top-0 z-50 flex h-full flex-col bg-[#0c0f14] transition-[width,transform] duration-200 ease-out",
              "max-md:z-[100] max-md:w-[272px]",
              mobileSidebarOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
              sidebarCompact ? RAIL_COMPACT : RAIL_EXPANDED,
            )}
          >
            {/* Brand */}
            <div className={classNames("flex h-14 shrink-0 items-center", sidebarCompact ? "justify-center" : "justify-between px-5")}>
              <Link to="/" onClick={closeMobile} title="Dashboard" className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-[15px] font-semibold tracking-tight text-white">
                  P
                </span>
                {!sidebarCompact && (
                  <span className="text-[17px] font-semibold tracking-tight text-white">PMWDS</span>
                )}
              </Link>
              {!sidebarCompact && (
                <button
                  onClick={() => setSidebarCompact(true)}
                  aria-label="Collapse sidebar"
                  className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  <HiOutlineChevronDoubleLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={closeMobile}
                aria-label="Close sidebar"
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:text-white"
              >
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>

            {sidebarCompact && (
              <button
                onClick={() => setSidebarCompact(false)}
                aria-label="Expand sidebar"
                className="hidden md:flex mx-auto mb-1 h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                <HiOutlineChevronDoubleRight className="h-4 w-4" />
              </button>
            )}

            {/* Navigation */}
            <div className={classNames("rail-scroll flex-1 overflow-y-auto pb-4", sidebarCompact ? "px-3" : "px-3")}>
              <div className="space-y-0.5 pt-2">
                <RailLink to="/" label="Dashboard" icon={iconMap.home} active={isActive("/")} compact={sidebarCompact} onNavigate={closeMobile} />
                <RailLink to="/projects" label="Projects" icon={iconMap.projects} active={isActive("/projects")} compact={sidebarCompact} onNavigate={closeMobile} />
                <RailLink
                  to="/notificationsPage"
                  label="Notifications"
                  icon={iconMap.inbox}
                  active={isActive("/notificationsPage")}
                  compact={sidebarCompact}
                  badge={unreadCount > 0}
                  onNavigate={closeMobile}
                />
              </div>

              {/* Live project shortcuts */}
              <div className="mt-3">
                <ProjectsGroup
                  theme={railTheme}
                  iconClass={iconClass}
                  compact={sidebarCompact}
                  onRequestExpand={() => setSidebarCompact(false)}
                />
              </div>

              <div className="mt-4 space-y-5">
                {navGroups.map((group) => {
                  const visibleItems = group.items.filter(
                    (item) => item.permissions.length === 0 || perm.hasAny(...item.permissions),
                  );
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={group.title}>
                      {sidebarCompact ? (
                        <div className="mx-3 mb-2 h-px bg-white/[0.07]" />
                      ) : (
                        <div className="px-3 pb-1.5 text-[11px] font-medium text-slate-500">{group.title}</div>
                      )}
                      <div className="space-y-0.5">
                        {visibleItems.map((item) => (
                          <RailLink
                            key={item.path}
                            to={item.path}
                            label={item.label}
                            icon={iconMap[item.icon]}
                            active={isActive(item.path)}
                            compact={sidebarCompact}
                            onNavigate={closeMobile}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account */}
            <div className="shrink-0 border-t border-white/[0.07] p-3">
              <div className={classNames("flex items-center rounded-lg", sidebarCompact ? "flex-col gap-2 py-1" : "gap-3 px-2 py-1.5")}>
                <Avatar
                  person={{
                    id: auth?.userId,
                    fullName: auth?.fullName || "User",
                    profilePictureUrl: auth?.profilePictureUrl,
                  }}
                  size={sidebarCompact ? "xs" : "sm"}
                  className="shrink-0 ring-1 ring-white/15"
                />
                {!sidebarCompact && (
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-medium text-white">{auth?.fullName || "User"}</div>
                    <div className="truncate text-[11px] text-slate-500">{roleLabel || "Member"}</div>
                  </div>
                )}
                <button
                  onClick={logout}
                  aria-label="Log out"
                  title="Log out"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Icon name="logout" size={16} />
                </button>
              </div>
            </div>
          </nav>

          {/* ── Main ───────────────────────────────────────────── */}
          <div
            className={classNames(
              "flex min-h-[100dvh] min-w-0 flex-1 flex-col transition-[margin] duration-200 ease-out",
              sidebarCompact ? "md:ml-[72px]" : "md:ml-[256px]",
            )}
          >
            <header className="sticky top-0 z-40 h-14 border-b border-slate-200 bg-white/[0.97]">
              <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Open sidebar"
                    className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <HiOutlineMenu className="h-5 w-5" />
                  </button>
                  <NavHeader />
                </div>

                <div className="flex items-center gap-1.5">
                  <TopbarSearchButton />
                  <TopbarSearchIconButton />

                  <button
                    onClick={() => void refresh()}
                    disabled={loading}
                    aria-label="Refresh workspace data"
                    title={
                      realtimeConnected
                        ? "Live updates connected. Click to refresh now."
                        : realtimeStatus === "connecting"
                          ? "Connecting live updates. Click to refresh now."
                          : realtimeStatus === "reconnecting"
                            ? "Live updates reconnecting. Data refreshes every 60s and on focus. Click to refresh now."
                            : "Live updates offline. Data refreshes every 60s and on focus. Click to refresh now."
                    }
                    className={topbarIconBtn}
                  >
                    <HiOutlineRefresh className={classNames("h-[18px] w-[18px]", loading && "animate-spin")} />
                    {realtimeOffline && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
                  </button>

                  <NavActionButton />

                  {SHOW_CHAT_BUTTON && (
                    <Link to="/chat" aria-label="Chat" className={topbarIconBtn}>
                      <HiOutlineChatAlt2 className="h-[18px] w-[18px]" />
                    </Link>
                  )}

                  <Link to="/notificationsPage" aria-label="Notifications" className={topbarIconBtn}>
                    <HiOutlineBell className="h-[18px] w-[18px]" />
                    {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
                  </Link>
                </div>
              </div>
            </header>

            <main className="relative mx-auto flex w-full max-w-[1680px] flex-1 flex-col gap-4 p-3 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </NavHeaderProvider>
    </CommandPaletteProvider>
  );
}

export { Layout };
