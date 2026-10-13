import { useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import type { ProjectNameBucket } from "../../../types";

interface ProjectOverviewProps {
  newProjects?: number;
  pendingProjects?: number;
  doneProjects?: number;
  /**
   * Names behind each segment. Optional so the chart still renders for callers that only
   * have counts; the tooltip then falls back to explaining the bucket definition.
   */
  newProjectsList?: ProjectNameBucket;
  pendingProjectsList?: ProjectNameBucket;
  doneProjectsList?: ProjectNameBucket;
}

type SegmentKey = "new" | "pending" | "done";

interface Segment {
  key: SegmentKey;
  label: string;
  color: string;
  dot: string;
  count: number;
  bucket?: ProjectNameBucket;
  description: string;
}

export function ProjectOverview({
  newProjects = 0,
  pendingProjects = 0,
  doneProjects = 0,
  newProjectsList,
  pendingProjectsList,
  doneProjectsList,
}: ProjectOverviewProps) {
  const total = newProjects + pendingProjects + doneProjects;
  const [hovered, setHovered] = useState<SegmentKey | null>(null);

  // Calculate stroke dasharray values based on proportions
  const circumference = 2 * Math.PI * 70; // 2πr where r=70
  const newDash = total > 0 ? (newProjects / total) * circumference : 0;
  const pendingDash = total > 0 ? (pendingProjects / total) * circumference : 0;
  const doneDash = total > 0 ? (doneProjects / total) * circumference : 0;

  // Calculate stroke dashoffset for each segment
  const pendingOffset = -newDash;
  const doneOffset = -(newDash + pendingDash);

  const segments: Segment[] = [
    {
      key: "new",
      label: "New",
      color: "#06b6d4",
      dot: "bg-cyan-500",
      count: newProjects,
      bucket: newProjectsList,
      description: "Not started and not completed",
    },
    {
      key: "pending",
      label: "Pending",
      color: "#f59e0b",
      dot: "bg-amber-500",
      count: pendingProjects,
      bucket: pendingProjectsList,
      description: "Currently in progress",
    },
    {
      key: "done",
      label: "Done",
      color: "#10b981",
      dot: "bg-emerald-500",
      count: doneProjects,
      bucket: doneProjectsList,
      description: "Completed",
    },
  ];

  const active = hovered ? segments.find((s) => s.key === hovered) ?? null : null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 h-[360px] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Project Overview</h3>
        <button className="text-slate-400 hover:text-slate-600">
          <Icon name="hi-dots-vertical" size={20} />
        </button>
      </div>

      <div className="flex justify-center mb-4 relative">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r="70"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="20"
          />

          {/* New Projects segment */}
          {newProjects > 0 && (
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={hovered && hovered !== "new" ? "#cbd5e1" : "#06b6d4"}
              strokeWidth="20"
              strokeDasharray={`${newDash} ${circumference - newDash}`}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke 150ms ease" }}
              className="cursor-pointer"
              onMouseEnter={() => setHovered("new")}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{segmentTooltipText(segments[0])}</title>
            </circle>
          )}

          {/* Pending Projects segment */}
          {pendingProjects > 0 && (
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={hovered && hovered !== "pending" ? "#cbd5e1" : "#f59e0b"}
              strokeWidth="20"
              strokeDasharray={`${pendingDash} ${circumference - pendingDash}`}
              strokeDashoffset={pendingOffset}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke 150ms ease" }}
              className="cursor-pointer"
              onMouseEnter={() => setHovered("pending")}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{segmentTooltipText(segments[1])}</title>
            </circle>
          )}

          {/* Done Projects segment */}
          {doneProjects > 0 && (
            <circle
              cx="90"
              cy="90"
              r="70"
              fill="none"
              stroke={hovered && hovered !== "done" ? "#cbd5e1" : "#10b981"}
              strokeWidth="20"
              strokeDasharray={`${doneDash} ${circumference - doneDash}`}
              strokeDashoffset={doneOffset}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke 150ms ease" }}
              className="cursor-pointer"
              onMouseEnter={() => setHovered("done")}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{segmentTooltipText(segments[2])}</title>
            </circle>
          )}

          {/* Centre readout doubles as the always-visible label for the hovered segment,
              so the tooltip works even where native SVG <title> tooltips are suppressed. */}
          <text
            x="90"
            y="86"
            textAnchor="middle"
            className="fill-slate-800"
            style={{ fontSize: 26, fontWeight: 700 }}
          >
            {active ? active.count : total}
          </text>
          <text
            x="90"
            y="104"
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: 11 }}
          >
            {active ? active.label : "Total"}
          </text>
        </svg>
      </div>

      <div className="flex justify-center gap-6 text-xs">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`flex items-center gap-2 rounded px-1 py-0.5 transition-colors ${
              hovered === segment.key ? "bg-slate-100" : ""
            }`}
            onMouseEnter={() => setHovered(segment.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className={`w-2 h-2 rounded-full ${segment.dot}`} />
            <span className="text-slate-500">
              {segment.label} ({segment.count})
            </span>
          </div>
        ))}
      </div>

      {/* Project names for whichever segment is hovered. */}
      {active && (
        <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {active.label} projects
            </span>
            <span className="text-[10px] text-slate-400">{active.description}</span>
          </div>
          {active.bucket && active.bucket.projects.length > 0 ? (
            <>
              <ul className="space-y-1">
                {active.bucket.projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                    title={project.name}
                  >
                    <span className="truncate">{project.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {Math.round(project.progressPercentage)}%
                    </span>
                  </li>
                ))}
              </ul>
              {active.bucket.totalCount > active.bucket.projects.length && (
                <p className="mt-1.5 text-[10px] text-slate-400">
                  +{active.bucket.totalCount - active.bucket.projects.length} more
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-slate-400">
              {active.count === 0 ? "Nothing in this segment yet." : active.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Native SVG tooltip, used as a fallback for browsers/assistive tech that suppress the panel. */
function segmentTooltipText(segment: Segment): string {
  const names = segment.bucket?.projects.map((p) => p.name) ?? [];
  const header = `${segment.label}: ${segment.count} project${segment.count === 1 ? "" : "s"}`;
  if (names.length === 0) return `${header} (${segment.description})`;
  const extra = segment.bucket!.totalCount - names.length;
  const footer = extra > 0 ? `\n…and ${extra} more` : "";
  return `${header}\n${names.join("\n")}${footer}`;
}