import { Icon } from "./components/ui/Icon";
import type { Project, User } from "./types";
import { roleDisplayNames } from "./permissions";

// ============================================================
// Grid & Panel Layout Classes
// ============================================================

export const pageGridClass = "grid gap-lg content-start";

export const panelClass = "glass-card rounded-2xl overflow-hidden bg-surface-container-lowest border-transparent border border-outline-variant shadow-sm transition-all duration-300 hover:shadow-md";

export const panelHeadClass = "flex items-start justify-between border-b border-outline-variant pb-lg mb-lg";

export const panelBodyClass = "p-0";

export const listColumnClass = "flex max-h-[420px] flex-col gap-sm overflow-y-auto pr-xs sidebar-scrollbar";

export const listCardClass = "rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-md text-left transition-all duration-200 hover:border-primary hover:bg-surface-container-low hover:shadow-sm";

export const selectedCardClass = "border-primary bg-primary-fixed/30 shadow-sm";

export const detailCardClass = "rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-md";

// ============================================================
// Button Classes
// ============================================================

export const primaryButtonClass = "gradient-btn rounded-lg px-lg py-sm text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg focus-ring disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButtonClass = "rounded-lg border border-outline-variant bg-surface-container-lowest px-lg py-sm text-sm font-medium text-on-surface-variant transition-all duration-200 hover:bg-surface-container-high hover:text-on-surface hover:border-outline focus-ring disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass = "rounded-lg border border-error/30 bg-error-container px-lg py-sm text-sm font-medium text-on-error-container transition-all duration-200 hover:bg-error-container/80 focus-ring";

// ============================================================
// Form Input Classes
// ============================================================

export const inputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm text-sm text-on-surface outline-none transition-all duration-200 placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10 focus-ring";

export const labelClass = "flex flex-col gap-xs text-label-caps text-on-surface-variant";

// ============================================================
// Utility Functions
// ============================================================

export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const RUPEE_SYMBOL = "\u20B9";

/** 1 lakh = 100,000 rupees. 1 crore = 100 lakhs. */
export const RUPEES_PER_LAKH = 100000;

/** Budgets at or above this many lakhs read better in crores. */
const LAKHS_PER_CRORE = 100;
const CRORE_THRESHOLD_IN_LAKHS = 10000;

function toSafeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function trimNumber(value: number, maxFractionDigits = 2) {
  return value
    .toLocaleString("en-IN", { maximumFractionDigits: maxFractionDigits })
    .replace(/\.0+$/, "");
}

/**
 * Formats a raw rupee amount (e.g. fund claims, certificate amounts) as
 * Indian rupees, e.g. 1250000 -> "₹12,50,000".
 */
export function formatRupees(value: number) {
  return `${RUPEE_SYMBOL}${Math.round(toSafeNumber(value)).toLocaleString("en-IN")}`;
}

/**
 * Formats a budget amount for display. The amount arrives as RAW RUPEES - that
 * is what the database stores - and is converted to lakhs so the figures stay
 * readable: 2,23,50,000 -> "₹223 L", 1,85,00,00,000 -> "₹18,500 L".
 * Amounts of 10,000 lakhs (1 crore) and above switch to crores.
 */
export function formatLakhs(valueInRupees: number) {
  const rupees = toSafeNumber(valueInRupees);

  if (Math.abs(rupees) < RUPEES_PER_LAKH) return formatRupees(rupees);

  const sign = rupees < 0 ? "-" : "";
  const absLakhs = Math.abs(rupees) / RUPEES_PER_LAKH;

  if (absLakhs >= CRORE_THRESHOLD_IN_LAKHS) {
    return `${sign}${RUPEE_SYMBOL}${trimNumber(absLakhs / LAKHS_PER_CRORE)} Cr`;
  }
  return `${sign}${RUPEE_SYMBOL}${trimNumber(absLakhs)} L`;
}

/**
 * Converts lakhs as typed into a budget field back to the rupees the API stores.
 */
export function lakhsToRupees(lakhs: number) {
  return toSafeNumber(lakhs) * RUPEES_PER_LAKH;
}

/**
 * Converts a stored rupee budget into lakhs for a budget input field.
 */
export function rupeesToLakhs(rupees: number) {
  return toSafeNumber(rupees) / RUPEES_PER_LAKH;
}

/**
 * Formats a project budget (stored in rupees) for display.
 */
export function formatMoney(value: number) {
  return formatLakhs(value);
}

/** Label used next to budget inputs so the unit is explicit. */
export const BUDGET_INPUT_LABEL = "Budget (₹ in Lakhs)";

export function formatPercent(value: number) {
  return `${Math.round(value ?? 0)}%`;
}

export function classNames(...values: Array<string | false | undefined | null>) {
  return values.filter(Boolean).join(" ");
}

// ============================================================
// Panel Component
// ============================================================

export function Panel({
  title,
  subtitle,
  children,
  style,
  className,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <section
      className={classNames(
        "glass-card rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant shadow-sm",
        className
      )}
      style={style}
    >
      <div className="px-lg py-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
        <div>
          <h2 className="text-h2 text-on-surface">{title}</h2>
          <p className="mt-xs text-body-md text-on-surface-variant">{subtitle}</p>
        </div>
      </div>
      <div className="p-lg">{children}</div>
    </section>
  );
}

