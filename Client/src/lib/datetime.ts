/**
 * Date and time handling for the whole app.
 *
 * The single rule this module enforces:
 *
 *   The database stores UTC. Everything the user reads is rendered in IST.
 *
 * Nothing here converts stored values. Reinterpreting stored timestamps as local time is
 * what makes an app show the wrong day once the machine timezone changes, so instead every
 * read is pinned to {@link APP_TIME_ZONE} and every "which day is it" question is asked in
 * IST. IST is UTC+05:30 with no daylight saving, so day boundaries are a fixed offset.
 *
 * Two kinds of values flow through the API, and they must not be formatted the same way:
 *
 *  1. **Instants** - `createdDate`, `modifiedDate`, `completedDate`, activity timestamps.
 *     These are points in time. Format the clock time in IST.
 *
 *  2. **Calendar dates** - task `startDate`/`dueDate`, milestone `dueDate`, project
 *     `plannedStartDate`/`plannedEndDate`. These are days, not instants, but they are
 *     stored as `DateTime` (at UTC midnight). Formatting them through `Date` shifts them a
 *     day backwards for anyone east of UTC - a task due "1 Jul" showing as "30 Jun" is the
 *     classic symptom. Use {@link formatDate} for these: it reads the stored calendar day
 *     directly and never applies an offset.
 */

/** The timezone every user-visible timestamp is rendered in. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** IST is UTC+05:30 year round - India observes no daylight saving. */
export const APP_UTC_OFFSET_MINUTES = 330;

/** Appended to rendered timestamps so nobody has to guess which zone they are reading. */
export const APP_TIME_ZONE_LABEL = "IST";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * A calendar day in the API's `DateTime` shape, split into its parts.
 * Returns null when the value is absent or unparseable.
 */
export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseCalendarDate(value?: string | null): DateParts | null {
  if (!value) return null;
  const match = DATE_KEY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

/**
 * Parses an API timestamp into a real instant.
 *
 * A value with no offset is UTC, because that is what the API emits for `Kind.Unified`
 * reads of `datetime2` columns (EF Core drops the `Kind` on read). Letting the browser
 * guess - which `new Date("2026-07-01T10:00:00")` does, treating it as *local* - makes the
 * displayed time depend on where the browser happens to be.
 */
export function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasZone ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `yyyy-mm-dd` for a value that represents a calendar day (never offset-shifted). */
export function toDateKey(value?: string | null): string | null {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Today in IST, as `yyyy-mm-dd`. */
export function todayKey(now: Date = new Date()): string {
  const ist = toIst(now);
  return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
}

/** Shifts a `Date`'s wall-clock reading into IST, so plain local getters give IST fields. */
function toIst(date: Date): Date {
  const shifted = new Date(date.getTime() + APP_UTC_OFFSET_MINUTES * 60_000);
  // Re-tag as "local" so getFullYear/getMonth/getDate read the IST wall clock.
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  );
}

/** The UTC instant at which the given IST calendar day begins. */
export function startOfIstDay(key: string | Date): Date {
  const k = typeof key === "string" ? key : todayKey(key);
  const [year, month, day] = k.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - APP_UTC_OFFSET_MINUTES * 60_000);
}

