import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player creates a private French Track Manager league that keeps its rules", async ({
  page,
}) => {
  const budget = sql("select rules ->> 'budget' from manager_rules");
  const creator = newPlayer("manager-league");
  await page.goto("/ligues");
  await signUp(page, creator);
  await page.waitForURL(/\/ligues$/);

  try {
    await page.getByRole("link", { name: "French Track Manager" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("French Track Manager");
    await expect(page.getByText("Tu n'es dans aucune ligue Manager")).toBeVisible();
    await page.getByRole("link", { name: "Créer une ligue Manager" }).click();

    // Every name is moderated, private leagues too.
    await page.getByLabel("Nom de la ligue").fill("Ligue FFA");
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(page.locator("main").getByText(/pas possible pour une ligue/)).toBeVisible();

    sql(`update manager_rules set rules = jsonb_set(rules, '{budget}', '130')`);
    await page.getByLabel("Nom de la ligue").fill("Les Lanceurs du dimanche");
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Les Lanceurs du dimanche");
    await expect(page.getByText("1 / 12 participants · Privée")).toBeVisible();
    // The creator is its admin and first participant; the code invites the others.
    const participants = page.getByRole("list", { name: "Participants" });
    await expect(participants.getByRole("listitem")).toHaveCount(1);
    await expect(participants).toContainText(creator.pseudo);
    await expect(participants).toContainText("admin");
    await expect(page.getByText("Code d'invitation")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "en nombre pair" })).toContainText(
      "de 4 à 12 participants, en nombre pair",
    );

    // The rules were copied at creation: a later change does not touch the league.
    await expect(page.getByText("130 crédits de budget")).toBeVisible();
    sql(`update manager_rules set rules = jsonb_set(rules, '{budget}', '999')`);
    await page.reload();
    await expect(page.getByText("130 crédits de budget")).toBeVisible();

    await page.getByRole("link", { name: "French Track Manager" }).click();
    // The card is a link named after the league, its participants as description (#495).
    const card = page
      .getByRole("list", { name: "Mes ligues Manager" })
      .getByRole("link", { name: "Les Lanceurs du dimanche", exact: true });
    await expect(card).toHaveAccessibleDescription(/participants/);
  } finally {
    sql(`update manager_rules set rules = jsonb_set(rules, '{budget}', '${budget}')`);
  }
});
