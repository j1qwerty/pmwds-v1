import React from 'react';
import type { Task } from "../../../types";
import { getStatusColor } from "../../shared/colors"; // Adjust import path as needed
import { Icon } from "../../../components/ui/Icon";

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  statusKey: string;
}

type TaskStatsProps = {
  tasks?: Task[];
};

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, statusKey }) => {
  const colors = getStatusColor(statusKey);
  
  return (
    <div className={`shadow-sm group relative overflow-hidden ${colors.shadowHoverColor} rounded-2xl p-4 hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between border-0 bg-white`}>
      {/* Animated blur background */}
      <div className={`absolute bottom-1/2 right-0 w-24 h-24 ${colors.bg} rounded-full blur-lg group-hover:opacity-80 transition-all pointer-events-none opacity-40`} />
      
      {/* Top row - Icon and Label */}
      <div className="relative flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 ${colors.badgeBg} rounded-lg flex items-center justify-center ${colors.badgeText} shrink-0`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      
      {/* Value */}
      <div className="relative mt-2">
        <span className={`text-2xl font-bold text-center tracking-wider ${colors.text}`}>
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

const TaskStats: React.FC<TaskStatsProps> = ({ tasks = [] }) => {
  const stats = [
    {
      icon: <Icon name="file" size={16} />,
      value: tasks.length,
      label: 'Total Tasks',
      statusKey: 'Total',
    },
    {
      icon: <Icon name="clock" size={16} />,
      value: tasks.filter(task => task.status === "InProgress").length,
      label: 'In Progress',
      statusKey: 'InProgress',
    },
    {
      icon: <Icon name="alert-circle" size={16} />,
      value: tasks.filter(task => task.status === "OnHold").length,
      label: 'On Hold',
      statusKey: 'OnHold',
    },
    {
      icon: <Icon name="check-circle" size={16} />,
      value: tasks.filter(task => task.status === "Completed" || task.progressPercentage === 100).length,
      label: 'Completed',
      statusKey: 'Completed',
    },
    {
      icon: <Icon name="close" size={16} />,
      value: tasks.filter(task => task.isOverdue || task.status === "Delayed").length,
      label: 'Delayed',
      statusKey: 'Delayed',
    }
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default TaskStats;