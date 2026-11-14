import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a league counts only the points scored once the player joined", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const competition = `e2e-member-${tag}`;
  // A finished event of its own, locked yesterday.
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${competition}', 'Test membre ${tag}', current_date - 1, current_date)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${competition}-100m', '100 m', 'F', now() - interval '1 day', now() - interval '1 day'
    from c`);
  const owner = newPlayer("owner");
  await page.goto("/profil");
  await signUp(page, owner);
  await page.waitForURL(/\/profil$/);

  // A friend scored 30 points on that event yesterday, and joins the league only today.
  const friend = `Ami ${tag}`;
  sql(`with u as (
      insert into auth.users (id, email) values (gen_random_uuid(), 'e2e-friend-${tag}@example.test')
      returning id
    ), p as (
      insert into profiles (id, pseudo, age_confirmed_at) select id, '${friend}', now() from u returning id
    )
    insert into score_events (user_id, competition_id, event_id, source, points, reason)
    select p.id, e.competition_id, e.id, 'prediction', 30, 'prediction'
    from p, events e where e.slug = '${competition}-100m'`);
  const league = sql(`with l as (
      insert into leagues (name, owner_id)
      select 'Ligue membre ${tag}', id from profiles where pseudo = '${owner.pseudo}' returning id, owner_id
    ), m as (insert into league_members (league_id, user_id, role) select id, owner_id, 'owner' from l),
    f as (insert into league_members (league_id, user_id)
          select l.id, p.id from l, profiles p where p.pseudo = '${friend}'),
    c as (insert into league_competitions (league_id, competition_id)
          select l.id, c.id from l, competitions c where c.slug = '${competition}')
    select id from l`);

  await page.goto(`/ligues/${league}`);
  const row = page
    .getByRole("list", { name: "Classement" })
    .getByRole("listitem")
    .filter({ hasText: friend });
  // No points in the league yet: the points column says 0, once (#706).
  await expect(row).toContainText(/(^|\D)0 point\b/);
  await expect(row).not.toContainText("Pas encore de points");
  // Still counted in the general ranking.
  await page.goto(`/classement?vue=general&competition=${competition}`);
  await expect(
    page
      .getByRole("list", { name: "Classement" })
      .getByRole("listitem")
      .filter({ hasText: friend }),
  ).toContainText("30");

  sql(`delete from auth.users where email = 'e2e-friend-${tag}@example.test'`);
  sql(`delete from competitions where slug = '${competition}'`);
});
