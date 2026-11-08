import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin adjusts the tolerance of the 100 m", async ({ page }) => {
  const before = sql("select tolerance from disciplines where name = '100 m'");
  const player = newPlayer("tolerance");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await page.getByRole("link", { name: "Disciplines" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Disciplines");
  const field = page.getByLabel("Tolérance du 100 m", { exact: true });
  await field.fill("0,03");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("✓ Enregistré")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Tolérance du 100 m", { exact: true })).toHaveValue("0.03");

  sql(`update disciplines set tolerance = ${before} where name = '100 m'`);
});
