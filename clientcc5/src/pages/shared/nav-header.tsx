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
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
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
          <span className="text-xs text-slate-400 whitespace-nowrap hidden lg:inline tabular-nums">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <div className="w-px bg-surface-variant hidden lg:block" style={{ height: 'clamp(14px, 2vw, 20px)' }} />
        </>
      )}
      {/* Topbar shows the page name only — descriptions are never rendered here. */}
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-slate-900 truncate">
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
      className="group rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:translate-y-px transition-colors text-[13px] font-medium flex items-center whitespace-nowrap"
      style={{
        padding: '0 14px',
        gap: '6px',
        height: '36px',
      }}
    >
      {action.icon && (
        <span className="material-symbols-outlined text-base ">
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
