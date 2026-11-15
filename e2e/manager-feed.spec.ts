import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { chooseSeason, createLeague, seasonReady } from "./manager-season";
import { newPlayer, signUp } from "./players";

test("the reveal of a mercato round tells « Mercato » in the feed of the Manager league", async ({
  page,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const league = `Fil Manager ${tag}`;
  const athlete = `Athlète Fil ${tag}`;
  const athleteId = sql(`insert into athletes (slug, name, country_code, gender, manager_price)
    values ('fil-manager-${tag}', '${athlete}', 'FRA', 'F', 30) returning id`);
  sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
       values ('${athleteId}', '100 m', true)`);
  const owner = newPlayer("feed-owner");

  // A Manager league with a second participant, before its mercato.
  await page.goto("/manager/creer");
  await signUp(page, owner);
  await page.waitForURL(/\/manager\/creer$/);
  await page.getByLabel("Nom de la ligue").fill(league);
  await chooseSeason(page);
  await createLeague(page);
  const leagueId = sql(`select id from manager_leagues where name = '${league}'`);
  const rival = sql(`with u as (
      insert into auth.users (id, email) values (gen_random_uuid(), 'e2e-feed-rival-${tag}@example.test')
      returning id
    ), p as (
      insert into profiles (id, pseudo, age_confirmed_at) select id, 'Rival Fil ${tag}', now() from u
    )
    select id from u`);
  sql(`insert into manager_members (league_id, user_id) values ('${leagueId}', '${rival}')`);

  // Nothing told yet: the empty feed points to the mercato.
  await page.goto(`/manager/${leagueId}?onglet=fil`);
  await expect(page.getByRole("link", { name: "Fil", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Voir le mercato" })).toBeVisible();

  // The owner bids, the first round closes: its reveal is told in the feed.
  sql(`update manager_leagues
       set rules = rules || '{"budget": 100, "closeModes": ["last_bidder"]}',
           mercato_opened_at = now() - interval '49 hours' where id = '${leagueId}'`);
  sql(`insert into manager_bids (league_id, user_id, athlete_id, amount)
       select '${leagueId}', id, '${athleteId}', 35 from profiles where pseudo = '${owner.pseudo}'`);
  sql(`select private.close_manager_rounds()`);

  await page.goto(`/manager/${leagueId}?onglet=fil`);
  // One card per round and player, its athletes folded under it (#979).
  const sentence = `${owner.pseudo} remporte 1 athlète au tour 1 · 35 crédits`;
  const moment = page.getByRole("article").filter({ hasText: sentence });
  await expect(moment).toContainText("Mercato");
  await expect(moment.getByText(athlete)).toBeHidden();
  await moment.getByText("Voir les athlètes").click();
  await expect(moment.getByText(athlete)).toBeVisible();

  // « Saison » brings the league back.
  await page.getByRole("link", { name: "Saison", exact: true }).click();
  await expect(page.getByRole("link", { name: "Catalogue du mercato" })).toBeVisible();
});
