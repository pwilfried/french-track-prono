import { expect, test } from "@playwright/test";

import { createTestEvent, sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

// #693: competitions, events, disciplines and the scale are kept across requests. A change made
// through the back-office shows at once; the lock is still decided by the database.

test("the event list comes from the cache, and the admin's new event time shows on the next page load", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const competition = `test-cache-${tag}`;
  const event = `${competition}-f-100m`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${competition}', 'Test cache ${tag}', '2099-06-25', '2099-06-25') returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, '${event}', '100 m', 'F', s, s from c,
      lateral (select timestamp '2099-06-25 20:35' at time zone 'Europe/Paris' as s) t`);

  const player = newPlayer("cache");
  await page.goto(`/epreuves/${event}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${event}$`));
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  const card = page.getByRole("link", { name: /^100 m femmes,/ });
  await page.goto(`/competitions?competition=${competition}`);
  await expect(card).toContainText("20:35");

  // A change made behind the app's back is not read again while the cache is fresh.
  sql(
    `update events set starts_at = timestamp '2099-06-25 20:50' at time zone 'Europe/Paris',
       lock_at = timestamp '2099-06-25 20:50' at time zone 'Europe/Paris' where slug = '${event}'`,
    { keepCache: true },
  );
  await page.reload();
  await expect(card).toContainText("20:35");

  // The admin moves the event: the cache expires at once.
  await page.goto(`/admin/${event}`);
  await page.getByText("Modifier l'épreuve").click();
  await page.getByLabel("Horaire (heure de Paris)").fill("2099-06-25T21:10");
  await page.getByRole("button", { name: "Enregistrer l'épreuve" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/${event}\\?enregistre=1$`));

  await page.goto(`/competitions?competition=${competition}`);
  await expect(card).toContainText("21:10");

  sql(`delete from competitions where slug = '${competition}'`);
});

test("a prediction is refused after the lock even when the event list came from the cache", async ({
  page,
}) => {
  const { competitionSlug, eventId } = createTestEvent();
  const event = sql(`select slug from events where id = '${eventId}'`);
  const player = newPlayer("cache-lock");

  await page.goto(`/epreuves/${event}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${event}$`));

  // The list of the competition is read once, then kept.
  await page.goto(`/competitions?competition=${competitionSlug}`);
  await page.goto(`/epreuves/${event}`);
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();

  // The event locks without the cache knowing; the database still refuses the prediction.
  sql(`update events set lock_at = now() - interval '1 second' where id = '${eventId}'`, {
    keepCache: true,
  });
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Trop tard");

  sql(`delete from competitions where slug = '${competitionSlug}'`);
});
