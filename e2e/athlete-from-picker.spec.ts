import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("a player opens an athlete's page from the podium picker and keeps the podium", async ({
  page,
}) => {
  // A final still open (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.round = 'final'
       and e.lock_at > now() + interval '5 minutes'
     order by e.starts_at limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const player = newPlayer("fiche");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, "ultimate-championship-2026");

  await page.goto(`/epreuves/${slug}`);
  const first = page.locator("li > button[aria-pressed]").first();
  const name = (await first.locator("span.font-bold").first().textContent())!.trim();
  await first.click();
  await expect(page.getByRole("button", { name: `1re place : ${name}` })).toBeVisible();

  await page.getByRole("link", { name: `Fiche de ${name}` }).click();
  await expect(page).toHaveURL(/\/athletes\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));
  await expect(page.getByRole("button", { name: `1re place : ${name}` })).toBeVisible();
});
