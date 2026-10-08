import type { ReactNode } from "react";
import { Icon } from "../../components/ui/Icon";

interface PageContainerProps {
  /** Optional top stats row (cards above the main content) */
  stats?: ReactNode;
  /** Optional filter bar */
  filters?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Optional right-aligned header actions if filters are not used */
  headerActions?: ReactNode;
  /** Class for the main content wrapper */
  contentClassName?: string;
}

/**
 * Standard page scaffold: stats row + filter bar + content.
 *
 * Keeps spacing consistent across all redesigned pages and matches the
 * AI page rhythm: tight gaps, white cards on the soft slate bg.
 *
 * Card-grid guidance: list/card grids inside `children` should use equal
 * width columns — `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
 * — and each card must be able to shrink (`min-w-0`) so long content can
 * never force a column wider than its track. Both wrappers below already
 * enforce `min-w-0` on their children/content.
 */
export function PageContainer({
  stats,
  filters,
  children,
  headerActions,
  contentClassName = "",
}: PageContainerProps) {
  return (
    <div className="relative">
      {stats && (
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 [&>*]:min-w-0">
          {stats}
        </div>
      )}

      {filters && (
        <div className="relative z-10 mb-4">{filters}</div>
      )}

      {!filters && headerActions && (
        <div className="relative z-10 mb-4 flex justify-end">{headerActions}</div>
      )}

      <div className={`relative z-10 min-w-0 ${contentClassName}`}>{children}</div>
    </div>
  );
}

interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noBodyPadding?: boolean;
}

/**
 * White card with optional title bar — used for grouping related
 * content within a page. Visually identical to the AI page cards
 * (white/90 backdrop-blur-xl border-slate-200/60 rounded-2xl shadow-sm).
 */
export function SectionCard({
  title,
  description,
  actions,
  icon,
  children,
  className = "",
  bodyClassName = "",
  noBodyPadding = false,
}: SectionCardProps) {
  return (
    <div
      className={`bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm transition-all duration-200 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start gap-2 px-5 py-3.5 border-b border-slate-100">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Icon name={icon} size={15} className="text-indigo-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-sm font-bold text-slate-800 leading-tight">{title}</h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={noBodyPadding ? bodyClassName : `px-5 py-4 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

interface PageHeaderActionProps {
  label: string;
  onClick: () => void;
  icon?: string;
  variant?: "primary" | "ghost" | "outline";
}

/** Quick action button used in page headers (New User, etc.) */
export function PageAction({ label, onClick, icon, variant = "primary" }: PageHeaderActionProps) {
  const variantCls =
    variant === "primary"
      ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-500/20"
      : variant === "outline"
      ? "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      : "bg-transparent text-slate-600 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold transition-all ${variantCls}`}
    >
      {icon && <Icon name={icon} size={16} />}
      {label}
    </button>
  );
}
