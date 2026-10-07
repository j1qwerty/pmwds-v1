import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export type BrowserMode = "headless" | "headed";

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
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: {
      dir: path.join(runDir, "video"),
      size: { width: 1440, height: 1000 },
    },
  });

  await mkdir(path.join(runDir, "network"), { recursive: true });

  const networkLog: string[] = [];
  const push = (event: string) => {
    networkLog.push(`${new Date().toISOString()} ${event}`);
  };

  context.on("request", (request) => {
    push(
      `REQUEST ${request.method()} ${request.url()}`,
    );
  });

  context.on("response", async (response) => {
    push(
      `RESPONSE ${response.status()} ${response.request().method()} ${response.url()}`,
    );
  });

  context.on("requestfailed", (request) => {
    push(
      `FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });

  const flush = async () => {
    await mkdir(path.join(runDir, "network"), { recursive: true });
    const destination = path.join(
      runDir,
      "network",
      `network-${Date.now()}.log`,
    );
    await Bun.write?.(destination, networkLog.join("\n")).catch?.(() => {});
  };

  const page = await context.newPage();
  return { context, page };
}
