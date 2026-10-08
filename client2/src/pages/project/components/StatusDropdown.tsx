// components/shared/StatusDropdown.tsx
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiCheck } from "react-icons/fi";

interface StatusDropdownProps {
  currentStatus: string;
  onChange: (status: string) => void;
}

const statuses = [
  { value: "NotStarted", label: "Not Started", color: "bg-slate-400" },
  { value: "InProgress", label: "In Progress", color: "bg-blue-500" },
  { value: "Completed", label: "Completed", color: "bg-emerald-500" },
  { value: "OnHold", label: "On Hold", color: "bg-amber-500" },
  { value: "Cancelled", label: "Cancelled", color: "bg-red-500" },
];

export function StatusDropdown({ currentStatus, onChange }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = statuses.find(s => s.value === currentStatus) || statuses[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-300 transition-colors min-w-[140px] justify-between"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${current.color}`} />
          <span>{current.label}</span>
        </div>
        <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden"
          >
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => {
                  onChange(status.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${
                  status.value === currentStatus
                    ? "text-indigo-600 bg-indigo-50/50"
                    : "text-slate-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${status.color}`} />
                {status.label}
                {status.value === currentStatus && (
                  <FiCheck className="w-4 h-4 ml-auto text-indigo-600" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}