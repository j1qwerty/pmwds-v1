import { useMemo, useState } from "react";
import { api } from "../../../api";
import { useAuth } from "../../../auth";
import type { Task, User } from "../../../types";
import { getPriorityColor, getStatusColor, usePermission, useToast } from "../../shared/index";
import { SubtaskFormModal } from "./SubtaskFormModal";
import { AvatarStack } from "../../shared/Avatar";
import { SubtaskEditModal } from "../../shared/modals/SubtaskEditModal";
import { FiAlertTriangle } from "react-icons/fi";
import { TaskEditModal } from "../../shared/modals/TaskEditModal";
import { Icon } from "../../../components/ui/Icon";

interface TaskSubtaskCardProps {
  task: Task;
  canEdit?: boolean;
  permissionEdit?: string;
  onViewTask?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  getProgressColor: (progress: number) => string;
  onAddSubtask?: (parentTaskId: string) => void;
  onRefresh?: () => void;
  users?: User[];
  organizationId?: string | null;
}

export function TaskSubtaskCard({
  task,
  canEdit,
  permissionEdit,
  onViewTask,
  onEditTask,
  getProgressColor,
  onAddSubtask,
  onRefresh: onParentRefresh,
  users = [],
  organizationId,
}: TaskSubtaskCardProps) {
  const perm = usePermission();
  const mayEdit = canEdit ?? (permissionEdit ? perm.has(permissionEdit) : false);
  const { auth } = useAuth();
  const { addToast } = useToast();
  const priorityColor = getPriorityColor(task.priority);
  const statusColors = getStatusColor(task.status);

  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState<Task[]>(task.subTasks ?? []);
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);
  const [editSubtask, setEditSubtask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [cardProgress, setCardProgress] = useState(task.progressPercentage);

  const getStrokeColor = (progress: number): string => {
    if (progress === 100) return '#10b981';
    if (progress >= 75) return '#fbbf24';
    if (progress >= 50) return '#22d3ee';
    if (progress >= 25) return '#fb7185';
    return '#cbd5e1';
  };

  const hasSubtasks = (task.subTasks?.length ?? 0) > 0 || subtasks.length > 0;

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const assigneeUsers = useMemo(
    () =>
      (task.assignees ?? []).map((a) => {
        const user = userMap.get(a.userId);
        return {
          userId: a.userId,
          id: a.userId,
          fullName: user?.fullName ?? a.fullName ?? null,
          profilePictureUrl: user?.profilePictureUrl ?? null,
          isActive: user?.isActive ?? true,
        };
      }),
    [task.assignees, userMap],
  );

  const recalcProgress = (list: Task[]) => {
    if (list.length === 0) {
      setCardProgress(task.progressPercentage);
      return;
    }
    const avg = Math.round(list.reduce((sum, s) => sum + (s.progressPercentage || 0), 0) / list.length);
    setCardProgress(avg);
  };

  const handleCreateSubtask = async (form: Record<string, unknown>) => {
    if (!auth) return;
    try {
      await api.createSubtask(auth.token, task.id, form);
      setShowSubtaskModal(false);
      addToast("Subtask created");
      onParentRefresh?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create subtask", "error");
    }
  };

  const handleSubtaskUpdate = async (subtaskId: string, data: { progress: number; status: string; priority: string }) => {
    if (!auth) return;
    const original = subtasks.find((s) => s.id === subtaskId);
    if (!original) return;
    try {
      if (data.progress !== (original.progressPercentage || 0)) {
        await api.updateSubtaskProgress(auth.token, subtaskId, data.progress);
      }
      if (data.status !== original.status) {
        await api.updateSubtaskStatus(auth.token, subtaskId, data.status);
      }
      if (data.priority !== (original.priority || "Medium")) {
        await api.updateSubtask(auth.token, subtaskId, {
          title: original.title,
          description: original.description ?? "",
          priority: data.priority,
          startDate: original.startDate,
          dueDate: original.dueDate,
          estimatedHours: original.estimatedHours ?? 0,
          milestoneId: original.milestoneId,
        });
      }
      onParentRefresh?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to update subtask", "error");
      throw e;
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!auth) return;
    try {
      await api.deleteSubtask(auth.token, subtaskId);
      addToast("Subtask deleted");
      onParentRefresh?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete subtask", "error");
    }
  };

  const handleSubtaskAddComment = async (subtaskId: string, text: string) => {
    if (!auth || !text.trim()) return;
    try {
      await api.addTaskComment(auth.token, subtaskId, text);
      addToast("Comment added.");
      onParentRefresh?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to add comment", "error");
    }
  };

  const handleTaskUpdate = async (taskId: string, data: { progress: number; status: string; priority: string }) => {
    if (!auth) return;
    try {
      if (data.status !== task.status) {
        await api.updateTaskStatus(auth.token, taskId, data.status);
      }
      if (data.progress !== Math.round(task.progressPercentage || 0)) {
        await api.updateTaskProgress(auth.token, taskId, data.progress);
      }
      if (data.priority !== (task.priority || "Medium")) {
        await api.updateTask(auth.token, taskId, {
          title: task.title,
          description: task.description ?? "",
          priority: data.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
          estimatedHours: task.estimatedHours ?? 0,
          milestoneId: task.milestoneId,
        });
      }
      setCardProgress(data.progress);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to update task", "error");
      throw e;
    }
  };

  const handleTaskAddComment = async (taskId: string, text: string) => {
    if (!auth || !text.trim()) return;
    try {
      await api.addTaskComment(auth.token, taskId, text);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to add comment", "error");
      throw e;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!auth) return;
    await api.deleteTask(auth.token, taskId);
    onParentRefresh?.();
  };

  const handleTaskEscalate = async () => {
    if (!auth) return;
    try {
      await api.escalateTask(auth.token, task.id);
      addToast("Task escalated.");
      onParentRefresh?.();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to escalate task", "error");
    }
  };

  const handleCardOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mayEdit) {
      setShowEditModal(true);
    }
  };

  const stopRowClick = (handler?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    handler?.();
  };

  return (
    <div className="bg-white rounded-xl py-4 px-2 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-500 hover:shadow-blue-300 transition-shadow duration-200">
      {/* Title + progress — clickable to open the task details modal */}
      <div
        className={mayEdit ? "cursor-pointer" : ""}
        onClick={handleCardOpen}
        role={mayEdit ? "button" : undefined}
        tabIndex={mayEdit ? 0 : -1}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && mayEdit) {
            e.preventDefault();
            setShowEditModal(true);
          }
        }}
      >
        <div className="px-2">

        
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-slate-700 leading-snug min-w-0">{task.title}</h4>
          {mayEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); handleTaskEscalate(); }}
              className={`p-2 rounded-lg cursor-pointer transition-colors shrink-0 ml-2 ${
                task.isEscalated
                  ? 'bg-amber-50 text-amber-600'
                  : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
              }`}
              title="Escalate task"
            >
              <FiAlertTriangle className="w-4 h-4 pointer-events-none" />
            </button>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 font-medium">Progress</span>
            <span className="text-[10px] font-semibold text-slate-600">
              {cardProgress}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className={`${getProgressColor(cardProgress)} h-1.5 rounded-full transition-all duration-300`}
              style={{ width: `${cardProgress}%` }}
            />
          </div>
        </div>
        </div>
      </div>

      {/* Subtask strip + expanded list */}
      <div className="flex items-center ">


        {hasSubtasks && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center justify-between gap-2 rounded-lg pl-2  py-1.5 flex-1 min-w-0 ${expanded ? "bg-slate-100" : "bg-purple-50 hover:bg-purple-100"
              }`}
          >
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
              aria-expanded={expanded}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">
                Subtasks
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                {subtasks.length}
              </span>
              {!expanded && subtasks.length > 0 && (
                <span className="text-[10px] text-slate-500 truncate min-w-0">
                  {subtasks.map((s) => s.title).join(", ")}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="shrink-0 pr-2"
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
            >
              <Icon
                name="chevron-right"
                size={16}
                className={`transition-transform duration-200 text-slate-500 ${expanded ? "rotate-90 text-indigo-600" : ""}`}
              />
            </button>
          </div>
        )}
      </div>

      {expanded && hasSubtasks && (
        <div className="mb-3 space-y-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
          {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setEditSubtask(sub)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditSubtask(sub);
                  }
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColors.dot}`}
                    title={sub.status}
                  />
                  <span className="text-xs text-slate-700 truncate" title={sub.title}>{sub.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="relative shrink-0 group" title={`${sub.progressPercentage || 0}%`}>
                    <svg className="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
                      <circle cx="10" cy="10" r="8" fill="none" className="stroke-slate-200" strokeWidth="2" />
                      <circle
                        cx="10" cy="10" r="8"
                        fill="none"
                        className="transition-all duration-300"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="50.27"
                        style={{
                          stroke: getStrokeColor(sub.progressPercentage || 0),
                          strokeDashoffset: 50.27 * (1 - (sub.progressPercentage || 0) / 100),
                        }}
                      />
                    </svg>
                  </div>
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={stopRowClick(() => handleDeleteSubtask(sub.id))}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Delete subtask"
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Bottom action row: priority, assignee avatars, edit, add subtask */}
      <div
        className="flex items-center justify-between border-t border-slate-100 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border}`}
          >
            {task.priority}
          </span>

          {assigneeUsers.length > 0 && (
            <div className="flex items-center gap-0.5">
              <AvatarStack people={assigneeUsers} limit={2} size="xs" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">

          {mayEdit &&
            (onAddSubtask ? (
              <button
                type="button"
                title="Add subtask"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubtask(task.id);
                }}
                className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Icon name="add" size={16} />
              </button>
            ) : (
              <button
                type="button"
                title="Add subtask"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtaskModal(true);
                }}
                className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Icon name="add" size={16} />
              </button>
            ))}

          {mayEdit && onEditTask && (
            <button
              type="button"
              title="Edit task"
              onClick={() => onEditTask(task)}
              className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
            >
              <Icon name="edit" size={16} />
            </button>
          )}


        </div>
      </div>

      {editSubtask && (
        <SubtaskEditModal
          subtask={editSubtask}
          mayEdit={mayEdit}
          onClose={() => setEditSubtask(null)}
          onUpdate={handleSubtaskUpdate}
          onAddComment={handleSubtaskAddComment}
          onDelete={handleDeleteSubtask}
        />
      )}

      {showEditModal && (
        <TaskEditModal
          task={task}
          users={users}
          mayEdit={mayEdit}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleTaskUpdate}
          onAddComment={handleTaskAddComment}
          onDelete={handleDeleteTask}
          onEscalate={handleTaskEscalate}
          onRefresh={async () => {
            onParentRefresh?.();
          }}
        />
      )}

      <SubtaskFormModal
        open={showSubtaskModal}
        parentTask={task}
        users={users}
        organizationId={organizationId}
        onSubmit={handleCreateSubtask}
        onClose={() => setShowSubtaskModal(false)}
      />
    </div>
  );
}
