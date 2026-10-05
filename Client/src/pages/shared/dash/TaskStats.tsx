import type { Task } from "../../../types";
import { getStatusColor } from "../colors";
import { Icon } from "../../../components/ui/Icon";
import { MetricStatCard, type MetricStatDetail } from "../MetricStatCard";

type TaskStatsProps = {
  tasks?: Task[];
};

function recentTasks(tasks: Task[], predicate: (task: Task) => boolean): MetricStatDetail[] {
  return tasks
    .filter(predicate)
    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: [task.projectName ?? "General", task.milestoneName ?? "No milestone"].join(" · "),
    }));
}

export default function TaskStats({ tasks = [] }: TaskStatsProps) {
  const stats = [
    {
      icon: <Icon name="file" size={16} />,
      value: tasks.length,
      label: "Total Tasks",
      statusKey: "Total",
      details: recentTasks(tasks, () => true),
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: tasks.filter((task) => task.status === "InProgress").length,
      label: "In Progress",
      statusKey: "InProgress",
      details: recentTasks(tasks, (task) => task.status === "InProgress"),
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: tasks.filter((task) => task.status === "OnHold").length,
      label: "On Hold",
      statusKey: "OnHold",
      details: recentTasks(tasks, (task) => task.status === "OnHold"),
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: tasks.filter((task) => task.status === "Completed" || task.progressPercentage === 100).length,
      label: "Completed",
      statusKey: "Completed",
      details: recentTasks(tasks, (task) => task.status === "Completed" || task.progressPercentage === 100),
    },
    {
      icon: <Icon name="close" size={16} />,
      value: tasks.filter((task) => task.isOverdue || task.status === "Delayed").length,
      label: "Delayed",
      statusKey: "Delayed",
      details: recentTasks(tasks, (task) => task.isOverdue || task.status === "Delayed"),
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat) => (
        <MetricStatCard
          key={stat.label}
          icon={stat.icon}
          value={stat.value}
          label={stat.label}
          tone={getStatusColor(stat.statusKey)}
          details={stat.details}
          detailLabel="Latest tasks"
        />
      ))}
    </div>
  );
}
