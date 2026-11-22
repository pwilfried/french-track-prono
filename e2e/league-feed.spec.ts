import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a result entered tells « podium parfait » in the feed of the player's league", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const names = ["Alpha", "Bravo", "Charlie"].map((n) => `${n} Fil ${tag}`);
  const ids = names.map((name, n) =>
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('feed-${n}-${tag}', '${name}', 'FRA', 'F') returning id`),
  );
  for (const id of ids) {
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         values ('${id}', '100 m', true)`);
  }

  // A competition of its own: one 100 m with three athletes, its predictions open for now.
  const competition = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('feed-${tag}', 'Meeting Fil ${tag}', current_date, current_date + 1) returning id`);
  const slug = `feed-100-${tag}`;
  const event =
    sql(`insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    values ('${competition}', '${slug}', '100 m', 'F', now() + interval '1 day',
            now() + interval '1 day') returning id`);
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'feed-_-${tag}'`);

  const player = newPlayer("feed");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);

  // The player and a friend in a league counting the competition, both members before the event.
  const friendId = sql(`with u as (
      insert into auth.users (id, email)
      values (gen_random_uuid(), 'e2e-feed-friend-${tag}@example.test') returning id
    )
    insert into profiles (id, pseudo, age_confirmed_at)
    select id, 'Ami Fil ${tag}', now() from u returning id`);
  const league = sql(`with l as (
      insert into leagues (name, owner_id) values ('Ligue Fil ${tag}', '${playerId}') returning id
    ), m as (
      insert into league_members (league_id, user_id, role, joined_at)
      select id, '${playerId}'::uuid, 'owner'::league_role, now() - interval '1 day' from l
      union all
      select id, '${friendId}'::uuid, 'member'::league_role, now() - interval '1 day' from l
    ), c as (
      insert into league_competitions (league_id, competition_id) select id, '${competition}' from l
    )
    select id from l`);

  // The player predicts Alpha, Bravo, Charlie; then the event starts.
  sql(`insert into predictions (user_id, event_id, p1, p2, p3)
       values ('${playerId}', '${event}', '${ids[0]}', '${ids[1]}', '${ids[2]}')`);
  // … and adds it to the league, as from the sheet after a save (#1068).
  sql(`insert into league_predictions (league_id, user_id, event_id)
       values ('${league}', '${playerId}', '${event}')`);
  sql(`update events set starts_at = now() - interval '1 hour', lock_at = now() - interval '1 hour'
       where id = '${event}'`);

  // Nothing told yet: the feed says what it will tell.
  await page.goto(`/ligues/${league}?onglet=fil`);
  await expect(page.getByText(/Le fil raconte les podiums parfaits/)).toBeVisible();

  // The admin enters the results sheet: the podium is exactly the player's prediction.
  sql(`update profiles set is_admin = true where id = '${playerId}'`);
  await page.goto(`/admin/${slug}`);
  await page.getByRole("link", { name: "Saisir la feuille de résultats" }).click();
  const card = (name: string) => page.getByRole("listitem", { name, exact: true });
  for (const [n, name] of names.entries()) {
    await card(name)
      .getByLabel("Place")
      .fill(`${n + 1}`);
  }
  await page.getByRole("button", { name: "Enregistrer et calculer les points" }).click();
  await page.waitForURL(new RegExp(`/admin/${slug}\\?enregistre=1$`));
  sql(`update profiles set is_admin = false where id = '${playerId}'`);

  // The feed of the league tells the perfect podium, under tonight's competition.
  await page.goto(`/ligues/${league}?onglet=fil`);
  await expect(page.getByRole("link", { name: "Fil", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const moment = page.getByRole("article").filter({ hasText: "Podium parfait" });
  await expect(moment).toContainText(`${player.pseudo} trouve le podium parfait du 100 m`);

  sql(`delete from leagues where id = '${league}'`);
  sql(`delete from competitions where id = '${competition}'`);
  sql(`delete from athletes where slug like 'feed-_-${tag}'`);
  sql(`delete from auth.users where id = '${friendId}'`);
});
