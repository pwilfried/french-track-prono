import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the season ends after the bonus matchday: the champion, the final standings and the honours", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mend");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const rivalPseudo = `Rival ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mend-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);
  const athleteName = `Athlete Fin ${tag}`;
  const athleteId = sql(`insert into athletes (slug, name, country_code, gender)
    values ('mend-${tag}', '${athleteName}', 'FRA', 'F') returning id`);

  // Three competitions a day apart: two head-to-head matchdays for two players, then a bonus one.
  const competitions = [1, 2, 3].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mend-${day}-${tag}', 'Meeting Fin ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mend-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const leagueName = `Fin ${tag}`;
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select '${leagueName}', '${playerId}', rules, array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  // Closing the mercato draws the schedule.
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  const score = (c: number, userId: string, total: number, athlete = false) => `(
    '${league}', '${competitions[c]}', '${userId}', true, ${total}, ${total}, 0, 0,
    '${athlete ? JSON.stringify([{ athlete_id: athleteId, total }]) : "[]"}')`;
  const insert = (rows: string[]) =>
    sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total,
                                     hungarian, bonus, predictions, athletes)
         values ${rows.join(", ")}`);

  // Both head-to-heads are scored: the player wins 900 – 700, then draws 650 – 650.
  insert([
    score(0, playerId, 900, true),
    score(0, rivalId, 700),
    score(1, playerId, 650, true),
    score(1, rivalId, 650),
  ]);

  // The bonus matchday is still to play: the season goes on.
  await page.goto(`/manager/${league}/fin-de-saison`);
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "La saison continue : elle se termine après la dernière journée du calendrier, journées bonus comprises.",
  );

  // The bonus matchday is scored: the rival's 3000 bring no championship point.
  insert([score(2, playerId, 100, true), score(2, rivalId, 3000)]);

  await page.goto(`/manager/${league}/classement`);
  const ended = page.getByRole("main").getByRole("status");
  await expect(ended).toContainText("Saison terminée : le classement est figé.");
  await ended.getByRole("link", { name: "Voir la fin de saison" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fin de saison");
  await expect(page.getByRole("heading", { name: "Tu es champion" })).toBeVisible();
  const rows = page
    .getByRole("table", { name: "Classement final du championnat" })
    .getByRole("row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(player.pseudo);
  await expect(rows.nth(1)).toContainText("Champion");
  await expect(rows.nth(1).getByRole("cell")).toHaveText(["1", "1", "1", "0", "4"]);
  await expect(rows.nth(2)).toContainText(rivalPseudo);
  await expect(rows.nth(2).getByRole("cell")).toHaveText(["2", "0", "1", "1", "1"]);

  const mySeason = page.getByRole("region", { name: "Ma saison" });
  await expect(mySeason).toContainText("Points Manager marqués1650");
  await expect(mySeason).toContainText("V · N · D1 · 1 · 0");
  await expect(mySeason).toContainText(`Meilleur athlète${athleteName} · 1650 pts`);
  await expect(mySeason).toContainText(`Face à ${rivalPseudo}1 V · 1 N · 0 D`);

  // The honours stay in the profile.
  await page.getByRole("link", { name: "Palmarès Manager" }).click();
  const honours = page.getByRole("region", { name: "Palmarès Manager" });
  await expect(honours.getByRole("link", { name: new RegExp(leagueName) })).toContainText(
    "🏆 Champion",
  );

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from athletes where id = '${athleteId}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
