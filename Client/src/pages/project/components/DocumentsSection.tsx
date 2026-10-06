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
import { UtilizationCertificates } from "../../shared/index";

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
            <span className="material-symbols-outlined text-indigo-600">description</span>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors border border-indigo-200"
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            Upload Document
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.filter((tab) => tab.id !== "uc" || canViewUc).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/60"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "uc" && canViewUc ? (
        <UtilizationCertificates projectId={projectId} milestones={milestones} tasks={tasks} />
      ) : canViewDocuments ? (
        <>
          {uploadOpen && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800">Upload document</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Only levels granted to your role are available.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="size-7 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                  aria-label="Close upload"
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Document level
                  </span>
                  <select
                    value={uploadLevel}
                    onChange={(event) => {
                      setUploadLevel(event.target.value as UploadLevel);
                      setTargetId("");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-300"
                  >
                    {allowedUploadLevels.map((level) => (
                      <option key={level} value={level}>
                        {level === "project" ? "Project" : level === "milestone" ? "Milestone" : "Task"}
                      </option>
                    ))}
                  </select>
                </label>

                {uploadLevel !== "project" && (
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {uploadLevel === "milestone" ? "Milestone" : "Task"}
                    </span>
                    <select
                      value={targetId}
                      onChange={(event) => setTargetId(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-300"
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
                  </label>
                )}

                <label className="block md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    File
                  </span>
                  <input
                    type="file"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={
                    !uploadFile ||
                    uploading ||
                    (uploadLevel !== "project" && !targetId)
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-symbols-outlined text-slate-400 animate-spin">progress_activity</span>
            </div>
          ) : visibleDocuments.length > 0 ? (
            <div className="space-y-2">
              {visibleDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3 hover:bg-slate-100/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="size-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-indigo-600 text-[18px]">description</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                        <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5">
                          {doc.level}
                        </span>
                        {doc.projectName && <span>{doc.projectName}</span>}
                        {doc.milestoneName && <span>· {doc.milestoneName}</span>}
                        {doc.taskTitle && <span>· {doc.taskTitle}</span>}
                        <span>· {formatFileSize(doc.fileSizeBytes)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    className="size-9 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-white transition-colors disabled:opacity-50 shrink-0"
                    title="Download"
                  >
                    <span className="material-symbols-outlined text-indigo-600 text-[18px]">
                      {downloadingId === doc.id ? "hourglass_top" : "download"}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-slate-400 text-3xl">folder_open</span>
              </div>
              <p className="text-sm font-medium text-slate-500">No documents in this section</p>
              <p className="text-xs text-slate-400 mt-1">
                Documents appear here when your role has access to their hierarchy level.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
