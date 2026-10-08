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
  TabButton,
  useToast,
} from "../shared";
import { ProfileSettings } from "./ProfileSettings";
import { AISettings } from "./AISettings";
import { DatabaseStatusSection } from "./DatabaseStatusSection";
import { DocumentArchiveSettings } from "./DocumentArchiveSettings";

export function SettingsPage() {
  const { logout, auth } = useAuth();
  const perm = usePermission();
  const canManageSystem = perm.has(PERMISSION_GROUPS.system.manage);

  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"profile" | "ai" | "database" | "background" | "documents">("profile");
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

  return (
    <div>
      <AnimatedBackground />





      {/* Tab Navigation */}
      <div className="relative z-10 mb-5">
        <div className="flex gap-2 border-b border-slate-200">
          <TabButton
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            icon="person"
            label="Profile"
          />
          {canManageSystem && (
            <>
              <TabButton
                active={activeTab === "ai"}
                onClick={() => setActiveTab("ai")}
                icon="smart_toy"
                label="AI Settings"
              />
              <TabButton
                active={activeTab === "database"}
                onClick={() => setActiveTab("database")}
                icon="database"
                label="Database"
              />
              <TabButton
                active={activeTab === "background"}
                onClick={() => setActiveTab("background")}
                icon="wallpaper"
                label="Background"
              />
              <TabButton
                active={activeTab === "documents"}
                onClick={() => setActiveTab("documents")}
                icon="archive"
                label="Documents"
              />
            </>
          )}
        </div>
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
        {activeTab === "documents" && canManageSystem && (
          <DocumentArchiveSettings auth={auth} onSaved={addToast} />
        )}
      </div>
    </div>
  );
}


