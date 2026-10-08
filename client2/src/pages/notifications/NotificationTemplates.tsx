import { useMemo, useState } from "react";
import type { NotificationTemplateRecord } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationTemplatesProps {
  templates: NotificationTemplateRecord[];
  onEdit: (template: NotificationTemplateRecord) => void;
  onDelete: (template: NotificationTemplateRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
}

type SortKey = "typeAsc" | "typeDesc" | "channelsDesc";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "typeAsc", label: "Type (A–Z)" },
  { value: "typeDesc", label: "Type (Z–A)" },
  { value: "channelsDesc", label: "Most channels" },
];

export function NotificationTemplates({
  templates,
  onEdit,
  onDelete,
  onCreate,
  canWrite,
}: NotificationTemplatesProps) {
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("typeAsc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const allChannels = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.supportedChannels?.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [templates]);

  const channelOptions = useMemo(
    () => [
      { value: "", label: "All", count: templates.length },
      ...allChannels.map((c) => ({
        value: c,
        label: c,
        count: templates.filter((t) => t.supportedChannels?.includes(c)).length,
      })),
    ],
    [allChannels, templates]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = templates;
    if (term) {
      list = list.filter((template) =>
        [
          template.templateType,
          template.subjectTemplate,
          template.bodyTemplate,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    if (channelFilter) {
      list = list.filter((t) => t.supportedChannels?.includes(channelFilter));
    }

    const sorted = [...list];
    if (sortKey === "typeAsc")
      sorted.sort((a, b) => a.templateType.localeCompare(b.templateType));
    else if (sortKey === "typeDesc")
      sorted.sort((a, b) => b.templateType.localeCompare(a.templateType));
    else if (sortKey === "channelsDesc")
      sorted.sort(
        (a, b) =>
          (b.supportedChannels?.length ?? 0) - (a.supportedChannels?.length ?? 0)
      );
    return sorted;
  }, [templates, query, channelFilter, sortKey]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search templates by type or subject..."
        chipGroups={
          allChannels.length > 0
            ? [
                {
                  key: "channel",
                  options: channelOptions,
                  value: channelFilter,
                  onChange: setChannelFilter,
                },
              ]
            : []
        }
        actions={
          <>
            <SortDropdown
              value={sortKey}
              onChange={(v) => setSortKey(v as SortKey)}
              options={SORT_OPTIONS}
            />
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              available={["card", "list"]}
            />
            {canWrite && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                <Icon name="add" size={14} />
                Create Template
              </button>
            )}
          </>
        }
      />

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          {templates.length} templates
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="description"
          title="No templates"
          description={
            canWrite
              ? "Create notification templates for consistent messaging."
              : "No notification templates have been configured yet."
          }
          accent="primary"
          action={
            canWrite ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
              >
                <Icon name="add" size={14} />
                Create Template
              </button>
            ) : undefined
          }
        />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
          {filtered.map((template, idx) => (
            <div
              key={template.id}
              className="card-stagger"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <TemplateCard
                template={template}
                onEdit={() => onEdit(template)}
                onDelete={() => onDelete(template)}
                canWrite={canWrite}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden pb-10 view-fade">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Type
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Subject
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Variables
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Channels
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((template) => (
                  <tr
                    key={template.id}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">
                        {template.templateType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-600 text-xs max-w-xs truncate">
                        {template.subjectTemplate}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {template.variables.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {template.variables.map((v) => (
                            <span
                              key={v}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono"
                            >
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {template.supportedChannels.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {template.supportedChannels.map((c) => (
                            <span
                              key={c}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(template)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        {canWrite && (
                          <button
                            type="button"
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
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function TemplateCard({
  template,
  onEdit,
  onDelete,
  canWrite,
}: {
  template: NotificationTemplateRecord;
  onEdit: () => void;
  onDelete: () => void;
  canWrite: boolean;
}) {
  return (
    <div className="group flex flex-col h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Icon name="description" size={16} />
          </div>
          <h3
            className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors"
            title={template.templateType}
          >
            {template.templateType}
          </h3>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
        {template.subjectTemplate || "No subject"}
      </p>

      {template.variables.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Variables
          </p>
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 4).map((v) => (
              <span
                key={v}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono"
              >
                {`{{${v}}}`}
              </span>
            ))}
            {template.variables.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 font-medium">
                +{template.variables.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {template.supportedChannels.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Channels
          </p>
          <div className="flex flex-wrap gap-1">
            {template.supportedChannels.map((c) => (
              <span
                key={c}
                className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Icon name="edit" size={11} />
          Edit
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Icon name="delete" size={11} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
