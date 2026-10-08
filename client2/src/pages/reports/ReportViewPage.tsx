import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AiReportResponse, StoredReportRecord } from "../../types";
import { useAuth } from "../../auth";
import { api } from "../../api";
import {
  AnimatedBackground,
  GlassCard,
  SectionCard,
  useToast,
  useNavHeader,
  LoadingPage,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { GeneratedReports } from "./GeneratedReports";
import {
  resolveMetricColor,
  resolveMetricIcon,
  resolveMetricTrend,
} from "./reportMetricStyle";

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#6d28d9"];

const TYPE_STYLES: Record<string, { icon: string; color: string; light: string; text: string; border: string; dot: string }> = {
  analysis:       { icon: "analytics",        color: "text-indigo-600",   light: "bg-indigo-50",   text: "text-indigo-700",   border: "border-indigo-200",   dot: "bg-indigo-500" },
  detail:         { icon: "info",              color: "text-blue-600",     light: "bg-blue-50",     text: "text-blue-700",     border: "border-blue-200",     dot: "bg-blue-500" },
  recommendation: { icon: "lightbulb",         color: "text-emerald-600",  light: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200",  dot: "bg-emerald-500" },
  summary:        { icon: "description",       color: "text-amber-600",    light: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",    dot: "bg-amber-500" },
};

const TREND_STYLE: Record<string, { icon: string; bg: string; text: string }> = {
  up:      { icon: "trending_up",   bg: "bg-emerald-100", text: "text-emerald-700" },
  down:    { icon: "trending_down", bg: "bg-red-100",    text: "text-red-700" },
  neutral: { icon: "trending_flat", bg: "bg-slate-100",  text: "text-slate-600" },
};

const METRIC_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  indigo:  { bg: "bg-indigo-100",  ring: "ring-indigo-500/20",  text: "text-indigo-600" },
  emerald: { bg: "bg-emerald-100", ring: "ring-emerald-500/20", text: "text-emerald-600" },
  amber:   { bg: "bg-amber-100",   ring: "ring-amber-500/20",   text: "text-amber-600" },
  red:     { bg: "bg-red-100",     ring: "ring-red-500/20",     text: "text-red-600" },
  violet:  { bg: "bg-violet-100",  ring: "ring-violet-500/20",  text: "text-violet-600" },
  blue:    { bg: "bg-blue-100",    ring: "ring-blue-500/20",    text: "text-blue-600" },
  cyan:    { bg: "bg-cyan-100",    ring: "ring-cyan-500/20",    text: "text-cyan-600" },
  green:   { bg: "bg-green-100",   ring: "ring-green-500/20",   text: "text-green-600" },
  orange:  { bg: "bg-orange-100",  ring: "ring-orange-500/20",  text: "text-orange-600" },
  pink:    { bg: "bg-pink-100",    ring: "ring-pink-500/20",    text: "text-pink-600" },
};

function MetricStat({ metric }: { metric: AiReportResponse["metrics"][number] }) {
  const c = METRIC_COLORS[resolveMetricColor(metric.color)];
  const trend = resolveMetricTrend(metric.trend);
  const t = TREND_STYLE[trend];
  const icon = resolveMetricIcon(metric.icon, metric.label);
  return (
    <div className="relative group min-w-0">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-2xl pointer-events-none" />
      <div className="relative bg-white rounded-2xl border border-slate-200/80 p-5 transition-all duration-300 hover:shadow-xl hover:border-slate-300/60 hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={`w-10 h-10 shrink-0 rounded-xl ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
            <span className={`material-symbols-outlined text-xl leading-none ${c.text}`}>{icon}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${t.bg} ${t.text}`}
            title={trend === "neutral" ? "No change" : trend === "up" ? "Trending up" : "Trending down"}
          >
            <span className="material-symbols-outlined text-sm leading-none">{t.icon}</span>
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 break-words">
          {metric.label}
        </p>
        {/* Long AI values must wrap inside the card instead of overlapping neighbours. */}
        <p className="text-2xl font-bold text-slate-900 tabular-nums break-words [overflow-wrap:anywhere]">
          {metric.value}
        </p>
      </div>
    </div>
  );
}

function SectionTimelineCard({ section }: { section: AiReportResponse["sections"][number] }) {
  const s = TYPE_STYLES[section.type] || TYPE_STYLES.detail;
  return (
    <div className="group relative pl-8 pb-2">
      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-slate-200 group-last:hidden" />
      <div className={`absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full ${s.light} border-2 ${s.border} flex items-center justify-center`}>
        <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 transition-all duration-200 hover:shadow-lg hover:border-slate-300/60">
        <div className="flex items-center gap-3 mb-2">
          <span className={`material-symbols-outlined text-lg ${s.color}`}>{s.icon}</span>
          <h3 className="font-semibold text-slate-900">{section.title}</h3>
          <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${s.light} ${s.text}`}>
            {section.type}
          </span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{section.content}</p>
      </div>
    </div>
  );
}

function SectionLabel({ icon, label, color, children }: { icon: string; label: string; color?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-8 h-8 rounded-lg ${color || "bg-indigo-100"} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${color ? color.replace("bg-", "text-") : "text-indigo-600"}`}>
          {icon}
        </span>
      </div>
      <h2 className="text-base font-bold text-slate-900">{label}</h2>
      {children}
    </div>
  );
}

export function ReportViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const { addToast } = useToast();
  const { setNavHeader } = useNavHeader();

  const state = location.state as { report?: AiReportResponse; exportParams?: Record<string, unknown> } | null;

  const [report, setReport] = useState<AiReportResponse | null>(state?.report ?? null);
  const [exportParams, setExportParams] = useState<Record<string, unknown> | undefined>(state?.exportParams);
  const [storedReports, setStoredReports] = useState<StoredReportRecord[]>([]);
  const [storedReportsLoading, setStoredReportsLoading] = useState(true);

  useEffect(() => {
    if (!state?.report) {
      navigate("/reports", { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    setStoredReportsLoading(true);
    api.getStoredReports(auth.token)
      .then(setStoredReports)
      .catch(() => {})
      .finally(() => setStoredReportsLoading(false));
  }, [auth]);

  useEffect(() => {
    if (report) {
      setNavHeader({ title: report.title, description: `Generated ${new Date(report.generatedAt).toLocaleString()}` });
    }
  }, [report, setNavHeader]);

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.metrics.map((m) => ({
      name: m.label,
      value: parseFloat(m.value.replace(/[^0-9.-]/g, "")) || 0,
    }));
  }, [report]);

  const handleDownloadPdf = async () => {
    if (!auth || !report) return;
    try {
      const needsProject = report.reportType === "project-status" || report.reportType === "budget-variance";
      const path = `reports/${report.reportType}`;
      const blob = await api.downloadReport(auth.token, path, {
        method: needsProject ? "GET" : "POST",
        body: needsProject ? undefined : (exportParams as Record<string, unknown> | undefined),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${report.reportType}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      addToast("PDF exported successfully.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Download failed"}`, "error");
    }
  };

  const handleViewStoredReport = async (record: StoredReportRecord) => {
    if (!auth) return;
    try {
      const blob = await api.downloadStoredReport(auth.token, record.id);
      const text = await blob.text();
      const parsed = JSON.parse(text) as AiReportResponse;
      setReport(parsed);
      setExportParams(undefined);
    } catch {
      addToast("Could not load this report for viewing.", "error");
    }
  };

  const handleDownloadStoredReport = async (record: StoredReportRecord) => {
    if (!auth) return;
    try {
      const blob = await api.downloadStoredReport(auth.token, record.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${record.name}.${record.format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Download failed"}`, "error");
    }
  };

  const handleDeleteStoredReport = async (id: string) => {
    if (!auth) return;
    try {
      await api.deleteStoredReport(auth.token, id);
      setStoredReports((prev) => prev.filter((r) => r.id !== id));
      addToast("Report deleted.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Delete failed"}`, "error");
    }
  };

  if (!report) return <LoadingPage label="Loading report..." />;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AnimatedBackground />

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-sm font-medium shrink-0"
            >
              <Icon name="arrow_back" size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-300 hidden sm:block shrink-0" />
            <div className="hidden sm:block min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 truncate">{report.title}</h1>
              <p className="text-[11px] text-slate-500">Generated {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider">
              {report.reportType.replace(/-/g, " ")}
            </span>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold transition-all hover:shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
            >
              <Icon name="download" size={16} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          {/* Left: Report content */}
          <div className="space-y-10 min-w-0">
            {/* Executive Summary */}
            {report.summary && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-6 sm:p-8 text-white shadow-lg shadow-indigo-500/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <span className="material-symbols-outlined text-white">auto_awesome</span>
                    </div>
                    <p className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider">Executive Summary</p>
                  </div>
                  <p className="text-base sm:text-lg leading-relaxed text-indigo-50 font-light">{report.summary}</p>
                </div>
              </div>
            )}

            {/* Metrics */}
            {report.metrics.length > 0 && (
              <div>
                <SectionLabel icon="analytics" label="Key Metrics" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {report.metrics.map((metric, i) => (
                    <MetricStat key={i} metric={metric} />
                  ))}
                </div>
              </div>
            )}

            {/* Charts */}
            {chartData.length > 1 && (
              <div>
                <SectionLabel icon="monitoring" label="Visual Analysis" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <GlassCard className="p-5 sm:p-6">
                    <h4 className="text-sm font-semibold text-slate-800 mb-6 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500 text-lg">bar_chart</span>
                      Metrics Distribution
                    </h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "13px", padding: "8px 12px" }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                  <GlassCard className="p-5 sm:p-6">
                    <h4 className="text-sm font-semibold text-slate-800 mb-6 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500 text-lg">pie_chart</span>
                      Distribution Overview
                    </h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={4}>
                          {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </GlassCard>
                </div>
              </div>
            )}

            {/* Sections */}
            {report.sections.length > 0 && (
              <div>
                <SectionLabel icon="article" label="Detailed Analysis">
                  <span className="text-sm text-slate-500 font-medium ml-auto">
                    {report.sections.length} section{report.sections.length > 1 ? "s" : ""}
                  </span>
                </SectionLabel>
                <div className="space-y-5">
                  {report.sections.map((section, i) => (
                    <SectionTimelineCard key={i} section={section} />
                  ))}
                </div>
              </div>
            )}

            {/* Tables */}
            {report.tables.length > 0 && (
              <div>
                <SectionLabel icon="table_chart" label="Data Tables" />
                <div className="space-y-5">
                  {report.tables.map((table, i) => (
                    <SectionCard
                      key={i}
                      title={table.title}
                      icon="hi-table"
                      noBodyPadding
                      bodyClassName="overflow-x-auto"
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100">
                            {table.columns.map((col, j) => (
                              <th
                                key={j}
                                className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {table.rows.map((row, j) => (
                            <tr key={j} className="hover:bg-indigo-50/40 transition-colors">
                              {row.map((cell, k) => (
                                <td key={k} className="px-6 py-3 text-slate-700">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </SectionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {report.insights.length > 0 && (
              <div>
                <SectionLabel icon="insights" label="Key Insights" color="bg-amber-100" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.insights.map((insight, i) => (
                    <div
                      key={i}
                      className="group relative bg-white rounded-xl border border-amber-200/60 p-5 transition-all duration-200 hover:shadow-lg hover:border-amber-300/80"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-400 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-amber-600 text-base">lightbulb</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="pb-12">
                <SectionLabel icon="assignment" label="Recommendations" color="bg-emerald-100" />
                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="group relative bg-white rounded-xl border border-slate-200/80 p-5 transition-all duration-200 hover:shadow-lg hover:border-emerald-200/80 hover:bg-emerald-50/20"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-sm font-bold text-emerald-700">{i + 1}</span>
                        </div>
                        <div className="pt-1.5">
                          <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="lg:sticky lg:top-20 h-fit">
            <GeneratedReports
              reports={storedReports}
              loading={storedReportsLoading}
              onView={handleViewStoredReport}
              onDownload={handleDownloadStoredReport}
              onDelete={handleDeleteStoredReport}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
