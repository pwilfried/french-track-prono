import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin proposes athletes with their odds and another athlete's, a wrong line pointed out", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const slug = `e2e-odds-${tag}`;
  // A competition with odds, an open event with six women on its start list.
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on, odds_enabled)
      values ('${slug}', 'Odds ${tag}', current_date + 60, current_date + 61, true) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, '${slug}-f-100m', '100 m', 'F', now() + interval '60 days', now() + interval '59 days' from c
      returning id
    )
    insert into entries (event_id, athlete_id)
    select e.id, a.id from e, (select id from athletes where gender = 'F' order by name limit 6) a`);
  const player = newPlayer("odds");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto(`/admin/${slug}-f-100m`);
  await page.getByRole("link", { name: "Cotes", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cotes · 100 m femmes");

  // A zero is refused before sending, on its own line.
  const propose = page.getByRole("button", { name: "Proposer" });
  for (let i = 0; i < 5; i++) await propose.first().click();
  const odds = page.getByLabel(/^Cote de /);
  for (let i = 0; i < 5; i++) await odds.nth(i).fill(String(1.5 + i));
  await odds.nth(2).fill("0");
  await page.getByLabel("Cote d'un autre athlète").fill("8");
  await page.getByRole("button", { name: "Enregistrer les cotes" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "doit être un nombre positif",
  );
  await expect(odds.nth(2)).toHaveAttribute("aria-invalid", "true");

  // Odds of 1 are fine (#294).
  await odds.nth(2).fill("1");
  await page.getByRole("button", { name: "Enregistrer les cotes" }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("✓ Enregistré.");
  await expect(page.getByLabel(/^Cote de /)).toHaveCount(5);
  await expect(page.getByLabel("Cote d'un autre athlète")).toHaveValue("8");

  sql(`delete from competitions where slug = '${slug}'`);
});
