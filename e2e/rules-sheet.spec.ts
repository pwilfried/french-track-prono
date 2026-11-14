import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { joinLeagueFor, newPlayer, signUp } from "./players";

test("a player reads the rules over the event page and keeps the podium being built", async ({
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
  const player = newPlayer("regles");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  joinLeagueFor(player.email, "ultimate-championship-2026");

  await page.goto(`/epreuves/${slug}`);
  const first = page.locator("li > button[aria-pressed]").first();
  const name = (await first.locator("span.font-bold").first().textContent())!.trim();
  await first.click();
  await expect(page.getByRole("button", { name: `1re place : ${name}` })).toBeVisible();

  // « Règles » opens the scale over the page, with a link to the full page.
  const help = page.getByRole("link", { name: "Comment jouer : les règles" });
  await help.click();
  const sheet = page.getByRole("dialog", { name: "Comment jouer" });
  await expect(sheet).toBeVisible();
  for (const title of ["Le podium", "Les cotes", "Les perfs", "Le joker", "Le coup de flair"]) {
    await expect(sheet.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(sheet.getByText(/podium parfait = 3 × \d+ \+ \d+ = \d+ points/)).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Toutes les règles" })).toHaveAttribute(
    "href",
    "/regles",
  );

  // Closed with Escape: still on the event, the athlete still placed, the focus back on « Règles ».
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(help).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));
  await expect(page.getByRole("button", { name: `1re place : ${name}` })).toBeVisible();

  // And with « Fermer ».
  await help.click();
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${slug}$`));
  await expect(page.getByRole("button", { name: `1re place : ${name}` })).toBeVisible();
});
