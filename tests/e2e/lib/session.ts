import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { Driver } from "./driver.js";
import type { MapFile } from "./mapfile.js";

export interface Account {
  /** Short id used on the command line, e.g. `pm`. */
  id: string;
  label: string;
  email: string;
  password: string;
  role: string;
}

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

/** Lets the runner apply a --url override; call before starting a hub. */
let baseUrl = BASE_URL;
export function setBaseUrl(url: string) {
  baseUrl = url;
}
export function getBaseUrl(): string {
  return baseUrl;
}

/** Seeded accounts, from the login page's demo list and the API seeder. */
export const ACCOUNTS: Account[] = [
  { id: "admin", label: "Admin / Director", email: "admin@org1.com", password: "Pmwds@123", role: "director" },
  { id: "pm", label: "Project Manager", email: "manager@org1.com", password: "Pmwds@123", role: "project-manager" },
  { id: "head-civil", label: "Head - Civil Division", email: "head.eng@org1.com", password: "Pmwds@123", role: "department-head" },
  { id: "head-pmo", label: "Head - PWD Coordination", email: "head.pmo@org1.com", password: "Pmwds@123", role: "department-head" },
  { id: "head-ops", label: "Head - Procurement", email: "head.ops@org1.com", password: "Pmwds@123", role: "department-head" },
  { id: "head-revenue", label: "Head - Revenue Dept", email: "head.bstr@org1.com", password: "Pmwds@123", role: "department-head" },
  { id: "head-qa", label: "Head - Quality Assurance", email: "head.csv@org1.com", password: "Pmwds@123", role: "department-head" },
  { id: "head-tehsildar", label: "Head - Tehsildar", email: "sunil.yadav@up.gov.in", password: "Pmwds@123", role: "department-head" },
  { id: "member", label: "Team Member", email: "member@org1.com", password: "Pmwds@123", role: "team-member" },
  { id: "viewer", label: "Viewer", email: "viewer@org1.com", password: "Pmwds@123", role: "viewer" },
  { id: "ee", label: "Executive Engineer", email: "dinesh.kumar@pwd.up.gov.in", password: "Pmwds@123", role: "team-member" },
  { id: "electrical", label: "Electrical", email: "suresh.pandey@up.gov.in", password: "Pmwds@123", role: "team-member" },
  { id: "sewerage", label: "Sewerage", email: "ramesh.yadav@up.gov.in", password: "Pmwds@123", role: "team-member" },
  { id: "superadmin", label: "Super Admin", email: "superadmin@org1.com", password: "Pmwds@123", role: "superadmin" },
];

export function accountById(id: string): Account {
  const hit = ACCOUNTS.find((a) => a.id === id);
  if (!hit) {
    throw new Error(`Unknown user "${id}". Known: ${ACCOUNTS.map((a) => a.id).join(", ")}`);
  }
  return hit;
}

/**
 * One browser, one isolated BrowserContext per signed-in user. Sessions are
 * created lazily and reused across steps, so the flow can flip between roles
 * without re-entering passwords, exactly like a multi-user test would.
 */
export class SessionHub {
  private browser?: Browser;
  private contexts = new Map<string, BrowserContext>();
  private drivers = new Map<string, Driver>();

  constructor(
    private maps: MapFile[],
    private opts: { headless?: boolean; slowMo?: number } = {},
  ) {}

  /**
   * Headless is the default: no browser window appears unless the run was
   * started in visible mode. `slowMo` only matters in visible mode.
   */
  async start() {
    this.browser = await chromium.launch({
      headless: this.opts.headless ?? true,
      slowMo: this.opts.slowMo ?? 0,
    });
  }

  async close() {
    for (const ctx of this.contexts.values()) await ctx.close().catch(() => undefined);
    this.contexts.clear();
    this.drivers.clear();
    await this.browser?.close();
  }

  /** Returns a logged-in driver for an account, signing in on first use. */
  async as(accountId: string): Promise<Driver> {
    const account = accountById(accountId);
    const existing = this.drivers.get(accountId);
    if (existing) return existing;

    const context = await this.browser!.newContext({
      viewport: { width: 1600, height: 1000 },
    });
    this.contexts.set(accountId, context);
    const page = await context.newPage();

    const driver = new Driver(page, this.maps, { verbose: true, baseUrl: getBaseUrl() });
    driver.watchNetwork();
    this.drivers.set(accountId, driver);

    await driver.goto(`${getBaseUrl()}/login`);
    await this.signIn(driver, account.email, account.password);
    return driver;
  }

  /** The already-signed-in driver without creating one. */
  driver(accountId: string): Driver {
    const d = this.drivers.get(accountId);
    if (!d) throw new Error(`User "${accountId}" has not signed in yet. Call hub.as() first.`);
    return d;
  }

  /** Signs a fresh context in. Used when a user must sign out and back in. */
  async reauth(accountId: string): Promise<Driver> {
    await this.contexts.get(accountId)?.close().catch(() => undefined);
    this.contexts.delete(accountId);
    this.drivers.delete(accountId);
    return this.as(accountId);
  }

  /** Opens a second tab for a user, keeping the first alive. */
  async newTab(accountId: string): Promise<Driver> {
    const context = this.contexts.get(accountId);
    if (!context) throw new Error(`User "${accountId}" has not signed in yet.`);
    const page: Page = await context.newPage();
    const driver = new Driver(page, this.maps, { verbose: true, baseUrl: getBaseUrl() });
    driver.watchNetwork();
    return driver;
  }

  async signIn(driver: Driver, email: string, password: string) {
    const page = driver.page;
    await page.locator("input[type='email']").fill(email);
    await page.locator("input[type='password']").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    // Successful sign-in leaves /login and lands on the dashboard.
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 30000,
      waitUntil: "domcontentloaded",
    });
    await driver.settle();
    console.log(`    signed in as ${email}`);
  }
}
