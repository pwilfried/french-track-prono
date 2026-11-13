import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

/**
 * 15 Diamond League meetings a Manager league can be created with (#663), far ahead, once each:
 * no other available competition has this level.
 */
function diamondLeague(): void {
  sql(`with c as (
         insert into competitions (slug, name, city, level, starts_on, ends_on)
         select 'test-picker-dl-' || n, 'Meeting Diamant ' || n, 'Ville ' || n, 'diamond-league',
                date '2031-04-01' + 7 * n, date '2031-04-01' + 7 * n
         from generate_series(1, 15) n
         on conflict (slug) do update set status = 'upcoming'
         returning id
       )
       insert into manager_competitions (competition_id) select id from c on conflict do nothing`);
}

test("a quick selection ticks the Diamond League and the season format follows", async ({
  page,
}) => {
  diamondLeague();
  const league = `Diamants ${Date.now() % 1000000}`;
  await page.goto("/manager/creer");
  await signUp(page, newPlayer("mgr-picker"));
  await page.waitForURL(/\/manager\/creer$/);
  await page.getByLabel("Nom de la ligue").fill(league);

  const submit = page.getByRole("button", { name: "Créer la ligue" });
  await expect(submit).toBeDisabled();

  // One tap: the 15 meetings, 8 players, a home-and-away of 14 matchdays and 1 bonus.
  await page.getByRole("button", { name: "Diamond League · 15" }).click();
  await expect(page.getByText("15 compétitions → 8 joueurs · 14 journées + 1 bonus")).toBeVisible();
  await expect(page.getByText("Encore 3 pour passer à 10 joueurs.")).toBeVisible();
  await expect(page.getByText("Retires-en 1 pour un aller-retour sans bonus.")).toBeVisible();

  // Unticking one, found with the search: the format follows.
  await page.getByRole("searchbox", { name: "Rechercher une compétition" }).fill("Ville 15");
  await page.getByRole("checkbox", { name: /^Meeting Diamant 15 ·/ }).uncheck();
  await expect(
    page.getByText("14 compétitions → 8 joueurs · 14 journées", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Encore 4 pour passer à 10 joueurs.")).toBeVisible();

  // « Only my ticked competitions » shows the 14 of them.
  await page.getByRole("searchbox", { name: "Rechercher une compétition" }).fill("");
  await page.getByLabel("Voir seulement mes compétitions cochées").check();
  await expect(page.getByText(/^14 affichées sur \d+$/)).toBeVisible();

  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(league);
  await expect(page.getByText("1 / 8 participants · Privée")).toBeVisible();
});
