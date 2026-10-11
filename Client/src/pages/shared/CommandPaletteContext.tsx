import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommandPalette, type CommandItem } from "./CommandPalette";

interface CommandPaletteContextValue {
  openPalette: () => void;
  closePalette: () => void;
  /** Register extra commands from the current page (merged into the Actions group). */
  setPaletteActions: (actions: CommandItem[]) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

/**
 * Global Cmd/Ctrl+K provider.
 *
 * - Listens for Ctrl/Cmd+K (preventing the browser default) and "/" when
 *   not typing in an input.
 * - Renders the palette itself.
 * - Pages can push contextual commands with setPaletteActions (they are
 *   scoped to the mounted page and cleared on unmount).
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pageActions, setPageActions] = useState<CommandItem[]>([]);
  const pageActionsRef = useRef<CommandItem[]>([]);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);

  const setPaletteActions = useCallback((actions: CommandItem[]) => {
    pageActionsRef.current = actions;
    setPageActions(actions);
  }, []);

  // Allow pages to clear their actions on unmount
  useEffect(() => {
    return () => {
      pageActionsRef.current = [];
      setPageActions([]);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
        return;
      }

      // "/" opens search when the user is not typing in a field
      if (key === "/" && !meta && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isTyping =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const value = useMemo(
    () => ({ openPalette, closePalette, setPaletteActions }),
    [openPalette, closePalette, setPaletteActions],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onClose={closePalette} actions={pageActions} />
    </CommandPaletteContext.Provider>
  );
}
