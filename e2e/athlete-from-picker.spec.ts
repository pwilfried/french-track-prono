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
  const athletes = page.locator("li > button[aria-pressed]");
  const nameOf = async (index: number) =>
    (await athletes.nth(index).locator("span.font-bold").first().textContent())!.trim();
  const [first, second, third] = [await nameOf(0), await nameOf(1), await nameOf(2)];
  await athletes.nth(0).click();
  await athletes.nth(1).click();
  await page.getByRole("switch", { name: /Joker/ }).check();
  const podium = page.getByRole("button", { name: `1re place : ${first}` });
  const runnerUp = page.getByRole("button", { name: `2e place : ${second}` });
  await expect(podium).toBeVisible();
  await expect(runnerUp).toBeVisible();

  // The back link of the athlete's page leads back to the podium being built, in view.
  await page.getByRole("link", { name: `Fiche de ${third}` }).click();
  await expect(page).toHaveURL(/\/athletes\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(third);
  await page.getByRole("link", { name: "‹ Mon podium" }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}(#podium)?$`));
  await expect(podium).toBeInViewport();
  await expect(runnerUp).toBeVisible();
  await expect(page.getByRole("switch", { name: /Joker/ })).toBeChecked();

  // The browser back button does the same.
  await page.getByRole("link", { name: `Fiche de ${third}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(third);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}(#podium)?$`));
  await expect(podium).toBeInViewport();
  await expect(runnerUp).toBeVisible();
  await expect(page.getByRole("switch", { name: /Joker/ })).toBeChecked();
});

test("an athlete's page opened from elsewhere goes back to the events", async ({ page }) => {
  for (const from of ["https://evil.test/epreuves/x", "/competitions", "//evil.test"]) {
    await page.goto(`/athletes/sha-carri-richardson?from=${encodeURIComponent(from)}`);
    await expect(page.getByRole("link", { name: "‹ Épreuves" })).toHaveAttribute(
      "href",
      "/competitions",
    );
  }
});
