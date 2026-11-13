import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("the competitions sheet offers the competitions of my leagues first", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Meeting E2E ${tag}`;
  sql(`with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('e2e-mine-${tag}', '${name}', current_date + 350, current_date + 351)
      returning id
    )
    insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
    select id, 'e2e-mine-${tag}-100m', '100 m', 'F', now() + interval '350 days', now() + interval '350 days'
    from c`);
  const player = newPlayer("mine");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, `e2e-mine-${tag}`);

  await page.goto("/competitions?competition=ultimate-championship-2026");
  await page.getByRole("button", { name: /^Changer de compétition/ }).click();
  const sheet = page.getByRole("dialog", { name: "Choisir une compétition" });
  await expect(sheet.getByRole("heading", { level: 3 }).first()).toHaveText("Dans mes ligues");
  await sheet.getByRole("link", { name: new RegExp(name) }).click();
  await page.waitForURL(new RegExp(`competition=e2e-mine-${tag}`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  // The card is a link named by the event (#517), its label kept in a hidden span.
  await expect(page.getByRole("link", { name: /^100 m, Femmes/ })).toBeVisible();

  sql(`delete from competitions where slug = 'e2e-mine-${tag}'`);
});
