import type { Page, Locator, Request, Response } from "playwright";
import type { Attributes, Entry, MapFile } from "./mapfile.js";
import { findEntry, listEntries } from "./mapfile.js";

/** Thrown when a map entry cannot be located in the DOM. */
export class SelectorError extends Error {
  constructor(
    public entry: Entry,
    public tried: string[],
    public hint?: string,
  ) {
    super(
      `Could not find ${entry.kind} "${entry.key}" (group "${entry.group}").\n` +
        `  Tried: ${tried.join(" | ")}\n` +
        (hint ? `  Hint: ${hint}\n` : "") +
        `  Map entry: ${entry.page}:${entry.line}`,
    );
    this.name = "SelectorError";
  }
}

export interface DriverOptions {
  /** Directory for screenshots. */
  shotDir?: string;
  /** Log every action. */
  verbose?: boolean;
  /** Origin that relative routes like "/projects" resolve against. */
  baseUrl?: string;
}

/**
 * Turns map entries into real browser actions. The driver prefers stable
 * handles from the map attributes and only falls back to positional/heuristic
 * selectors when the map does not give one, so a map edit is enough to fix a
 * broken test.
 */
export class Driver {
  private netLog: Array<{ method: string; url: string; status: number }> = [];
  /** Origin used to turn a relative route into an absolute URL. */
  private baseUrl: string;

  constructor(
    public page: Page,
    public maps: MapFile[],
    private opts: DriverOptions = {},
  ) {
    this.baseUrl = opts.baseUrl ?? "http://localhost:5175";
  }

  // ---------------------------------------------------------------- locator

  /**
   * Builds a locator for an entry from its attributes. Attribute priority:
   * css > testid > aria > title > placeholder > role+name > label > text.
   */
  private build(entry: Entry, extra: Attributes = {}): Locator {
    const a: Attributes = { ...entry.attrs, ...extra };
    // `root` narrows the search; a Page and a Locator expose the same getBy*
    // family, so either can be the search scope.
    const root: Page | Locator = a.root ? this.page.locator(a.root) : this.page;
    const tried: string[] = [];
    const push = (l: Locator, note: string) => {
      tried.push(note);
      return l;
    };

    let loc: Locator | null = null;

    if (a.css) {
      loc = push(root.locator(a.css), `css=${a.css}`);
      return loc;
    }
    if (a.byLabel) {
      // The client renders fields as <div><label>Text</label><input/></div>
      // with no htmlFor, so getByLabel cannot work. Locate the wrapper div by
      // its label text and take the control inside it. This survives field
      // reordering, unlike a positional nth.
      const wrapper = root.locator(`div:has(> label:has-text(${JSON.stringify(a.byLabel)}))`);
      loc = push(
        wrapper.locator("input, select, textarea").first(),
        `byLabel=${a.byLabel}`,
      );
      return loc;
    }
    if (a.testid) {
      loc = push(root.getByTestId(a.testid), `testid=${a.testid}`);
      return loc;
    }
    if (a.aria) {
      loc = push(root.getByLabel(a.aria, { exact: a.exact === "1" }), `aria-label=${a.aria}`);
      return loc;
    }
    if (a.title) {
      loc = push(root.getByTitle(a.title, { exact: a.exact === "1" }), `title=${a.title}`);
      return loc;
    }
    if (a.placeholder) {
      loc = push(
        root.getByPlaceholder(a.placeholder, { exact: a.exact === "1" }),
        `placeholder=${a.placeholder}`,
      );
      return loc;
    }
    if (a.role && a.name) {
      loc = push(
        root.getByRole(a.role as never, { name: a.name, exact: a.exact === "1" }),
        `role=${a.role} name=${a.name}`,
      );
      return loc;
    }
    if (a.label) {
      loc = push(root.getByLabel(a.label, { exact: a.exact === "1" }), `label=${a.label}`);
      return loc;
    }
    if (a.text) {
      loc = push(root.getByText(a.text, { exact: a.exact === "1" }), `text=${a.text}`);
      return loc;
    }

    // No handle in the map. Fall back to the entry kind and report it, because
    // this is the case that makes tests brittle.
    throw new SelectorError(entry, ["no selector attribute on the map entry"]);
  }

