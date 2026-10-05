import type { Project, ProjectDashboardData } from "../../types";
import { getStatusColor } from "../shared/colors";
import { Icon } from "../../components/ui/Icon";
import { MetricStatCard, type MetricStatDetail } from "../shared/MetricStatCard";

interface DashboardStatsProps {
  projects?: Project[];
  dashboard?: ProjectDashboardData | null;
}

function recentProjects(dashboard: ProjectDashboardData | null | undefined, projects: Project[], predicate: (project: { status: string; progressPercentage: number }) => boolean): MetricStatDetail[] {
  const source = dashboard?.recentProjectPreviews?.length ? dashboard.recentProjectPreviews : projects;
  return source
    .filter(predicate)
    .slice(0, 5)
    .map((project) => ({
      id: project.id,
      title: project.name,
      subtitle: `${project.projectCode} · ${project.status}`,
    }));
}

export default function DashboardStats({ projects = [], dashboard }: DashboardStatsProps) {
  const stats = [
    {
      icon: <Icon name="file" size={16} />,
      value: dashboard?.totalProjects ?? projects.length,
      label: "Total Projects",
      statusKey: "Total",
      details: recentProjects(dashboard, projects, () => true),
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: dashboard?.activeProjects ?? projects.filter((p) => p.status === "InProgress").length,
      label: "In Progress",
      statusKey: "InProgress",
      details: recentProjects(dashboard, projects, (p) => p.status === "InProgress"),
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: dashboard?.onHoldProjects ?? projects.filter((p) => p.status === "OnHold").length,
      label: "On Hold",
      statusKey: "OnHold",
      details: recentProjects(dashboard, projects, (p) => p.status === "OnHold"),
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: dashboard?.completedProjects ?? projects.filter((p) => p.status === "Completed" || p.progressPercentage === 100).length,
      label: "Completed",
      statusKey: "Completed",
      details: recentProjects(dashboard, projects, (p) => p.status === "Completed" || p.progressPercentage === 100),
    },
    {
      icon: <Icon name="close" size={16} />,
      value: dashboard?.delayedProjects ?? projects.filter((p) => p.status === "Delayed").length,
      label: "Delayed",
      statusKey: "Delayed",
      details: recentProjects(dashboard, projects, (p) => p.status === "Delayed"),
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
          detailLabel="Latest projects"
        />
      ))}
    </div>
  );
}
