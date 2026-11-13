import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { addFriendTo, newPlayer, signUp } from "./players";

test("a sprint league counts the 100 m and not the javelin, until its creator adds throws", async ({
  page,
}) => {
  // A coming competition of its own with a 100 m final and a javelin final.
  const tag = `e2e-fam-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Test familles ${tag}', current_date + 330, current_date + 331)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${tag}-100m', '100 m', 'F', now() + interval '330 days', now() + interval '330 days'
    from c
    union all
    select id, '${tag}-javelot', 'Javelot', 'F', now() + interval '331 days', now() + interval '331 days'
    from c`);
  const player = newPlayer("fam");

  // The player creates a league « Sprint » on that competition.
  await page.goto(`/ligues/creer?competition=${tag}`);
  await signUp(page, player);
  await page.waitForURL(/\/ligues\/creer\?/);
  await page.getByLabel("Nom de la ligue").fill(`Sprint ${tag}`.slice(0, 40));
  await page.getByRole("radio", { name: /Certaines familles/ }).check();
  const create = page.getByRole("button", { name: "Créer la ligue" });
  await expect(create).toBeDisabled();
  await page
    .locator("label")
    .filter({ hasText: /^Sprint$/ })
    .click();
  await expect(page.getByText("Comptent dans la ligue : Sprint")).toBeVisible();
  await create.click();
  await expect(page.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = page.url().split("?")[0]!;

  // Points on both predictions, as the admin would compute them: 5 on the 100 m, 9 on the javelin.
  for (const [event, points] of [
    ["100m", 5],
    ["javelot", 9],
  ] as const) {
    sql(`insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
      select u.id, e.competition_id, e.id, 'prediction', ${points}, 'prediction',
             jsonb_build_object('reasons', '[]'::jsonb)
      from auth.users u, events e
      where u.email = '${player.email}' and e.slug = '${tag}-${event}'`);
  }
  const friend = addFriendTo(leagueUrl, tag);

  // Only the 100 m counts in the league; the javelin is listed « Hors ligue ».
  await page.goto(leagueUrl);
  await expect(page.getByLabel("Épreuves qui comptent : Sprint")).toBeVisible();
  const me = page
    .getByRole("list", { name: "Classement" })
    .getByRole("listitem")
    .filter({ hasText: player.pseudo });
  await expect(me).toContainText("5 points");
  await expect(page.getByRole("link", { name: /Javelot femmes/ })).toContainText("Hors ligue");
  await expect(page.getByRole("link", { name: /100 m femmes/ })).not.toContainText("Hors ligue");

  // The general ranking of the competition still counts both.
  await page.goto(`/classement?vue=general&competition=${tag}`);
  await expect(
    page
      .getByRole("list", { name: "Classement" })
      .getByRole("listitem")
      .filter({ hasText: player.pseudo }),
  ).toContainText("14 points");

  // The creator adds the throws: the javelin has not started, so it counts from now on.
  await page.goto(leagueUrl);
  await page.getByRole("link", { name: "+ Ajouter une famille" }).click();
  await expect(page.getByLabel("Sprint, déjà dans la ligue")).toBeVisible();
  await page.getByRole("link", { name: "Lancers" }).click();
  await expect(page.getByRole("link", { name: /Javelot femmes/ })).toContainText("Compte");
  await page.getByRole("button", { name: "Ajouter Lancers" }).click();
  await page.waitForURL(leagueUrl);
  await expect(page.getByText(/Lancers compte dans la ligue depuis le/)).toBeVisible();
  await expect(me).toContainText("14 points");

  sql(`delete from auth.users where email = '${friend}'`);
  sql(`delete from competitions where slug = '${tag}'`);
});
