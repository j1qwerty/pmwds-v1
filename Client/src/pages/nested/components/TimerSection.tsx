import { useState } from "react";
import { FiChevronDown, FiClock } from "react-icons/fi";

interface TimerSectionProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  onStart: () => void;
}

export function TimerSection({
  description,
  onDescriptionChange,
  onStart,
}: TimerSectionProps) {
  const [showTimer, setShowTimer] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
      <button
        onClick={() => setShowTimer(!showTimer)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <FiClock className="w-3.5 h-3.5" /> Timer
        </div>
        <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTimer ? "rotate-180" : ""}`} />
      </button>
      {showTimer && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          <input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What are you working on?"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300"
          />
          <button onClick={onStart} className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2 cursor-pointer">
            <FiClock className="w-4 h-4" /> Start Timer
          </button>
        </div>
      )}
    </div>
  );
}
