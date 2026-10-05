import React from 'react';
import type { Project } from "../../types";
import { getStatusColor } from "../shared/colors";
import { Icon } from "../../components/ui/Icon";

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  statusKey: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, statusKey }) => {
  const colors = getStatusColor(statusKey);

  return (
    <div className={`shadow-sm grouprelative ${colors.badgeBg} overflow-hidden ${colors.shadowHoverColor} rounded-2xl p-4 hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between border-0`}>
      {/* <div className={`absolute bottom-1/2 right-0 w-24 h-24 bg-red-600 rounded-full  group-hover:opacity-80 transition-all pointer-events-none `} /> */}

      <div className="relative flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 ${colors.badgeBg} rounded-lg flex items-center justify-center ${colors.badgeText} shrink-0`}>
          {icon}
        </div>
        <span className={`text-xs font-medium ${[colors.badgeText]} uppercase tracking-wider`}>
          {label}
        </span>
      </div>

      <div className="relative mt-2">
        <span className={`text-2xl font-bold text-center tracking-wider ${colors.text}`}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

interface DashboardStatsProps {
  projects?: Project[];
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ projects = [] }) => {
  const stats = [
    {
      icon: <Icon name="file" size={16} />,
      value: projects.length,
      label: 'Total Projects',
      statusKey: 'Total',
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: projects.filter(p => p.status === "InProgress").length,
      label: 'In Progress',
      statusKey: 'InProgress',
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: projects.filter(p => p.status === "OnHold").length,
      label: 'On Hold',
      statusKey: 'OnHold',
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: projects.filter(p => p.status === "Completed" || p.progressPercentage === 100).length,
      label: 'Completed',
      statusKey: 'Completed',
    },
    {
      icon: <Icon name="close" size={16} />,
      value: projects.filter(p => p.status === "Delayed").length,
      label: 'Delayed',
      statusKey: 'Delayed',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 ">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
};

export default DashboardStats;
