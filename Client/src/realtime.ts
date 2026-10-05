import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type IRetryPolicy,
  type RetryContext,
} from "@microsoft/signalr";
import type { DataChangedNotification } from "./realtimeScopes";

/**
 * SignalR connection to the API's `DashboardHub`.
 *
 * The hub already existed and was already mapped in Program.cs (`/hubs/dashboard`), but
 * nothing ever pushed to it and no client ever connected. This wires the two halves
 * together. See docs/realtime-sync-and-data-durability.md step 4.
 *
 * This is a *hint* channel only. Every handler refetches through the normal authorized
 * API, so a stale or forged notification can never surface data the caller is not
 * allowed to read.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5177/api/v1";

/** Matches STORAGE_KEY in auth.tsx, where the current JWT is persisted. */
const AUTH_STORAGE_KEY = "pmwds-client-auth";

export type RealtimeStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

type DataChangedHandler = (notification: DataChangedNotification) => void;
type StatusHandler = (status: RealtimeStatus) => void;

function resolveHubUrl(): string {
  // The hub is always served from the site ROOT at /hubs/dashboard, never under the
  // /api/v1 prefix, so only the origin matters here and the API path must be discarded.
  //
  // That discarding has to happen for BOTH forms of the base:
  //   absolute  http://localhost:5177/api/v1  -> origin http://localhost:5177
  //   relative  /api/v1                       -> origin https://host
  // Previously only the absolute branch stripped the path, so the relative form produced
  // /api/v1/hubs/dashboard - correct nowhere. Dev used the absolute form and passed, so
  // the broken path would only ever have appeared in a deployed bundle, where it silently
  // fell back to the 60s poll. deploy.ps1 sets VITE_API_BASE_URL=/api/v1 deliberately, so
  // this was the production path.
  const base = API_BASE_URL;
  const origin = /^https?:\/\//i.test(base)
    ? new URL(base).origin
    : typeof window !== "undefined"
      ? window.location.origin
      : "";

  return `${origin.replace(/\/$/, "")}/hubs/dashboard`;
}

function currentToken(): string | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string | null }).token ?? null;
  } catch {
    return null;
  }
}

/**
 * Retry policy that never gives up.
 *
 * `withAutomaticReconnect([0, 2000, 5000, 10000, 30000])` is a *finite* policy. Once the
 * last delay is used SignalR transitions to Disconnected and never tries again, so the
 * socket is permanently dead until the page is reloaded - which is exactly what was
 * happening: browsers sat showing the offline dot until someone hit refresh.
 *
 * Returning a delay forever instead means the built-in reconnect machinery keeps working
 * for as long as the tab is open. `scheduleRestart` below is the second line of defence
 * for the cases the built-in policy cannot cover (a failure during the *initial* connect,
 * which never enters the reconnect loop at all).
 */
