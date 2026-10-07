import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export type BrowserMode = "headless" | "headed";

export type BrowserResources = {
  context: BrowserContext;
  page: Page;
  flushNetwork: () => Promise<string>;
};

const MAX_PAYLOAD = 12_000;
const SECRET_KEYS = /password|token|authorization|secret|cookie|refresh/i;

function redactPayload(text: string): string {
  if (!text) return "";
  const compact = text.length > MAX_PAYLOAD
    ? `${text.slice(0, MAX_PAYLOAD)}... [truncated]`
    : text;

  try {
    const parsed: unknown = JSON.parse(compact);
    const redact = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(redact);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [
            key,
            SECRET_KEYS.test(key) ? "[REDACTED]" : redact(nested),
          ]),
        );
      }
      return value;
    };
    return JSON.stringify(redact(parsed));
  } catch {
    return compact
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
      .replace(/(password|token|secret|authorization)=([^&\s]+)/gi, "$1=[REDACTED]");
  }
}

export async function launchBrowser(mode: BrowserMode): Promise<Browser> {
  return chromium.launch({
    headless: mode !== "headed",
    args:
      mode === "headed"
        ? ["--start-maximized"]
        : ["--disable-dev-shm-usage"],
  });
}

export async function newContext(
  browser: Browser,
  runDir: string,
): Promise<BrowserResources> {
  await mkdir(path.join(runDir, "network"), { recursive: true });
  await mkdir(path.join(runDir, "video"), { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: {
      dir: path.join(runDir, "video"),
      size: { width: 1440, height: 1000 },
    },
  });

  const networkLog: string[] = [];
  const push = (event: string) => {
    networkLog.push(`${new Date().toISOString()} ${event}`);
  };

  context.on("request", (request) => {
    const payload = request.postData();
    push(
      [
        `REQUEST ${request.method()} ${request.url()}`,
        payload ? `  payload: ${redactPayload(payload)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  });

  context.on("response", async (response) => {
    let body = "";
    const contentType = response.headers()["content-type"] ?? "";
    if (
      contentType.includes("application/json") ||
      contentType.includes("text/")
    ) {
      body = await response.text().catch(() => "");
    }

    push(
      [
        `RESPONSE ${response.status()} ${response.request().method()} ${response.url()}`,
        body ? `  body: ${redactPayload(body)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  });

  context.on("requestfailed", (request) => {
    push(
      `FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });

  const flushNetwork = async (): Promise<string> => {
    const destination = path.join(
      runDir,
      "network",
      `network-${Date.now()}.log`,
    );
    await writeFile(destination, networkLog.join("\n"), "utf8");
    return destination;
  };

  const page = await context.newPage();
  return { context, page, flushNetwork };
}
