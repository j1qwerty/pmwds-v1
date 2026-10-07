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
  await field.selectOption({ label: value }).catch(async () => {
    await field.selectOption(value);
  });
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

export async function openProjectByName(
  page: Page,
  projectName: string,
): Promise<string> {
  const projectMatches = page.getByText(projectName, { exact: true });
  const project = await visibleLocator(projectMatches, `project "${projectName}"`);
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
