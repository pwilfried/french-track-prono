import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin validates a club typed by a player, then renames it", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const typed = `Foulees Zclub ${tag}`;
  const fixed = `Foulées du Val ${tag}`;
  const admin = newPlayer("clubs");
  await page.goto("/profil");
  await signUp(page, admin);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);
  sql(`insert into clubs (name, city, source) values ('${typed}', 'Nulle-Part', 'player')`);

  await page.goto("/admin/clubs");
  const list = page.getByRole("list", { name: "Clubs" });
  const row = list.getByRole("listitem").filter({ hasText: typed });
  await expect(row).toContainText("À valider");
  await row.getByRole("button", { name: "Valider" }).click();
  // Validated, it leaves the list of clubs to validate.
  await expect(row).toHaveCount(0);

  await page.goto(`/admin/clubs?q=${encodeURIComponent(typed)}`);
  const found = list.getByRole("listitem").filter({ hasText: typed });
  await expect(found).not.toContainText("À valider");
  await found.getByText("Modifier").click();
  await found.getByLabel("Nom").fill(fixed);
  await found.getByRole("button", { name: "Enregistrer" }).click();
  // Renamed, it no longer matches the search.
  await expect(found).toHaveCount(0);
  await page.goto(`/admin/clubs?q=${encodeURIComponent(fixed)}`);
  await expect(list.getByRole("listitem").filter({ hasText: fixed })).toBeVisible();

  expect(sql(`select validated from clubs where name = '${fixed}'`)).toBe("t");
  sql(`delete from clubs where name = '${fixed}'`);
});
