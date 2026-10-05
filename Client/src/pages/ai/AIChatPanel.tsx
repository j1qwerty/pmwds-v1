import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface AIChatPanelProps {
  chatPrompt: string;
  setChatPrompt: (prompt: string) => void;
  chatResult: any;
  onChat: () => void;
}

export function AIChatPanel({ chatPrompt, setChatPrompt, chatResult, onChat }: AIChatPanelProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="auto_awesome" size={20} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">AI Assistant</h3>
      </div>

      <div className="flex flex-col gap-3">
        <textarea
          value={chatPrompt}
          onChange={(e) => setChatPrompt(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          placeholder="Ask the AI assistant..."
        />
        
        <button
          onClick={onChat}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors"
        >
          Run Analysis
        </button>

        {chatResult && (
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 mt-2">
            {chatResult.intent && (
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                {chatResult.intent}
              </div>
            )}
            <p className="text-sm text-slate-700 leading-relaxed">{chatResult.message}</p>
            {chatResult.suggestedActions?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {chatResult.suggestedActions.map((action: string) => (
                  <span key={action} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white text-indigo-600 border border-indigo-200">
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