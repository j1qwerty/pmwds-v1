import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { formatRelativeTime } from "../../lib/datetime";
import type { NotificationItem } from "../../types";

interface TooltipState {
  item: NotificationItem;
  icon: string;
  iconColor: string;
  x: number;
  y: number;
}

export function NotificationList({
  items,
  title = "Notifications",
  onOpen,
}: {
  items: NotificationItem[];
  title?: string;
  onOpen?: (item: NotificationItem) => void | Promise<void>;
}) {
  const itemsArray = Array.isArray(items) ? items : [];
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback((item: NotificationItem, icon: string, iconColor: string, e: React.MouseEvent) => {
    // The list scrolls inside a fixed-height, overflow-hidden card, so an in-flow tooltip
    // would be clipped. Tracking the pointer and rendering through a portal keeps the full
    // text readable no matter where the row sits in the list.
    if (!hasHiddenText(item)) return;
    setTooltip({ item, icon, iconColor, x: e.clientX, y: e.clientY });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  if (!itemsArray.length) {
    return (
      <div className="bg-surface-container-lowest  rounded-xl p-lg ambient-glow border border-outline-variant/20 h-[360px] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary bg-primary/10 p-1.5 rounded-lg">notifications</span>
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
          </div>
          <span className="bg-surface-container text-on-surface-variant text-[10px] font-semibold px-2 py-[2px] rounded-full">0 New</span>
        </div>
        <div className="flex flex-col flex-1 items-center justify-center py-lg text-center">
          <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center mb-sm">
            <span className="material-symbols-outlined text-outline text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              notifications_off
            </span>
          </div>
          <p className="text-on-surface-variant text-sm font-medium">All caught up!</p>
          <p className="text-on-surface-variant text-xs mt-1">No new notifications</p>
        </div>
      </div>
    );
  }

  const getNotificationType = (item: NotificationItem) => {
    const priority = item.priority || "Info";
    
    switch (priority) {
      case "Critical":
        return {
          type: "critical",
          icon: "error",
          bg: "bg-error-container-10",
          iconColor: "text-error",
          highlightColor: "text-error",
          badge: "bg-error text-white",
        };
      case "High":
        return {
          type: "mention",
          icon: "chat",
          bg: "bg-primary/10",
          iconColor: "text-primary",
          highlightColor: "text-primary",
          badge: "bg-primary text-white",
        };
      case "Info":
      case "Success":
      default:
        return {
          type: "release",
          icon: "info",
          bg: "bg-secondary-container-10",
          iconColor: "text-secondary",
          highlightColor: "text-secondary",
          badge: "bg-secondary text-white",
        };
    }
  };

  // Relative for the last week, then the IST date. Goes through the shared helper so the
  // timestamp is read as UTC and the date rendered in IST, instead of being guessed from
  // the browser's zone.
  const formatTime = (dateStr: string) => formatRelativeTime(dateStr);

  const unreadCount = itemsArray.filter(item => !item.isRead).length;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-lg ambient-glow border border-outline-variant/20 h-[360px] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary bg-primary/10 p-1.5 rounded-lg">notifications</span>
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
        </div>
        {unreadCount > 0 && (
          <span className="bg-primary text-white text-[10px] font-bold px-2 py-[2px] rounded-full">
            {unreadCount} New
          </span>
        )}
      </div>
      <div className="flex flex-col gap-sm flex-1 min-h-0 overflow-y-auto pr-1">
        {itemsArray.map((item) => {
          const config = getNotificationType(item);
          
          // Extract highlighted text from message if it contains a colon or specific pattern
          let mainText = item.title;
          let highlightedText = "";
          
          if (item.title.includes(": ")) {
            const parts = item.title.split(": ");
            mainText = parts[0] + ": ";
            highlightedText = parts[1];
          } else if (item.title.includes(" in ")) {
            const parts = item.title.split(" in ");
            mainText = parts[0] + " in ";
            highlightedText = parts[1];
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void onOpen?.(item)}
              onMouseMove={(e) => showTooltip(item, config.icon, config.iconColor, e)}
              onMouseLeave={hideTooltip}
              onFocus={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                showTooltip(item, config.icon, config.iconColor, {
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.bottom,
                } as React.MouseEvent);
              }}
              onBlur={hideTooltip}
              // No native `title` here: it would fire alongside the hover card a second
              // later and the user would see the same text twice.
              className="w-full text-left flex gap-3 items-start p-3 rounded-xl hover:bg-surface-container-low cursor-pointer transition-all duration-200 border border-transparent hover:border-outline-variant/30 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                <span className={`material-symbols-outlined ${config.iconColor} text-[18px]`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {config.icon}
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  {!item.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  )}
                </div>
              </div>
               
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-primary font-semibold">{formatTime(item.createdDate)}</span>

                  <span className="text-[13px] text-on-surface font-semibold truncate">
                    {mainText}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${config.badge}`}>
                    {item.priority}
                  </span>
                </div>
                {highlightedText && (
                  <span className={`text-[13px] font-medium ${config.highlightColor}`}>
                    {highlightedText}
                  </span>
                )}
                {item.message && (
                  <p className="text-[12px] text-on-surface-variant mt-1 line-clamp-2">
                    {item.message.slice(0, 80)}
                  </p>
                )}
               
              </div>
            </button>
          );
        })}
      </div>

      {tooltip &&
        createPortal(
          <FullTextTooltip
            key={tooltip.item.id}
            tooltip={tooltip}
            onDismiss={hideTooltip}
          />,
          document.body,
        )}
    </div>
  );
}

/** True when the row's one-line title / two-line message hides part of the text. */
function hasHiddenText(item: NotificationItem) {
  return (item.title?.length ?? 0) > 40 || (item.message?.length ?? 0) > 80;
}

function FullTextTooltip({
  tooltip,
  onDismiss,
}: {
  tooltip: TooltipState;
  onDismiss: () => void;
}) {
  const CARD_WIDTH = 352;
  const ESTIMATED_HEIGHT = 168;
  const GAP = 12;

  // Flip to the left of the pointer near the right edge, and above it near the bottom.
  const left = tooltip.x + GAP + CARD_WIDTH > window.innerWidth
    ? Math.max(GAP, tooltip.x - GAP - CARD_WIDTH)
    : tooltip.x + GAP;
  const top = tooltip.y + GAP + ESTIMATED_HEIGHT > window.innerHeight
    ? Math.max(GAP, tooltip.y - GAP - ESTIMATED_HEIGHT)
    : tooltip.y + GAP;

  return (
    <div
      role="tooltip"
      onMouseLeave={onDismiss}
      style={{ left, top, width: CARD_WIDTH }}
      className="fixed z-[100] pointer-events-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-left shadow-2xl"
    >
      <div className="flex items-start gap-2">
        <span
          className={`material-symbols-outlined ${tooltip.iconColor} text-[16px] mt-px shrink-0`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {tooltip.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-on-surface break-words whitespace-pre-wrap">
            {tooltip.item.title}
          </p>
          {tooltip.item.message && (
            <p className="mt-1 text-[12px] text-on-surface-variant break-words whitespace-pre-wrap">
              {tooltip.item.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}