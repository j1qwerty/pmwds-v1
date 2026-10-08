import type { NotificationItem } from "../types";

/**
 * Where a notification click should take the user.
 *
 * The server stores a path in `ActionUrl`, but not every stored value maps to a route that
 * exists today. Seeded and historic rows can point at `/tasks` with no id, or at a project that
 * was since deleted. Sending the browser to an unrouted path just renders the "no access" page,
 * which reads as "clicking notifications is broken".
 *
 * So targets are resolved here, in one place, and anything that cannot be resolved to a real
 * destination falls back to a page that always exists.
 */
export type NotificationTarget =
  | { kind: "task"; taskId: string }
  | { kind: "path"; path: string }
  | { kind: "none" };

/** Routes the client actually serves. Anything outside these is treated as unroutable. */
const KNOWN_PATHS: RegExp[] = [
  /^\/$/,
  /^\/projects$/,
  /^\/projects\/[^/]+$/,
  /^\/projects\/[^/]+\/(overview|milestones|tasks|documents|dependencies)$/,
  /^\/notificationsPage$/,
  /^\/organizationStructure$/,
  /^\/departmentsPage$/,
  /^\/users$/,
  /^\/profiles$/,
  /^\/skills$/,
  /^\/ai$/,
  /^\/reports$/,
  /^\/reports\/view$/,
  /^\/roles$/,
  /^\/activity-logs$/,
  /^\/settings$/,
];

function isKnownPath(path: string) {
  return KNOWN_PATHS.some((pattern) => pattern.test(path));
}

/**
 * A notification with no usable target should still be acknowledgeable, so callers get
 * `{ kind: "none" }` and stay where they are instead of being navigated to a dead page.
 */
export function resolveNotificationTarget(item: NotificationItem): NotificationTarget {
  const raw = item.actionUrl?.trim();
  if (!raw) return { kind: "none" };

  // Absolute URLs pointing at another host are not ours to navigate.
  if (/^https?:\/\//i.test(raw)) return { kind: "none" };

  // "/tasks/{id}" is a notification-only shorthand: the task page lives under its project, so the
  // project id has to be resolved with an API call before the route exists.
  const taskShorthand = /^\/tasks\/([^/?#]+)/.exec(raw);
  if (taskShorthand) {
    return { kind: "task", taskId: taskShorthand[1] };
  }

  // Strip the query string before matching; ?taskId=... does not change the route.
  const [pathname] = raw.split("?");
  const path = pathname.replace(/\/+$/, "") || "/";

  return isKnownPath(path) ? { kind: "path", path: raw } : { kind: "none" };
}
