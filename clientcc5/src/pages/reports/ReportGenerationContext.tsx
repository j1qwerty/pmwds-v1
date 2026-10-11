import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { AiReportResponse } from "../../types";

/**
 * Tracks in-flight report generations above the router so the "Generating..."
 * state survives navigation.
 *
 * Report generation is slow (an LLM round trip). Previously the flag lived in
 * ReportsPage local state, so switching pages unmounted the component, dropped
 * the flag, and let the same report type be triggered a second time while the
 * first request was still running. Holding the state here keeps it alive across
 * route changes and exposes which report type is currently pending.
 */

type GenerationResult = {
  reportType: string;
  report: AiReportResponse;
  exportParams: Record<string, unknown>;
};

type ReportGenerationContextValue = {
  /** Report type currently being generated, or null when idle. */
  pendingReportType: string | null;
  isGenerating: boolean;
  /** True when a request for this specific report type is already in flight. */
  isGeneratingType: (reportType: string) => boolean;
  /** Runs the generation; rejects if the same type is already in flight. */
  generate: (
    reportType: string,
    body: Record<string, unknown>,
    exportParams: Record<string, unknown>,
  ) => Promise<GenerationResult>;
  /** Most recent successful generation, for consumers that mount late. */
  lastResult: GenerationResult | null;
  clearLastResult: () => void;
  generationError: string | null;
};

const ReportGenerationContext = createContext<ReportGenerationContextValue | null>(null);

export function ReportGenerationProvider({ children }: PropsWithChildren) {
  const { auth } = useAuth();
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Mirrors `pending` for synchronous reads within the same tick, so a rapid
  // second click cannot slip through before React re-renders.
  const pendingRef = useRef<Set<string>>(new Set());

  const begin = useCallback((reportType: string) => {
    pendingRef.current.add(reportType);
    setPending(new Set(pendingRef.current));
  }, []);

  const end = useCallback((reportType: string) => {
    pendingRef.current.delete(reportType);
    setPending(new Set(pendingRef.current));
  }, []);

  const generate = useCallback(
    async (
      reportType: string,
      body: Record<string, unknown>,
      exportParams: Record<string, unknown>,
    ): Promise<GenerationResult> => {
      if (pendingRef.current.has(reportType)) {
        throw new Error("This report is already being generated.");
      }
      if (!auth) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      begin(reportType);
      setGenerationError(null);
      try {
        const report = await api.generateReport(auth.token, reportType, body);
        const result: GenerationResult = { reportType, report, exportParams };
        setLastResult(result);
        return result;
      } catch (cause) {
        setGenerationError(cause instanceof Error ? cause.message : "Report generation failed.");
        throw cause;
      } finally {
        end(reportType);
      }
    },
    [auth, begin, end],
  );

  const value = useMemo<ReportGenerationContextValue>(
    () => ({
      pendingReportType: pending.size > 0 ? Array.from(pending)[0] : null,
      isGenerating: pending.size > 0,
      isGeneratingType: (reportType: string) => pending.has(reportType),
      generate,
      lastResult,
      clearLastResult: () => setLastResult(null),
      generationError,
    }),
    [pending, generate, lastResult, generationError],
  );

  return (
    <ReportGenerationContext.Provider value={value}>{children}</ReportGenerationContext.Provider>
  );
}

export function useReportGeneration(): ReportGenerationContextValue {
  const context = useContext(ReportGenerationContext);
  if (!context) {
    throw new Error("useReportGeneration must be used inside ReportGenerationProvider.");
  }
  return context;
}
