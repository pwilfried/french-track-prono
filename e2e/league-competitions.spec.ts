import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player picks two French competitions on the home page and his league adds up both", async ({
  page,
}) => {
  // Two French competitions of their own, one event each, far enough to come after the others.
  const tag = `e2e-${Date.now() % 1000000}`;
  const names = [`Test France A ${tag}`, `Test France B ${tag}`];
  for (const [i, name] of names.entries()) {
    sql(`with c as (
        insert into competitions (slug, name, scope, starts_on, ends_on)
        values ('${tag}-${i}', '${name}', 'france', current_date + ${300 + i}, current_date + ${301 + i})
        returning id
      )
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-${i}-100m', '100 m', 'F', now() + interval '${300 + i} days',
             now() + interval '${300 + i} days'
      from c`);
  }
  const player = newPlayer("multi");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choisis ta compétition");
  await page.getByRole("link", { name: /Compétitions françaises/ }).click();
  await expect(page).toHaveURL(/\/competitions\?type=france$/);
  for (const name of names) await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  await page.getByRole("button", { name: "Créer ma ligue" }).click();

  await signUp(page, player);
  await page.waitForURL(/\/ligues\/creer\?/);
  const chosen = page.getByRole("list", { name: "Compétitions de la ligue" });
  for (const name of names) await expect(chosen).toContainText(name);
  await page.getByLabel("Nom de la ligue").fill(`Multi ${tag}`);
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = page.url().split("?")[0]!;

  // Points in each competition, as the admin would compute them: 12 then 3.
  for (const [i, points] of [12, 3].entries()) {
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-${i}-100m'`);
  }

  await page.goto(leagueUrl);
  const rows = page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("15");

  sql(`delete from competitions where slug like '${tag}-%'`);
});
