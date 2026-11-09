import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { adminMenu } from "./admin";
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
  // The menu counts the clubs waiting for the admin.
  await adminMenu(page).locator("summary").click();
  await expect(adminMenu(page).getByRole("link", { name: /^Clubs \d+ à traiter$/ })).toBeVisible();
  await adminMenu(page).locator("summary").click();

  const search = page.getByLabel("Nom ou ville");
  await search.fill(typed);
  const list = page.getByRole("list", { name: "Clubs" });
  const row = list.getByRole("listitem").filter({ hasText: typed });
  await expect(row).toContainText("À valider");
  // Grouped action: select, then validate.
  await row.getByRole("checkbox", { name: `Sélectionner ${typed}` }).check();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Club validé." })).toBeVisible();
  // Validated, it leaves the clubs to validate; the « Validés » chip shows it.
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: /^Validés · / }).click();
  await list.getByRole("button", { name: `Ouvrir ${typed}` }).click();

  // The detail panel: Entrée saves the new name.
  const panel = page.getByRole("complementary", { name: typed });
  await panel.getByLabel("Nom").fill(fixed);
  await panel.getByLabel("Nom").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Club enregistré." })).toBeVisible();
  expect(sql(`select validated from clubs where name = '${fixed}'`)).toBe("t");
  sql(`delete from clubs where name = '${fixed}'`);
});

test("the admin merges a typed club into the imported one and its player is told", async ({
  page,
  browser,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const typed = `AC Zmerge${tag}`;
  const real = `Athletic Club de Zmerge${tag}`;
  const player = newPlayer("merged");
  const admin = newPlayer("merger");
  sql(`insert into clubs (name, city, department, source, validated)
       values ('${real}', 'Zmerge${tag}', '92', 'import', true)`);

  // A player signs up with a club typed by hand.
  const playerPage = await (await browser.newContext()).newPage();
  await playerPage.goto("/profil");
  await signUp(playerPage, player);
  await playerPage.waitForURL(/\/profil$/);
  sql(`insert into clubs (name, city, department, source, created_by)
       select '${typed}', 'Zmerge${tag}', '92', 'player', id from profiles where pseudo = '${player.pseudo}'`);
  sql(`update profiles set club_id = (select id from clubs where name = '${typed}')
       where pseudo = '${player.pseudo}'`);

  await page.goto("/profil");
  await signUp(page, admin);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);
  await page.goto("/admin/clubs");
  await page.getByLabel("Nom ou ville").fill(`Zmerge${tag}`);
  const row = page
    .getByRole("list", { name: "Clubs" })
    .getByRole("listitem")
    .filter({ hasText: typed });
  // The duplicate is pointed out.
  await expect(row).toContainText(`Ressemble à ${real}`);
  await row.getByRole("button", { name: `Ouvrir ${typed}` }).click();
  await page.getByRole("button", { name: `Fusionner dans ${real}` }).click();
  // A real confirmation window.
  const dialog = page.getByRole("dialog", { name: `Fusionner « ${typed} » dans « ${real} » ?` });
  await dialog.getByRole("button", { name: "Fusionner" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Fusionné dans ${real} : 1 joueur déplacé.` }),
  ).toBeVisible();

  expect(sql(`select count(*) from clubs where name = '${typed}'`)).toBe("0");
  expect(
    sql(
      `select c.name from profiles p join clubs c on c.id = p.club_id where p.pseudo = '${player.pseudo}'`,
    ),
  ).toBe(real);
  // The player learns it at the next visit.
  await playerPage.goto("/");
  await expect(playerPage.getByText(`Ton club « ${typed} » existait déjà`)).toBeVisible();
  sql(`delete from clubs where name = '${real}'`);
});
