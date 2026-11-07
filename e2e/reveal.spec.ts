import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player cannot see a friend's podium before the lock and sees it after", async ({
  browser,
}) => {
  // An open event of its own (the prediction journey uses the first one).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.lock_at > now() + interval '5 minutes'
     order by e.starts_at offset 3 limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const anna = newPlayer("anna");
  const bob = newPlayer("bob");
  const annaPage = await (await browser.newContext()).newPage();
  const bobPage = await (await browser.newContext()).newPage();

  // Anna predicts.
  await annaPage.goto(`/connexion?next=/epreuves/${slug}`);
  await signUp(annaPage, anna);
  await annaPage.waitForURL(new RegExp(`/epreuves/${slug}$`));
  const athletes = annaPage.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await annaPage.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(annaPage.getByRole("status")).toContainText("Podium enregistré");

  // Before the lock, Bob sees nothing of Anna's podium.
  await bobPage.goto(`/connexion?next=/epreuves/${slug}`);
  await signUp(bobPage, bob);
  await bobPage.waitForURL(new RegExp(`/epreuves/${slug}$`));
  await expect(
    bobPage.getByText("Les pronos des autres se dévoilent au verrouillage."),
  ).toBeVisible();
  await expect(bobPage.getByText(anna.pseudo)).toHaveCount(0);

  // After the lock, he sees it.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await bobPage.reload();
  await expect(bobPage.getByRole("heading", { name: "Les pronos" })).toBeVisible();
  await expect(bobPage.getByText(anna.pseudo)).toBeVisible();
});
