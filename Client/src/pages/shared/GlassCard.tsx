import type { HTMLAttributes } from "react";

export function GlassCard({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}