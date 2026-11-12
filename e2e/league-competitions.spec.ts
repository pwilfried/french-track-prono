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

  await page.goto("/competitions?type=france");
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

test("a player creates a league without competition, then adds a coming one to its ranking", async ({
  page,
}) => {
  const tag = `e2e-later-${Date.now() % 1000000}`;
  const name = `Test plus tard ${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, scope, starts_on, ends_on)
      values ('${tag}', '${name}', 'international', current_date + 320, current_date + 321)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() + interval '320 days', now() + interval '320 days'
    from c`);
  const player = newPlayer("later");

  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);
  await page.getByRole("link", { name: "Créer une ligue" }).click();
  await expect(page.getByText("Aucune compétition pour l'instant")).toBeVisible();
  await page.getByLabel("Nom de la ligue").fill(`Plus tard ${tag}`);
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = page.url().split("?")[0]!;

  // The league starts empty; its creator adds the coming competition.
  await page.goto(leagueUrl);
  await expect(page.getByText("Pas encore de compétition")).toBeVisible();
  await page.getByLabel("Ajouter une compétition à venir").selectOption({ label: name });
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Compétition ajoutée");
  await expect(
    page.getByRole("region", { name: "Compétitions de la ligue" }).getByRole("link", { name }),
  ).toBeVisible();

  // Its points now count in the league ranking.
  sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
    select u.id, e.competition_id, e.id, 'prediction', 7, 'prediction',
           jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
    from auth.users u, events e
    where u.email = '${player.email}' and e.slug = '${tag}-100m'`);
  await page.reload();
  const rows = page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("7");

  sql(`delete from competitions where slug = '${tag}'`);
});

test("a league without competition says once that none is coming when none can be added", async ({
  page,
}) => {
  const tag = `e2e-none-${Date.now() % 1000000}`;
  const player = newPlayer("none");
  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);
  await page.getByRole("link", { name: "Créer une ligue" }).click();
  await page.getByLabel("Nom de la ligue").fill(`Rien ${tag}`);
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = page.url().split("?")[0]!;

  // No competition left to add (#550): every coming one starts today, then comes back.
  const coming = sql(`select coalesce(json_agg(json_build_object('id', id, 'day', starts_on)), '[]')
    from competitions where starts_on > current_date`);
  try {
    sql(`update competitions set starts_on = current_date where starts_on > current_date`);
    await page.goto(leagueUrl);
    const competitions = page.getByRole("region", { name: "Compétitions de la ligue" });
    await expect(competitions).toContainText("Aucune compétition à venir pour l'instant");
    await expect(competitions).not.toContainText("Pas encore de compétition");
    await expect(competitions).not.toContainText("déjà dans la ligue");
  } finally {
    sql(`update competitions c set starts_on = (x->>'day')::date
      from json_array_elements('${coming}'::json) x where c.id = (x->>'id')::uuid`);
  }
});
