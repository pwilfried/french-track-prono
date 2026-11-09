import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("the events tab offers the competitions of my leagues first", async ({ page }) => {
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

  await page.goto("/epreuves");
  const picker = page.getByRole("navigation", { name: "Choisir la compétition" });
  await expect(picker.getByText("Mes ligues")).toBeVisible();
  await picker.getByRole("link", { name: name }).click();
  await page.waitForURL(new RegExp(`competition=e2e-mine-${tag}`));
  await expect(picker.getByRole("link", { name: name })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("100 m").first()).toBeVisible();

  sql(`delete from competitions where slug = 'e2e-mine-${tag}'`);
});
