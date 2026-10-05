import { useMemo } from "react";
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
import type { AiReportResponse, ReportSection } from "../../types";
import { GlassCard } from "../shared";
import {
  resolveMetricColor,
  resolveMetricIcon,
  resolveMetricTrend,
} from "./reportMetricStyle";

interface ReportViewerProps {
  report: AiReportResponse;
  onClose: () => void;
  onDownloadPdf: (reportType: string) => void;
}

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#6d28d9"];

const colorStyles: Record<string, { bg: string; text: string; light: string; border: string }> = {
  indigo: { bg: "bg-indigo-500", text: "text-indigo-600", light: "bg-indigo-50", border: "border-indigo-200" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-50", border: "border-emerald-200" },
  amber: { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-200" },
  red: { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50", border: "border-red-200" },
  violet: { bg: "bg-violet-500", text: "text-violet-600", light: "bg-violet-50", border: "border-violet-200" },
  blue: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200" },
  cyan: { bg: "bg-cyan-500", text: "text-cyan-600", light: "bg-cyan-50", border: "border-cyan-200" },
  green: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50", border: "border-green-200" },
  orange: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50", border: "border-orange-200" },
  pink: { bg: "bg-pink-500", text: "text-pink-600", light: "bg-pink-50", border: "border-pink-200" },
};

const sectionIcons: Record<string, string> = {
  analysis: "analytics",
  detail: "info",
  recommendation: "lightbulb",
  summary: "description",
};

function MetricBadge({ metric }: { metric: any }) {
  const colors = colorStyles[resolveMetricColor(metric.color)];
  const trend = resolveMetricTrend(metric.trend);
  const icon = resolveMetricIcon(metric.icon, metric.label);

  return (
    <div className={`${colors.light} ${colors.border} rounded-xl border p-4 min-w-0`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`material-symbols-outlined text-lg leading-none shrink-0 ${colors.text}`}>{icon}</span>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider break-words">
          {metric.label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-slate-800 break-words [overflow-wrap:anywhere]">
          {metric.value}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
            trend === "up"
              ? "bg-emerald-100 text-emerald-700"
              : trend === "down"
                ? "bg-red-100 text-red-700"
                : "bg-slate-100 text-slate-600"
          }`}
          title={trend === "neutral" ? "No change" : trend === "up" ? "Trending up" : "Trending down"}
        >
          <span className="material-symbols-outlined text-sm leading-none">
            {trend === "up" ? "trending_up" : trend === "down" ? "trending_down" : "trending_flat"}
          </span>
        </span>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: ReportSection }) {
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-200 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 text-lg">
              {sectionIcons[section.type] || "article"}
            </span>
          </div>
          <h4 className="font-semibold text-slate-800">{section.title}</h4>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium uppercase tracking-wider">
          {section.type}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed ml-13">{section.content}</p>
    </div>
  );
}

export function ReportViewer({ report, onClose, onDownloadPdf }: ReportViewerProps) {
  const chartData = useMemo(() => {
    return report.metrics.map((m) => ({
      name: m.label,
      value: parseFloat(m.value.replace(/[^0-9.-]/g, "")) || 0,
    }));
  }, [report.metrics]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl my-8">
          <GlassCard className="overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <span className="material-symbols-outlined">description</span>
                    {report.title}
                  </h2>
                  <p className="text-sm text-indigo-100 mt-1 ml-9">
                    Generated {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onDownloadPdf(report.reportType)}
                    className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Export PDF
                  </button>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-white">close</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Executive Summary */}
              {report.summary && (
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50 border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
                    <h3 className="text-base font-bold text-slate-800">Executive Summary</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
                </div>
              )}

              {/* Metrics Grid */}
              {report.metrics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-indigo-500">dashboard</span>
                    <h3 className="text-base font-bold text-slate-800">Key Metrics</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {report.metrics.map((metric, i) => (
                      <MetricBadge key={i} metric={metric} />
                    ))}
                  </div>
                </div>
              )}

              {/* Charts */}
              {chartData.length > 1 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500">bar_chart</span>
                      Metrics Distribution
                    </h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie Chart */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-500">pie_chart</span>
                      Distribution Overview
                    </h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={4}
                        >
                          {chartData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CHART_COLORS[index % CHART_COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Report Sections */}
              {report.sections.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-indigo-500">article</span>
                    <h3 className="text-base font-bold text-slate-800">Detailed Analysis</h3>
                  </div>
                  <div className="space-y-3">
                    {report.sections.map((section, i) => (
                      <SectionCard key={i} section={section} />
                    ))}
                  </div>
                </div>
              )}

              {/* Tables */}
              {report.tables.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-indigo-500">table</span>
                    <h3 className="text-base font-bold text-slate-800">Data Tables</h3>
                  </div>
                  <div className="space-y-4">
                    {report.tables.map((table, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                          <h4 className="font-semibold text-slate-800 text-sm">{table.title}</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50/50">
                                {table.columns.map((col, j) => (
                                  <th key={j} className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {table.rows.map((row, j) => (
                                <tr key={j} className="hover:bg-indigo-50/30 transition-colors">
                                  {row.map((cell, k) => (
                                    <td key={k} className="px-5 py-3 text-slate-700">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {report.insights.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-amber-600">insights</span>
                    <h3 className="text-base font-bold text-amber-900">Key Insights</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {report.insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-amber-900">
                        <span className="material-symbols-outlined text-amber-500 text-base mt-0.5">star</span>
                        <span className="leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-blue-600">lightbulb</span>
                    <h3 className="text-base font-bold text-blue-900">Recommendations</h3>
                  </div>
                  <ol className="space-y-3">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}