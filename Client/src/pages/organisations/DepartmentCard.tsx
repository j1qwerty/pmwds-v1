import type { Department, User } from "../../types";
import { formatPercent } from "../../lib/formatters";
import { Avatar, AvatarStack } from "../shared";

interface DepartmentCardProps {
  department: Department;
  index: number;
  isAdmin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  teamMembers?: User[];
  departmentHead?: User;
  activeProjects?: number;
  completedProjects?: number;
  avgWorkload?: number;
}

export function DepartmentCard({ 
  department, 
  index, 
  isAdmin, 
  canEdit = isAdmin,
  canDelete = isAdmin,
  onEdit, 
  onDelete,
  teamMembers = [],
  departmentHead,

  avgWorkload = 0,
}: DepartmentCardProps) {
  const colors = [
    { bg: "bg-indigo-100", text: "text-indigo-600", bar: "bg-indigo-500" },
    { bg: "bg-violet-100", text: "text-violet-600", bar: "bg-violet-500" },
    { bg: "bg-blue-100", text: "text-blue-600", bar: "bg-blue-500" },
    { bg: "bg-cyan-100", text: "text-cyan-600", bar: "bg-cyan-500" },
    { bg: "bg-emerald-100", text: "text-emerald-600", bar: "bg-emerald-500" },
    { bg: "bg-teal-100", text: "text-teal-600", bar: "bg-teal-500" },
  ];
  const color = colors[index % colors.length];
  const extraCount = Math.max(0, teamMembers.length - 3);
  const capacityPercent = Math.min((department.capacityUtilization || 0) * 100, 100);

  return (
    <div
      className="p-5 rounded-xl bg-white border border-slate-100 shadow-md hover:border-slate-200 hover:shadow-lg transition-all duration-200"
      style={{ animation: `slideIn 0.3s ease ${index * 0.08}s both` }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center shrink-0`}>
            <span className={`material-symbols-outlined text-xl ${color.text}`}>
              groups
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-800 truncate">{department.name}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{department.code}</div>
          </div>
        </div>
         <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 font-medium mb-0.5">Max</div>
          <div className="text-sm font-bold text-slate-700">{department.maxCapacity}</div>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex gap-1 shrink-0 ml-2">
            {canEdit && (
              <button
                onClick={() => onEdit(department)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white cursor-pointer flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-colors"
                title="Edit department"
              >
                <span className="material-symbols-outlined text-sm text-slate-500">edit</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(department)}
                className="w-8 h-8 rounded-lg border border-red-200 bg-red-50 cursor-pointer flex items-center justify-center hover:bg-red-100 hover:border-red-300 transition-colors"
                title="Delete department"
              >
                <span className="material-symbols-outlined text-sm text-red-500">delete</span>
              </button>
            )}
          </div>
        )}
      </div>

     

     

    

      {/* Team Members & Department Head */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          {/* Team Member Avatars */}
          {teamMembers.length > 0 && <AvatarStack people={teamMembers} limit={3} size="sm" />}
          {extraCount > 0 && <span className="sr-only">{extraCount} more team members</span>}
          
          {teamMembers.length === 0 && (
            <span className="text-[11px] text-slate-400 italic">No team members</span>
          )}
        </div>

        {/* Department Head */}
        {departmentHead && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">Head</span>
            <Avatar person={departmentHead} size="sm" />
            <span className={`text-[11px] font-medium ${departmentHead.isActive === false ? "text-red-500" : "text-slate-600"}`}>{departmentHead.fullName}</span>
          </div>
        )}
        
        {!departmentHead && department.departmentHeadUserId && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">Head</span>
            <div className="size-6 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-xs text-amber-600">person</span>
            </div>
          </div>
        )}
      </div>

      {/* Workload Indicator */}
      {avgWorkload > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                avgWorkload > 80 ? 'bg-red-400' : avgWorkload > 60 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(avgWorkload, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-slate-400">{avgWorkload}% load</span>
        </div>
      )}
    </div>
  );
}
