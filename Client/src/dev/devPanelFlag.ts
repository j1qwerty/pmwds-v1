/**
 * Visibility of the bottom e2e dev panel.
 *
 * Defaults to ON so a deployed build shows the panel too - it is a demo aid.
 * The panel itself renders only while the e2e control server is reachable
 * (no server, no panel), so leaving the default on is harmless.
 *
 * Set `VITE_BOTTOM_DEV_PANLE=false` to hide it, or `VITE_BOTTOM_DEV_PANLE=true`
 * (the default) to show it. Only `VITE_`-prefixed variables reach the browser
 * bundle, which is why the prefix is not optional here.
 */

function readFlag(): boolean {
  const raw = import.meta.env?.VITE_BOTTOM_DEV_PANLE;
  if (raw === undefined || raw === null || raw === "") return true;
  return String(raw).trim().toLowerCase() !== "false" && String(raw).trim() !== "0";
}

export const SHOW_BOTTOM_DEV_PANEL = readFlag();
