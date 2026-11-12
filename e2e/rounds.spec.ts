import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

/** Puts a single athlete in a round of the test and gives them the official result. */
const runRound = (slug: string, athlete: string, mark: string) =>
  sql(`with s as (select id from events where slug = '${slug}'),
    a as (select id from athletes where slug = '${athlete}'),
    en as (insert into entries (event_id, athlete_id) select s.id, a.id from s, a returning event_id, athlete_id)
    insert into results (event_id, athlete_id, rank, mark) select event_id, athlete_id, 1, '${mark}' from en`);

test("a final opens to predictions once its semi-finals are run, and shows the semi-final times", async ({
  page,
}) => {
  const tag = `e2e-rounds-${Date.now() % 1000000}`;
  // A final and its two semi-finals in the competition.
  sql(`with c as (select id from competitions where slug = 'ultimate-championship-2026'),
    f as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-final', '200 m', 'F', now() + interval '60 days', now() + interval '59 days' from c
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, round, parent_id)
    select c.id, '${tag}-semi' || n, '200 m', 'F', now() + interval '58 days', now() + interval '58 days', 'semi', f.id
    from c, f, generate_series(1, 2) n`);
  // The first semi-final has its result, which finishes it (#488); the second has not run yet.
  runRound(`${tag}-semi1`, "sha-carri-richardson", "22.05");

  // Players see the final only in the list.
  await page.goto("/epreuves");
  await expect(page.locator(`a[href^="/epreuves/${tag}-semi"]`)).toHaveCount(0);

  await page.goto(`/epreuves/${tag}-final`);
  // The loading skeleton is a second <main> while the page streams: wait for the real heading.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("200 m");
  await expect(
    page.getByText("Les pronos ouvrent quand les tours précédents sont terminés."),
  ).toBeVisible();
  await page.getByText("Perfs des tours précédents (2)").click();
  const semi = page.getByRole("region", { name: /^Demi-finale/ }).filter({ hasText: "22.05" });
  await expect(semi).toContainText("Sha'Carri Richardson");

  // Once the second semi-final has its result, the final takes predictions.
  runRound(`${tag}-semi2`, "julien-alfred", "22.10");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("200 m");
  await expect(page.getByText("Connecte-toi pour pronostiquer")).toBeVisible();

  sql(`delete from events where slug like '${tag}-%'`);
});