// ============================================================
// StatCard Component
// ============================================================

export function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  const toneClass: Record<string, string> = {
    teal: "text-success",
    rust: "text-error",
    gold: "text-warning",
    ink: "text-on-surface",
  };

  const iconMap: Record<string, string> = {
    teal: "layers",
    rust: "checklist",
    gold: "group",
    ink: "schedule",
  };

  return (
    <article className="glass-card glass-card-hover rounded-2xl p-lg flex flex-col gap-md transition-all duration-300 group border border-outline-variant hover:border-primary">
      <div className="flex justify-between items-start">
        <span className="text-label-caps text-on-surface-variant">{label}</span>
        <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center group-hover:bg-primary-fixed transition-colors">
          <Icon name={iconMap[tone] || "analytics"} size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
        </div>
      </div>
      <strong className={classNames("text-display text-on-surface", toneClass[tone] ?? "text-on-surface")}>
        {value}
      </strong>
      <small className="text-body-md text-on-surface-variant">{detail}</small>
    </article>
  );
}

// ============================================================
// MetricRow Component
// ============================================================

export function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant py-md last:border-0">
      <span className="text-body-md text-on-surface-variant">{label}</span>
      <strong className="text-body-md font-semibold text-on-surface">{value}</strong>
    </div>
  );
}

// ============================================================
// MetricTile Component
// ============================================================

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-md text-center">
      <span className="block text-label-caps text-on-surface-variant">{label}</span>
      <strong className="mt-sm block text-h2 text-on-surface">{value}</strong>
    </div>
  );
}

// ============================================================
// EmptyState Component
// ============================================================

export function EmptyState({
  title,
  description,
  compact,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={classNames(
        "rounded-lg border border-dashed border-outline-variant bg-surface-container-low text-center",
        compact ? "p-md" : "p-lg"
      )}
    >
      <strong className="block text-body-md font-semibold text-on-surface">{title}</strong>
      <span className="mt-xs block text-body-md text-on-surface-variant">{description}</span>
    </div>
  );
}

// ============================================================
// LoadingPanel Component
// ============================================================

export function LoadingPanel({ label }: { label: string }) {
  return (
    <section className={panelClass}>
      <div className="p-lg">
        <EmptyState title={label} description="Loading the latest workspace data." />
      </div>
    </section>
  );
}

// ============================================================
// ErrorPanel Component
// ============================================================

export function ErrorPanel({ message }: { message: string }) {
  return (
    <section className={panelClass}>
      <div className="p-lg">
        <EmptyState title="Something failed" description={message} />
      </div>
    </section>
  );
}

// ============================================================
// Notice Component
// ============================================================

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-12 rounded-lg border border-primary/30 bg-primary-fixed/20 px-lg py-md text-body-md text-on-primary-fixed">
      {children}
    </div>
  );
}

// ============================================================
// SimpleProjectCards Component
// ============================================================

export function SimpleProjectCards({
  projects,
  selectedId,
  onPick,
}: {
  projects: Project[];
  selectedId: string;
  onPick: (projectId: string) => void;
}) {
  return (
    <div className={listColumnClass}>
      {projects.map((project) => (
        <button
          key={project.id}
          className={classNames(
            listCardClass,
            selectedId === project.id && selectedCardClass
          )}
          onClick={() => onPick(project.id)}
        >
          <strong className="block text-body-md font-semibold text-on-surface">
            {project.name}
          </strong>
          <span className="mt-xs block text-label-caps text-primary">
            {project.status} / {formatPercent(project.progressPercentage)}
          </span>
          <small className="mt-xs block text-body-md text-on-surface-variant">
            {project.totalTasks} tasks / {project.overdueTasks} overdue
          </small>
        </button>
      ))}
    </div>
  );
}

// ============================================================
// UserTable Component
// ============================================================

export function UserTable({ users }: { users: User[] }) {
  return (
    <div className="overflow-x-auto sidebar-scrollbar">
      <table className="w-full border-collapse text-body-md">
        <thead>
          <tr className="border-b border-outline-variant text-left text-label-caps text-on-surface-variant">
            <th className="px-md py-md">Name</th>
            <th className="px-md py-md">Role</th>
            <th className="px-md py-md">Department</th>
            <th className="px-md py-md">Availability</th>
            <th className="px-md py-md">Workload</th>
            <th className="px-md py-md">Burnout</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              className="border-b border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
              key={user.id}
            >
              <td className="px-md py-md">
                <strong className="block text-on-surface">
                  {user.fullName}
                </strong>
                <div className="text-body-md text-on-surface-variant">
                  {user.email}
                </div>
              </td>
              <td className="px-md py-md">
                {roleDisplayNames(user.roles).join(", ") || user.jobTitle}
              </td>
              <td className="px-md py-md">
                {user.department || "Unassigned"}
              </td>
              <td className="px-md py-md">{user.availabilityStatus}</td>
              <td className="px-md py-md">
                {formatPercent(user.aiWorkloadScore)}
              </td>
              <td className="px-md py-md">
                {formatPercent(user.aiBurnoutRiskScore * 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

