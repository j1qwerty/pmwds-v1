/**
 * Icon and colour normalisation for AI-generated report metrics.
 *
 * The report model is produced by an LLM, so `icon` and `color` can contain
 * arbitrary strings. Material Symbols renders an unknown ligature as literal
 * text, which visually breaks the metric cards (e.g. an icon of
 * "revenue_growth" renders the word instead of a glyph). These helpers map
 * AI output onto a known-good allowlist with sensible keyword fallbacks.
 */

// Verified Material Symbols Outlined ligature names.
const KNOWN_ICONS = new Set<string>([
  "analytics",
  "insights",
  "monitoring",
  "dashboard",
  "bar_chart",
  "pie_chart",
  "donut_large",
  "ssid_chart",
  "table_chart",
  "show_chart",
  "leaderboard",
  "query_stats",
  "percent",
  "calculate",
  "payments",
  "account_balance",
  "savings",
  "currency_rupee",
  "currency_exchange",
  "receipt_long",
  "price_check",
  "wallet",
  "toll",
  "task_alt",
  "checklist",
  "check_circle",
  "assignment",
  "assignment_turned_in",
  "task",
  "pending_actions",
  "groups",
  "group",
  "person",
  "engineering",
  "construction",
  "handyman",
  "architecture",
  "build",
  "precision_manufacturing",
  "flag",
  "flag_circle",
  "emoji_events",
  "military_tech",
  "workspace_premium",
  "verified",
  "schedule",
  "timer",
  "event_busy",
  "hourglass_bottom",
  "speed",
  "warning",
  "error",
  "report",
  "description",
  "summarize",
  "article",
  "fact_check",
  "lightbulb",
  "auto_awesome",
  "search",
  "calendar_month",
  "date_range",
  "history",
  "trending_up",
  "trending_down",
  "trending_flat",
  "donut_small",
  "fitness_center",
  "health_and_safety",
  "support_agent",
  "campaign",
  "bolt",
  "rocket_launch",
  "local_shipping",
  "inventory_2",
  "warehouse",
  "handshake",
  "campaigns",
  "gavel",
  "balance",
  "hub",
  "database",
]);

const DEFAULT_ICON = "analytics";

/** Keyword fallbacks, ordered: the first match on the icon/label wins. */
const KEYWORD_ICONS: Array<[RegExp, string]> = [
  [/money|budget|cost|revenue|financial|payment|payout|spend|price|variance|currenc|fund/i, "payments"],
  [/task|todo|complete|done|checklist|assigned/i, "task_alt"],
  [/people|team|staff|user|headcount|workload|capacity|resource|employee/i, "groups"],
  [/delay|late|overdue|slip|risk|blocked|warning|escalat/i, "warning"],
  [/milestone|target|goal|objective|complete|award|win/i, "flag"],
  [/progress|percent|rate|ratio|growth|metric|score|stat|analytic|data|kpi/i, "analytics"],
  [/time|schedule|date|day|timeline|hour|duration/i, "schedule"],
  [/quality|verified|check|approved|valid/i, "verified"],
  [/risk|issue|problem|error|fail/i, "error"],
  [/plan|design|architecture|build|construct|engineer/i, "architecture"],
  [/summary|report|document|insight|note/i, "description"],
  [/team|resource|capacity/i, "groups"],
  [/inventory|material|stock|supply|store/i, "inventory_2"],
  [/idea|suggest|recommend|improve|opportunity/i, "lightbulb"],
];

export const METRIC_COLORS = [
  "indigo",
  "emerald",
  "amber",
  "red",
  "violet",
  "blue",
  "cyan",
  "orange",
] as const;

export type MetricColor = (typeof METRIC_COLORS)[number];

const DEFAULT_COLOR: MetricColor = "indigo";

/**
 * Resolve an AI-supplied icon to a renderable Material Symbols name.
 * Falls back to keywords derived from the icon and metric label, then to a
 * safe default, so a card never renders raw text in place of a glyph.
 */
export function resolveMetricIcon(icon: string | null | undefined, label?: string | null): string {
  const candidate = (icon ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (candidate && KNOWN_ICONS.has(candidate)) {
    return candidate;
  }

  const haystack = `${candidate} ${label ?? ""}`;
  for (const [pattern, mapped] of KEYWORD_ICONS) {
    if (pattern.test(haystack)) {
      return mapped;
    }
  }

  return DEFAULT_ICON;
}

/** Resolve an AI-supplied colour to an allowlisted Tailwind palette name. */
export function resolveMetricColor(color: string | null | undefined): MetricColor {
  const candidate = (color ?? "").trim().toLowerCase();
  return (METRIC_COLORS as readonly string[]).includes(candidate)
    ? (candidate as MetricColor)
    : DEFAULT_COLOR;
}

/** Resolve an AI-supplied trend, defaulting to neutral for unknown values. */
export function resolveMetricTrend(trend: string | null | undefined): "up" | "down" | "neutral" {
  const candidate = (trend ?? "").trim().toLowerCase();
  return candidate === "up" || candidate === "down" ? candidate : "neutral";
}
