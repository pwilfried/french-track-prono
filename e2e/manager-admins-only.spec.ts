import { expect, test } from "@playwright/test";

import { newPlayer, openManagerTo, signUp } from "./players";

test("a player who is not an admin sees no Manager, an admin does", async ({ page }) => {
  const player = newPlayer("no-manager");
  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);

  // Four tabs, no Manager anywhere: neither in the bar, nor on the home.
  const bar = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(bar.getByRole("link")).toHaveCount(4);
  await expect(bar.getByRole("link", { name: "Manager", exact: true })).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.locator("main").getByRole("heading", { name: "French Track Manager" }),
  ).toHaveCount(0);
  await expect(page.locator("main").locator('a[href^="/manager"]')).toHaveCount(0);

  // The Manager pages are not found.
  for (const path of ["/manager", "/manager/creer", "/manager/rejoindre"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }

  // An admin sees the Manager tab, and the Manager.
  openManagerTo(player);
  await page.goto("/");
  await expect(bar.getByRole("link")).toHaveCount(5);
  await bar.getByRole("link", { name: "Manager", exact: true }).click();
  await page.waitForURL(/\/manager$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("French Track Manager");
});
