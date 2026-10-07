import { useEffect, useRef, useState } from "react";

export type InfoTipProps = {
  /** Short label for the trigger. Defaults to "?" */
  label?: string;
  /** Card/topic this explains, shown bold at the top of the popup. */
  title: string;
  /** One or two plain-language sentences on what the number means. */
  summary: string;
  /** Optional "how it is worked out" bullets, phrased for a non-technical reader. */
  points?: string[];
  /** Optional caveat, e.g. when the figure is a fallback estimate. */
  note?: string;
  align?: "left" | "right";
  className?: string;
};

/**
 * The "?" affordance used across metric cards.
 *
 * Opens on hover (pointer devices) and on click/tap (touch, and keyboard via
 * Enter/Space). Escape and an outside click close it. Positioned absolutely
 * rather than in a portal so it inherits the card's stacking context.
 */
export function InfoTip({
  label = "?",
  title,
  summary,
  points,
  note,
  align = "right",
  className = "",
}: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`What is ${title}?`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        className={`grid place-items-center w-[18px] h-[18px] shrink-0 rounded-full border text-[10px] font-bold leading-none transition-colors cursor-help ${
          open
            ? "bg-indigo-600 border-indigo-600 text-white"
            : "bg-white/70 border-slate-300 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600"
        }`}
      >
        {label}
      </button>

      {open && (
        <div
          role="tooltip"
          className={`absolute top-[calc(100%+8px)] z-50 w-[280px] rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xl shadow-slate-900/10 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-[12px] font-bold text-slate-800 leading-snug">{title}</p>
          <p className="text-[11px] text-slate-600 leading-relaxed mt-1.5">{summary}</p>

          {points && points.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {points.map((point) => (
                <li key={point} className="flex gap-1.5 text-[11px] text-slate-600 leading-relaxed">
                  <span className="text-indigo-500 shrink-0 mt-[1px]">
                    <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}

          {note && (
            <p className="mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed italic">
              {note}
            </p>
          )}
        </div>
      )}
    </span>
  );
}

type InfoTipCardProps = {
  title: string;
  icon?: React.ReactNode;
  summary: string;
  points?: string[];
  note?: string;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * A standalone explainer card for a whole section rather than a single
 * number - used where several cards share one explanation.
 */
export function InfoTipCard({
  title,
  icon,
  summary,
  points,
  note,
  actions,
  className = "",
}: InfoTipCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`How ${title} is calculated`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-help ${
          open
            ? "bg-indigo-600 border-indigo-600 text-white"
            : "bg-white/70 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600"
        }`}
      >
        {icon}
        How this works
        <span className="material-symbols-outlined text-[13px]">
          {open ? "expand_less" : "help_outline"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl shadow-slate-900/10">
          <p className="text-[13px] font-bold text-slate-800">{title}</p>
          <p className="text-[11.5px] text-slate-600 leading-relaxed mt-1.5">{summary}</p>

          {points && points.length > 0 && (
            <ul className="mt-3 space-y-2">
              {points.map((point) => (
                <li key={point} className="flex gap-2 text-[11.5px] text-slate-600 leading-relaxed">
                  <span className="mt-[2px] w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}

          {note && (
            <p className="mt-3 pt-3 border-t border-slate-100 text-[10.5px] text-slate-500 leading-relaxed italic">
              {note}
            </p>
          )}

          {actions && <div className="mt-3 pt-3 border-t border-slate-100">{actions}</div>}
        </div>
      )}
    </div>
  );
}
