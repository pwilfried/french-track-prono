import type { Page } from "@playwright/test";

/**
 * The guide of the first mercato opens over the first catalogue of a device (#1037): a test that
 * is not about it marks it seen before the page loads, so it does not cover the catalogue.
 */
export async function skipFirstMercatoGuide(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("ftp:manager-first-mercato-seen", "1"));
}
