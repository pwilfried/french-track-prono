import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin adjusts the points of a mark within the tolerance", async ({ page }) => {
  const before = sql("select value from scoring_rules where key = 'mark_exact'");
  const player = newPlayer("bareme");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  // An admin only sees the back-office: the home page leads there.
  await page.goto("/");
  await expect(page).toHaveURL(/\/admin\/competitions$/);
  // Every section of the back-office is one tap away, as on the board.
  await expect(
    page.getByRole("navigation", { name: "Sections du back-office" }).getByRole("link"),
  ).toHaveCount(6);
  // Only the admin interface: no player navigation, and a way out.
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await page.getByRole("link", { name: "Barème" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Barème");
  const field = page.getByLabel("Perf dans la tolérance", { exact: true });
  await field.fill("6");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Enregistré");
  expect(sql("select value from scoring_rules where key = 'mark_exact'")).toBe("6");

  // A value that is not positive is refused.
  await field.fill("0");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("nombre positif");

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choisis ta compétition");

  sql(`update scoring_rules set value = ${before} where key = 'mark_exact'`);
});
