import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin imports a pasted start list, with fuzzy names and a new athlete", async ({
  page,
}) => {
  const slug = `e2e-import-${Date.now() % 1000000}`;
  sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${slug}', '100 m', 'F', now() + interval '60 days', now() + interval '59 days'
    from competitions where slug = 'ultimate-championship-2026'`);
  const player = newPlayer("import");
  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto(`/admin/${slug}/depart`);
  await page.getByRole("link", { name: "Importer une liste (CSV)" }).click();
  const paste = page.getByLabel("Colle la liste de départ");

  // A paste without names is explained, not a crash.
  await paste.fill("10.71,10.75\n10.80,10.82");
  await page.getByRole("button", { name: "Analyser" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Aucune colonne de noms");

  const newcomer = `Inventée ${slug}`;
  await paste.fill(`RICHARDSON Sha'carri;USA;10.71\nAlfred Julien;LCA\n${newcomer};FRA;11.20`);
  await page.getByRole("button", { name: "Analyser" }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText(
    "2 reconnus · 0 à confirmer · 1 nouveau",
  );

  await page.getByRole("button", { name: "Appliquer (3 athlètes)" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/${slug}/depart\\?enregistre=1$`));
  await expect(page.locator("main").getByRole("status")).toContainText("3 athlètes");

  await page.goto(`/epreuves/${slug}`);
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText("Sha'Carri Richardson");
  await expect(page.locator('main:not([aria-busy="true"])')).toContainText(newcomer);

  sql(`delete from events where slug = '${slug}'`);
});
