import type { NotificationItem } from "../../types";
import { GlassCard, GradientButton } from "../shared";

interface NotificationInboxProps {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onBroadcast: () => void;
  canWrite: boolean;
}

export function NotificationInbox({ items, onMarkRead, onMarkAllRead, onDelete, onBroadcast, canWrite }: NotificationInboxProps) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Inbox</h3>
          <p className="text-xs text-slate-400">Read, clear, and monitor personal notifications</p>
        </div>
        <div className="flex gap-2">
          <GradientButton variant="ghost" onClick={onMarkAllRead}>
            <span className="material-symbols-outlined text-sm">done_all</span>
            Mark All Read
          </GradientButton>
          {canWrite && (
            <GradientButton onClick={onBroadcast}>
              <span className="material-symbols-outlined text-sm">campaign</span>
              Broadcast
            </GradientButton>
          )}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">notifications_off</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">No notifications</h4>
            <p className="text-xs text-slate-400">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`p-5 hover:bg-slate-50 transition-colors ${!item.isRead ? "bg-indigo-50/50 border-l-4 border-l-indigo-500" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                      )}
                      <strong className="text-slate-800 font-semibold text-sm">{item.title}</strong>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{item.message}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.priority === "High" 
                          ? "bg-red-50 text-red-600 border border-red-100" 
                          : item.priority === "Medium"
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : "bg-blue-50 text-blue-600 border border-blue-100"
                      }`}>
                        {item.priority}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        item.isRead 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                          : "bg-amber-50 text-amber-600 border border-amber-100"
                      }`}>
                        {item.isRead ? "Read" : "Unread"}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        {new Date(item.createdDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!item.isRead && (
                      <button
                        onClick={() => onMarkRead(item.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
                      >
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}