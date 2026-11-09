import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the profile shows my club's rank in the club ranking and the podium of the clubs", async ({
  page,
}) => {
  // A club of its own, a competition of its own with one event.
  const tag = `e2e-clubs-${Date.now() % 1000000}`;
  const club = `Club Zeta ${tag}`;
  sql(`insert into clubs (name, city, department, source, validated)
       values ('${club}', 'Testville', '75', 'import', true)`);
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test clubs ${tag}', current_date + 340, current_date + 341)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() + interval '340 days', now() + interval '340 days'
    from c`);

  // Three invented teammates with points (a club is ranked from 3 players).
  for (const n of [1, 2, 3]) {
    sql(`with u as (
        insert into auth.users (id, email, aud, role)
        values (gen_random_uuid(), '${tag}-${n}@example.test', 'authenticated', 'authenticated')
        returning id
      )
      insert into profiles (id, pseudo, avatar_emoji, age_confirmed_at, club_id)
      select u.id, 'Zeta ${n} ${tag}'::text, '🦊', now(), c.id from u, clubs c where c.name = '${club}'`);
  }

  const player = newPlayer("clubs");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set club_id = (select id from clubs where name = '${club}')
       where pseudo = '${player.pseudo}'`);

  // Every member of the club scores 900 points: far above any other club.
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
    select p.id, e.competition_id, e.id, 'prediction', 900, 'prediction',
           jsonb_build_object('reasons', '[]'::jsonb)
    from profiles p, events e
    where p.club_id = (select id from clubs where name = '${club}') and e.slug = '${tag}-100m'`);
  await page.reload();

  const section = page.getByRole("region", { name: "Classement des clubs" });
  await expect(section).toContainText(`${club} : 1er sur`);
  await expect(section).toContainText("900 pts de moyenne");
  const podium = section.getByRole("list", { name: "Podium des clubs" });
  await expect(podium.getByRole("listitem").first()).toContainText(club);
  await expect(podium.getByRole("listitem").first()).toHaveAttribute("aria-current", "true");
  await expect(podium.getByRole("listitem").first()).toContainText("4 joueurs");

  sql(`delete from competitions where slug = '${tag}'`);
  sql(`delete from auth.users where email like '${tag}-%@example.test'`);
  sql(`update profiles set club_id = null where pseudo = '${player.pseudo}'`);
  sql(`delete from clubs where name = '${club}'`);
});
