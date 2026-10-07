import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

type DiscoveredElement = {
  tag: string;
  role: string | null;
  text: string;
  label: string | null;
  placeholder: string | null;
  name: string | null;
  id: string | null;
  type: string | null;
  ariaLabel: string | null;
  href: string | null;
  disabled: boolean;
  group: string;
};

export type PageInventory = {
  title: string;
  url: string;
  forms: string[];
  groups: Record<string, DiscoveredElement[]>;
};

export async function discoverPage(page: Page): Promise<PageInventory> {
  const elements = await page.locator("input, textarea, select, button, a").evaluateAll(
    (nodes) =>
      nodes
        .filter((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        })
        .map((node) => {
          const element = node as HTMLElement;
          const nearest =
            element.closest("form, [role=dialog], dialog, section, article") ??
            element.parentElement;

          const heading = nearest?.querySelector("h1,h2,h3,h4,h5,h6");
          const labelElement =
            element.closest("label") ??
            (element.id
              ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
              : null);

          return {
            tag: element.tagName.toLowerCase(),
            role: element.getAttribute("role"),
            text: (element.innerText || element.textContent || "").trim(),
            label: labelElement?.textContent?.trim() || null,
            placeholder: element.getAttribute("placeholder"),
            name: element.getAttribute("name"),
            id: element.id || null,
            type: element.getAttribute("type"),
            ariaLabel: element.getAttribute("aria-label"),
            href: element.getAttribute("href"),
            disabled:
              (element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement)
                .disabled ?? false,
            group:
              heading?.textContent?.trim() ||
              nearest?.getAttribute("aria-label") ||
              nearest?.getAttribute("role") ||
              "Page",
          };
        }),
  );

  const forms = await page.locator("form").evaluateAll((nodes) =>
    nodes.map((node) => ({
      action: node.getAttribute("action") || "",
      method: node.getAttribute("method") || "get",
      heading:
        node.querySelector("h1,h2,h3,h4,h5,h6")?.textContent?.trim() || "Form",
    })),
  );

  const groups: Record<string, DiscoveredElement[]> = {};
  for (const element of elements) {
    const key = element.group || "Page";
    (groups[key] ??= []).push(element);
  }

  return {
    title: await page.title(),
    url: page.url(),
    forms: forms.map(
      (form) => `${form.heading} [${form.method.toUpperCase()} ${form.action}]`,
    ),
    groups,
  };
}

export async function writeInventory(
  outputDir: string,
  fileName: string,
  inventory: PageInventory,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const destination = path.join(outputDir, fileName);

  const sections = Object.entries(inventory.groups)
    .map(([group, elements]) => {
      const lines = [
        `## ${group}`,
        "",
        "Detected controls:",
      ];

      for (const element of elements) {
        const parts = [
          element.tag.toUpperCase(),
          element.role ? `role=${element.role}` : null,
          element.type ? `type=${element.type}` : null,
          element.name ? `name=${element.name}` : null,
          element.id ? `id=${element.id}` : null,
          element.label ? `label=${element.label}` : null,
          element.placeholder ? `placeholder=${element.placeholder}` : null,
          element.ariaLabel ? `aria-label=${element.ariaLabel}` : null,
          element.href ? `href=${element.href}` : null,
          element.disabled ? "DISABLED" : null,
        ].filter(Boolean);

        const text = element.text ? ` text="${element.text.replace(/\s+/g, " ")}"` : "";
        lines.push(`- ${parts.join(" ")}${text}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  const content = [
    `# PMWDS UI inventory: ${fileName}`,
    "",
    `URL: ${inventory.url}`,
    `Title: ${inventory.title}`,
    "",
    "## Forms",
    "",
    ...(inventory.forms.length
      ? inventory.forms.map((form) => `- ${form}`)
      : ["- None detected"]),
    "",
    sections || "No visible controls detected.",
    "",
  ].join("\n");

  await writeFile(destination, content, "utf8");
  return destination;
}
