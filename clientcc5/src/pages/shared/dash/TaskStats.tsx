import { useNavigate } from "react-router-dom";
import type { TaskDashboardPreview, TaskDashboardStats } from "../../../types";
import { getStatusColor } from "../colors";
import { Icon } from "../../../components/ui/Icon";
import { MetricStatCard, type MetricStatDetail } from "../MetricStatCard";

type TaskStatsProps = {
  stats?: TaskDashboardStats | null;
};

const PREVIEW_LIMIT = 5;

function previews(tasks: TaskDashboardPreview[] | undefined): MetricStatDetail[] {
  return (tasks ?? [])
    .slice(0, PREVIEW_LIMIT)
    .map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: [task.projectName ?? "General", task.milestoneName ?? "No milestone"].join(" · "),
      projectId: task.projectId,
    }));
}

export default function TaskStats({ stats }: TaskStatsProps) {
  const navigate = useNavigate();

  const openTask = (detail: MetricStatDetail) => {
    if (detail.projectId) {
      navigate(`/projects/${detail.projectId}/tasks?taskId=${detail.id}`);
    }
  };

  const cards = [
    {
      icon: <Icon name="file" size={16} />,
      value: stats?.totalTasks ?? 0,
      label: "Total Tasks",
      statusKey: "Total",
      details: previews(stats?.recentTasks),
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: stats?.inProgressTasks ?? 0,
      label: "In Progress",
      statusKey: "InProgress",
      details: previews(stats?.recentInProgressTasks),
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: stats?.onHoldTasks ?? 0,
      label: "On Hold",
      statusKey: "OnHold",
      details: previews(stats?.recentOnHoldTasks),
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: stats?.completedTasks ?? 0,
      label: "Completed",
      statusKey: "Completed",
      details: previews(stats?.recentCompletedTasks),
    },
    {
      icon: <Icon name="close" size={16} />,
      value: stats?.delayedTasks ?? 0,
      label: "Delayed",
      statusKey: "Delayed",
      details: previews(stats?.recentDelayedTasks),
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((card) => (
        <MetricStatCard
          key={card.label}
          icon={card.icon}
          value={card.value}
          label={card.label}
          tone={getStatusColor(card.statusKey)}
          details={card.details}
          detailLabel="Latest tasks"
          onOpenDetail={openTask}
        />
      ))}
    </div>
  );
}
