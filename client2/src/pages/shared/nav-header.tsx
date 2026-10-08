import { useNavigate } from "react-router-dom";
import { useNavHeader, type NavHeaderAction } from "./NavHeaderContext";
import { Icon } from "../../components/ui/Icon";

/**
 * Colored back button for the topbar (icon "arrow-back" + optional
 * short label). Rendered only when a page provides `backTo` via setNavHeader;
 * it takes the date chip's place so the topbar never gets crowded.
 */
function NavBackButton({ to, label }: { to: string; label?: string }) {
  const navigate = useNavigate();
  const title = label || "Back";
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      aria-label={title}
      title={title}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-indigo-700 transition-colors hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
    >
      <Icon name="arrow-back" size={16} />
      {label && <span className="whitespace-nowrap text-xs font-semibold">{label}</span>}
    </button>
  );
}

export function NavHeader() {
  const { title, backTo, backLabel } = useNavHeader();

  return (
    <div className="flex items-center min-w-0" style={{ gap: 'clamp(8px, 1.5vw, 16px)' }}>
      {/* Back slot replaces the date chip + divider only when backTo is set;
          every other page keeps the date exactly as before. */}
      {backTo ? (
        <NavBackButton to={backTo} label={backLabel} />
      ) : (
        <>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap hidden lg:inline">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <div className="w-px bg-surface-variant hidden lg:block" style={{ height: 'clamp(14px, 2vw, 20px)' }} />
        </>
      )}
      {/* Topbar shows the page name only — descriptions are never rendered here. */}
      <div className="min-w-0 leading-tight">
        <div className="text-base font-bold text-slate-800 truncate">
          {title}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ action }: { action: NavHeaderAction }) {
  return (
    <button
      onClick={action.onClick}
      className="shadow-sm group rounded-xl bg-white border border-slate-200/60 text-slate-700 hover:border-indigo-300 hover:shadow-md hover:text-indigo-600 transition-all duration-200 text-xs font-semibold flex items-center whitespace-nowrap"
      style={{
        padding: 'clamp(6px, 1vw, 16px) clamp(8px, 1.2vw, 16px)',
        gap: 'clamp(4px, 0.8vw, 6px)',
        height: 'clamp(32px, 4.5vw, 44px)',
        minHeight: 'clamp(32px, 4.5vw, 44px)',
      }}
    >
      {action.icon && (
        <span className="material-symbols-outlined text-base group-hover:rotate-12 transition-transform">
          {action.icon}
        </span>
      )}
      {action.label}
    </button>
  );
}

export function NavActionButton() {
  const { action, actions } = useNavHeader();

  const allActions = actions ?? (action ? [action] : []);

  if (allActions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {allActions.map((a, i) => (
        <ActionButton key={i} action={a} />
      ))}
    </div>
  );
}
