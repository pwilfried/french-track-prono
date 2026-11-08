import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

test("a combined event lists its disciplines and offers the same podium prediction", async ({
  page,
}) => {
  // A heptathlon of the competition, open, with the start list of an existing women's event.
  const slug = `e2e-heptathlon-${Date.now() % 1000000}`;
  sql(`with e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, kind, sub_disciplines)
      select id, '${slug}', 'Heptathlon', 'F', now() + interval '60 days', now() + interval '59 days',
             'combined', array['100 m haies','Hauteur','Poids','200 m','Longueur','Javelot','800 m']
      from competitions where slug = 'ultimate-championship-2026'
      returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, en.athlete_id from e, entries en
    where en.event_id = (select id from events where slug = 'f-100m' limit 1)`);

  await page.goto(`/epreuves/${slug}`);

  const disciplines = page.getByRole("region", { name: "Épreuve combinée · 7 disciplines" });
  await expect(disciplines.getByRole("listitem")).toHaveCount(7);
  await expect(disciplines.getByRole("listitem").last()).toContainText("800 m");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Heptathlon");
  await expect(
    page.locator("main").getByRole("link", { name: "Se connecter", exact: true }),
  ).toBeVisible();

  sql(`delete from events where slug = '${slug}'`);
});
