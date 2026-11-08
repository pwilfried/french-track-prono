import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the general ranking adds up the points of every competition", async ({ page }) => {
  // Two competitions of their own, one event each.
  const tag = `e2e-general-${Date.now() % 1000000}`;
  for (const i of [0, 1]) {
    sql(`with c as (
        insert into competitions (slug, name, starts_on, ends_on)
        values ('${tag}-${i}', 'Test général ${tag} ${i}', current_date + ${330 + i}, current_date + ${331 + i})
        returning id
      )
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-${i}-100m', '100 m', 'F', now() + interval '${330 + i} days',
             now() + interval '${330 + i} days'
      from c`);
  }
  const player = newPlayer("general");
  await page.goto("/classement");
  await signUp(page, player);
  await page.waitForURL(/\/classement$/);

  // Points in each competition, as the admin would compute them: 40 then 33.
  for (const [i, points] of [40, 33].entries()) {
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-${i}-100m'`);
  }
  await page.reload();

  await expect(page.getByText("Tous les joueurs · toutes les compétitions")).toBeVisible();
  const mine = page
    .getByRole("list", { name: "Classement" })
    .getByRole("listitem")
    .filter({ hasText: player.pseudo });
  await expect(mine).toContainText("73");

  sql(`delete from competitions where slug like '${tag}-%'`);
});
