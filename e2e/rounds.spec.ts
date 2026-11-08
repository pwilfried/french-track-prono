import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

test("a final opens to predictions once its semi-final is run, and shows the semi-final times", async ({
  page,
}) => {
  const tag = `e2e-rounds-${Date.now() % 1000000}`;
  // A final and its semi-final in the competition; the semi-final has a result, not finished yet.
  sql(`with c as (select id from competitions where slug = 'ultimate-championship-2026'),
    f as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-final', '200 m', 'F', now() + interval '60 days', now() + interval '59 days' from c
      returning id
    ),
    s as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, round, parent_id)
      select c.id, '${tag}-semi', '200 m', 'F', now() + interval '58 days', now() + interval '58 days', 'semi', f.id
      from c, f returning id
    ),
    a as (select id from athletes where slug = 'sha-carri-richardson'),
    en as (insert into entries (event_id, athlete_id) select s.id, a.id from s, a returning event_id, athlete_id)
    insert into results (event_id, athlete_id, rank, mark) select event_id, athlete_id, 1, '22.05' from en`);

  // Players see the final only in the list.
  await page.goto("/epreuves");
  await expect(page.locator(`a[href="/epreuves/${tag}-semi"]`)).toHaveCount(0);

  await page.goto(`/epreuves/${tag}-final`);
  await expect(page.locator("main")).toContainText(
    "Les pronos ouvrent quand les tours précédents sont terminés.",
  );
  await page.getByText("Perfs des tours précédents (1)").click();
  const semi = page.getByRole("region", { name: "Demi-finale 1" });
  await expect(semi).toContainText("Sha'Carri Richardson");
  await expect(semi).toContainText("22.05");

  // Once the semi-final is finished, the final takes predictions.
  sql(`update events set status = 'finished' where slug = '${tag}-semi'`);
  await page.reload();
  await expect(
    page.locator("main").getByRole("link", { name: "Se connecter", exact: true }),
  ).toBeVisible();

  sql(`delete from events where slug like '${tag}-%'`);
});
