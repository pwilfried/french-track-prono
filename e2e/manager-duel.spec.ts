import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a participant opens their head-to-head from the matchday and sees both lineups on the stadium", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mduel");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const rivalPseudo = `Rival Duel ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mduel-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);

  // Eight athletes each: a stadium of 8 places (one sprint, one middle distance, one throws, five
  // free, the default rules).
  const disciplines = ["100 m", "800 m", "Lancer du poids", "100 m", "800 m", "5000 m", "100 m"];
  const athletes = (who: string) =>
    [...disciplines, "200 m"].map((discipline, n) => {
      const slug = `mduel-${who}-${n}-${tag}`;
      const id = sql(`insert into athletes (slug, name, country_code, gender, manager_price)
        values ('${slug}', 'Duel${who} Athlete${n} ${tag}', 'FRA', 'F', 10) returning id`);
      sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
           values ('${id}', '${discipline}', true)`);
      return id;
    });
  const mine = athletes("me");
  const theirs = athletes("rival");

  // Two competitions a day apart: one head-to-head each way.
  const competitions = [1, 2].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mduel-${day}-${tag}', 'Meeting Duel ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mduel-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Confrontation ${tag}', '${playerId}', rules,
           array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  // Closing the mercato draws the schedule.
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  // Both line up for the first competition before it starts; then it starts.
  const uuids = (ids: string[]) => `array['${ids.join("','")}']::uuid[]`;
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       values ('${league}', '${competitions[0]}', '${playerId}', ${uuids(mine)}),
              ('${league}', '${competitions[0]}', '${rivalId}', ${uuids(theirs)})`);
  sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
       where competition_id = '${competitions[0]}'`);
  // Scored: the player wins 930 – 812; their first athlete is at 0.
  const detail = (ids: string[], first: number) =>
    JSON.stringify(
      ids.map((id, n) => ({
        athlete_id: id,
        total: n === 0 ? first : 100,
        bonus_points: n === 1 ? 20 : 0,
      })),
    );
  sql(`insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                                   bonus, predictions, athletes)
       values ('${league}', '${competitions[0]}', '${playerId}', true, 930, 880, 20, 30,
               '${detail(mine, 0)}'),
              ('${league}', '${competitions[0]}', '${rivalId}', true, 812, 780, 20, 12,
               '${detail(theirs, 100)}')`);

  // From the matchday to the head-to-head.
  await page.goto(`/manager/${league}/journee/1`);
  await page
    .getByRole("listitem", { name: "Ma confrontation" })
    .getByRole("link", { name: /Voir la confrontation/ })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confrontation");

  const summary = page.getByRole("region", { name: "Résultat de la confrontation" });
  await expect(summary).toContainText("Victoire +3");
  await expect(summary).toContainText(rivalPseudo);
  await expect(summary).toContainText("930");
  await expect(summary).toContainText("812");
  await expect(summary).toContainText(`Aller · `);
  await expect(summary).toContainText("Pronos : toi +30, adversaire +12 (inclus)");

  // The 16 starters on one stadium: the rival's at the top, the player's at the bottom.
  const stadium = page.getByRole("region", { name: "Le stade de la confrontation" });
  await expect(stadium.getByRole("article")).toHaveCount(16);
  await expect(
    stadium.getByRole("list", { name: `Alignement de ${rivalPseudo}` }).getByRole("article"),
  ).toHaveCount(8);
  const myCards = stadium
    .getByRole("list", { name: `Alignement de ${player.pseudo}` })
    .getByRole("article");
  await expect(myCards).toHaveCount(8);
  await expect(myCards.filter({ hasText: /(^|\D)0 pts/ })).toHaveCount(1);
  await expect(myCards.filter({ hasText: "+20" })).toHaveCount(1);

  await page.getByRole("link", { name: "Classement ›" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classement");

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from athletes where slug like 'mduel-%-${tag}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
