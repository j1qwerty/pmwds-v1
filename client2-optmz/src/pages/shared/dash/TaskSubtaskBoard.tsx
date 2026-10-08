import { useCallback, type JSX } from 'react';
import { getStatusColor } from '../colors';
import type { Task, User } from '../../../types';
import { TaskSubtaskCard } from "../../project/components/TaskSubtaskCard";
import { Icon } from "../../../components/ui/Icon";

interface TaskBoardProps {
    tasks?: Task[];
    onViewTask?: (task: Task) => void | Promise<void>;
    onEditTask?: (task: Task) => void | Promise<void>;
    canEdit?: boolean;
    visibleBoards?: Record<string, boolean>;
    users?: User[];
    onRefresh?: () => void;
}

export interface BoardConfig {
    status: string;
    title: string;
    headerBg: string;
    headerText: string;
    badgeBg: string;
    badgeText: string;
    icon: JSX.Element;
}

export const allBoards: BoardConfig[] = [
    {
        status: 'NotStarted', title: 'Not Started', icon: <Icon name="add" size={16} />
    },
    {
        status: 'InProgress', title: 'In Progress', icon: <Icon name="clock" size={16} />
    },
    {
        status: 'Completed', title: 'Completed', icon: <Icon name="check-circle" size={16} />
    },
    {
        status: 'Delayed', title: 'Delayed', icon: <Icon name="alert-circle" size={16} />
    },
    {
        status: 'OnHold', title: 'On Hold', icon: <Icon name="pause" size={16} />
    },
    {
        status: 'Cancelled', title: 'Cancelled', icon: <Icon name="close" size={16} />
    },
].map(board => {
    const colors = getStatusColor(board.status);
    return {
        ...board,
        headerBg: colors.headerBg,
        headerText: colors.headerText,
        badgeBg: colors.badgeBg,
        badgeText: colors.badgeText,
    };
});

const TaskBoard: React.FC<TaskBoardProps> = ({
    tasks = [],
    onViewTask,
    onEditTask,
    canEdit = false,
    visibleBoards = {
        'Not Started': true,
        'In Progress': true,
        'Completed': true,
        'Delayed': true,
        'On Hold': true,
        'Cancelled': true
    },
    users = [],
    onRefresh,
}) => {
    const getProgressColor = (progress: number): string => {
        if (progress === 100) return 'bg-emerald-500';
        if (progress >= 75) return 'bg-amber-400';
        if (progress >= 50) return 'bg-sky-400';
        if (progress >= 25) return 'bg-red-400';
        return 'bg-slate-300';
    };

    const getTasksByStatus = useCallback((status: string): Task[] => {
        return tasks.filter(task => task.status === status);
    }, [tasks]);

    return (
        <div className="w-full my-4 py-4 rounded-xl p-md ambient-glow ">
            {/* Kanban Boards */}
            <div className="flex flex-col md:flex-row md:flex-wrap gap-1">
                {allBoards.map((board) => {
                    if (!visibleBoards[board.title]) return null;

                    const boardTasks = getTasksByStatus(board.status);

                    return (
                        <div
                            key={board.status}
                            className="bg-slate-50/50 rounded-2xl p-4 flex-1 min-w-[200px] max-w-[500px]"
                        >
                            <div className={`flex items-center justify-between mb-4 p-3 rounded-xl ${board.headerBg}`}>
                                <div className="flex items-center gap-2">
                                    <span className={board.headerText}>{board.icon}</span>
                                    <h3 className={`text-sm font-semibold ${board.headerText}`}>
                                        {board.title}
                                    </h3>
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${board.badgeBg} ${board.badgeText}`}>
                                    {boardTasks.length}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {boardTasks.map((task) => (
                                    <TaskSubtaskCard
                                        key={task.id}
                                        task={task}
                                        canEdit={canEdit}
                                        onViewTask={onViewTask}
                                        onEditTask={onEditTask}
                                        getProgressColor={getProgressColor}
                                        users={users}
                                        onRefresh={onRefresh}
                                    />
                                ))}

                                {boardTasks.length === 0 && (
                                    <div className="text-center py-8">
                                        <div className="text-slate-400 mb-2">
                                            <Icon name="hi-inbox" size={32} className="mx-auto" />
                                        </div>
                                        <p className="text-xs text-slate-400">No tasks</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskBoard;
