import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a participant plays a joker with their lineup and both sides see it from the lock (#1091)", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const player = newPlayer("mjoker");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);
  const rivalPseudo = `Rival Joker ${tag}`;
  const rivalId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-mjoker-rival-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, '${rivalPseudo}', now() from u returning id`);

  // Two sprinters each.
  const athletes = (who: string) =>
    sql(`with a as (
        insert into athletes (slug, name, country_code, gender, manager_price)
        select 'mjoker-${who}-' || n || '-${tag}', 'Joker${who} Athlete' || n || ' ${tag}', 'FRA',
               'F', 10
        from generate_series(1, 2) n returning id, slug
      ), ad as (
        insert into athlete_disciplines (athlete_id, discipline, is_primary)
        select id, '100 m', true from a
      )
      select string_agg(id::text, ',' order by slug) from a`).split(",");
  const mine = athletes("me");
  const theirs = athletes("rival");
  const target = `Jokerrival Athlete2 ${tag}`;

  // Two competitions a day apart: one head-to-head each way.
  const competitions = [1, 2].map((day) => {
    const id = sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('mjoker-${day}-${tag}', 'Meeting Joker ${day} ${tag}', current_date + ${day},
              current_date + ${day}) returning id`);
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
         values ('${id}', 'mjoker-100-${day}-${tag}', '100 m', 'F',
                 now() + interval '${day} days', now() + interval '${day} days')`);
    return id;
  });
  const league = sql(`insert into manager_leagues (name, owner_id, rules, competition_ids)
    select 'Jokers ${tag}', '${playerId}', rules, array['${competitions.join("','")}']::uuid[]
    from manager_rules returning id`);
  sql(`insert into manager_members (league_id, user_id)
       values ('${league}', '${playerId}'), ('${league}', '${rivalId}')`);
  sql(`insert into manager_rounds (league_id, round, ends_at) values ('${league}', 1, now())`);
  sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
       select '${league}', a.id::uuid, a.owner::uuid, 10, 1
       from (values ${[
         ...mine.map((id) => `('${id}', '${playerId}')`),
         ...theirs.map((id) => `('${id}', '${rivalId}')`),
       ].join(", ")}) as a(id, owner)`);
  // Closing the mercato draws the schedule.
  sql(`update manager_leagues set mercato_opened_at = now() - interval '2 days',
         mercato_closed_at = now() where id = '${league}'`);
  const [competition, home] = sql(`select md.competition_id || ',' || f.home_id
    from manager_matchdays md join manager_fixtures f using (league_id, round)
    where md.league_id = '${league}' and md.round = 1`).split(",");
  const slug = sql(`select slug from competitions where id = '${competition}'`);

  // On the lineup of the first matchday: the false start card, aimed at an athlete of the rival.
  await page.goto(`/manager/${league}/alignement/${slug}`);
  const jokers = page.getByRole("region", { name: "🃏 Ta carte de la journée" });
  await expect(jokers).toContainText("Une carte par confrontation");
  await jokers.getByRole("button", { name: /Faux départ/ }).click();
  await jokers.getByRole("button", { name: `❓ ${target}` }).click();
  await expect(jokers.getByRole("status")).toHaveText(
    `✅ Faux départ sur ${target}. Enregistré avec ton alignement.`,
  );
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "🃏 Ta carte de la journée" })
      .getByRole("button", { name: /Faux départ/ }),
  ).toHaveAttribute("aria-pressed", "true");

  // The lineups lock: both cards face up.
  const uuids = (ids: string[]) => `array['${ids.join("','")}']::uuid[]`;
  sql(`insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
       values ('${league}', '${competition}', '${playerId}', ${uuids(mine)}),
              ('${league}', '${competition}', '${rivalId}', ${uuids(theirs)})`);
  sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
       where competition_id = '${competition}'`);
  await page.reload();
  const revealed = page.getByRole("region", { name: "🃏 Ta carte de la journée" });
  await expect(revealed).toContainText("🔒 Verrou passé · cartes révélées");
  await expect(revealed).toContainText("Faux départ");
  await expect(revealed).toContainText(target);

  await page.goto(`/manager/${league}/confrontation/1/${home}`);
  await expect(page.getByRole("region", { name: "Jokers" })).toContainText(
    `${player.pseudo} · Faux départ · ${target}`,
  );

  sql(`delete from manager_leagues where id = '${league}'`);
  sql(`delete from competitions where id in ('${competitions.join("','")}')`);
  sql(`delete from athletes where slug like 'mjoker-%-${tag}'`);
  sql(`delete from auth.users where id = '${rivalId}'`);
});
