import { expect, test } from "@playwright/test";

test("offline, a visitor reopens a page already seen and gets the offline page elsewhere", async ({
  page,
  context,
}) => {
  await page.goto("/epreuves/f-100m");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Seen again once the service worker controls the page, so it keeps a copy.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto("/epreuves/f-100m");

  await context.setOffline(true);
  await page.goto("/epreuves/f-100m");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toContainText("Melissa Jefferson-Wooden");

  await page.goto("/epreuves/m-400m");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pas de réseau");

  await context.setOffline(false);
});
