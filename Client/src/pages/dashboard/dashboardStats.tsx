import type { Project } from "../../types";
import { getStatusColor } from "../shared/colors";
import { Icon } from "../../components/ui/Icon";
import { MetricStatCard, type MetricStatDetail } from "../shared/MetricStatCard";

interface DashboardStatsProps {
  projects?: Project[];
}

function recentProjects(projects: Project[], predicate: (project: Project) => boolean): MetricStatDetail[] {
  return projects
    .filter(predicate)
    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
    .slice(0, 5)
    .map((project) => ({
      id: project.id,
      title: project.name,
      subtitle: `${project.projectCode} · ${project.status}`,
    }));
}

const DashboardStats = ({ projects = [] }: DashboardStatsProps) => {
  const stats = [
    {
      icon: <Icon name="file" size={16} />,
      value: projects.length,
      label: "Total Projects",
      statusKey: "Total",
      details: recentProjects(projects, () => true),
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: projects.filter((p) => p.status === "InProgress").length,
      label: "In Progress",
      statusKey: "InProgress",
      details: recentProjects(projects, (p) => p.status === "InProgress"),
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: projects.filter((p) => p.status === "OnHold").length,
      label: "On Hold",
      statusKey: "OnHold",
      details: recentProjects(projects, (p) => p.status === "OnHold"),
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: projects.filter((p) => p.status === "Completed" || p.progressPercentage === 100).length,
      label: "Completed",
      statusKey: "Completed",
      details: recentProjects(projects, (p) => p.status === "Completed" || p.progressPercentage === 100),
    },
    {
      icon: <Icon name="close" size={16} />,
      value: projects.filter((p) => p.status === "Delayed").length,
      label: "Delayed",
      statusKey: "Delayed",
      details: recentProjects(projects, (p) => p.status === "Delayed"),
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
};

export default DashboardStats;