  /**
   * Locates an entry, applying nth/role fallbacks and failing with a useful
   * error listing everything that was attempted.
   */
  async locate(entry: Entry, extra: Attributes = {}): Promise<Locator> {
    const a: Attributes = { ...entry.attrs, ...extra };
    let loc: Locator;
    try {
      loc = this.build(entry, a);
    } catch (err) {
      throw err;
    }

    // Try each nth candidate when `nth` is specified: "0,1" means first try
    // the first match, then the second. Useful for repeated selects.
    const nthSpec = a.nth ?? "0";
    const candidates = nthSpec.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
    const tried: string[] = [];

    for (const n of candidates) {
      const target = n === 0 ? loc.first() : loc.nth(n);
      tried.push(`nth=${n}`);
      if ((await target.count()) > 0) {
        // Hover-only buttons (opacity-0 group-hover) still need a hover.
        if (a.hover === "1") {
          const host = n === 0 ? loc.first() : loc.nth(n);
          await host.hover({ timeout: 2000 }).catch(() => undefined);
        }
        return target;
      }
    }

    throw new SelectorError(
      entry,
      [describeLocator(loc), ...tried],
      a.hover === "1" ? "the control may only be reachable after hovering its row" : undefined,
    );
  }

  // ---------------------------------------------------------------- actions

  /** Fills a text-like field. `value` may come from the map or from extra. */
  async fill(key: string, value?: string, group?: string, extra: Attributes = {}) {
    const entry = this.require("field", key, group);
    const val = value ?? extra.value ?? entry.attrs.value ?? "";
    const loc = await this.locate(entry, extra);
    await loc.scrollIntoViewIfNeeded();
    await loc.fill(String(val));
    this.log(`fill "${key}" = ${val}`);
    return loc;
  }

  /** Selects an option in a native <select> by visible label. */
  async select(key: string, label: string, group?: string, extra: Attributes = {}) {
    const entry = this.require("field", key, group);
    const loc = await this.locate(entry, extra);
    await loc.scrollIntoViewIfNeeded();
    await loc.selectOption({ label });
    this.log(`select "${key}" = ${label}`);
    return loc;
  }

  /** Checks a checkbox or radio, or clicks a toggle when it is already set. */
  async toggle(key: string, want = true, group?: string, extra: Attributes = {}) {
    const entry = this.require("field", key, group);
    const loc = await this.locate(entry, extra);
    await loc.scrollIntoViewIfNeeded();
    if (extra.force === "1") {
      await loc.click({ force: true });
    } else {
      await loc.setChecked(want);
    }
    this.log(`toggle "${key}" = ${want}`);
    return loc;
  }

  /** Sets a file input's contents. `paths` are absolute or relative paths. */
  async upload(key: string, paths: string[], group?: string, extra: Attributes = {}) {
    const entry = this.require("field", key, group);
    const loc = await this.locate(entry, extra);
    await loc.setInputFiles(paths);
    this.log(`upload "${key}" <- ${paths.join(", ")}`);
    return loc;
  }