/** The UTC instant at which the given IST calendar day ends (exclusive). */
export function endOfIstDay(key: string | Date): Date {
  const start = startOfIstDay(key);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Shifts a `yyyy-mm-dd` key by whole days, staying in calendar space. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Whole days since the epoch for a calendar value, or null.
 *
 * Used to place items on a date range timeline. Comparing calendar days to calendar days
 * keeps a milestone due on the last day of a project inside the bar, where comparing
 * instants could push it outside by the UTC/IST offset.
 */
export function toCalendarDayNumber(value?: string | Date | null): number | null {
  const day = calendarDayOf(value);
  if (!day) return null;
  return Date.UTC(day.year, day.month - 1, day.day) / 86_400_000;
}

/** Today in IST, as a day number. Pairs with {@link toCalendarDayNumber}. */
export function todayCalendarDayNumber(now: Date = new Date()): number {
  return toCalendarDayNumber(todayKey(now))!;
}

/** Weekday short name for a calendar key, e.g. "Wed". */
export function weekdayShort(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

/** Short month name for a calendar key, e.g. "Jul". */
export function monthShort(key: string): string {
  const parts = parseCalendarDate(key);
  return parts ? MONTH_SHORT[parts.month - 1] : "";
}

/**
 * True when a calendar-date value (a due date) is before today in IST.
 *
 * Due dates carry no time of day, so they are only overdue once the *day* has passed. This
 * replaces `new Date(dueDate) < Date.now()`, which treated a task due today as overdue from
 * 00:00 UTC - 05:30 IST - and made freshly due work flash red.
 */
export function isCalendarDatePast(value?: string | null, now: Date = new Date()): boolean {
  const key = toDateKey(value);
  if (!key) return false;
  return key < todayKey(now);
}

/** True when an instant falls on today's calendar day in IST. */
export function isToday(value?: string | Date | null, now: Date = new Date()): boolean {
  const instant =
    value instanceof Date
      ? Number.isNaN(value.getTime()) ? null : value
      : parseInstant(value);
  if (!instant) return false;
  return todayKey(instant) === todayKey(now);
}

/** True when two instants fall on the same IST calendar day. */
export function isSameIstDay(a?: string | Date | null, b: string | Date = new Date()): boolean {
  const left = typeof a === "string" ? parseInstant(a) : a;
  const right = typeof b === "string" ? parseInstant(b) : b;
  if (!left || !right) return false;
  return todayKey(left) === todayKey(right);
}

/**
 * Formats a value as a calendar day, "1 Jul 2026".
 *
 * Two cases, chosen from the shape of the value rather than guessed:
 *
 *  - **Date-only** (`2026-07-01`, or a time of exactly midnight): a calendar day. The
 *    stored day is returned verbatim. This is what keeps a task due 1 Jul from rendering
 *    as 30 Jun - the old `new Date(value).toLocaleDateString()` shifted it back a day for
 *    every user east of UTC.
 *  - **Anything with a real time of day**: an instant. Converted to IST and read there, so
 *    `lastLoginDate` shows the day the user actually logged in, not the UTC one.
 */
export function formatDate(value?: string | Date | null, fallback = "Not set"): string {
  const day = calendarDayOf(value);
  if (!day) return fallback;
  return `${day.day} ${MONTH_SHORT[day.month - 1]} ${day.year}`;
}

/** Calendar day as "1 Jul" - used where the year is implied or crowded out. */
export function formatDateShort(value?: string | Date | null, fallback = "-"): string {
  const day = calendarDayOf(value);
  if (!day) return fallback;
  return `${day.day} ${MONTH_SHORT[day.month - 1]}`;
}

/**
 * The IST calendar day a value falls on, or null when it is not a date at all.
 *
 * Date-only values are their own day; anything with a time of day is an instant and is
 * converted into IST before the day is read.
 */
function calendarDayOf(value?: string | Date | null): DateParts | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const ist = toIst(value);
    return { year: ist.getFullYear(), month: ist.getMonth() + 1, day: ist.getDate() };
  }

  const raw = value.trim();
  const asCalendarDay = parseCalendarDate(raw);
  if (!asCalendarDay) return null;

  // A date, or a DateTime sitting exactly on midnight, carries no time of day to convert.
  const match = DATE_KEY_PATTERN.exec(raw)!;
  const timePart = raw.slice(match[0].length).trim();
  if (!timePart || /^T?0{1,2}:?0{2}(:0{2}(\.0+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(timePart)) {
    return asCalendarDay;
  }

  const instant = parseInstant(raw);
  if (!instant) return asCalendarDay;
  const ist = toIst(instant);
  return { year: ist.getFullYear(), month: ist.getMonth() + 1, day: ist.getDate() };
}

/** Formats an **instant** as "1 Jul 2026, 3:45 pm IST". */
export function formatDateTime(value?: string | Date | null, fallback = "-"): string {
  const instant = toDate(value);
  if (!instant) return fallback;
  return `${formatDateTimeShort(instant)}, ${APP_TIME_ZONE_LABEL}`;
}

/** Formats an **instant** as "1 Jul 2026, 3:45 pm" - appends the zone only when asked. */
export function formatDateTimeShort(value?: string | Date | null, fallback = "-"): string {
  const instant = toDate(value);
  if (!instant) return fallback;
  const ist = toIst(instant);
  const day = calendarDayOf(instant)!;
  return `${day.day} ${MONTH_SHORT[day.month - 1]} ${day.year}, ${formatClockTime(ist)}`;
}

/** Formats an **instant** as "3:45 pm" in IST. */
export function formatTime(value?: string | Date | null, fallback = "-"): string {
  const instant = toDate(value);
  if (!instant) return fallback;
  const ist = toIst(instant);
  return formatClockTime(ist);
}

/** `3:45 pm` from a Date already shifted into IST. */
function formatClockTime(ist: Date): string {
  const hours = ist.getHours();
  const meridiem = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${pad(ist.getMinutes())} ${meridiem}`;
}

/** Full IST stamp: "Wed, 1 Jul 2026, 3:45 pm IST". */
export function formatDateTimeLong(value?: string | Date | null, fallback = "-"): string {
  const instant = toDate(value);
  if (!instant) return fallback;
  const key = todayKey(instant);
  return `${weekdayShort(key)}, ${formatDate(key)}, ${formatTime(instant)} ${APP_TIME_ZONE_LABEL}`;
}

/** Month and year for a calendar key, e.g. "Jul 2026". */
export function formatMonthYear(value?: string | Date | null, fallback = "-"): string {
  const key = typeof value === "string" ? toDateKey(value) : value ? todayKey(value) : null;
  if (!key) return fallback;
  const [, month, year] = key.split("-");
  return `${MONTH_SHORT[Number(month) - 1]} ${year}`;
}

/** "1 Jul", or "1 Jul 26" when it is not the current IST year. */
export function formatDateCompact(value?: string | Date | null, fallback = "-") {
  const day = calendarDayOf(value);
  if (!day) return fallback;
  const short = `${day.day} ${MONTH_SHORT[day.month - 1]}`;
  const currentYear = new Date().getUTCFullYear();
  return day.year === currentYear ? short : `${short} ${String(day.year).slice(-2)}`;
}

/** "1 July 2026". */
export function formatDateLong(value?: string | Date | null, fallback = "Not set") {
  const day = calendarDayOf(value);
  if (!day) return fallback;
  return `${day.day} ${MONTH_LONG[day.month - 1]} ${day.year}`;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  return parseInstant(value);
}

/**
 * Human-friendly age of an instant, e.g. "Just now", "12 minutes ago", "3 days ago".
 * After a week it stops guessing and shows the IST date.
 */
export function formatRelativeTime(value?: string | Date | null, now: Date = new Date()): string {
  const instant = toDate(value);
  if (!instant) return "";

  const diffMs = now.getTime() - instant.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDateShort(todayKey(instant));
}

/** Full notification-style stamp: relative for today, IST date and time otherwise. */
export function formatTimestamp(value?: string | Date | null, now: Date = new Date()): string {
  if (!value) return "";
  if (isToday(value, now)) return `Today, ${formatTime(value)}`;
  return formatDateTime(value);
}

/**
 * Value for an `<input type="date">`, from an API date.
 * The stored calendar day is used verbatim - no offset, so nothing slips by a day.
 */
export function toDateInputValue(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return todayKey(value);
  const parts = parseCalendarDate(value);
  if (parts) return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const instant = parseInstant(value);
  return instant ? todayKey(instant) : "";
}

/**
 * Turns an `<input type="date">` value into the ISO instant the API expects for midnight
 * **IST** on that day, not UTC midnight.
 *
 * `2026-07-01` therefore becomes `2026-06-30T18:30:00Z`, which reads back as "1 Jul" in IST
 * no matter where the browser or server is. Sending bare UTC midnight instead is what made
 * a task created for 1 Jul come back labelled 30 Jun.
 */
export function dateInputToIso(value: string): string {
  const key = value.trim();
  if (!key) return "";
  if (!DATE_KEY_PATTERN.test(key)) return key;
  return startOfIstDay(key).toISOString();
}

/** `yyyy-mm-dd` for today in IST - the default value for a new task/milestone date. */
export function todayInputValue(now: Date = new Date()): string {
  return todayKey(now);
}

/** `yyyy-mm-dd` `days` from today in IST. */
export function inputValueFromToday(days = 0, now: Date = new Date()): string {
  return addDays(todayKey(now), days);
}