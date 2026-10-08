import { useNavHeader, type NavHeaderAction } from "./NavHeaderContext";

export function NavHeader() {
  const { title } = useNavHeader();

  return (
    <div className="flex items-center" style={{ gap: 'clamp(8px, 1.5vw, 16px)' }}>
      <span className="font-semibold text-blue-700 uppercase tracking-wider whitespace-nowrap" style={{ fontSize: 'clamp(9px, 1.2vw, 12px)' }}>
        {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
      </span>
      <div className="w-px bg-surface-variant" style={{ height: 'clamp(14px, 2vw, 20px)' }} />
      <div className="font-bold tracking-[-0.03em] text-primary leading-tight" style={{ fontSize: 'clamp(14px, 2.5vw, 24px)' }}>
        {title}
      </div>
    </div>
  );
}

function ActionButton({ action }: { action: NavHeaderAction }) {
  return (
    <button
      onClick={action.onClick}
      className="shadow-sm group rounded-xl bg-white border border-slate-200/60 text-gray-700 hover:border-blue-300 hover:shadow-md hover:text-blue-600 transition-all duration-200 font-medium flex items-center whitespace-nowrap"
      style={{
        padding: 'clamp(6px, 1vw, 16px) clamp(8px, 1.2vw, 16px)',
        fontSize: 'clamp(10px, 1.2vw, 13px)',
        gap: 'clamp(4px, 0.8vw, 6px)',
        height: 'clamp(32px, 4.5vw, 44px)',
        minHeight: 'clamp(32px, 4.5vw, 44px)',
      }}
    >
      {action.icon && (
        <span className="material-symbols-outlined group-hover:rotate-12 transition-transform" style={{ fontSize: 'clamp(14px, 2vw, 20px)' }}>
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
