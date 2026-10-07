import { expect, type Locator, type Page } from "@playwright/test";

export async function fillLabel(
  page: Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  const field = page.getByLabel(label).first();
  await field.waitFor({ state: "visible" });
  await field.fill(value);
}

export async function fillPlaceholder(
  page: Page,
  placeholder: string | RegExp,
  value: string,
): Promise<void> {
  const field = page.getByPlaceholder(placeholder).first();
  await field.waitFor({ state: "visible" });
  await field.fill(value);
}

export async function selectLabel(
  page: Page,
  label: string | RegExp,
  value: string,
): Promise<void> {
  const field = page.getByLabel(label).first();
  await field.waitFor({ state: "visible" });
  await field.selectOption({ label: value }).catch(async () => {
    await field.selectOption(value);
  });
}

export async function selectAnyOption(
  page: Page,
  optionText: string,
): Promise<void> {
  const select = page.locator("select").filter({ hasText: optionText }).first();
  await select.waitFor({ state: "visible" });
  await select.selectOption({ label: optionText });
}

export async function clickButton(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  const button = page.getByRole("button", { name }).first();
  await button.waitFor({ state: "visible" });
  await button.click();
}

export async function expectButtonHidden(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  await expect(page.getByRole("button", { name }).first()).toBeHidden();
}

export async function clickTitle(page: Page, title: string): Promise<void> {
  const button = page.locator(`button[title="${title}"]`).first();
  await button.waitFor({ state: "visible" });
  await button.click();
}

export async function uploadFirstFile(
  page: Page,
  filePath: string,
): Promise<void> {
  const file = page.locator('input[type="file"]').first();
  await file.waitFor({ state: "visible" });
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
  if (await checkbox.isVisible()) {
    if (!(await checkbox.isChecked())) await checkbox.check();
  } else {
    await row.click();
  }
}

export async function openProjectByName(
  page: Page,
  projectName: string,
): Promise<string> {
  const project = page.getByText(projectName, { exact: true }).last();
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
  const next = page.getByRole("button", { name: /^Next$/ }).last();
  await next.waitFor({ state: "visible" });
  await next.click();
}

export async function clickFinishWizard(page: Page): Promise<void> {
  const finish = page.getByRole("button", { name: /^Finish$/ }).last();
  await finish.waitFor({ state: "visible" });
  await finish.click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+/i, { timeout: 60_000 });
}
