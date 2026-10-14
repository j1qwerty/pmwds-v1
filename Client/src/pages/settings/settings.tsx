import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { DatabaseStatus } from "../../types";
import {
  AnimatedBackground,
  BgControls,
  PERMISSION_GROUPS,
  usePermission,
  useNavHeader,
  useToast,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { ProfileSettings } from "./ProfileSettings";
import { AISettings } from "./AISettings";
import { DatabaseStatusSection } from "./DatabaseStatusSection";
import { ActionVisibilitySettings } from "./ActionVisibilitySettings";
import { PreferencesSettings } from "./PreferencesSettings";

type SettingsTab = "profile" | "actions" | "preferences" | "ai" | "database" | "background";

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: string;
  description: string;
}

export function SettingsPage() {
  const { logout, auth } = useAuth();
  const perm = usePermission();
  const canManageSystem = perm.has(PERMISSION_GROUPS.system.manage);

  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as SettingsTab | null;
  const [activeTab, setActiveTabState] = useState<SettingsTab>(requestedTab ?? "profile");
  // Keep the tab in the URL so a settings section can be linked to or reloaded.
  const setActiveTab = (tab: SettingsTab) => {
    setActiveTabState(tab);
    setSearchParams(tab === "profile" ? {} : { tab }, { replace: true });
  };
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState("");

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Settings",
      description: canManageSystem
        ? "Manage your profile, display preferences, AI configuration, and system settings"
        : "Manage your profile and how the app looks and behaves for you",
    });
  }, [setNavHeader, canManageSystem]);

  const fetchDatabaseStatus = async () => {
    if (!auth || !canManageSystem) return;
    setDatabaseLoading(true);
    setDatabaseError("");
    try {
      setDatabaseStatus(await api.getDatabaseStatus(auth.token));
    } catch (e) {
      setDatabaseError(e instanceof Error ? e.message : "Failed to load database status");
    } finally {
      setDatabaseLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStatus();
  }, [auth, canManageSystem]);

  const tabs: TabDef[] = [
    { id: "profile", label: "Profile", icon: "person", description: "Personal information & account" },
    { id: "actions", label: "Row & card actions", icon: "visibility", description: "Hover vs always-visible actions" },
    { id: "preferences", label: "Preferences", icon: "tune", description: "Motion and sidebar" },
    ...(canManageSystem
      ? ([
          { id: "ai", label: "AI Settings", icon: "auto_awesome", description: "Providers, models & risk threshold" },
          { id: "database", label: "Database", icon: "hi-database", description: "Connection status & provider log" },
          { id: "background", label: "Background", icon: "hi-color-swatch", description: "Personalize the canvas" },
        ] as TabDef[])
      : []),
  ];

  // A link to a tab the person cannot open (e.g. ?tab=database for a non-admin)
  // falls back to Profile instead of rendering an empty page.
  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const currentTab = activeTabDef.id;

  return (
    <div className="relative">
      <AnimatedBackground />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-5 items-start">
        {/* ── Section nav — vertical rail on desktop, chip scroller on mobile ── */}
        <nav
          aria-label="Settings sections"
          className="lg:sticky lg:top-20"
        >
          {/* Mobile: horizontal chip scroller */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden -mx-1 px-1">
            {tabs.map((tab) => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold transition-all chip-pop ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical rail */}
          <div className="hidden lg:flex flex-col gap-1 p-2 bg-white/97  border border-slate-200/60 rounded-2xl shadow-sm">
            {tabs.map((tab) => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20"
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-800"
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      active
                        ? "bg-white/15 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                    }`}
                  >
                    <Icon name={tab.icon} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-bold ${active ? "text-white" : "text-slate-800"}`}>
                      {tab.label}
                    </span>
                    <span className={`block text-[11px] leading-snug mt-0.5 ${active ? "text-white/70" : "text-slate-400"}`}>
                      {tab.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content area ── */}
        <div className="min-w-0">
          {activeTabDef && (
            <div className="flex items-center gap-2 mb-4 px-1">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon name={activeTabDef.icon} size={16} className="text-indigo-600" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800 leading-tight">{activeTabDef.label}</h2>
                <p className="text-[11px] text-slate-400">{activeTabDef.description}</p>
              </div>
            </div>
          )}

          <div key={currentTab} className="view-fade">
            {currentTab === "profile" && (
              <ProfileSettings
                auth={auth}
                onSave={() => { addToast("Profile settings saved!"); }}
                onLogout={logout}
              />
            )}

            {currentTab === "actions" && (
              <ActionVisibilitySettings />
            )}

            {currentTab === "preferences" && <PreferencesSettings />}

            {currentTab === "ai" && canManageSystem && (
              <AISettings
                auth={auth}
                onSaveComplete={(msg) => addToast(msg)}
              />
            )}

            {currentTab === "database" && canManageSystem && (
              <DatabaseStatusSection
                status={databaseStatus}
                loading={databaseLoading}
                error={databaseError}
                onRetry={fetchDatabaseStatus}
              />
            )}

            {currentTab === "background" && (
              <BgControls />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
