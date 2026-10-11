import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  Milestone,
  ProjectDocument,
  ProjectDocumentCapabilities,
  Task,
  User,
} from "../../../types";
import { api } from "../../../api";
import { Permission, usePermission } from "../../shared/RoleGate";
import { onDataChanged } from "../../../realtime";
import { DOCUMENT_SCOPES } from "../../../realtimeScopes";
import {
  UtilizationCertificates,
  Modal,
  Sheet,
  ModalCancelButton,
  ModalPrimaryButton,
  ModalDangerButton,
  EmptyState,
  FilterBar,
  ViewToggle,
  HoverActions,
  type ViewMode,
  useToast,
  type FilterChipOption,
  GlassCard,
  Skeleton,
} from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

interface DocumentsSectionProps {
  projectId: string;
  authToken?: string | null;
  milestones?: Milestone[];
  tasks?: Task[];
  /** Optional user directory, used to attribute uploads. */
  users?: User[];
}

type DocumentTab = "all" | "project" | "milestone" | "task" | "uc";
type UploadLevel = "project" | "milestone" | "task";

const LEVEL_TABS: Array<{ id: DocumentTab; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "folder" },
  { id: "project", label: "Project", icon: "hi-folder-open" },
  { id: "milestone", label: "Milestone", icon: "flag" },
  { id: "task", label: "Task", icon: "task" },
  { id: "uc", label: "UC", icon: "verified_user" },
];

