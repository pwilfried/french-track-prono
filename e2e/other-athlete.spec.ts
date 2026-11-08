import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player predicts with the odds and puts « autre athlète » on the podium", async ({
  page,
}) => {
  // An open final in a competition of its own that plays with odds: 7 athletes on the start list,
  // the first 5 proposed, and « autre athlète ».
  const tag = `e2e-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on, odds_enabled)
      values ('${tag}', 'Test cotes ${tag}', current_date + 5, current_date + 6, true) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-100m', '100 m', 'F', now() + interval '5 days', now() + interval '5 days'
      from c returning id
    ), a as (
      select id, row_number() over (order by name) as n from athletes where gender = 'F' limit 7
    ), en as (
      insert into entries (event_id, athlete_id) select e.id, a.id from e, a returning athlete_id
    )
    insert into event_odds (event_id, athlete_id, odds)
    select e.id, a.id, 1 + a.n from e, a where a.n <= 5
    union all select e.id, null, 9 from e`);
  const player = newPlayer("cotes");

  await page.goto(`/epreuves/${tag}-100m`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${tag}-100m$`));

  const choices = page.locator("li > button[aria-pressed]");
  await expect(choices).toHaveCount(6);
  await expect(page.getByText("×9,00")).toBeVisible();
  await choices.nth(0).click();
  await page.getByRole("button", { name: /^Autre athlète/ }).click();
  await choices.nth(1).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");
  await expect(page.getByRole("button", { name: "2e place : Autre athlète" })).toBeVisible();

  expect(
    sql(`select num_nulls(p.p1, p.p2, p.p3) || ' ' || (p.p2 is null)
         from predictions p join auth.users u on u.id = p.user_id
         where u.email = '${player.email}'`),
  ).toBe("1 true");

  sql(`delete from competitions where slug = '${tag}'`);
});
