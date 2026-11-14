import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

/**
 * 15 Diamond League meetings a Manager league can be created with (#663), with the available ones
 * of other tests aside: pre-production also holds demo meetings (#694, #830). The test adds the
 * rest far ahead, once each, and returns the number of the last one it added.
 */
function diamondLeague(): number {
  sql(`delete from competitions where slug like 'test-picker-dl-%'`);
  const others = Number(
    sql(`select count(*) from manager_competitions mc join competitions c on c.id = mc.competition_id
         where c.status <> 'finished' and c.level = 'diamond-league'`),
  );
  const added = 15 - others;
  expect(added, "more than 15 Diamond League meetings available").toBeGreaterThan(0);
  sql(`with c as (
         insert into competitions (slug, name, city, level, starts_on, ends_on)
         select 'test-picker-dl-' || n, 'Meeting Diamant ' || n, 'Ville ' || n, 'diamond-league',
                date '2031-04-01' + 7 * n, date '2031-04-01' + 7 * n
         from generate_series(1, ${added}) n
         returning id
       )
       insert into manager_competitions (competition_id) select id from c on conflict do nothing`);
  return added;
}

test("a quick selection ticks the Diamond League and the season format follows", async ({
  page,
}) => {
  const last = diamondLeague();
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
  await page.getByRole("searchbox", { name: "Rechercher une compétition" }).fill(`Ville ${last}`);
  await page.getByRole("checkbox", { name: new RegExp(`^Meeting Diamant ${last} ·`) }).uncheck();
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
