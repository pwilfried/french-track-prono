import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("from a league, a player opens a finished final and unfolds a member's points", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const competition = `e2e-result-${tag}`;
  const slug = `${competition}-100m`;
  // A final of its own, still open: the predictions go in first.
  const event = sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${competition}', 'Test résultat ${tag}', current_date, current_date + 1)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, round)
    select id, '${slug}', '100 m', 'F', now() + interval '1 day', now() + interval '1 day', 'final'
    from c returning id`);
  const ids = ["Alpha", "Bravo", "Charlie"].map((name, n) =>
    sql(`insert into athletes (slug, name, country_code, gender)
         values ('result-${n}-${tag}', '${name} Résultat ${tag}', 'FRA', 'F') returning id`),
  );
  sql(`insert into entries (event_id, athlete_id)
       select '${event}', id from athletes where slug like 'result-_-${tag}'`);

  const owner = newPlayer("result-owner");
  await page.goto("/profil");
  await signUp(page, owner);
  await page.waitForURL(/\/profil$/);
  const ownerId = sql(`select id from profiles where pseudo = '${owner.pseudo}'`);

  // Two friends: one predicts the perfect podium, the other does not predict.
  const friends = [`Ami ${tag}`, `Muet ${tag}`].map((pseudo, n) =>
    sql(`with u as (
        insert into auth.users (id, email)
        values (gen_random_uuid(), 'e2e-result-${n}-${tag}@example.test') returning id
      )
      insert into profiles (id, pseudo, age_confirmed_at) select id, '${pseudo}', now() from u
      returning id`),
  );
  const [friendId] = friends as [string, string];
  sql(`insert into predictions (user_id, event_id, p1, p2, p3) values
       ('${friendId}', '${event}', '${ids[0]}', '${ids[1]}', '${ids[2]}'),
       ('${ownerId}', '${event}', '${ids[0]}', '${ids[2]}', '${ids[1]}')`);
  const league = sql(`with l as (
      insert into leagues (name, owner_id) values ('Ligue résultat ${tag}', '${ownerId}')
      returning id
    ), m as (
      insert into league_members (league_id, user_id, role)
      select l.id, u.id, (case when u.id = '${ownerId}' then 'owner' else 'member' end)::league_role
      from l, unnest(array['${ownerId}', '${friends.join("', '")}']::uuid[]) as u(id)
    ), c as (
      insert into league_competitions (league_id, competition_id)
      select l.id, e.competition_id from l, events e where e.id = '${event}'
    )
    select id from l`);
  sql(`insert into league_predictions (league_id, user_id, event_id) values
       ('${league}', '${friendId}', '${event}'), ('${league}', '${ownerId}', '${event}')`);

  // The final ends: the official podium, and the points computed with their reasons.
  sql(`update events set lock_at = now() - interval '1 hour', starts_at = now() - interval '1 hour'
       where id = '${event}'`);
  sql(`insert into results (event_id, athlete_id, rank)
       values ('${event}', '${ids[0]}', 1), ('${event}', '${ids[1]}', 2), ('${event}', '${ids[2]}', 3)`);
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
    select v.user_id::uuid, e.competition_id, e.id, 'prediction', v.points, 'prediction', v.detail::jsonb
    from events e, (values
      ('${friendId}', 12, '{"reasons":[{"kind":"exact","slot":1},{"kind":"exact","slot":2},{"kind":"exact","slot":3},{"kind":"perfect_podium"}]}'),
      ('${ownerId}', 5, '{"reasons":[{"kind":"exact","slot":1},{"kind":"on_podium","slot":2},{"kind":"on_podium","slot":3}]}')
    ) as v(user_id, points, detail)
    where e.id = '${event}'`);

  // The league proposes its last result, and opens it without leaving the league.
  await page.goto(`/ligues/${league}`);
  const latest = page.getByRole("region", { name: "🏁 Dernier résultat" });
  await expect(latest).toContainText(`Ami ${tag}`);
  await latest.getByRole("link", { name: "Voir les pronos de la ligue ›" }).click();
  await page.waitForURL(new RegExp(`/ligues/${league}/epreuves/${slug}$`));
  await expect(page.getByText("Les pronos de la ligue · 2 sur 3")).toBeVisible();

  // Every member, ranked by points: the friend first, me, then the one without a prediction.
  const cards = page
    .getByRole("list")
    .filter({ hasText: "🦗 Pas de prono" })
    .locator(":scope > li");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText(`Ami ${tag}`);
  await expect(cards.nth(0)).toContainText(/\+12\spts/);
  await expect(cards.nth(1)).toContainText("Toi");
  await expect(cards.nth(2)).toContainText(`Muet ${tag}`);

  // My card opens on its detail; the friend's unfolds on a tap, line by line.
  await expect(cards.nth(1).getByText("🔄 2 athlètes mal placés")).toBeVisible();
  await page.getByLabel(`Détail des points de Ami ${tag}`).click();
  await expect(cards.nth(0).getByText("🎯 Podium parfait")).toBeVisible();
  await expect(cards.nth(0).getByText("Total")).toBeVisible();

  sql(`delete from auth.users where email like 'e2e-result-%-${tag}@example.test'`);
  sql(`delete from competitions where slug = '${competition}'`);
  sql(`delete from athletes where slug like 'result-_-${tag}'`);
});
