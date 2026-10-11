import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export interface NavHeaderAction {
  label: string;
  onClick: () => void;
  icon?: string;
}

interface NavHeaderState {
  title: string;
  description?: string;
  action?: NavHeaderAction;
  actions?: NavHeaderAction[];
  /**
   * Optional back-navigation slot for the topbar. When set, NavHeader renders
   * a colored back button (arrow-back + optional backLabel) before the
   * title, replacing the date chip, and only the page title is shown
   * (description hidden). Detail shells (e.g. ProjectDetailShell)
   * set it via setNavHeader; when absent nothing renders and other pages are
   * unaffected.
   */
  backTo?: string;
  backLabel?: string;
}

interface NavHeaderContextType extends NavHeaderState {
  /** Accepts a full state object (existing behaviour) or a functional
   *  updater. The updater form lets a caller patch only its own fields
   *  (e.g. add/remove the back slot) without clobbering the title another
   *  component just set. */
  setNavHeader: (state: NavHeaderState | ((prev: NavHeaderState) => NavHeaderState)) => void;
}

const NavHeaderContext = createContext<NavHeaderContextType | null>(null);

const DEFAULT_STATE: NavHeaderState = { title: "PMWDS" };

export function NavHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavHeaderState>(DEFAULT_STATE);

  const setNavHeader = useCallback(
    (update: NavHeaderState | ((prev: NavHeaderState) => NavHeaderState)) => {
      setState((prev) => (typeof update === "function" ? update(prev) : update));
    },
    [],
  );

  const value = useMemo(() => ({ ...state, setNavHeader }), [state, setNavHeader]);

  return (
    <NavHeaderContext.Provider value={value}>
      {children}
    </NavHeaderContext.Provider>
  );
}

export function useNavHeader() {
  const ctx = useContext(NavHeaderContext);
  if (!ctx) throw new Error("useNavHeader must be used within NavHeaderProvider");
  return ctx;
}
