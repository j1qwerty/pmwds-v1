import { GlassCard, InfoTip } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { chatContext, isChatError, type ChatResponse } from "./chatTypes";

interface AIChatPanelProps {
  chatPrompt: string;
  setChatPrompt: (prompt: string) => void;
  chatResult: ChatResponse | null;
  onChat: () => void;
  pending?: boolean;
  provider?: string;
  model?: string;
}

export function AIChatPanel({
  chatPrompt,
  setChatPrompt,
  chatResult,
  onChat,
  pending = false,
  provider,
  model,
}: AIChatPanelProps) {
  const isError = isChatError(chatResult);
  const context = chatContext(chatResult);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="auto_awesome" size={20} className="text-indigo-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 truncate">AI Assistant</h3>
        </div>
        <InfoTip
          title="AI Assistant"
          summary="Ask a plain-language question and get an answer based on your real project data."
          points={[
            "The assistant is given your projects, tasks, subtasks, milestones and document lists before it answers.",
          ]}
          note={provider ? `Answering with ${provider}${model ? ` using ${model}` : ""}.` : undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        <textarea
          value={chatPrompt}
          onChange={(e) => setChatPrompt(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          placeholder="Ask about your projects, tasks, milestones or documents..."
        />

        <div className="flex flex-wrap gap-1.5">
          {[
            "Tell me about all the projects",
            "Which projects are delayed?",
            "Show my open tasks",
            "List the milestones",
            "Who is overloaded?",
            "Show me the documents",
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setChatPrompt(suggestion)}
              disabled={pending}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onChat}
            disabled={pending || !chatPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {pending && (
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
            )}
            {pending ? "Thinking..." : "Run Analysis"}
          </button>

          {pending && (
            <span className="text-[11px] text-slate-400">
              Large models can take a minute or more to answer.
            </span>
          )}
        </div>

        {chatResult && (
          <div
            role="status"
            className={`p-4 rounded-xl border mt-2 ${
              isError ? "bg-red-50 border-red-200" : "bg-indigo-50 border-indigo-100"
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
                isError ? "text-red-500" : "text-indigo-400"
              }`}
            >
              {isError && <span className="material-symbols-outlined text-[13px]">error</span>}
              {isError ? "Could not answer" : chatResult.intent || "Answer"}
            </div>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isError ? "text-red-700" : "text-slate-700"}`}>
              {chatResult.message}
            </p>
            {context?.usedFallbackModel && !isError && (
              <p className="text-[11px] text-amber-600 mt-2 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[13px] mt-px">bolt</span>
                <span>
                  Your configured model was rate limited, so this answer came from the
                  backup model{context.modelUsed ? ` (${context.modelUsed})` : ""}. It is
                  still your project data, but expect a shorter or less polished reply.
                </span>
              </p>
            )}
            {isError && (
              <p className="text-[11px] text-red-500 mt-2">
                Check the provider, API key, and model under AI Settings, then try again.
              </p>
            )}
            {(chatResult.suggestedActions?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(chatResult.suggestedActions ?? []).map((action) => (
                  <span
                    key={action}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white text-indigo-600 border border-indigo-200"
                  >
                    {action}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
