import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { resolveNotificationTarget } from "../../lib/notificationTarget";
import { useAuth } from "../../auth";
import { onDataChanged } from "../../realtime";
import { REALTIME_SCOPES } from "../../realtimeScopes";
import type { AlertRuleRecord, Department, NotificationItem, NotificationTemplateRecord } from "../../types";
import {
  AnimatedBackground,
  LoadingPage,
  useNavHeader,
  Modal,
  ModalCancelButton,
  ModalDangerButton,
  PERMISSION_GROUPS,
  usePermission,
  StatCard,
  TabButton,
  useToast,
} from "../shared";
import { NotificationInbox } from "./NotificationInbox";
import { NotificationTemplates } from "./NotificationTemplates";
import { NotificationRules } from "./NotificationRules";
import { BroadcastModal } from "./BroadcastModal";
import { TemplateFormModal } from "./TemplateFormModal";
import { RuleFormModal } from "./RuleFormModal";

export function NotificationsPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const perm = usePermission();
  const canConfigure = perm.isSuperAdmin;
  const canBroadcast = perm.has(PERMISSION_GROUPS.notification.broadcast);
  const { addToast } = useToast();
  const { setNavHeader } = useNavHeader();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateRecord[]>([]);
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "templates" | "rules">("inbox");
  const [notificationView, setNotificationView] = useState<"all" | "unread">("all");

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [templateModal, setTemplateModal] = useState<{ open: boolean; editTemplate?: NotificationTemplateRecord }>({ open: false });
  const [ruleModal, setRuleModal] = useState<{ open: boolean; editRule?: AlertRuleRecord }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "template" | "rule";
    id: string;
    name: string;
  }>({ open: false, type: "template", id: "", name: "" });

  useEffect(() => {
    setNavHeader({
      title: "Notifications",
      description: canConfigure ? "Manage inbox, templates, and alert rules" : "Manage your notification inbox",
      action: canBroadcast ? {
        label: "Broadcast",
        onClick: () => setBroadcastOpen(true),
        icon: "campaign",
      } : undefined,
    });
  }, [setNavHeader, canConfigure, canBroadcast]);

  const loadInbox = useCallback(async () => {
    if (!auth) return;
    setItems(await api.getNotifications(auth.token));
  }, [auth]);

  const loadTemplates = useCallback(async () => {
    if (!auth || !canConfigure) return;
    setTemplates(await api.getNotificationTemplates(auth.token));
  }, [auth, canConfigure]);

  const loadRules = useCallback(async () => {
    if (!auth || !canConfigure) return;
    setRules(await api.getAlertRules(auth.token));
  }, [auth, canConfigure]);

  const loadDepartments = useCallback(async () => {
    if (!auth || !canBroadcast) return;
    setDepartments(await api.getDepartments(auth.token));
  }, [auth, canBroadcast]);

  useEffect(() => {
    if (!auth) return;
    let disposed = false;
    setLoading(true);
    loadInbox()
      .catch((cause) => {
        if (!disposed) addToast(cause instanceof Error ? cause.message : "Failed to load notifications", "error");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => { disposed = true; };
  }, [auth, loadInbox, addToast]);

  useEffect(() => {
    if (!auth) return;
    let timer: number | undefined;
    const stopListening = onDataChanged((notification) => {
      if (notification.scope !== REALTIME_SCOPES.notifications) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadInbox().catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to refresh notifications", "error"));
      }, 250);
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      stopListening();
    };
  }, [auth, loadInbox, addToast]);

  useEffect(() => {
    if (!canConfigure) {
      setActiveTab("inbox");
      return;
    }
    if (activeTab === "templates") void loadTemplates();
    if (activeTab === "rules") void loadRules();
  }, [activeTab, canConfigure, loadTemplates, loadRules]);

  const handleOpenNotification = async (item: NotificationItem) => {
    if (!auth) return;
    if (!item.isRead) {
      try {
        await api.markNotificationRead(auth.token, item.id);
        setItems((current) => current.map((notification) => notification.id === item.id ? { ...notification, isRead: true } : notification));
      } catch {
        // Acknowledgement failure must not block navigation.
      }
    }

    const target = resolveNotificationTarget(item);
    if (target.kind === "none") return;

    if (target.kind === "task") {
      try {
        const task = await api.getTask(auth.token, target.taskId);
        navigate(`/projects/${task.projectId}/tasks?taskId=${task.id}`);
      } catch {
        addToast("The linked task could not be opened.", "error");
      }
      return;
    }
    navigate(target.path);
  };

  const handleMarkAllRead = async () => {
    if (!auth) return;
    await api.markAllNotificationsRead(auth.token);
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    addToast("All notifications marked as read.");
  };

  const handleMarkRead = async (id: string) => {
    if (!auth) return;
    await api.markNotificationRead(auth.token, id);
    setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
  };

  const handleDeleteNotification = async (id: string) => {
    if (!auth) return;
    await api.deleteNotification(auth.token, id);
    setItems((current) => current.filter((item) => item.id !== id));
    addToast("Notification deleted.");
  };

  const handleBroadcast = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    await api.broadcastNotification(auth.token, payload);
    setBroadcastOpen(false);
    addToast("Broadcast sent successfully.");
  };

  const handleTemplateSubmit = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    if (templateModal.editTemplate) {
      await api.updateNotificationTemplate(auth.token, templateModal.editTemplate.id, payload);
      addToast("Template updated.");
    } else {
      await api.createNotificationTemplate(auth.token, payload);
      addToast("Template created.");
    }
    setTemplateModal({ open: false });
    await loadTemplates();
  };

  const handleRuleSubmit = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    if (ruleModal.editRule) {
      await api.updateAlertRule(auth.token, ruleModal.editRule.id, payload);
      addToast("Rule updated.");
    } else {
      await api.createAlertRule(auth.token, payload);
      addToast("Rule created.");
    }
    setRuleModal({ open: false });
    await loadRules();
  };

  const handleDelete = async () => {
    if (!auth) return;
    if (deleteConfirm.type === "template") {
      await api.deleteNotificationTemplate(auth.token, deleteConfirm.id);
      await loadTemplates();
    } else {
      await api.deleteAlertRule(auth.token, deleteConfirm.id);
      await loadRules();
    }
    addToast(`${deleteConfirm.type === "template" ? "Template" : "Rule"} deleted.`);
    setDeleteConfirm({ open: false, type: "template", id: "", name: "" });
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  const ensureDepartmentsLoaded = async () => {
    if (departments.length === 0) await loadDepartments();
  };

  const filteredItems = notificationView === "unread" ? items.filter((item) => !item.isRead) : items;

  if (loading) return <LoadingPage label="Loading notifications..." />;

  return (
    <div>
      <AnimatedBackground />

      {/* Stats Row */}
      <div className={`relative z-10 grid grid-cols-2 ${canConfigure ? "md:grid-cols-4" : "md:grid-cols-2"} gap-3 mb-5`}>
        <StatCard label="Total Notifications" value={items.length} color="indigo" icon="notifications" />
        <StatCard label="Unread" value={unreadCount} color="amber" icon="mark_email_unread" />
        {canConfigure && (
          <>
            <StatCard label="Templates" value={templates.length} color="emerald" icon="description" />
            <StatCard label="Alert Rules" value={rules.length} color="violet" icon="rule" />
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div className="relative z-10 mb-5">
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          <TabButton active={activeTab === "inbox"} onClick={() => setActiveTab("inbox")} icon="inbox" label="Inbox" count={unreadCount} countColor="amber" />
          {canConfigure && (
            <>
              <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")} icon="description" label="Templates" count={templates.length} />
              <TabButton active={activeTab === "rules"} onClick={() => setActiveTab("rules")} icon="rule" label="Alert Rules" count={rules.length} />
            </>
          )}
        </div>
      </div>

      {/* Active tab content */}
      <div className="relative z-10">
        {activeTab === "inbox" && (
          <NotificationInbox
            items={filteredItems}
            unreadCount={unreadCount}
            totalCount={items.length}
            view={notificationView}
            onViewChange={setNotificationView}
            onOpen={handleOpenNotification}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onDelete={handleDeleteNotification}
            onBroadcast={() => { void ensureDepartmentsLoaded(); setBroadcastOpen(true); }}
            canWrite={canBroadcast}
          />
        )}

        {activeTab === "templates" && canConfigure && (
          <NotificationTemplates
            templates={templates}
            onEdit={(template) => setTemplateModal({ open: true, editTemplate: template })}
            onDelete={(template) => setDeleteConfirm({ open: true, type: "template", id: template.id, name: template.templateType })}
            onCreate={() => setTemplateModal({ open: true })}
            canWrite={canConfigure}
          />
        )}

        {activeTab === "rules" && canConfigure && (
          <NotificationRules
            rules={rules}
            onEdit={(rule) => setRuleModal({ open: true, editRule: rule })}
            onDelete={(rule) => setDeleteConfirm({ open: true, type: "rule", id: rule.id, name: rule.name })}
            onCreate={() => setRuleModal({ open: true })}
            canWrite={canConfigure}
          />
        )}
      </div>

      {/* Modals — render themselves with the new <Modal> wrapper */}
      {broadcastOpen && canBroadcast && (
        <BroadcastModal
          departments={departments}
          onSubmit={handleBroadcast}
          onCancel={() => setBroadcastOpen(false)}
        />
      )}

      {templateModal.open && canConfigure && (
        <TemplateFormModal
          initialData={templateModal.editTemplate}
          onSubmit={handleTemplateSubmit}
          onCancel={() => setTemplateModal({ open: false })}
        />
      )}

      {ruleModal.open && canConfigure && (
        <RuleFormModal
          initialData={ruleModal.editRule}
          onSubmit={handleRuleSubmit}
          onCancel={() => setRuleModal({ open: false })}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, type: "template", id: "", name: "" })}
        title="Confirm Deletion"
        description={`This will permanently delete "${deleteConfirm.name}".`}
        icon="warning"
        accent="danger"
        size="sm"
        footer={
          <>
            <ModalCancelButton
              onClick={() => setDeleteConfirm({ open: false, type: "template", id: "", name: "" })}
            />
            <ModalDangerButton onClick={handleDelete} label="Delete Permanently" />
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">info</span>
          <span>This action cannot be undone. The {deleteConfirm.type} will be removed permanently.</span>
        </div>
      </Modal>
    </div>
  );
}
