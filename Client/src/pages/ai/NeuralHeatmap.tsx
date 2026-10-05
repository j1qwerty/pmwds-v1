import type { Project } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NeuralHeatmapProps {
  project: Project | null;
}

// Dummy data per project or default
const DUMMY_HEATMAP_DATA: Record<string, { name: string; value: number; risk: boolean; tasks: number }[]> = {
  default: [
    { name: "Backend", value: 45, risk: false, tasks: 12 },
    { name: "Frontend", value: 72, risk: true, tasks: 18 },
    { name: "DevOps", value: 35, risk: false, tasks: 8 },
    { name: "Mobile", value: 58, risk: false, tasks: 14 },
    { name: "QA", value: 28, risk: false, tasks: 6 },
    { name: "Security", value: 42, risk: false, tasks: 9 },
  ],
};

const DUMMY_PROJECT_NAMES = ["Vanguard", "Horizon", "Nexus", "Phoenix", "Atlas"];

export function NeuralHeatmap({ project }: NeuralHeatmapProps) {
  // Generate project-specific dummy data
  const getHeatmapData = () => {
    if (!project) return DUMMY_HEATMAP_DATA.default;
    
    const projectIndex = DUMMY_PROJECT_NAMES.findIndex(name => 
      project.name.toLowerCase().includes(name.toLowerCase())
    );
    
    if (projectIndex >= 0 && DUMMY_HEATMAP_DATA[project.name]) {
      return DUMMY_HEATMAP_DATA[project.name];
    }
    
    // Generate randomized data based on project name hash
    const seed = project.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return DUMMY_HEATMAP_DATA.default.map((dept, i) => ({
      ...dept,
      value: Math.min(95, Math.max(15, dept.value + (seed % 20) - 10 + i * 5)),
      risk: dept.risk || (seed % 3 === 0 && i === 1),
      tasks: dept.tasks + (seed % 6) - 3,
    }));
  };

  const heatmapData = getHeatmapData();
  const maxValue = Math.max(...heatmapData.map(d => d.value));
  const highRiskDept = heatmapData.find(d => d.risk);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="hub" size={20} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800">
            Neural Heatmap {project ? `· ${project.name}` : ""}
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {heatmapData.reduce((sum, d) => sum + d.tasks, 0)} active tasks
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        AI-generated intensity map showing workload distribution and risk areas
        {project ? ` for ${project.name}` : " across all projects"}.
      </p>

      {/* Bar Chart */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl pt-5 pb-2 relative" style={{ minHeight: "220px" }}>
        <div className="flex items-end h-50 px-8  gap-4">
          {heatmapData.map((dept) => {
            const heightPx = (dept.value / 100) * 176;
            
            return (
              <div key={dept.name} className="flex-1 flex flex-col items-center group">
                {/* Value label */}
                <span className={`text-[10px] font-bold mb-1 ${
                  dept.risk ? "text-red-500" : "text-slate-400"
                }`}>
                  {dept.value}%
                </span>
                
                {/* Bar */}
                <div 
                  className="w-full relative overflow-hidden transition-all duration-500 hover:opacity-90 cursor-pointer rounded-t-lg"
                  style={{ height: `${heightPx}px` }}
                >
                  {/* Bar fill */}
                  <div className={`absolute inset-0 rounded-t-lg ${
                    dept.risk 
                      ? "bg-gradient-to-t from-red-400/80 to-red-300/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]" 
                      : "bg-gradient-to-t from-indigo-400/60 to-violet-300/40"
                  }`}>
                  </div>
                  
                  {/* Grid lines */}
                  <div className="absolute inset-0">
                    {[25, 50, 75].map((line) => (
                      <div 
                        key={line}
                        className="absolute w-full border-t border-white/20"
                        style={{ bottom: `${line}%` }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Department name */}
                <span className={`text-[10px] mt-2 font-semibold ${
                  dept.risk ? "text-red-500" : "text-slate-600"
                }`}>
                  {dept.name}
                </span>
                
                {/* Task count */}
                <span className="text-[9px] text-slate-400">
                  {dept.tasks} tasks
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute left-3 top-14 bottom-8 flex flex-col justify-between">
          {[100, 75, 50, 25, 0].map((val) => (
            <span key={val} className="text-[8px] text-slate-400">{val}%</span>
          ))}
        </div>

        {/* Legend */}
        <div className="absolute top-3 right-3 flex gap-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-slate-200">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-indigo-400/60 to-violet-300/40"></div>
            <span className="text-[9px] text-slate-500">Normal Load</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-red-400/80 to-red-300/60"></div>
            <span className="text-[9px] text-red-500">High Risk</span>
          </div>
        </div>
      </div>

      {/* Alert for high risk */}
      {highRiskDept && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
          <Icon name="warning" size={18} className="text-red-500 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-red-700 block">
              {highRiskDept.name} requires attention
            </span>
            <span className="text-[10px] text-red-500">
              Workload intensity at {highRiskDept.value}% with {highRiskDept.tasks} active tasks. 
              Consider redistributing resources.
            </span>
          </div>
        </div>
      )}

      {/* Data source indicator */}
      <p className="text-[9px] text-slate-400 mt-3 text-right">
        Generated from historical project data and neural pattern analysis
      </p>
    </GlassCard>
  );
}