import type { PermissionRecord } from "../../types";
import { GlassCard, GradientButton } from "../shared";
import React from "react";

interface PermissionsTableProps {
  permissions: PermissionRecord[];
  onEdit: (permission: PermissionRecord) => void;
  onDelete: (permission: PermissionRecord) => void;
  onCreate: () => void;
  isAdmin: boolean;
}

export function PermissionsTable({ permissions, onEdit, onDelete, onCreate, isAdmin }: PermissionsTableProps) {
  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const module = perm.module || "Other";
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {} as Record<string, PermissionRecord[]>);

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Permissions</h3>
          <p className="text-xs text-slate-400">Module-level permissions used by roles</p>
        </div>
        {/* {isAdmin && (
          <GradientButton onClick={onCreate} className="hidden">
            <span className="material-symbols-outlined text-sm">add</span>
            Create Permission
          </GradientButton>
        )} */}
      </div>

    <div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Code</th>
        <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Module</th>
        <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Scope</th>
        <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Description</th>
        <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider hidden">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
        <React.Fragment key={module}>
          {/* Only show module header if there are multiple permissions in this module */}  
          {modulePermissions.length > 1 && (
            <tr className="bg-slate-50/50">
              <td colSpan={5} className="px-6 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{module}</span>
                  <span className="text-[10px] text-slate-400">({modulePermissions.length})</span>
                </div>
              </td>
            </tr>
          )}
          
          {modulePermissions.map((permission) => (
            <tr key={permission.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <span className="material-symbols-outlined text-violet-600 text-sm">lock</span>
                  </div>
                  <div>
                    <div className="font-mono text-xs font-semibold text-slate-800">{permission.code}</div>
                    <div className="text-xs text-slate-500">{permission.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-3">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                  {permission.module}
                </span>
              </td>
              <td className="px-6 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  permission.isGlobal
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-blue-50 text-blue-600"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${permission.isGlobal ? "bg-emerald-500" : "bg-blue-500"}`}></span>
                  {permission.isGlobal ? "Global" : "Scoped"}
                </span>
              </td>
              <td className="px-6 py-3">
                <p className="text-xs text-slate-500  truncate">
                  {permission.description || "—"}
                </p>
              </td>
              <td className="px-6 py-3 text-right hidden">
                {isAdmin && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(permission)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(permission)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </React.Fragment>
      ))}
    </tbody>
  </table>

  {permissions.length === 0 && (
    <div className="py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-3xl text-slate-400">lock</span>
      </div>
      <h4 className="text-sm font-semibold text-slate-700 mb-2">No permissions defined</h4>
      <p className="text-xs text-slate-400 mx-auto">
        Create permissions to define granular access controls
      </p>
      {/* {isAdmin && (
        <button onClick={onCreate} className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 hidden">
          <span className="material-symbols-outlined text-lg">add</span>
          Create Permission
        </button>
      )} */}
    </div>
  )}
</div>
    </GlassCard>
  );
}