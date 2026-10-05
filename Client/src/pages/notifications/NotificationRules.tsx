import type { AlertRuleRecord } from "../../types";
import { GlassCard, GradientButton } from "../shared";

interface NotificationRulesProps {
  rules: AlertRuleRecord[];
  onEdit: (rule: AlertRuleRecord) => void;
  onDelete: (rule: AlertRuleRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
}

export function NotificationRules({ rules, onEdit, onDelete, onCreate, canWrite }: NotificationRulesProps) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Alert Rules</h3>
          <p className="text-xs text-slate-400">Define automated notification conditions and actions</p>
        </div>
        {canWrite && (
          <GradientButton onClick={onCreate}>
            <span className="material-symbols-outlined text-sm">add</span>
            Create Rule
          </GradientButton>
        )}
      </div>

      <div className="overflow-x-auto">
        {rules.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">rule</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">No alert rules</h4>
            <p className="text-xs text-slate-400">Create rules to automate notification delivery</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Condition</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Action</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800">{rule.name}</span>
                    {rule.lastTriggered && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {rule.conditionType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
                      {rule.actionType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      rule.isEnabled 
                        ? "bg-emerald-50 text-emerald-600" 
                        : "bg-slate-100 text-slate-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rule.isEnabled ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                      {rule.isEnabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(rule)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      {canWrite && (
                        <button
                          onClick={() => onDelete(rule)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}