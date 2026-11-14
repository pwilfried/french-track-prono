import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { comingCompetition, deleteCompetition } from "./competitions";
import { addFriendTo, newPlayer, signUp } from "./players";

test("a player picks two French competitions in the season picker and his league adds up both", async ({
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

  await page.goto("/ligues/creer");
  await signUp(page, player);
  await page.waitForURL(/\/ligues\/creer$/);
  // The name typed first stays while the competitions are picked, on the same page (#721).
  await page.getByLabel("Nom de la ligue").fill(`Multi ${tag}`);
  // Their months are closed: the search finds them.
  await page.getByRole("searchbox", { name: "Rechercher une compétition" }).fill(tag);
  for (const name of names) await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  await expect(page.getByText("2 compétitions cochées")).toBeVisible();
  await expect(page.getByLabel("Nom de la ligue")).toHaveValue(`Multi ${tag}`);
  // Once ticked, the bar sticks above the navigation: the button is whole, without scrolling (#804).
  const submit = page.getByRole("button", { name: "Créer la ligue" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await expect(submit).toBeInViewport({ ratio: 1 });
    const button = (await submit.boundingBox())!;
    const nav = (await page
      .getByRole("navigation", { name: "Navigation principale" })
      .boundingBox())!;
    expect(button.y + button.height).toBeLessThanOrEqual(nav.y);
  }
  await submit.click();
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

  // The ranking shows once a friend is in the league (alone, the player is asked to invite).
  const friend = addFriendTo(leagueUrl, tag);
  await page.goto(leagueUrl);
  const rows = page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(player.pseudo);
  await expect(rows.first()).toContainText("15");

  sql(`delete from auth.users where email = '${friend}'`);
  sql(`delete from competitions where slug like '${tag}-%'`);
});

test("a league needs a competition; on one under way, only the events locked after its creation count", async ({
  page,
}) => {
  // A competition under way with an event already played and one still to come, and a coming one.
  const tag = `e2e-active-${Date.now() % 1000000}`;
  const running = `Test en cours ${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, scope, starts_on, ends_on)
      values ('${tag}', '${running}', 'international', current_date - 1, current_date + 2)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-played', '100 m', 'F', now() - interval '2 hours', now() - interval '2 hours'
    from c
    union all
    select id, '${tag}-coming', '200 m', 'F', now() + interval '1 day', now() + interval '1 day'
    from c`);
  const coming = comingCompetition(`${tag}-later`, 320);
  const player = newPlayer("active");

  // Without a competition, the league cannot be created.
  await page.goto("/ligues");
  await signUp(page, player);
  await page.waitForURL(/\/ligues$/);
  await page.getByRole("link", { name: "Créer une ligue" }).click();
  await expect(page.getByText("Il en faut au moins 1.")).toBeVisible();
  await page.getByLabel("Nom de la ligue").fill(`Vide ${tag}`);
  await expect(page.getByRole("button", { name: "Créer la ligue" })).toBeDisabled();

  // With the competition under way, it can.
  await page.goto(`/ligues/creer?competition=${tag}`);
  await expect(page.getByRole("checkbox", { name: new RegExp(running) })).toBeChecked();
  await page.getByLabel("Nom de la ligue").fill(`En cours ${tag}`);
  await page.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = page.url().split("?")[0]!;

  // Points, as the admin would compute them: 10 on the event already played, 4 on the coming one.
  const score = (event: string, points: number) =>
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[{"kind":"exact","slot":1}]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${event}'`);
  score(`${tag}-played`, 10);
  score(`${tag}-coming`, 4);
  const friend = addFriendTo(leagueUrl, tag);
  // Members as if they joined long ago: only the entry of the competition leaves an event out.
  sql(`update league_members set joined_at = now() - interval '3 days'
       where league_id = '${leagueUrl.split("/").pop()}'`);
  await page.goto(leagueUrl);
  const rows = page.getByRole("list", { name: "Classement" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(player.pseudo);
  await expect(rows.first()).toContainText("4 points");
  await expect(rows.first()).not.toContainText("14 points");

  // Its creator adds a coming competition; its points count too.
  await page
    .getByLabel("Ajouter une compétition à venir ou en cours")
    .selectOption({ label: `Test ${coming}` });
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Compétition ajoutée");
  score(`${coming}-100m`, 7);
  await page.reload();
  await expect(rows.first()).toContainText("11 points");

  sql(`delete from auth.users where email = '${friend}'`);
  sql(`delete from competitions where slug = '${tag}'`);
  deleteCompetition(coming);
});
