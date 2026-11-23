import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("the « Pronostiquer » button of a league opens its open final (#1069)", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const slug = `e2e-predict-${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${slug}', 'Meeting E2E ${tag}', current_date + 350, current_date + 351)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${slug}-100m', '100 m', 'F', now() + interval '350 days', now() + interval '350 days'
    from c`);
  const player = newPlayer("predict");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, slug);
  const leagueId = sql(`select l.id from leagues l
    join league_competitions lc on lc.league_id = l.id
    join competitions c on c.id = lc.competition_id
    where c.slug = '${slug}'`);

  await page.goto(`/ligues/${leagueId}`);
  const block = page.getByRole("region", { name: "Pronostiquer dans cette ligue" });
  await expect(block.getByText("Ton prochain prono")).toBeVisible();
  await block.getByRole("link", { name: /^Pronostiquer/ }).click();
  await page.waitForURL(new RegExp(`/epreuves/${slug}-100m\\?ligue=${leagueId}$`));

  sql(`delete from competitions where slug = '${slug}'`);
});
