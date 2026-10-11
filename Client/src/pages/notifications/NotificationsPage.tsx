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
  useToast,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { NotificationInbox } from "./NotificationInbox";
import { NotificationTemplates } from "./NotificationTemplates";
import { NotificationRules } from "./NotificationRules";
import { BroadcastModal } from "./BroadcastModal";
import { TemplateFormModal } from "./TemplateFormModal";
import { RuleFormModal } from "./RuleFormModal";

type NotificationsTab = "inbox" | "templates" | "rules";

const TABS: { key: NotificationsTab; label: string; icon: string }[] = [
  { key: "inbox", label: "Inbox", icon: "hi-inbox" },
  { key: "templates", label: "Templates", icon: "description" },
  { key: "rules", label: "Alert rules", icon: "rule" },
];

export function NotificationsPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const perm = usePermission();
  const canConfigure =
    perm.isSuperAdmin ||
    perm.hasAny(
      PERMISSION_GROUPS.notification.manage,
      PERMISSION_GROUPS.notification.template,
      PERMISSION_GROUPS.notification.rule,
    );
  const canBroadcast = perm.has(PERMISSION_GROUPS.notification.broadcast);
  const { addToast } = useToast();
  const { setNavHeader } = useNavHeader();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateRecord[]>([]);
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NotificationsTab>("inbox");
  const [notificationView, setNotificationView] = useState<"all" | "unread">("all");
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        label: "New broadcast",
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
    if (activeTab === "templates") {
      setTemplatesLoading(true);
      void loadTemplates().finally(() => setTemplatesLoading(false));
    }
    if (activeTab === "rules") {
      setRulesLoading(true);
      void loadRules().finally(() => setRulesLoading(false));
    }
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
    if (!auth || deleteLoading) return;
    setDeleteLoading(true);
    try {
      if (deleteConfirm.type === "template") {
        await api.deleteNotificationTemplate(auth.token, deleteConfirm.id);
        await loadTemplates();
      } else {
        await api.deleteAlertRule(auth.token, deleteConfirm.id);
        await loadRules();
      }
      addToast(`${deleteConfirm.type === "template" ? "Template" : "Rule"} deleted.`);
      setDeleteConfirm({ open: false, type: "template", id: "", name: "" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  const ensureDepartmentsLoaded = async () => {
    if (departments.length === 0) await loadDepartments();
  };

  const filteredItems = notificationView === "unread" ? items.filter((item) => !item.isRead) : items;

  const closeDeleteConfirm = () => setDeleteConfirm({ open: false, type: "template", id: "", name: "" });

  const visibleTabs = TABS.filter((tab) => tab.key === "inbox" || canConfigure);
  const deleteEntityLabel = deleteConfirm.type === "template" ? "template" : "alert rule";

  if (loading) return <LoadingPage label="Loading notifications..." />;

  return (
    <div>
      <AnimatedBackground />

      {/* Tabs — clean underline style */}
      <div className="relative z-10 mb-4">
        <div
          role="tablist"
          aria-label="Notification sections"
          className="flex items-stretch gap-1 overflow-x-auto border-b border-slate-200/80"
        >
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.key;
            const count =
              tab.key === "inbox" ? unreadCount : tab.key === "templates" ? templates.length : rules.length;
            const countTone =
              tab.key === "inbox" && count > 0
                ? "bg-amber-100 text-amber-700"
                : active
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-slate-100 text-slate-500";
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                  active ? "text-indigo-600" : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-700"
                }`}
              >
                <Icon name={tab.icon} size={16} className={active ? "text-indigo-600" : "text-slate-400"} />
                {tab.label}
                {count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${countTone}`}>{count}</span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div key={activeTab} className="view-fade relative z-10">
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
            loading={templatesLoading}
            onEdit={(template) => setTemplateModal({ open: true, editTemplate: template })}
            onDelete={(template) => setDeleteConfirm({ open: true, type: "template", id: template.id, name: template.templateType })}
            onCreate={() => setTemplateModal({ open: true })}
            canWrite={canConfigure}
          />
        )}

        {activeTab === "rules" && canConfigure && (
          <NotificationRules
            rules={rules}
            loading={rulesLoading}
            onEdit={(rule) => setRuleModal({ open: true, editRule: rule })}
            onDelete={(rule) => setDeleteConfirm({ open: true, type: "rule", id: rule.id, name: rule.name })}
            onCreate={() => setRuleModal({ open: true })}
            canWrite={canConfigure}
          />
        )}
      </div>

      {/* Modals — render themselves with the shared <Modal> wrapper */}
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
        onClose={closeDeleteConfirm}
        title={`Delete ${deleteEntityLabel}`}
        description={`This will permanently delete "${deleteConfirm.name}".`}
        icon="delete"
        accent="danger"
        size="sm"
        footer={
          <>
            <ModalCancelButton onClick={closeDeleteConfirm} />
            <ModalDangerButton onClick={handleDelete} loading={deleteLoading} label="Delete permanently" />
          </>
        }
      >
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <Icon name="info" size={14} className="mt-0.5 shrink-0" />
          <span>
            This action cannot be undone. The {deleteEntityLabel} will be removed permanently and any automation
            relying on it will stop.
          </span>
        </div>
      </Modal>
    </div>
  );
}