  /** Clicks a button or link described by a map entry. */
  async click(key: string, group?: string, extra: Attributes = {}) {
    const entry = this.require("button", key, group);
    const loc = await this.locate(entry, extra);
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: extra.timeout ? Number(extra.timeout) : undefined });
    this.log(`click "${key}"`);
    return loc;
  }

  /** Navigates using a `nav` entry (or a raw route string). */
  async nav(key: string, group?: string, extra: Attributes = {}) {
    const entry = listEntries(this.maps, "nav", group).find((e) => e.key === key);
    let route: string | undefined;
    if (entry) {
      const loc = await this.locate({ ...entry, kind: "nav" }, extra);
      await loc.scrollIntoViewIfNeeded();
      await loc.click();
      this.log(`nav "${key}"`);
    } else {
      route = extra.route;
      if (!route) throw new Error(`No nav entry or route for "${key}"`);
      await this.page.goto(route);
      this.log(`goto ${route}`);
    }
    await this.settle();
    return undefined;
  }

  /** Direct route navigation, for pages with a stable URL. */
  async goto(route: string) {
    // Accept both "/projects" and a full URL; Playwright needs absolute.
    const url = /^https?:\/\//i.test(route) ? route : new URL(route, this.baseUrl).toString();
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    this.log(`goto ${url}`);
    await this.settle();
  }

  /** Waits for text to appear (default 10s, shorter toasts 3s). */
  async expectText(key: string, group?: string, timeout?: number) {
    const entry = this.require("assert", key, group);
    const text = entry.attrs.text ?? entry.key;
    const loc = this.page.getByText(text, { exact: entry.attrs.exact === "1" });
    await loc.first().waitFor({ state: "visible", timeout: timeout ?? 10000 });
    this.log(`saw text "${text}"`);
    return loc;
  }

  /** Waits for an API response matching an `api` entry. */
  async waitApi(key: string, group?: string, timeout = 20000) {
    const entry = this.require("api", key, group);
    const path = entry.attrs.path ?? "";
    const method = (entry.attrs.method ?? "GET").toUpperCase();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => matchesResponse(r, method, path, entry.attrs),
        { timeout },
      ),
      this.log(`waiting for ${method} ${path}`),
    ]);
    this.log(`<- ${method} ${path} ${response.status()}`);
    return response;
  }

  /** Clicks a button and waits for the API call it triggers, in one step. */
  async clickAndWait(key: string, group?: string, apiKey?: string, extra: Attributes = {}) {
    const api = apiKey ? this.require("api", apiKey, group) : undefined;
    if (!api) {
      await this.click(key, group, extra);
      await this.settle();
      return undefined;
    }
    const [response] = await Promise.all([
      this.waitApi(apiKey!, group),
      this.click(key, group, extra),
    ]);
    await this.settle();
    return response;
  }

  // ----------------------------------------------------------------- helpers

  require(kind: Entry["kind"], key: string, group?: string): Entry {
    const entry = findEntry(this.maps, kind, key, group);
    if (!entry) {
      const known = listEntries(this.maps, kind)
        .map((e) => e.key)
        .join(", ");
      throw new Error(`No ${kind} "${key}" in the maps. Known: ${known}`);
    }
    return entry;
  }

  /** Waits for the network to go quiet and any spinner to clear. */
  async settle(timeout = 15000) {
    await this.page
      .waitForLoadState("networkidle", { timeout })
      .catch(() => undefined);
    // The app renders a full-page loader while workspace permissions resolve.
    await this.page
      .getByText("Loading workspace permissions...")
      .waitFor({ state: "hidden", timeout: 5000 })
      .catch(() => undefined);
  }

  /** Starts recording every request/response for later assertions. */
  watchNetwork() {
    this.netLog = [];
    this.page.on("request", (req: Request) => this.note("req", req));
    this.page.on("response", (res: Response) => this.note("res", res));
  }

  private note(_kind: "req" | "res", res: Request | Response) {
    // A Response carries the method on its request, not on itself.
    const method = "method" in res ? res.method() : res.request().method();
    const rec = {
      method,
      url: res.url(),
      status: "status" in res ? res.status() : 0,
    };
    this.netLog.push(rec);
    if (this.netLog.length > 500) this.netLog.shift();
  }

  /** Requests seen since watchNetwork() started, for reporting. */
  network(): Array<{ method: string; url: string; status: number }> {
    return [...this.netLog];
  }

  /** Failed (4xx/5xx) API calls since watchNetwork() started. */
  apiFailures(): Array<{ method: string; url: string; status: number }> {
    return this.netLog.filter((r) => r.status >= 400);
  }

  private log(msg: string) {
    if (this.opts.verbose !== false) console.log(`    ${msg}`);
  }
}

function describeLocator(loc: Locator): string {
  try {
    // Locator internals differ across Playwright versions; this is best effort
    // purely for the error message.
    const s = String(loc);
    return s.length > 160 ? `${s.slice(0, 160)}...` : s;
  } catch {
    return "locator";
  }
}

function matchesResponse(r: Response, method: string, path: string, attrs: Attributes): boolean {
  if (path && !r.url().includes(path)) return false;
  if (attrs.method && r.request().method() !== method) return false;
  const status = attrs.status;
  if (status && r.status() !== Number(status)) return false;
  return true;
}