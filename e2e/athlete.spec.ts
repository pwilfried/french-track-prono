import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

test("a visitor opens an athlete from a start list and sees a PR and a recent race", async ({
  page,
}) => {
  // The open-events script removes the competition's results, so she gets a race of her own: a
  // past meeting in a competition of its own (the records trigger keeps her PR up to date).
  const tag = `e2e-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${tag}', 'Meeting ${tag}', current_date - 30, current_date - 30) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-100m', '100 m', 'F', now() - interval '30 days', now() - interval '30 days'
      from c returning id
    ), a as (select id from athletes where slug = 'sha-carri-richardson'),
    en as (insert into entries (event_id, athlete_id) select e.id, a.id from e, a returning event_id, athlete_id)
    insert into results (event_id, athlete_id, rank, mark) select event_id, athlete_id, 2, '10.81' from en`);

  await page.goto("/epreuves/f-100m");
  await page.getByRole("link", { name: "Sha'Carri Richardson" }).click();

  await expect(page).toHaveURL(/\/athletes\/sha-carri-richardson$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sha'Carri Richardson");
  const records = page.getByRole("region", { name: "Records" });
  await expect(records.getByText("PB", { exact: true }).first()).toBeVisible();
  await expect(records.getByText(/^\d+\.\d{2}$/).first()).toBeVisible();
  const races = page.getByRole("region", { name: "Dernières courses" }).getByRole("listitem");
  // Other suites may leave a more recent race for her, so look for this meeting's race by name.
  await expect(races.filter({ hasText: `Meeting ${tag}` })).toContainText("10.81");

  sql(`delete from competitions where slug = '${tag}'`);
});

test("an unknown athlete gives the not-found page", async ({ page }) => {
  const response = await page.goto("/athletes/no-such-athlete");
  expect(response?.status()).toBe(404);
});