class PersistentRetryPolicy implements IRetryPolicy {
  nextRetryDelayInMilliseconds(retryContext: RetryContext): number | null {
    const attempt = retryContext.previousRetryCount;
    // 0ms, 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
    return attempt <= 0 ? 0 : Math.min(1000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
  }
}

const MAX_RETRY_DELAY_MS = 30_000;

let connection: HubConnection | null = null;
let starting: Promise<void> | null = null;
let status: RealtimeStatus = "disconnected";

/** Set by stopRealtime() so an intentional shutdown is not undone by the self-healer. */
let stopped = false;
/** Pending self-heal timer, so it can be cancelled and never stacks up. */
let restartTimer: number | undefined;
/** How many consecutive self-heal attempts have failed; drives the backoff. */
let restartAttempt = 0;

const dataChangedHandlers = new Set<DataChangedHandler>();
const statusHandlers = new Set<StatusHandler>();

function setStatus(next: RealtimeStatus) {
  if (status === next) return;
  status = next;
  statusHandlers.forEach((handler) => {
    try {
      handler(next);
    } catch {
      // A misbehaving subscriber must not break the connection for everyone else.
    }
  });
}

function build(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(resolveHubUrl(), {
      // Read fresh on every (re)negotiate rather than closing over a token captured at
      // start time. auth.tsx rewrites localStorage when it refreshes the JWT, so a socket
      // that reconnects after expiry picks up the new one instead of failing to 401.
      accessTokenFactory: () => currentToken() ?? "",
      withCredentials: true,
    })
    .withAutomaticReconnect(new PersistentRetryPolicy())
    .configureLogging(LogLevel.Warning)
    .build();
}

function clearRestart() {
  if (restartTimer !== undefined) {
    window.clearTimeout(restartTimer);
    restartTimer = undefined;
  }
}

/**
 * Schedules a reconnect attempt after a backoff, unless the socket was stopped on purpose.
 *
 * This covers the two cases `PersistentRetryPolicy` does not:
 *
 * 1. The **initial** `hub.start()` rejects (server restarting, VPN coming up, hub URL
 *    unreachable). A failed initial connect never enters the automatic reconnect loop, so
 *    without this the socket stays dead for the life of the tab.
 * 2. The connection reaches a terminal `close` for any other reason.
 *
 * The attempt counter resets on success, so a later blip restarts from a fast retry rather
 * than inheriting an old 30s wait.
 */
function scheduleRestart() {
  if (stopped) return;
  clearRestart();

  restartAttempt += 1;
  const delay = Math.min(1000 * 2 ** (restartAttempt - 1), MAX_RETRY_DELAY_MS);

  restartTimer = window.setTimeout(() => {
    restartTimer = undefined;
    void startRealtime();
  }, delay);
}

/**
 * Connects if not already connected. Safe to call repeatedly and from multiple
 * components (React StrictMode mounts everything twice in development).
 */
export function startRealtime(): Promise<void> {
  // An explicit start means we do want a connection, so cancel any pending self-heal and
  // clear the intentional-stop latch.
  stopped = false;
  clearRestart();

  if (connection && connection.state !== HubConnectionState.Disconnected) {
    return starting ?? Promise.resolve();
  }

  if (starting) return starting;

  const hub = build();

  // Assign `connection` before starting. This is what makes `isRealtimeHealthy()` work and
  // what stops a re-run of the mount effect from building a second live connection: the
  // guard above only short-circuits because this variable is set. When it was left null,
  // every call built another HubConnection and the earlier ones were never stopped, so a
  // long-lived tab accumulated leaked sockets.
  connection = hub;

  hub.on("DataChanged", (notification: DataChangedNotification) => {
    if (!notification?.scope) return;
    dataChangedHandlers.forEach((handler) => {
      try {
        handler(notification);
      } catch {
        // One bad subscriber must not stop the others from refreshing.
      }
    });
  });

  hub.onreconnecting(() => {
    // Built-in reconnect is in progress. Clear any self-heal timer so the two mechanisms
    // cannot both fire, and keep the attempt counter so a later failure backs off further.
    clearRestart();
    setStatus("reconnecting");
  });

  hub.onreconnected(() => {
    restartAttempt = 0;
    setStatus("connected");
  });

  hub.onclose(() => {
    // Only clear `connection` if this is still the live one. A stale hub closing after a
    // replacement was created must not orphan the current connection.
    if (connection === hub) {
      connection = null;
    }
    setStatus("disconnected");
    scheduleRestart();
  });

  setStatus("connecting");

  starting = hub
    .start()
    .then(() => {
      restartAttempt = 0;
      setStatus("connected");
    })
    .catch((error: unknown) => {
      // Losing the socket is survivable: the focus-refetch and 60s poll in appData cover
      // it. Do not throw, or an unreachable hub would break the whole app. A rejected
      // initial start is NOT covered by automatic reconnect, so self-heal it here.
      if (connection === hub) {
        connection = null;
      }
      setStatus("disconnected");
      scheduleRestart();
      console.warn(
        "[realtime] Could not connect to the dashboard hub; retrying in the background.",
        error,
      );
    })
    .finally(() => {
      starting = null;
    });

  return starting;
}

export function stopRealtime(): void {
  stopped = true;
  clearRestart();
  restartAttempt = 0;

  dataChangedHandlers.clear();
  statusHandlers.clear();
  starting = null;

  const hub = connection;
  connection = null;
  setStatus("disconnected");

  if (hub) {
    void hub.stop().catch(() => undefined);
  }
}

/**
 * Registers a handler for the `DataChanged` event. Returns an unsubscribe function.
 * Handlers registered before the connection starts are kept and invoked once it does.
 */
export function onDataChanged(handler: DataChangedHandler): () => void {
  dataChangedHandlers.add(handler);
  return () => {
    dataChangedHandlers.delete(handler);
  };
}

/** Registers a handler for connection status changes (offline indicator). */
export function onStatusChanged(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  try {
    handler(status);
  } catch {
    // ignore
  }
  return () => {
    statusHandlers.delete(handler);
  };
}

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/**
 * Whether the client can rely on the socket rather than the poll. Used to skip the
 * safety-net interval when the socket is healthy, so a working setup does not pay for
 * both.
 */
export function isRealtimeHealthy(): boolean {
  return connection?.state === HubConnectionState.Connected;
}

/**
 * Whether the socket is connected, or is on its way there and has not yet given up.
 *
 * The watchdog in appData treats this as "not worth interrupting" so a reconnect that is
 * merely slow does not get restarted underneath itself, which would reset the backoff and
 * could otherwise loop.
 */
export function isRealtimeRecovering(): boolean {
  return (
    connection?.state === HubConnectionState.Connecting ||
    connection?.state === HubConnectionState.Reconnecting
  );
}

/** How many consecutive self-heal attempts have failed. Exposed for diagnostics. */
export function getRealtimeRestartAttempt(): number {
  return restartAttempt;
}
