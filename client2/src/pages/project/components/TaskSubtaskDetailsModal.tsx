import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiAlertTriangle } from "react-icons/fi";
import type { Milestone, Project, Task, User } from "../../../types";
import { api } from "../../../api";
import { useAuth } from "../../../auth";
import { usePermission, useToast, Modal, ModalCancelButton } from "../../shared/index";
import { TaskHeaderCard } from "./TaskHeaderCard";
import { ProgressCommentForm } from "./ProgressCommentForm";
import { SubtasksSection } from "./SubtasksSection";
import { TaskAiInsightsSection } from "./TaskAiInsightsSection";

interface TaskSubtaskDetailsProps {
  task: Task | null;
  users: User[];
  project?: Project | null;
  milestone?: Milestone | null;
  recommendation?: any;
  delay?: any;
  isAdmin?: boolean;
  permissionEdit?: string;
  onStatusChange?: (status: string, options?: { confirmReset?: boolean }) => void;
  onEdit: (task: Task) => void;
  onUpdateProgress?: (progress: number, notes: string) => void;
  onAddComment?: (comment: string) => void;
  onRefresh?: () => void;
  onEscalate: () => void;
  onMessage?: (message: string) => void;
  onClose?: () => void;
  hideCloseButton?: boolean;
  onDelete: (task: Task) => void;
}

type InnerTaskSubtaskDetailsProps = Omit<TaskSubtaskDetailsProps, "task"> & { task: Task };

// ─── Main Component ─────────────────────────────────

export function TaskSubtaskDetailsModal(props: TaskSubtaskDetailsProps) {
  if (!props.task) return null;
  const innerProps: InnerTaskSubtaskDetailsProps = {
    ...props,
    task: props.task,
  };
  return <TaskSubtaskDetailsModalInner {...innerProps} />;
}

