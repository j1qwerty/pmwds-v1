import { expect, type Locator, type Page } from "@playwright/test";

function byLabelContainer(
  page: Page,
  label: string | RegExp,
): Locator {
  const labels = page.locator("label").filter({ hasText: label });
  return labels
    .first()
    .locator("xpath=..")
    .locator("input, textarea, select")
    .first();
}

async function visibleLocator(
  locator: Locator,
  description: string,
): Promise<Locator> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  throw new Error(`Visible ${description} not found`);
}

export async function fillLabel(
  page: Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  const semantic = page.getByLabel(label);
  const field =
    (await semantic.count()) > 0
      ? await visibleLocator(semantic, `field "${String(label)}"`)
      : byLabelContainer(page, label);
  await field.waitFor({ state: "visible" });
  await field.fill(value);
}

export async function fillPlaceholder(
  page: Page,
  placeholder: string | RegExp,
  value: string,
): Promise<void> {
  const field = page.getByPlaceholder(placeholder);
  await visibleLocator(field, `placeholder "${String(placeholder)}"`);
  const visible = await visibleLocator(
    field,
    `placeholder "${String(placeholder)}"`,
  );
  await visible.fill(value);
}

export async function selectLabel(
  page: Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  const semantic = page.getByLabel(label);
  const field =
    (await semantic.count()) > 0
      ? await visibleLocator(semantic, `select "${String(label)}"`)
      : byLabelContainer(page, label);
  await field.waitFor({ state: "visible" });

  // Option labels are routinely decorated - the milestone dependency modal renders
  // "PWD Coordination Milestone (Not Started)" - so an exact match on the milestone
  // name alone never resolves. Resolve the option by prefix and select it by value,
  // which keeps callers passing the plain name.
  const prefixed = field
    .locator("option")
    .filter({ hasText: new RegExp(`^${escapeRegExp(value)}`) })
    .first();

  if ((await prefixed.count()) > 0) {
    const optionValue = await prefixed.getAttribute("value");
    if (optionValue !== null) {
      await field.selectOption(optionValue);
      return;
    }
  }

  await field
    .selectOption({ label: value })
    .catch(() => field.selectOption(value));
}

export async function selectAnyOption(
  page: Page,
  optionText: string,
): Promise<void> {
  const select = page.locator("select").filter({ hasText: optionText });
  const visible = await visibleLocator(select, `select containing "${optionText}"`);
  await visible.selectOption({ label: optionText });
}

export async function clickButton(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  const button = await visibleLocator(
    page.getByRole("button", { name }),
    `button "${String(name)}"`,
  );
  await button.click();
}

export async function expectButtonHidden(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  const buttons = page.getByRole("button", { name });
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    await expect(buttons.nth(index)).toBeHidden();
  }
}

export async function clickTitle(page: Page, title: string): Promise<void> {
  const button = await visibleLocator(
    page.locator(`button[title="${title}"]`),
    `button title "${title}"`,
  );
  await button.click();
}

export async function uploadFirstFile(
  page: Page,
  filePath: string,
): Promise<void> {
  const file = await visibleLocator(
    page.locator('input[type="file"]'),
    "file input",
  );
  await file.setInputFiles(filePath);
}

export async function clickDepartmentRow(
  page: Page,
  departmentName: string,
): Promise<void> {
  const row = page
    .locator("tr")
    .filter({ hasText: departmentName })
    .first();
  await row.waitFor({ state: "visible" });
  const checkbox = row.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible().catch(() => false)) {
    if (!(await checkbox.isChecked())) await checkbox.check();
  } else {
    await row.click();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The project card in the projects list.
 *
 * Matched by accessible name containing the project name rather than by exact
 * text. On the projects page the name is not its own element: the card button
 * concatenates progress, name, status, code, priority and departments into one
 * text node, so `getByText(name, { exact: true })` matches nothing there and only
 * ever resolved against the sidebar entry - which is not part of the list under
 * test. Scoped to <main> so the sidebar cannot satisfy the assertion.
 */
export async function projectCard(page: Page, projectName: string): Promise<Locator> {
  const name = new RegExp(escapeRegExp(projectName));
  const main = page.locator("main");
  if ((await main.count()) > 0) {
    return main.getByRole("button", { name }).first();
  }
  return page.getByRole("button", { name }).first();
}

export async function openProjectByName(
  page: Page,
  projectName: string,
): Promise<string> {
  const project = await projectCard(page, projectName);
  await project.waitFor({ state: "visible", timeout: 30_000 });
  await project.click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+/i, { timeout: 30_000 });
  const match = page.url().match(/\/projects\/([0-9a-f-]+)/i);
  if (!match) throw new Error(`Could not extract project id from ${page.url()}`);
  return match[1];
}

export async function waitForToast(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  await expect(page.getByText(text).last()).toBeVisible({ timeout: 15_000 });
}

export async function clickNextWizard(page: Page): Promise<void> {
  await clickButton(page, /^Next$/);
}

export async function clickFinishWizard(page: Page): Promise<void> {
  await clickButton(page, /^Finish$/);
  await page.waitForURL(/\/projects\/[0-9a-f-]+/i, { timeout: 60_000 });
}
