import { useState } from "react";
import { priorities } from "../../constants";

import type { Department } from "../../../types";
import { BUDGET_INPUT_LABEL, formatRupees, lakhsToRupees } from "../../../lib/formatters";

interface ProjectDetailsStepProps {
  name: string;
  description: string;
  priority: string;
  budget: number;
  startDate: string;
  endDate: string;
  onChange: (field: string, value: string | number) => void;
  primaryDepartmentId?: string;
  departments?: Department[];
  onPrimaryDepartmentChange?: (id: string) => void;
  primaryDepartmentLocked?: boolean;
}

export function ProjectDetailsStep({ name, description, priority, budget, startDate, endDate, onChange, primaryDepartmentId, departments, onPrimaryDepartmentChange, primaryDepartmentLocked = false }: ProjectDetailsStepProps) {
  // The budget is typed in lakhs. Holding the raw text locally keeps typing natural: with a
  // controlled value of 0 the browser edits "0" as a string, so typing 20 lands as "020".
  const [budgetLakhs, setBudgetLakhs] = useState(budget > 0 ? String(budget) : "");

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Enter project name"
          className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          required
        />
      </div>

        {departments && onPrimaryDepartmentChange && (
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Primary Department <span className="text-slate-300 font-normal">(creator)</span>
          </label>
          <select
            value={primaryDepartmentId ?? ""}
            onChange={(e) => onPrimaryDepartmentChange(e.target.value)}
            disabled={primaryDepartmentLocked}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">-- None --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Primary Department owns the project and keeps full visibility. Other departments only see milestones and tasks assigned to their department.
          </p>
          {primaryDepartmentLocked && <p className="text-[10px] text-indigo-500 mt-1">Your permission scope fixes the primary department to your department.</p>}
        </div>
      )}

      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Brief description of the project"
          rows={3}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={(e) => onChange("priority", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            {BUDGET_INPUT_LABEL}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
            <input
              type="number"
              value={budgetLakhs}
              onChange={(e) => {
                const text = e.target.value;
                setBudgetLakhs(text);
                onChange("budget", text === "" ? 0 : Number(text));
              }}
              placeholder="0"
              min={0}
              step={0.5}
              title="Enter the project budget in lakhs (1 lakh = ₹1,00,000)"
              className="w-full p-3 pl-7 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Enter amount in lakhs (1 lakh = ₹1,00,000)
            {budget > 0 && <> &middot; {formatRupees(lakhsToRupees(budget))}</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onChange("endDate", e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {startDate && endDate && endDate < startDate && (
            <p className="text-[10px] text-red-600 mt-1">End date must be on or after the start date</p>
          )}
        </div>
      </div>

    
    </div>
  );
}
