import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const requestedMode = process.argv[2] === "automatic" ? "automatic" : "interactive";

  console.log("");
  console.log("PMWDS browser test runner");
  console.log("-------------------------");
  console.log("");
  console.log("Browser mode");
  console.log("  1. Headless (default)");
  console.log("  2. Visible Chromium");
  const browserChoice = await prompt("Choice [1]: ");
  const browserMode = browserChoice === "2" ? "headed" : "headless";

  console.log("");
  console.log("Run mode");
  console.log("  1. Interactive");
  console.log("  2. Automatic");
  const runChoice =
    requestedMode === "automatic"
      ? "2"
      : await prompt("Choice [1]: ");

  console.log("");
  console.log(
    `Selected: ${browserMode} browser, ${runChoice === "2" ? "automatic" : "interactive"} runner.`,
  );
  console.log("The complete business-flow registry is added in the browser-flow PR.");
  console.log("For the current foundation, use the discovery command:");
  console.log("  pnpm --dir browser-tests e2e:discover");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