function TaskSubtaskDetailsModalInner({
  task,
  users,
  project,
  milestone,
  recommendation,
  delay,
  isAdmin,
  permissionEdit,
  onStatusChange = () => {},
  onEdit,
  onUpdateProgress = () => {},
  onAddComment = () => {},
  onRefresh = () => {},
  onEscalate,
  onMessage,
  onClose,
  onDelete,
  hideCloseButton = false,
}: InnerTaskSubtaskDetailsProps) {
  const perm = usePermission();
  const mayEdit = isAdmin ?? (permissionEdit ? perm.has(permissionEdit) : false);
  const { auth } = useAuth();
  const { addToast } = useToast();

  const [progress, setProgress] = useState(Math.round(task.progressPercentage || 0));
  const [progressComment, setProgressComment] = useState("");
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [subtasks, setSubtasks] = useState<Task[]>(task.subTasks || []);
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState<Set<string>>(new Set());
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    priority: "Medium",
    dueDate: "",
    assignedToUserId: "",
  });

  const [pendingNotStarted, setPendingNotStarted] = useState<string | null>(null);

  const hasSubTasks = task.hasSubTasks ?? (task.subTasks && task.subTasks.length > 0) ? true : false;

  // Sync state when task updates
  useEffect(() => {
    setSubtasks(task.subTasks || []);
    setProgress(Math.round(task.progressPercentage || 0));
  }, [task.id, task.subTasks, task.progressPercentage]);

  // Progress bar interactivity
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mayEdit || hasSubTasks || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.round((x / rect.width) * 100);
    setProgress(Math.max(0, Math.min(100, pct)));
  };

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mayEdit || hasSubTasks) return;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!progressBarRef.current) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const pct = Math.round((x / rect.width) * 100);
      setProgress(Math.max(0, Math.min(100, pct)));
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Main progress update
  const handleProgressUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSubTasks) return;
    onUpdateProgress(progress, progressComment.trim());
    setProgressComment("");
  };

  // Main status change (accepts string directly)
  const handleMainStatusChange = (nextStatus: string) => {
    if (
      nextStatus === "NotStarted" &&
      task.progressPercentage > 0 &&
      task.status !== "NotStarted"
    ) {
      setPendingNotStarted(nextStatus);
      return;
    }
    onStatusChange(nextStatus);
  };

  // Subtask handlers
  const handleCreateSubtask = async () => {
    if (!auth || !subtaskForm.title) return;
    const newSubtask = await api.createSubtask(auth.token, task.id, {
      ...subtaskForm,
      description: "",
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      startDate: new Date().toISOString(),
      estimatedHours: 0,
    });
    setSubtasks(prev => [...prev, { ...newSubtask, hasSubTasks: false }]);
    setSubtaskForm({ title: "", priority: "Medium", dueDate: task.dueDate?.slice(0, 10) || "", assignedToUserId: "" });
    setShowSubtaskForm(false);
    addToast("Subtask created.");
    onMessage?.("Subtask created.");
    onRefresh();
  };

  const handleSubtaskStatusChange = async (subtaskId: string, status: string) => {
    if (!auth) return;
    const updated = await api.updateSubtaskStatus(auth.token, subtaskId, status);
    setSubtasks(prev =>
      prev.map(s =>
        s.id === subtaskId
          ? { ...s, status: updated.status, progressPercentage: updated.progressPercentage, hasSubTasks: updated.hasSubTasks }
          : s
      )
    );
    addToast("Subtask status updated.");
    onMessage?.("Subtask status updated.");
    onRefresh();
  };

  const handleSubtaskToggleCompleted = async (subtaskId: string, currentlyCompleted: boolean) => {
    const nextStatus = currentlyCompleted ? "InProgress" : "Completed";
    await handleSubtaskStatusChange(subtaskId, nextStatus);
  };

  const handleSubtaskProgressUpdate = async (subtaskId: string, value: number) => {
    if (!auth) return;
    const updated = await api.updateSubtaskProgress(auth.token, subtaskId, value);
    setSubtasks(prev =>
      prev.map(s =>
        s.id === subtaskId
          ? { ...s, progressPercentage: updated.progressPercentage, status: updated.status, hasSubTasks: updated.hasSubTasks }
          : s
      )
    );
    onRefresh();
  };

  const handleSubtaskAddComment = async (subtaskId: string, text: string) => {
    if (!auth || !text.trim()) return;
    await api.addTaskComment(auth.token, subtaskId, text);
    addToast("Comment added to subtask.");
    onMessage?.("Comment added to subtask.");
    onRefresh();
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!auth) return;
    if (!confirm("Delete this subtask?")) return;
    await api.deleteSubtask(auth.token, subtaskId);
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    setExpandedSubtaskIds(prev => {
      const next = new Set(prev);
      next.delete(subtaskId);
      return next;
    });
    addToast("Subtask deleted.");
    onMessage?.("Subtask deleted.");
    onRefresh();
  };

  const toggleSubtaskExpand = (id: string) => {
    setExpandedSubtaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Progress bar colors
  const progressColor = progress >= 80
    ? "from-emerald-400 to-emerald-500"
    : progress >= 50
    ? "from-cyan-400 to-cyan-500"
    : progress >= 25
    ? "from-amber-400 to-amber-500"
    : "from-rose-400 to-rose-500";

  // open state derived from task presence; onClose may be undefined in embedded contexts
  const open = !!task;
  const handleClose = onClose ?? (() => {});

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Task Details"
      description={project?.name ?? "View and manage task"}
      icon="task_alt"
      accent="primary"
      size="xl"
      footer={
        <ModalCancelButton onClick={handleClose} label="Close" />
      }
    >
      <div className="flex flex-col gap-3">
        <TaskHeaderCard
          task={task}
          users={users}
          project={project}
          milestone={milestone}
          mayEdit={mayEdit}
          hasSubTasks={hasSubTasks}
          subtaskCount={subtasks.length}
          progress={progress}
          progressColor={progressColor}
          progressBarRef={progressBarRef}
          onProgressBarClick={handleProgressBarClick}
          onProgressBarDrag={handleProgressDrag}
          onStatusChange={handleMainStatusChange}
          onEdit={() => onEdit(task)}
          onEscalate={onEscalate}
          onDelete={() => { onDelete(task); }}
          onClose={onClose}
          hideCloseButton={true}
        />

        {/* "Not Started" reset warning */}
        <AnimatePresence>
          {pendingNotStarted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-sm"
            >
              <div className="flex gap-2 items-start">
                <FiAlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">Reset progress warning</p>
                  <p className="text-xs text-amber-700 mt-1">
                    This will reset progress to 0% for this task{hasSubTasks ? " and all subtasks" : ""}. Continue?
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        onStatusChange(pendingNotStarted, { confirmReset: true });
                        setPendingNotStarted(null);
                      }}
                      className="px-3 py-1 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer"
                    >
                      Yes, reset
                    </button>
                    <button
                      onClick={() => setPendingNotStarted(null)}
                      className="px-3 py-1 text-xs font-semibold bg-white border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasSubTasks && mayEdit && (
          <ProgressCommentForm
            progress={progress}
            progressComment={progressComment}
            onCommentChange={setProgressComment}
            onSubmit={handleProgressUpdate}
          />
        )}

        <SubtasksSection
          subtasks={subtasks}
          mayEdit={mayEdit}
          expandedSubtaskIds={expandedSubtaskIds}
          onToggleExpand={toggleSubtaskExpand}
          onToggleCompleted={handleSubtaskToggleCompleted}
          onDelete={handleDeleteSubtask}
          onProgressUpdate={handleSubtaskProgressUpdate}
          onAddComment={handleSubtaskAddComment}
          onStatusChange={handleSubtaskStatusChange}
          onCreateSubtask={handleCreateSubtask}
          showSubtaskForm={showSubtaskForm}
          subtaskForm={subtaskForm}
          onSubtaskFormChange={setSubtaskForm}
          onCancelSubtaskForm={() => {
            setShowSubtaskForm(false);
            setSubtaskForm({ title: "", priority: "Medium", dueDate: task.dueDate?.slice(0, 10) || "", assignedToUserId: "" });
          }}
          onToggleShowForm={() => {
            setSubtaskForm(prev => ({
              ...prev,
              dueDate: prev.dueDate || task.dueDate?.slice(0, 10) || "",
            }));
            setShowSubtaskForm(true);
          }}
          parentTaskDueDate={task.dueDate}
        />

        <TaskAiInsightsSection
          recommendation={recommendation}
          delay={delay}
          isEscalated={task.isEscalated ?? false}
        />
      </div>
    </Modal>
  );
}