/** File-type aware icon tile colors (pdf=red, doc=blue, xls=emerald, img=violet, other=slate). */
function fileTypeMeta(title: string): { icon: string; tile: string; label: string } {
  const ext = title.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return { icon: "hi-document-report", tile: "bg-red-50 text-red-600 border-red-100", label: "PDF" };
  if (ext === "doc" || ext === "docx" || ext === "rtf" || ext === "odt")
    return { icon: "hi-document-text", tile: "bg-blue-50 text-blue-600 border-blue-100", label: "DOC" };
  if (ext === "xls" || ext === "xlsx" || ext === "csv" || ext === "ods")
    return { icon: "hi-chart-square-bar", tile: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "XLS" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
    return { icon: "hi-photograph", tile: "bg-violet-50 text-violet-600 border-violet-100", label: "IMG" };
  return { icon: "file", tile: "bg-slate-100 text-slate-600 border-slate-200", label: ext ? ext.slice(0, 4).toUpperCase() : "FILE" };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DocumentsSection({
  projectId,
  authToken,
  milestones = [],
  tasks = [],
  users = [],
}: DocumentsSectionProps) {
  const perm = usePermission();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [capabilities, setCapabilities] = useState<ProjectDocumentCapabilities | null>(null);
  const [activeTab, setActiveTab] = useState<DocumentTab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLevel, setUploadLevel] = useState<UploadLevel>("project");
  const [targetId, setTargetId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const levelCounts = useMemo(() => {
    const normal = documents.filter((doc) => doc.category !== "UtilizationCertificate");
    return {
      all: normal.length,
      project: normal.filter((d) => d.level === "Project").length,
      milestone: normal.filter((d) => d.level === "Milestone").length,
      task: normal.filter((d) => d.level === "Task").length,
    };
  }, [documents]);

  const levelChipOptions = useMemo<FilterChipOption[]>(
    () =>
      LEVEL_TABS.filter((tab) => tab.id !== "uc" || canViewUc).map((tab) => ({
        value: tab.id,
        label: tab.label,
        count: tab.id === "uc" ? undefined : levelCounts[tab.id as keyof typeof levelCounts],
      })),
    [canViewUc, levelCounts],
  );

  const visibleDocuments = useMemo(() => {
    const normal = documents.filter((doc) => doc.category !== "UtilizationCertificate");
    let list: ProjectDocument[];
    if (activeTab === "project") list = normal.filter((doc) => doc.level === "Project");
    else if (activeTab === "milestone") list = normal.filter((doc) => doc.level === "Milestone");
    else if (activeTab === "task") list = normal.filter((doc) => doc.level === "Task");
    else list = normal;

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((doc) =>
        [doc.title, doc.milestoneName, doc.taskTitle, doc.level]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term),
      );
    }
    return list;
  }, [activeTab, documents, search]);

  const uploaderName = (doc: ProjectDocument) =>
    users.find((u) => u.id === doc.uploadedByUserId)?.fullName || "";

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
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Download failed", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!authToken || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteProjectDocument(authToken, projectId, deleteTarget.id);
      addToast("Document deleted");
      setDeleteTarget(null);
      fetchDocuments();
      fetchCapabilities();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete document", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (!canViewDocuments && !canViewUc) return null;

  const canDeleteDocuments = capabilities?.canDelete === true;
  const showDocs = activeTab !== "uc" && canViewDocuments;
  const hasFilters = search.trim() !== "" || activeTab !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon name="description" size={17} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Documents</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Project, milestone and task documents remain scoped to your permissions.
            </p>
          </div>
        </div>
        {allowedUploadLevels.length > 0 && (
          <button
            type="button"
            onClick={handleOpenUpload}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
          >
            <Icon name="upload" size={14} />
            Upload document
          </button>
        )}
      </div>

      {/* Filter bar: search + level chips + view toggle */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search documents by name or type..."
        chipGroups={levelChipOptions.length > 0 ? [{ key: "level", options: levelChipOptions, value: activeTab, onChange: (v) => setActiveTab(v as DocumentTab) }] : []}
        actions={<ViewToggle value={viewMode} onChange={setViewMode} available={["card", "list"]} />}
      />

      {activeTab === "uc" && canViewUc ? (
        <UtilizationCertificates projectId={projectId} milestones={milestones} tasks={tasks} />
      ) : showDocs ? (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <GlassCard key={i} className="p-3.5 flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : visibleDocuments.length > 0 ? (
            viewMode === "card" ? (
              <div key="card" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 view-fade">
                {visibleDocuments.map((doc, idx) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    uploader={uploaderName(doc)}
                    downloading={downloadingId === doc.id}
                    canDelete={canDeleteDocuments}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => setDeleteTarget(doc)}
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  />
                ))}
              </div>
            ) : (
              <GlassCard key="list" className="p-0 overflow-hidden divide-y divide-slate-100 view-fade">
                {visibleDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    uploader={uploaderName(doc)}
                    downloading={downloadingId === doc.id}
                    canDelete={canDeleteDocuments}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => setDeleteTarget(doc)}
                  />
                ))}
              </GlassCard>
            )
          ) : (
            <EmptyState
              icon="folder_open"
              title={hasFilters ? "No documents match" : "No documents in this section"}
              description={
                hasFilters
                  ? "Try a different search term or switch the level filter."
                  : "Documents appear here when your role has access to their hierarchy level."
              }
              compact={hasFilters}
              accent="primary"
              action={
                !hasFilters && allowedUploadLevels.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleOpenUpload}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                  >
                    <Icon name="upload" size={14} />
                    Upload document
                  </button>
                ) : undefined
              }
            />
          )}
        </>
      ) : null}

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        title="Delete document"
        description="This file will be removed for everyone with access."
        icon="delete"
        accent="danger"
        size="sm"
        closeOnBackdrop={!deleting}
        footer={
          <>
            <ModalCancelButton onClick={() => setDeleteTarget(null)} />
            <ModalDangerButton
              onClick={handleDelete}
              loading={deleting}
              label={deleting ? "Deleting..." : "Delete document"}
            />
          </>
        }
      >
        {deleteTarget && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className={`size-10 rounded-lg border flex items-center justify-center shrink-0 ${fileTypeMeta(deleteTarget.title).tile}`}>
              <Icon name={fileTypeMeta(deleteTarget.title).icon} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate" title={deleteTarget.title}>
                {deleteTarget.title}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatFileSize(deleteTarget.fileSizeBytes)} · v{deleteTarget.version}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload sheet (right slide-in form) */}
      <Sheet
        open={uploadOpen}
        onClose={() => (uploading ? undefined : setUploadOpen(false))}
        title="Upload document"
        description="Choose a level, target, and file to attach."
        icon="upload"
        accent="primary"
        size="sm"
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
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Document level
            </label>
            <select
              value={uploadLevel}
              onChange={(event) => {
                setUploadLevel(event.target.value as UploadLevel);
                setTargetId("");
              }}
              className={INPUT_CLASS}
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
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                {uploadLevel === "milestone" ? "Milestone" : "Task"}
              </label>
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className={INPUT_CLASS}
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
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              File
            </label>
            <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-lg border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all">
              <Icon name="hi-cloud-upload" size={24} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">
                {uploadFile ? uploadFile.name : "Click to choose a file"}
              </span>
              {uploadFile && (
                <span className="text-[10px] text-slate-400">{formatFileSize(uploadFile.size)}</span>
              )}
              <input
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

