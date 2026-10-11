import { useMemo, useState } from "react";
import type { NotificationTemplateRecord } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  PageContainer,
  StatCard,
  Skeleton,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationTemplatesProps {
  templates: NotificationTemplateRecord[];
  onEdit: (template: NotificationTemplateRecord) => void;
  onDelete: (template: NotificationTemplateRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
  /** True while the template list is being fetched for this tab. */
  loading?: boolean;
}

type SortKey = "typeAsc" | "typeDesc" | "channelsDesc";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "typeAsc", label: "Type (A–Z)" },
  { value: "typeDesc", label: "Type (Z–A)" },
  { value: "channelsDesc", label: "Most channels" },
];

/* ── Small presentational helpers ────────────────────────────────── */

function ChannelChip({ channel }: { channel: string }) {
  return (
    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
      {channel}
    </span>
  );
}

function VariableChip({ variable }: { variable: string }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
      {`{{${variable}}}`}
    </span>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone: "indigo" | "red";
}) {
  const toneCls =
    tone === "indigo"
      ? "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
      : "text-slate-400 hover:bg-red-50 hover:text-red-600";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls}`}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/97 shadow-sm">
      <div className="divide-y divide-slate-100">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationTemplates({
  templates,
  onEdit,
  onDelete,
  onCreate,
  canWrite,
  loading = false,
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

  const allVariables = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.variables?.forEach((v) => set.add(v)));
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

  const noChannelCount = useMemo(
    () => templates.filter((t) => (t.supportedChannels?.length ?? 0) === 0).length,
    [templates]
  );

  const createButton = canWrite ? (
    <button
      type="button"
      onClick={onCreate}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:from-indigo-700 hover:to-violet-700"
    >
      <Icon name="add" size={14} />
      New template
    </button>
  ) : undefined;

  return (
    <PageContainer
      stats={
        loading ? undefined : (
          <>
            <StatCard label="Templates" value={templates.length} color="emerald" icon="description" />
            <StatCard label="Channels in use" value={allChannels.length} color="indigo" icon="devices" />
            <StatCard label="Variables" value={allVariables.length} color="violet" icon="code" />
            <StatCard label="Missing channels" value={noChannelCount} color="amber" icon="warning" />
          </>
        )
      }
      filters={
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search templates by type or subject..."
          chipGroups={
            allChannels.length > 0
              ? [
                  {
                    key: "channel",
                    label: "Channel",
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
              {createButton}
            </>
          }
        />
      }
    >
      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="description"
          title="No templates"
          description={
            canWrite
              ? "Create notification templates for consistent messaging across channels."
              : "No notification templates have been configured yet."
          }
          accent="primary"
          action={createButton}
        />
      ) : viewMode === "card" ? (
        <div className="view-fade grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3">
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
        <div className="view-fade overflow-hidden rounded-2xl border border-slate-200/60 bg-white/97 shadow-sm">
          <div className="divide-y divide-slate-100">
            {filtered.map((template, idx) => (
              <div
                key={template.id}
                className="card-stagger flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Icon name="description" size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="max-w-full truncate text-sm font-semibold text-slate-800"
                      title={template.templateType}
                    >
                      {template.templateType}
                    </span>
                    {(template.supportedChannels?.length ?? 0) === 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                        No channels
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500" title={template.subjectTemplate}>
                    {template.subjectTemplate || "No subject"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {template.supportedChannels.slice(0, 3).map((c) => (
                      <ChannelChip key={c} channel={c} />
                    ))}
                    {template.supportedChannels.length > 3 && (
                      <span className="text-[10px] font-medium text-slate-400">
                        +{template.supportedChannels.length - 3} more
                      </span>
                    )}
                    {template.variables.length > 0 && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        {template.variables.length} variable{template.variables.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <IconAction
                    icon="edit"
                    label={`Edit template: ${template.templateType}`}
                    onClick={() => onEdit(template)}
                    tone="indigo"
                  />
                  {canWrite && (
                    <IconAction
                      icon="delete"
                      label={`Delete template: ${template.templateType}`}
                      onClick={() => onDelete(template)}
                      tone="red"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
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
    <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon name="description" size={16} />
          </span>
          <h3
            className="line-clamp-1 text-sm font-bold text-slate-800 transition-colors group-hover:text-indigo-700"
            title={template.templateType}
          >
            {template.templateType}
          </h3>
        </div>
        {(template.supportedChannels?.length ?? 0) === 0 && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            No channels
          </span>
        )}
      </div>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
        {template.subjectTemplate || "No subject"}
      </p>

      {template.variables.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Variables
          </p>
          <div className="flex flex-wrap gap-1">
            {template.variables.slice(0, 4).map((v) => (
              <VariableChip key={v} variable={v} />
            ))}
            {template.variables.length > 4 && (
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                +{template.variables.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {template.supportedChannels.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Channels
          </p>
          <div className="flex flex-wrap gap-1">
            {template.supportedChannels.map((c) => (
              <ChannelChip key={c} channel={c} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
        <IconAction
          icon="edit"
          label={`Edit template: ${template.templateType}`}
          onClick={onEdit}
          tone="indigo"
        />
        {canWrite && (
          <IconAction
            icon="delete"
            label={`Delete template: ${template.templateType}`}
            onClick={onDelete}
            tone="red"
          />
        )}
      </div>
    </div>
  );
}
