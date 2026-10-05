import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Milestone, Project, Task, User } from "../../../types";
import { GlassCard } from "../../shared";
import { MilestoneCard } from "./MilestoneCard";
import { MilestoneDetailk } from "./MilestoneDetailk";
import { Icon } from "../../../components/ui/Icon";

const PAGE_SIZE = 10;
const PIN_THRESHOLD = 5;

interface MilestonesPanelProps {
  milestones: Milestone[];
  tasks: Task[];
  users: User[];
  project?: Project | null;
  selectedMilestoneId: string;
  onSelectMilestone: (id: string) => void;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (milestone: Milestone) => void;
  onDelete: (milestone: Milestone) => void;
  onComplete: (milestoneId: string) => void;
  onStatusChange: (milestoneId: string, status: string) => void;
  onAddTask: (milestoneId: string) => void;
  hideDetailPanel?: boolean;
  onViewDetail?: (milestone: Milestone) => void;
}

export function MilestonesPanel({
  milestones,
  tasks,
  users,
  project,
  selectedMilestoneId,
  onSelectMilestone,
  canManage,
  onAdd,
  onEdit,
  onDelete,
  onComplete,
  onStatusChange,
  onAddTask,
  hideDetailPanel = false,
  onViewDetail,
}: MilestonesPanelProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedScrollPos, setSavedScrollPos] = useState(0);
  const [pinnedMilestone, setPinnedMilestone] = useState<Milestone | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredMilestones = useMemo(
    () =>
      milestones.filter((m) =>
        m.name.toLowerCase().includes(search.toLowerCase())
      ),
    [milestones, search]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleMilestones = useMemo(
    () => filteredMilestones.slice(0, visibleCount),
    [filteredMilestones, visibleCount]
  );

  const remaining = filteredMilestones.length - visibleCount;

  const handleSelect = useCallback((id: string) => {
    onSelectMilestone(id);
    const idx = filteredMilestones.findIndex((m) => m.id === id);
    const ms = filteredMilestones.find((m) => m.id === id) ?? null;

    if (idx >= PIN_THRESHOLD) {
      setSavedScrollPos(window.scrollY);
      setPinnedMilestone(ms);
    } else {
      setPinnedMilestone(null);
      setSavedScrollPos(0);
    }
  }, [onSelectMilestone, filteredMilestones]);

  useEffect(() => {
    if (!pinnedMilestone) return;
    requestAnimationFrame(() => {
      const grid = listRef.current?.closest<HTMLElement>('div.grid');
      if (grid) {
        const rect = grid.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight) {
          window.scrollBy({ top: rect.top - 16, behavior: "smooth" });
        }
      }
    });
  }, [pinnedMilestone]);

  const handleJumpBack = () => {
    setPinnedMilestone(null);
    if (savedScrollPos > 0) {
      window.scrollTo({ top: savedScrollPos, behavior: "smooth" });
    }
    setSavedScrollPos(0);
  };

  const selected = milestones.find((m) => m.id === selectedMilestoneId) ?? null;
  const milestoneTasks = selected ? tasks.filter((t) => t.milestoneId === selected.id) : [];

  const listPanel = (
    <GlassCard className="p-4 h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Milestones
        </span>
        {canManage && (
          <button type="button" onClick={onAdd} className="text-indigo-600 hover:text-indigo-800">
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        )}
      </div>

      <div className="relative mb-3 px-1 shrink-0">
        <span className="material-symbols-outlined absolute left-3 top-1.5 text-slate-400 text-[16px]">search</span>
        <input
          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow outline-none shadow-sm"
          placeholder="Filter milestones..."
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div ref={listRef} className="flex flex-col p-2 gap-2 flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {pinnedMilestone && (
          <div className="shrink-0">
            <div className="relative">
              <MilestoneCard
                milestone={pinnedMilestone}
                isSelected={pinnedMilestone.id === selectedMilestoneId}
                index={-1}
                onSelectMilestone={handleSelect}
                onViewMilestone={onViewDetail ?? ((m) => handleSelect(m.id))}
                onEditMilestone={onEdit}
                canManage={canManage}
              />
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200 shadow-sm">
                Pinned
              </span>
            </div>
          </div>
        )}

        {visibleMilestones.map((milestone, index) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            isSelected={milestone.id === selectedMilestoneId}
            index={index}
            onSelectMilestone={handleSelect}
            onViewMilestone={onViewDetail ?? ((m) => handleSelect(m.id))}
            onEditMilestone={onEdit}
            canManage={canManage}
          />
        ))}

        {filteredMilestones.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Icon name="flag" size={32} className="mx-auto mb-3" />
            <p className="text-sm font-medium">No milestones match filters</p>
          </div>
        )}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium py-1.5 text-center transition-colors"
          >
            Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
          </button>
        )}
        {visibleCount > PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setVisibleCount(PAGE_SIZE)}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium py-1 text-center transition-colors"
          >
            Show less
          </button>
        )}
      </div>

      {savedScrollPos > 0 && createPortal(
        <button
          type="button"
          onClick={handleJumpBack}
          className="fixed bottom-4 z-50 size-9 flex items-center justify-center rounded-full bg-white border border-blue-200 shadow-lg text-blue-500 transition-all max-md:!left-auto max-md:right-4 animate-[bounce-glow_2.5s_ease-in-out_infinite]"
          style={{
            left: 'calc(clamp(200px,25vw,240px) + 280px)',
          }}
          title="Back to previous position"
        >
          <Icon name="arrow-down" size={16} />
          <style>{`
            @keyframes bounce-glow {
              0%, 100% { 
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(59,130,246,0.15), 0 1px 3px rgba(0,0,0,0.08);
              }
              50% { 
                transform: translateY(-6px);
                box-shadow: 0 8px 25px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2);
              }
            }
          `}</style>
        </button>,
        document.body
      )}
    </GlassCard>
  );

  if (hideDetailPanel) return listPanel;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6">
      {listPanel}
      {/* Milestone Detail */}
      <div className="max-h-[calc(100vh-20px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {selected ? (
          <MilestoneDetailk
            milestone={selected}
            tasks={milestoneTasks}
            project={project}
            users={users}
            onComplete={() => onComplete(selected.id)}
            onStatusChange={(status) => onStatusChange(selected.id, status)}
            onEdit={() => onEdit(selected)}
            onDelete={() => onDelete(selected)}
            onAddTask={() => onAddTask(selected.id)}
            isAdmin={canManage}
          />
        ) : (
          <GlassCard className="p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Milestones" value={milestones.length} color="indigo" />
              <StatCard label="Completed" value={milestones.filter((m) => m.status === "Completed").length} color="emerald" />
              <StatCard label="Critical" value={milestones.filter((m) => m.isCritical).length} color="rose" />
              <StatCard label="Avg Progress" value={milestones.length ? `${Math.round(milestones.reduce((s, m) => s + (m.progressPercentage || 0), 0) / milestones.length)}%` : "0%"} color="amber" />
            </div>
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 mx-auto">
                <span className="material-symbols-outlined text-4xl text-slate-400">flag</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Milestone</h3>
              <p className="text-sm text-slate-400 mx-auto">
                Choose a milestone from the left panel to view its details and associated tasks
              </p>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  };
  const colors = colorMap[color] || colorMap.indigo;

  return (
    <div className={`rounded-xl border p-4 text-center ${colors.border} ${colors.bg}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
    </div>
  );
}