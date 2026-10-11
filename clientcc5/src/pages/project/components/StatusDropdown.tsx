// components/shared/StatusDropdown.tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronDown, FiCheck } from "react-icons/fi";
import { getStatusColor } from "../../shared/colors";

interface StatusDropdownProps {
  currentStatus: string;
  onChange: (status: string) => void;
}

const statuses = [
  { value: "NotStarted", label: "Not started" },
  { value: "InProgress", label: "In progress" },
  { value: "Completed", label: "Completed" },
  { value: "OnHold", label: "On hold" },
  { value: "Cancelled", label: "Cancelled" },
];

/**
 * The options menu is rendered through a portal into document.body with
 * viewport-fixed positioning computed from the trigger rect. This keeps it
 * above card grids (overflow/stacking contexts) and above Sheet/Modal
 * overlays (z-[1000]) — e.g. when used inside ProgressStatusEditor within
 * the task/subtask edit sheets.
 */
const MENU_Z_INDEX = 1100;
const MENU_MIN_WIDTH = 160;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const ESTIMATED_MENU_HEIGHT = 190; // corrected with the real height after mount

interface MenuPos {
  top: number;
  left: number;
  width: number;
}

export function StatusDropdown({ currentStatus, onChange }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = statuses.find(s => s.value === currentStatus) || statuses[0];
  const currentColors = getStatusColor(currentStatus);

  const updateMenuPos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || ESTIMATED_MENU_HEIGHT;
    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    const spaceBelow = window.innerHeight - rect.bottom;
    // Flip above the trigger when there is no room below (and room above is better)
    const openAbove = spaceBelow < menuHeight + MENU_GAP && rect.top > spaceBelow;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
    );
    const top = openAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - menuHeight - MENU_GAP)
      : rect.bottom + MENU_GAP;
    setMenuPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === width
        ? prev
        : { top, left, width }
    );
  }, []);

  // Anchor the floating menu while open: any container scroll (capture phase
  // catches nested scroll areas like sheet bodies) + window resizes.
  useEffect(() => {
    if (!isOpen) return;
    updateMenuPos();
    const handleReposition = () => updateMenuPos();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen, updateMenuPos]);

  // Correct the position once the real menu height is measurable
  useLayoutEffect(() => {
    if (isOpen) updateMenuPos();
  }, [isOpen, updateMenuPos]);

  // Close on pointer down outside (both the trigger and the portal menu)
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  // Escape closes just this menu — capture phase so a parent Sheet/Modal
  // (bubble-phase document listener) does not also close behind it.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isOpen) updateMenuPos();
          setIsOpen(!isOpen);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex items-center justify-between gap-2 h-9 px-3 min-w-[140px] rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentColors.dot}`} />
          <span className="truncate">{current.label}</span>
        </span>
        <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && menuPos && createPortal(
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden py-1"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: MENU_Z_INDEX,
            }}
            role="listbox"
          >
            {statuses.map((status) => {
              const colors = getStatusColor(status.value);
              const active = status.value === currentStatus;
              return (
                <button
                  key={status.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(status.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                  <span className="truncate">{status.label}</span>
                  {active && <FiCheck className="w-4 h-4 ml-auto text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}
