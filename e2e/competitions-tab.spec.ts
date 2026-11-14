import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

// #659: the events tab became « Compétitions »: one competition, its days, its events by session.

test("an old link to the events tab leads to the competitions tab with the same choices", async ({
  page,
}) => {
  await page.goto("/epreuves?competition=ultimate-championship-2026&filtre=posed");

  await expect(page).toHaveURL(
    /\/competitions\?competition=ultimate-championship-2026&filtre=posed$/,
  );
  const bar = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(bar.getByRole("link", { name: "Compétitions" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("a visitor picks another competition from the sheet, then a day shows only its events", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Meeting deux jours ${tag}`;
  // Two days, one final each, in the evening Paris time.
  sql(`with c as (
      insert into competitions (slug, name, city, starts_on, ends_on)
      values ('e2e-days-${tag}', '${name}', 'Songeville', current_date + 300, current_date + 301)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, 'e2e-days-${tag}-' || d.slug, d.discipline, 'F', s, s
    from c, (values ('100m', '100 m', 0), ('200m', '200 m', 1)) d(slug, discipline, n),
      lateral (select ((current_date + 300 + d.n)::timestamp + interval '19 hours')
               at time zone 'Europe/Paris' as s) t`);

  await page.goto("/competitions?competition=ultimate-championship-2026");
  await page.getByRole("button", { name: /^Changer de compétition/ }).click();
  const sheet = page.getByRole("dialog", { name: "Choisir une compétition" });
  await sheet.getByRole("searchbox").fill("songeville");
  await sheet.getByRole("link", { name: new RegExp(name) }).click();

  await page.waitForURL(new RegExp(`competition=e2e-days-${tag}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(sheet).toBeHidden();
  // The first day opens before the competition, its final in the evening session.
  const evening = page.getByRole("region", { name: /^Soir/ });
  await expect(evening.getByRole("link", { name: /^100 m femmes,/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^200 m femmes,/ })).toHaveCount(0);

  const days = page.getByRole("navigation", { name: "Jours de la compétition" });
  await days.getByRole("link").nth(1).click();
  await page.waitForURL(/jour=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("link", { name: /^200 m femmes,/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^100 m femmes,/ })).toHaveCount(0);

  sql(`delete from competitions where slug = 'e2e-days-${tag}'`);
});

test("a competition without programme offers « Me prévenir », which a player turns on and off", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const slug = `e2e-pending-${tag}`;
  sql(`insert into competitions (slug, name, starts_on, ends_on)
       values ('${slug}', 'Meeting sans programme ${tag}', current_date + 40, current_date + 41)`);
  const alerts = () =>
    sql(`select count(*) from program_alerts a join competitions c on c.id = a.competition_id
         where c.slug = '${slug}'`);

  await page.goto(`/competitions?competition=${slug}`);
  await expect(
    page.getByRole("heading", { name: "Le programme n'est pas encore publié" }),
  ).toBeVisible();
  await expect(page.getByText("Début dans 40 jours")).toBeVisible();
  await page.getByRole("link", { name: "Connecte-toi pour être prévenu" }).click();
  await signUp(page, newPlayer("pending"));
  await page.waitForURL(new RegExp(`/competitions\\?competition=${slug}$`));

  await page.getByRole("button", { name: "Me prévenir à la publication" }).click();
  await expect(page.getByRole("button", { name: /Tu seras prévenu/ })).toBeVisible();
  expect(alerts()).toBe("1");

  await page.getByRole("button", { name: /Tu seras prévenu/ }).click();
  await expect(page.getByRole("button", { name: "Me prévenir à la publication" })).toBeVisible();
  expect(alerts()).toBe("0");

  sql(`delete from competitions where slug = '${slug}'`);
});
