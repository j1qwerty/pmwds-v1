import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { FiEdit3 } from "react-icons/fi";
import { StatusDropdown } from "./StatusDropdown";
import { Icon } from "../../../components/ui/Icon";

interface ProgressStatusEditorProps {
  progress: number;
  status: string;
  mayEdit: boolean;
  onChange: (data: { progress: number; status: string }) => void;
  entityType?: "task" | "subtask";
}

function getProgressGradient(value: number): string {
  if (value >= 80) return "from-emerald-400 to-emerald-500";
  if (value >= 50) return "from-sky-400 to-sky-500";
  if (value >= 25) return "from-amber-400 to-amber-500";
  return "from-red-400 to-red-500";
}

export function ProgressStatusEditor({ progress, status, mayEdit, onChange, entityType = "task" }: ProgressStatusEditorProps) {
  const [progressInput, setProgressInput] = useState(String(progress));
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isDragging, setIsDragging] = useState(false);
  const [warning, setWarning] = useState<{ pendingProgress: number } | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressInputRef = useRef(progressInput);
  const selectedStatusRef = useRef(selectedStatus);

  progressInputRef.current = progressInput;
  selectedStatusRef.current = selectedStatus;

  const currentProgress = Math.min(100, Math.max(0, Number(progressInput) || 0));
  const progressGradient = getProgressGradient(currentProgress);

  const emit = (p: number, s: string) => {
    onChange({ progress: p, status: s });
  };

  const setProgress = (val: string) => {
    setProgressInput(val);
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    emit(num, selectedStatus);
  };

  const setStatus = (s: string) => {
    setSelectedStatus(s);
    emit(currentProgress, s);
  };

  const applyProgressReduction = (newProgress: number) => {
    setWarning(null);
    setProgressInput(String(newProgress));
    setSelectedStatus("InProgress");
    emit(newProgress, "InProgress");
  };

  const cancelProgressReduction = () => {
    setWarning(null);
    setProgressInput("100");
    emit(100, "Completed");
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "Completed") {
      setProgressInput("100");
      setSelectedStatus("Completed");
      emit(100, "Completed");
    } else if (selectedStatus === "Completed" && currentProgress === 100) {
      if (confirm(`This ${entityType} is completed. Changing status will reset progress. Continue?`)) {
        const input = prompt("Enter new progress percentage (0-99):", "0");
        if (input !== null) {
          const val = Math.min(99, Math.max(0, Number(input) || 0));
          setProgressInput(String(val));
          setSelectedStatus(newStatus);
          emit(val, newStatus);
        }
      }
    } else {
      setStatus(newStatus);
    }
  };

  const calculateProgressFromEvent = (clientX: number) => {
    if (!progressBarRef.current) return currentProgress;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mayEdit) return;
    const newProgress = calculateProgressFromEvent(e.clientX);
    if (selectedStatus === "Completed" && newProgress < 100) {
      setWarning({ pendingProgress: newProgress });
      return;
    }
    setProgress(String(newProgress));
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!mayEdit) return;
    const newProgress = calculateProgressFromEvent(e.touches[0].clientX);
    if (selectedStatus === "Completed" && newProgress < 100) {
      setWarning({ pendingProgress: newProgress });
      return;
    }
    setProgress(String(newProgress));
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newProgress = calculateProgressFromEvent(e.clientX);
      setProgressInput(String(newProgress));
    };

    const handleTouchMove = (e: TouchEvent) => {
      const newProgress = calculateProgressFromEvent(e.touches[0].clientX);
      setProgressInput(String(newProgress));
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      const finalProgress = Math.min(100, Math.max(0, Number(progressInputRef.current) || 0));
      emit(finalProgress, selectedStatusRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!mayEdit) return;
    const step = e.shiftKey ? 10 : 1;

    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setProgress(String(Math.min(100, currentProgress + step)));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const newVal = Math.max(0, currentProgress - step);
      if (selectedStatus === "Completed" && newVal < 100) {
        setWarning({ pendingProgress: newVal });
        return;
      }
      setProgress(String(newVal));
    }
  };

  const handleProgressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setProgressInput(val);
    }
  };

  const handleProgressInputBlur = () => {
    const val = Math.min(100, Math.max(0, Number(progressInput) || 0));
    if (selectedStatus === "Completed" && val < 100) {
      setWarning({ pendingProgress: val });
      return;
    }
    setProgressInput(String(val));
    emit(val, selectedStatus);
  };

  useEffect(() => {
    if (currentProgress === 100 && selectedStatus !== "Completed") {
      setSelectedStatus("Completed");
      emit(100, "Completed");
    }
  }, [currentProgress]);

  if (!mayEdit) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Progress
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${progressGradient}`}
                style={{ width: `${currentProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-600 shrink-0">{currentProgress}%</span>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Status
          </label>
          <StatusDropdown currentStatus={status} onChange={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Progress
          </label>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <FiEdit3 className="w-3 h-3 text-slate-400" />
            <input
              type="text"
              inputMode="numeric"
              aria-label="Progress percentage"
              value={progressInput}
              onChange={handleProgressInputChange}
              onBlur={handleProgressInputBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleProgressInputBlur();
                } else {
                  handleKeyDown(e);
                }
              }}
              className="w-12 text-xs font-semibold text-slate-700 text-center outline-none bg-transparent"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>

        <div
          ref={progressBarRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={currentProgress}
          aria-label="Progress"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className={`relative w-full h-4 rounded-full bg-slate-100 overflow-hidden cursor-pointer select-none group ${
            isDragging ? "scale-y-125" : ""
          } transition-transform focus-visible:ring-2 focus-visible:ring-indigo-200 outline-none`}
        >
          <div className="absolute inset-0 bg-slate-100" />

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${currentProgress}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressGradient} rounded-full`}
          />

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-white/10 to-transparent" />

          <motion.div
            animate={{ left: `${currentProgress}%` }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-md border-2 border-slate-200 ${
              isDragging ? "scale-110 border-indigo-400 shadow-lg" : "group-hover:scale-105"
            } transition-all`}
            style={{ left: `${currentProgress}%` }}
          />
        </div>

        <p className="text-[10px] text-slate-400 mt-1.5">
          Click and drag the bar or use arrow keys to adjust
        </p>
      </div>

      {warning && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 view-fade">
          <div className="flex items-start gap-2">
            <Icon name="warning" size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                This {entityType} is completed. Reducing progress will change status to InProgress.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => applyProgressReduction(warning.pendingProgress)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={cancelProgressReduction}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Status
          </label>
          <StatusDropdown
            currentStatus={selectedStatus}
            onChange={handleStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
