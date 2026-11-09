import type { Page } from "@playwright/test";

/** The back-office menu: a drop-down on a phone, opened before following one of its sections. */
export function adminMenu(page: Page) {
  return page.getByRole("navigation", { name: "Sections du back-office" });
}

export async function openAdminSection(page: Page, name: string) {
  const menu = adminMenu(page);
  const toggle = menu.locator("summary");
  if (await toggle.isVisible()) await toggle.click();
  await menu.getByRole("link", { name: new RegExp(`^${name}`) }).click();
}
