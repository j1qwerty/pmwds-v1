import { useState } from "react";
import { Icon } from "../../components/ui/Icon";

interface AIInfoHintProps {
  title: string;
  children: string;
  align?: "left" | "right";
}

export function AIInfoHint({ title, children, align = "right" }: AIInfoHintProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-6 h-6 rounded-full border border-slate-200 bg-white text-slate-400 text-[11px] font-bold flex items-center justify-center hover:text-indigo-600 hover:border-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        aria-label={"How " + title + " is calculated"}
        aria-expanded={open}
      >
        ?
      </button>
      {open && (
        <div
          className={`absolute top-8 z-50 w-72 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl ${align === "right" ? "right-0" : "left-0"}`}
          role="tooltip"
        >
          <div className="flex items-start gap-2">
            <Icon name="info" size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700">{title}</p>
              <p className="text-[11px] leading-relaxed text-slate-500 mt-1">{children}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
