import type { NotificationTemplateRecord } from "../../types";
import { GlassCard, GradientButton } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationTemplatesProps {
  templates: NotificationTemplateRecord[];
  onEdit: (template: NotificationTemplateRecord) => void;
  onDelete: (template: NotificationTemplateRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
}

export function NotificationTemplates({ templates, onEdit, onDelete, onCreate, canWrite }: NotificationTemplatesProps) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Templates</h3>
          <p className="text-xs text-slate-400">Maintain reusable notification layouts and channels</p>
        </div>
        {canWrite && (
          <GradientButton onClick={onCreate}>
            <Icon name="add" size={15} />
            Create Template
          </GradientButton>
        )}
      </div>

      <div className="overflow-x-auto">
        {templates.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="description" size={24} className="text-slate-400" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">No templates</h4>
            <p className="text-xs text-slate-400">Create notification templates for consistent messaging</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Subject</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Variables</th>
                <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Channels</th>
                <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-800">{template.templateType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-600 text-xs max-w-xs truncate">{template.subjectTemplate}</p>
                  </td>
                  <td className="px-6 py-4">
                    {template.variables.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v) => (
                          <span key={v} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {template.supportedChannels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {template.supportedChannels.map((c) => (
                          <span key={c} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(template)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      {canWrite && (
                        <button
                          onClick={() => onDelete(template)}
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