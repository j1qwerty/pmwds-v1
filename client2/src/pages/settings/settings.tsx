import { useEffect, useState } from "react";
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

type SettingsTab = "profile" | "ai" | "database" | "background";

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState("");

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "Settings", description: "Manage your profile, AI configuration, and provider settings" });
  }, [setNavHeader]);

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
    ...(canManageSystem
      ? ([
          { id: "ai", label: "AI Settings", icon: "smart_toy", description: "Providers, models & risk" },
          { id: "database", label: "Database", icon: "database", description: "Connection status" },
          { id: "background", label: "Background", icon: "wallpaper", description: "Personalize the canvas" },
        ] as TabDef[])
      : []),
  ];

  const activeTabDef = tabs.find((t) => t.id === activeTab);

  return (
    <div className="relative">
      <AnimatedBackground />

      {/* Tab Navigation — clean pill bar */}
      <div className="relative z-10 mb-5">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon name={tab.icon} size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {activeTabDef && (
          <p className="mt-2 text-xs text-slate-500 px-1">
            <Icon name="arrow_right" size={12} className="inline -mt-0.5 mr-1" />
            {activeTabDef.description}
          </p>
        )}
      </div>

      {/* Tab Content */}
      <div className="relative z-10">
        {activeTab === "profile" && (
          <ProfileSettings
            auth={auth}
            onSave={() => { addToast("Profile settings saved!"); }}
            onLogout={logout}
          />
        )}

        {activeTab === "ai" && canManageSystem && (
          <AISettings
            auth={auth}
            onSaveComplete={(msg) => addToast(msg)}
          />
        )}

        {activeTab === "database" && canManageSystem && (
          <DatabaseStatusSection
            status={databaseStatus}
            loading={databaseLoading}
            error={databaseError}
            onRetry={fetchDatabaseStatus}
          />
        )}

        {activeTab === "background" && (
          <BgControls />
        )}
      </div>
    </div>
  );
}
