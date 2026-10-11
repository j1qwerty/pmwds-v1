/**
 * Display formatting helpers.
 *
 * This module deliberately contains no components. The old `ui.tsx` mixed Tailwind class
 * constants and a dozen unused panels/tables with these functions; the class constants and
 * components are gone, so nothing imports this as JSX any more.
 */

export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const RUPEE_SYMBOL = "\u20B9";

/** 1 lakh = 100,000 rupees. 1 crore = 100 lakhs. */
const RUPEES_PER_LAKH = 100000;

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
