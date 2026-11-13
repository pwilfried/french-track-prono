import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";

test("an event of a French competition opens from its competition page", async ({ page }) => {
  const tag = `e2e-${Date.now() % 1000000}`;
  sql(`with c as (
      insert into competitions (slug, name, scope, starts_on, ends_on)
      values ('${tag}', 'Test France ${tag}', 'france', current_date + 3, current_date + 4)
      returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${tag}-f-100m', '100 m', 'F', now() + interval '3 days', now() + interval '3 days'
      from c returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, a.id from e, (select id from athletes where gender = 'F' limit 4) a`);

  await page.goto(`/competitions/${tag}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Test France ${tag}`);
  await page.getByRole("link", { name: /^100 m, Femmes/ }).click();

  await expect(page).toHaveURL(new RegExp(`/epreuves/${tag}-f-100m$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("100 m — Finale");
  await expect(page.locator("main").getByRole("link", { name: /^‹ Épreuves$/ })).toHaveAttribute(
    "href",
    new RegExp(`^/competitions\\?competition=${tag}&jour=\\d{4}-\\d{2}-\\d{2}$`),
  );

  sql(`delete from competitions where slug = '${tag}'`);
});
