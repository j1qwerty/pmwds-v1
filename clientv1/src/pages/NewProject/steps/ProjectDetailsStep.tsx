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
  projectDocumentFile?: File | null;
  onProjectDocumentChange?: (file: File | null) => void;
  canUploadProjectDocument?: boolean;
}

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

const LABEL_CLASS =
  "text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5";

export function ProjectDetailsStep({ name, description, priority, budget, startDate, endDate, onChange, primaryDepartmentId, departments, onPrimaryDepartmentChange, primaryDepartmentLocked = false, projectDocumentFile = null, onProjectDocumentChange, canUploadProjectDocument = false }: ProjectDetailsStepProps) {
  // The budget is typed in lakhs. Holding the raw text locally keeps typing natural: with a
  // controlled value of 0 the browser edits "0" as a string, so typing 20 lands as "020".
  const [budgetLakhs, setBudgetLakhs] = useState(budget > 0 ? String(budget) : "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>
            Project name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Enter project name"
            className={INPUT_CLASS}
            required
          />
        </div>

        {departments && onPrimaryDepartmentChange && (
          <div>
            <label className={LABEL_CLASS}>
              Primary department <span className="normal-case font-medium text-slate-300">(creator)</span>
            </label>
            <select
              value={primaryDepartmentId ?? ""}
              onChange={(e) => onPrimaryDepartmentChange(e.target.value)}
              disabled={primaryDepartmentLocked}
              className={INPUT_CLASS}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              The primary department owns the project and keeps full visibility. Other departments only see milestones and tasks assigned to their department.
            </p>
            {primaryDepartmentLocked && <p className="text-[11px] text-indigo-500 mt-1">Your permission scope fixes the primary department to your department.</p>}
          </div>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS}>Description</label>
        <textarea
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Brief description of the project"
          rows={3}
          className={`${INPUT_CLASS} min-h-[64px] py-2 resize-y`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Priority</label>
          <select
            value={priority}
            onChange={(e) => onChange("priority", e.target.value)}
            className={INPUT_CLASS}
          >
            {priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>{BUDGET_INPUT_LABEL}</label>
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
              className={`${INPUT_CLASS} pl-7`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Enter amount in lakhs (1 lakh = ₹1,00,000)
            {budget > 0 && <> &middot; {formatRupees(lakhsToRupees(budget))}</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>
            Start date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>
            End date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onChange("endDate", e.target.value)}
            className={INPUT_CLASS}
          />
          {startDate && endDate && endDate < startDate && (
            <p className="text-xs text-red-600 mt-1">End date must be on or after the start date</p>
          )}
        </div>
      </div>

      {canUploadProjectDocument && onProjectDocumentChange && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <label className={LABEL_CLASS}>
            Project document <span className="normal-case font-medium text-slate-300">(optional)</span>
          </label>
          <input
            type="file"
            onChange={(event) => onProjectDocumentChange(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-600"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            This file is uploaded at project level. Milestone and task documents can be added after the project is created.
          </p>
          {projectDocumentFile && (
            <p className="text-[11px] font-semibold text-indigo-600 mt-1.5 truncate">
              Selected: {projectDocumentFile.name}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