type DocActionProps = {
  doc: ProjectDocument;
  uploader: string;
  downloading: boolean;
  canDelete: boolean;
  onDownload: () => void;
  onDelete: () => void;
};

function DocumentCard({
  doc,
  uploader,
  downloading,
  canDelete,
  onDownload,
  onDelete,
  style,
}: DocActionProps & { style?: CSSProperties }) {
  const meta = fileTypeMeta(doc.title);
  return (
    <GlassCard
      className="card-stagger group p-3.5 flex items-start gap-3 hover:shadow-md hover:border-slate-300 transition-all"
      style={style}
    >
      <div className={`size-10 rounded-lg border flex items-center justify-center shrink-0 ${meta.tile}`} title={meta.label}>
        <Icon name={meta.icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate" title={doc.title}>
          {doc.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold uppercase">
            {doc.level}
          </span>
          {doc.milestoneName && (
            <span className="inline-flex items-center gap-0.5" title={`Milestone: ${doc.milestoneName}`}>
              <Icon name="flag" size={10} />
              <span className="max-w-[110px] truncate">{doc.milestoneName}</span>
            </span>
          )}
          {doc.taskTitle && (
            <span className="inline-flex items-center gap-0.5" title={`Task: ${doc.taskTitle}`}>
              <Icon name="task_alt" size={10} />
              <span className="max-w-[110px] truncate">{doc.taskTitle}</span>
            </span>
          )}
          <span>{formatFileSize(doc.fileSizeBytes)}</span>
          <span className="text-slate-300">·</span>
          <span title={`Uploaded ${formatUploadedDate(doc.createdDate)}${uploader ? ` by ${uploader}` : ""}`}>
            {formatUploadedDate(doc.createdDate)}
          </span>
          {uploader && (
            <>
              <span className="text-slate-300">·</span>
              <span className="truncate max-w-[90px]">{uploader}</span>
            </>
          )}
        </div>
      </div>
      {/* Actions — delete always visible (capability-gated), download on hover */}
      <HoverActions
        entity="documents"
        className="mt-0.5"
        always={
          canDelete
            ? [{ icon: "delete", label: `Delete ${doc.title}`, tone: "danger", onClick: onDelete }]
            : []
        }
        onHover={[
          {
            icon: downloading ? "hourglass_top" : "download",
            label: `Download ${doc.title}`,
            onClick: onDownload,
            disabled: downloading,
          },
        ]}
      />
    </GlassCard>
  );
}

function DocumentRow({ doc, uploader, downloading, canDelete, onDownload, onDelete }: DocActionProps) {
  const meta = fileTypeMeta(doc.title);
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 transition-colors">
      <div className={`size-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.tile}`} title={meta.label}>
        <Icon name={meta.icon} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate" title={doc.title}>
          {doc.title}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
          {doc.level}
          {doc.milestoneName ? ` · ${doc.milestoneName}` : ""}
          {doc.taskTitle ? ` · ${doc.taskTitle}` : ""}
          {` · ${formatFileSize(doc.fileSizeBytes)} · ${formatUploadedDate(doc.createdDate)}`}
          {uploader ? ` · ${uploader}` : ""}
        </p>
      </div>
      {/* Actions — delete always visible (capability-gated), download on hover */}
      <HoverActions
        entity="documents"
        className="shrink-0"
        always={
          canDelete
            ? [{ icon: "delete", label: `Delete ${doc.title}`, tone: "danger", onClick: onDelete }]
            : []
        }
        onHover={[
          {
            icon: downloading ? "hourglass_top" : "download",
            label: `Download ${doc.title}`,
            onClick: onDownload,
            disabled: downloading,
          },
        ]}
      />
    </div>
  );
}
