import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Milestone,
  ProjectDocument,
  ProjectDocumentCapabilities,
  Task,
} from "../../../types";
import { api } from "../../../api";
import { Permission, usePermission } from "../../shared/RoleGate";
import { onDataChanged } from "../../../realtime";
import { DOCUMENT_SCOPES } from "../../../realtimeScopes";
import {
  UtilizationCertificates,
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
  EmptyState,
  SectionCard,
} from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

interface DocumentsSectionProps {
  projectId: string;
  authToken?: string | null;
  milestones?: Milestone[];
  tasks?: Task[];
}

type DocumentTab = "all" | "project" | "milestone" | "task" | "uc";
type UploadLevel = "project" | "milestone" | "task";

const TABS: Array<{ id: DocumentTab; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "folder" },
  { id: "project", label: "Project", icon: "folder_shared" },
  { id: "milestone", label: "Milestone", icon: "flag" },
  { id: "task", label: "Task", icon: "task" },
  { id: "uc", label: "UC", icon: "workspace_premium" },
];

export function DocumentsSection({
  projectId,
  authToken,
  milestones = [],
  tasks = [],
}: DocumentsSectionProps) {
  const perm = usePermission();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [capabilities, setCapabilities] = useState<ProjectDocumentCapabilities | null>(null);
  const [activeTab, setActiveTab] = useState<DocumentTab>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLevel, setUploadLevel] = useState<UploadLevel>("project");
  const [targetId, setTargetId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canViewDocuments =
    perm.has(Permission.DocumentOwnView) || perm.has(Permission.DocumentAllView);
  const canViewUc =
    perm.has(Permission.UtilizationCertificateOwnView) ||
    perm.has(Permission.UtilizationCertificateAllView);

  const fetchDocuments = useCallback(() => {
    if (!authToken || !projectId || !canViewDocuments) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getProjectDocuments(authToken, projectId)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [authToken, projectId, canViewDocuments]);

  const fetchCapabilities = useCallback(() => {
    if (!authToken || !projectId || !canViewDocuments) {
      setCapabilities(null);
      return;
    }
    api
      .getProjectDocumentCapabilities(authToken, projectId)
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
  }, [authToken, projectId, canViewDocuments]);

  useEffect(() => {
    fetchDocuments();
    fetchCapabilities();
  }, [fetchDocuments, fetchCapabilities]);

  useEffect(() => {
    let debounceTimer: number | undefined;
    const stopListening = onDataChanged((notification) => {
      if (!DOCUMENT_SCOPES.includes(notification.scope)) return;
      if (notification.projectId && notification.projectId !== projectId) return;
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = undefined;
        fetchDocuments();
        fetchCapabilities();
      }, 250);
    });
    return () => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      stopListening();
    };
  }, [projectId, fetchDocuments, fetchCapabilities]);

  const allowedUploadLevels = useMemo<UploadLevel[]>(() => {
    if (!capabilities) return [];
    return [
      capabilities.canUploadProject ? "project" : null,
      capabilities.canUploadMilestone ? "milestone" : null,
      capabilities.canUploadTask ? "task" : null,
    ].filter((level): level is UploadLevel => Boolean(level));
  }, [capabilities]);

  useEffect(() => {
    if (!allowedUploadLevels.includes(uploadLevel)) {
      setUploadLevel(allowedUploadLevels[0] ?? "project");
      setTargetId("");
    }
  }, [allowedUploadLevels, uploadLevel]);

  const visibleDocuments = useMemo(() => {
    const normal = documents.filter((doc) => doc.category !== "UtilizationCertificate");
    if (activeTab === "project") return normal.filter((doc) => doc.level === "Project");
    if (activeTab === "milestone") return normal.filter((doc) => doc.level === "Milestone");
    if (activeTab === "task") return normal.filter((doc) => doc.level === "Task");
    return normal;
  }, [activeTab, documents]);

  const handleOpenUpload = () => {
    if (allowedUploadLevels.length === 0) return;
    setUploadLevel(allowedUploadLevels[0]);
    setTargetId("");
    setUploadFile(null);
    setUploadOpen(true);
  };

  const handleFileUpload = async () => {
    if (!authToken || !uploadFile) return;
    if ((uploadLevel === "milestone" || uploadLevel === "task") && !targetId) return;
    setUploading(true);
    try {
      await api.uploadProjectDocument(authToken, projectId, uploadFile, {
        milestoneId: uploadLevel === "milestone" ? targetId : null,
        taskId: uploadLevel === "task" ? targetId : null,
      });
      setUploadFile(null);
      setTargetId("");
      setUploadOpen(false);
      fetchDocuments();
      fetchCapabilities();
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    if (!authToken) return;
    setDownloadingId(doc.id);
    try {
      const blob = await api.downloadProjectDocument(authToken, projectId, doc.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.title;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!canViewDocuments && !canViewUc) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Icon name="description" size={16} className="text-indigo-600" />
            Documents
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Project, milestone and task documents remain scoped to your permissions.
          </p>
        </div>
        {allowedUploadLevels.length > 0 && (
          <button
            type="button"
            onClick={handleOpenUpload}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
          >
            <Icon name="upload_file" size={14} />
            Upload
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60 w-fit">
        {TABS.filter((tab) => tab.id !== "uc" || canViewUc).map((tab) => {
          const active = activeTab === tab.id;
          const count =
            tab.id === "all"
              ? documents.filter((d) => d.category !== "UtilizationCertificate").length
              : tab.id === "project"
                ? documents.filter((d) => d.level === "Project" && d.category !== "UtilizationCertificate").length
                : tab.id === "milestone"
                  ? documents.filter((d) => d.level === "Milestone" && d.category !== "UtilizationCertificate").length
                  : tab.id === "task"
                    ? documents.filter((d) => d.level === "Task" && d.category !== "UtilizationCertificate").length
                    : undefined;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
              }`}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  active ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "uc" && canViewUc ? (
        <UtilizationCertificates projectId={projectId} milestones={milestones} tasks={tasks} />
      ) : canViewDocuments ? (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="progress_activity" size={22} className="text-slate-300 animate-spin" />
            </div>
          ) : visibleDocuments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {visibleDocuments.map((doc) => {
                const ext = doc.title.split(".").pop()?.toLowerCase() || "";
                const icon =
                  ext === "pdf" ? "picture_as_pdf" :
                  ext === "doc" || ext === "docx" ? "description" :
                  ext === "xls" || ext === "xlsx" ? "table_chart" :
                  ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" ? "image" :
                  ext === "zip" || ext === "rar" ? "folder_zip" :
                  "draft";
                return (
                  <div
                    key={doc.id}
                    className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <div className="size-10 rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center shrink-0 border border-indigo-100/50">
                      <Icon name={icon} size={18} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={doc.title}>
                        {doc.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold uppercase">
                          {doc.level}
                        </span>
                        {doc.milestoneName && (
                          <span className="inline-flex items-center gap-0.5">
                            <Icon name="flag" size={10} />
                            {doc.milestoneName}
                          </span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span>{formatFileSize(doc.fileSizeBytes)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 shrink-0"
                      title="Download"
                    >
                      <Icon name={downloadingId === doc.id ? "hourglass_top" : "download"} size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="folder_open"
              title="No documents in this section"
              description="Documents appear here when your role has access to their hierarchy level."
              compact
              accent="primary"
            />
          )}
        </>
      ) : null}

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Document"
        description="Choose a level, target, and file to attach."
        icon="upload_file"
        accent="primary"
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={() => setUploadOpen(false)} />
            <ModalPrimaryButton
              onClick={handleFileUpload}
              loading={uploading}
              disabled={!uploadFile || (uploadLevel !== "project" && !targetId)}
              label={uploading ? "Uploading..." : "Upload"}
              icon="upload"
            />
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Document level
            </label>
            <select
              value={uploadLevel}
              onChange={(event) => {
                setUploadLevel(event.target.value as UploadLevel);
                setTargetId("");
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              {allowedUploadLevels.map((level) => (
                <option key={level} value={level}>
                  {level === "project" ? "Project" : level === "milestone" ? "Milestone" : "Task"}
                </option>
              ))}
            </select>
          </div>

          {uploadLevel !== "project" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {uploadLevel === "milestone" ? "Milestone" : "Task"}
              </label>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                <option value="">Select {uploadLevel}</option>
                {uploadLevel === "milestone"
                  ? milestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.name}
                      </option>
                    ))
                  : tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title} · {task.milestoneName ?? "No milestone"} · {task.projectName ?? "Project"}
                      </option>
                    ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              File
            </label>
            <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all">
              <Icon name="cloud_upload" size={24} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">
                {uploadFile ? uploadFile.name : "Click to choose a file"}
              </span>
              <input
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
