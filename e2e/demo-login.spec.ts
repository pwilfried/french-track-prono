import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

// Pre-production only (#637): playwright.config.ts starts the app with PREPROD_DEMO_LOGIN=1.
test("an admin of pre-production signs in as a demo player, then comes back to their account", async ({
  page,
  browser,
}) => {
  // A demo player: every invented player of the tests is on example.test.
  const demo = newPlayer("demo");
  const demoPage = await (await browser.newContext()).newPage();
  await demoPage.goto("/connexion");
  await signUp(demoPage, demo);

  // A player who is not an admin finds no such page.
  const notFound = await demoPage.goto("/admin/joueurs-demo");
  expect(notFound?.status()).toBe(404);
  await expect(demoPage.getByRole("list", { name: "Joueurs démo" })).toHaveCount(0);

  const admin = newPlayer("as");
  await page.goto("/connexion");
  await signUp(page, admin);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);

  await page.goto("/admin/joueurs-demo");
  const list = page.getByRole("list", { name: "Joueurs démo" });
  // Admins are not in the list, the admin themselves included.
  await expect(list.getByText(admin.pseudo)).toHaveCount(0);
  await list.getByRole("button", { name: `Se connecter en tant que ${demo.pseudo}` }).click();

  await page.waitForURL((url) => url.pathname === "/");
  const banner = page.getByRole("region", { name: "Session de démo" });
  await expect(banner).toContainText(`Tu joues en tant que ${demo.pseudo}`);
  // Now the demo player: the back-office is closed to them.
  expect((await page.goto("/admin/joueurs-demo"))?.status()).toBe(404);
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Revenir à mon compte" }).click();
  await page.waitForURL(/\/admin\/joueurs-demo$/);
  await expect(page.getByRole("list", { name: "Joueurs démo" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Session de démo" })).toHaveCount(0);

  sql(`delete from auth.users where email in ('${demo.email}', '${admin.email}')`);
});
