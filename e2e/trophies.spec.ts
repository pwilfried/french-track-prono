import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

test("an admin sets the FrenchTrack account and draws the trophies; a player sees them on the shelf of their season", async ({
  page,
}) => {
  // The account of the Témoin d'or is shared with the other tests and pre-production: put back.
  const witness = sql("select coalesce(witness_id::text, 'null') from trophy_settings");
  const player = newPlayer("vitrine");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // No trophy yet: the showcase says how to win the first one.
  const showcase = page.getByRole("region", { name: "Vitrine" });
  await expect(showcase).toContainText("Pas encore de trophée");

  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );
  try {
    await page.goto("/admin/tableau-de-bord");
    await openAdminSection(page, "Trophées");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trophées");

    await page.getByLabel("Pseudo du compte (vide : aucun)").fill("Personne ne porte ce nom");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Aucun joueur ne porte ce pseudo.",
    );
    await page.getByLabel("Pseudo du compte (vide : aucun)").fill(player.pseudo.toLowerCase());
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("main").getByRole("status")).toHaveText(
      "Compte FrenchTrack enregistré.",
    );

    // Drawing the trophies says how many the season has; the button tells it is working.
    await page.getByRole("button", { name: "Attribuer les trophées" }).click();
    await expect(page.locator("main").getByRole("status").last()).toContainText(/Saison \d{4} :/);
  } finally {
    sql(`update trophy_settings set witness_id = ${witness === "null" ? "null" : `'${witness}'`}`);
    sql(
      `update profiles set is_admin = false where id = (select id from auth.users where email = '${player.email}')`,
    );
  }

  // Two trophies of a season of their own (2099: no draw replaces them during the test).
  const userId = sql(`select id from auth.users where email = '${player.email}'`);
  sql(`insert into trophies (user_id, season, kind, metal, league_id, league_name, animal) values
    ('${userId}', 2099, 'league', 'gold', gen_random_uuid(), 'Ligue des lanceurs', 'bear'),
    ('${userId}', 2099, 'chrono', null, gen_random_uuid(), 'Ligue des lanceurs', null)`);
  await page.goto("/profil");
  const shelf = showcase.getByRole("group", { name: /Saison 2099/ });
  await expect(shelf).toContainText("2 trophées");
  await expect(shelf.getByRole("listitem")).toHaveText([
    /Ours d'or\s*Ligue des lanceurs/,
    /Chrono figé\s*Ligue des lanceurs/,
  ]);
  // The shelf fits the phone screen: nothing wider than the page.
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
