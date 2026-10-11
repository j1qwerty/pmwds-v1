export const departmentColorPalette = [
  { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500", ring: "ring-indigo-200", hover: "hover:bg-indigo-100" },
  { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500", ring: "ring-violet-200", hover: "hover:bg-violet-100" },
  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", dot: "bg-blue-500", ring: "ring-blue-200", hover: "hover:bg-blue-100" },
  { bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700", dot: "bg-cyan-500", ring: "ring-cyan-200", hover: "hover:bg-cyan-100" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200", hover: "hover:bg-emerald-100" },
  { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", dot: "bg-teal-500", ring: "ring-teal-200", hover: "hover:bg-teal-100" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500", ring: "ring-amber-200", hover: "hover:bg-amber-100" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-500", ring: "ring-rose-200", hover: "hover:bg-rose-100" },
];

export interface StatusColorEntry {
  bg: string;
  border: string;
  text: string;
  dot: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  shadow: string;
  shadowHoverColor: string;
}

export const statusColorPalette: Record<string, StatusColorEntry> = {
  Planning: {
    bg: "bg-cyan-100",
    border: "border-cyan-200",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
    headerBg: "bg-cyan-100",
    headerText: "text-cyan-600",
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-700",
    shadow: "shadow-sm hover:shadow-md",
    shadowHoverColor: "hover:shadow-cyan-500",
  },
  Active: {
    bg: "bg-blue-100",
    border: "border-blue-200",
    text: "text-blue-600",
    dot: "bg-blue-500",
    headerBg: "bg-blue-100",
    headerText: "text-blue-500",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-600",
    shadow: "shadow-sm hover:shadow-md",
    shadowHoverColor: "hover:shadow-blue-500",
  },
  Total: {
    bg: "bg-sky-100",
    border: "border-sky-200",
    text: "text-sky-700",
    dot: "bg-sky-500",
    headerBg: "bg-sky-100",
    headerText: "text-white",
    badgeBg: "bg-gray-700",
    badgeText: "text-white",
    shadow: "shadow-sm hover:shadow-md",
    shadowHoverColor: "hover:shadow-sky-500",
  },
  Pending: {
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-500",
    dot: "bg-slate-400",
    headerBg: "bg-slate-100",
    headerText: "text-slate-400",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-500",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-slate-500  ",
  },
  NotStarted: {
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-500",
    dot: "bg-slate-400",
    headerBg: "bg-slate-100",
    headerText: "text-slate-400",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-500",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-slate-500  ",
  },
  InProgress: {
    bg: "bg-blue-100",
    border: "border-blue-200",
    text: "text-blue-600",
    dot: "bg-blue-500",
    headerBg: "bg-blue-100",
    headerText: "text-blue-500",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-600",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-blue-500  ",
  },
  Completed: {
    bg: "bg-emerald-100",
    border: "border-emerald-200",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    headerBg: "bg-emerald-100",
    headerText: "text-emerald-500",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-600",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-emerald-500  ",
  },
  Delayed: {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
    headerBg: "bg-amber-100",
    headerText: "text-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-amber-500  ",
  },
  OnHold: {
    bg: "bg-purple-100",
    border: "border-purple-200",
    text: "text-purple-600",
    dot: "bg-purple-500",
    headerBg: "bg-purple-100",
    headerText: "text-purple-500",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-600",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-purple-500  ",
  },
  Cancelled: {
    bg: "bg-red-100",
    border: "border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
    headerBg: "bg-red-100",
    headerText: "text-red-600",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    shadow: "shadow-sm hover:shadow-md ",
    shadowHoverColor: "hover:shadow-red-500  ",
  },
};

export const priorityColorPalette = {
  Low: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-500",
    dot: "bg-gray-500"
  },
  Medium: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    dot: "bg-blue-500"
  },
  High: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-red-600",
    dot: "bg-red-500"
  },
  Critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    dot: "bg-red-500"
  },
};

export function getDepartmentColor(index: number) {
  return departmentColorPalette[index % departmentColorPalette.length];
}

export function getStatusColor(status: string): StatusColorEntry {
  return statusColorPalette[status as keyof typeof statusColorPalette] || statusColorPalette.NotStarted;
}

export function getPriorityColor(priority: string) {
  return priorityColorPalette[priority as keyof typeof priorityColorPalette] || priorityColorPalette.Medium;
}