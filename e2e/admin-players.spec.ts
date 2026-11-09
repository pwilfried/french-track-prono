import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin blocks a player, who leaves the general ranking, then unblocks them", async ({
  page,
  browser,
}) => {
  // A competition of its own and a player with points in it.
  const tag = `${Date.now() % 1000000}`;
  const target = `Cible E2E ${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('e2e-mod-${tag}', 'Test modération ${tag}', current_date + 340, current_date + 341)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, 'e2e-mod-${tag}-100m', '100 m', 'F', now() + interval '340 days', now() + interval '340 days'
    from c`);
  sql(`with u as (
      insert into auth.users (id, email) values (gen_random_uuid(), 'e2e-mod-${tag}@example.test')
      returning id
    ), p as (
      insert into profiles (id, pseudo, age_confirmed_at) select id, '${target}', now() from u
      returning id
    )
    insert into score_events (user_id, competition_id, event_id, source, points, reason)
    select p.id, e.competition_id, e.id, 'prediction', 12, 'prediction'
    from p, events e where e.slug = 'e2e-mod-${tag}-100m'`);

  const admin = newPlayer("mod");
  await page.goto("/classement");
  await signUp(page, admin);
  await page.waitForURL(/\/classement$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);
  // Another player watches the general ranking (an admin still sees every line).
  const viewer = newPlayer("viewer");
  const viewerPage = await (await browser.newContext()).newPage();
  await viewerPage.goto("/classement");
  await signUp(viewerPage, viewer);
  await viewerPage.waitForURL(/\/classement$/);
  const ranking = viewerPage.getByRole("list", { name: "Classement" });
  await expect(ranking.getByText(target)).toBeVisible();

  await page.goto("/admin/joueurs");
  await page.getByRole("searchbox", { name: "Pseudo" }).fill(`cible e2e ${tag}`);
  await page.getByRole("button", { name: "Chercher" }).click();
  const row = page
    .getByRole("list", { name: "Joueurs" })
    .getByRole("listitem")
    .filter({ hasText: target });
  await row.getByRole("button", { name: "Bloquer" }).click();
  await expect(row.getByText("Bloqué", { exact: true })).toBeVisible();

  await viewerPage.reload();
  await expect(ranking).toBeVisible();
  await expect(viewerPage.getByText(target)).toHaveCount(0);

  await page.goto(`/admin/joueurs?q=${encodeURIComponent(target)}`);
  await row.getByRole("button", { name: "Débloquer" }).click();
  await expect(row.getByText("Bloqué", { exact: true })).toHaveCount(0);
  await viewerPage.reload();
  await expect(ranking.getByText(target)).toBeVisible();

  expect(
    sql(`select count(*) from admin_actions where action = 'moderate_player'
              and payload->>'pseudo' = '${target}'`),
  ).toBe("2");
  sql(`delete from auth.users where email = 'e2e-mod-${tag}@example.test'`);
  sql(`delete from competitions where slug = 'e2e-mod-${tag}'`);
});
