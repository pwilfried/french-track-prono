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
    // The Manager has its own tab in the bottom bar, no longer a link of the leagues page (#471).
    await expect(
      page.locator("main").getByRole("link", { name: "French Track Manager" }),
    ).toHaveCount(0);
    const bar = page.getByRole("navigation", { name: "Navigation principale" });
    await bar.getByRole("link", { name: "Manager", exact: true }).click();
    await page.waitForURL(/\/manager$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("French Track Manager");
    await expect(bar.getByRole("link", { name: "Manager", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Without a Manager league, the presentation of the mode, its figures from the rules (#618).
    const steps = page.getByRole("list", { name: "Le Manager en 5 étapes" });
    await expect(steps.getByRole("listitem")).toHaveCount(5);
    await expect(steps).toContainText(`${budget} crédits pour recruter`);
    await expect(page.getByRole("link", { name: "J'ai un code d'invitation" })).toHaveAttribute(
      "href",
      "/manager/rejoindre",
    );
    await page.getByRole("link", { name: "Créer une ligue Manager" }).click();
    await page.waitForURL(/\/manager\/creer$/);

    // Every name is moderated, private leagues too.
    await page.getByLabel("Nom de la ligue").fill("Ligue FFA");
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(page.locator("main").getByText(/pas possible pour une ligue/)).toBeVisible();

    sql(`update manager_rules set rules = jsonb_set(rules, '{budget}', '130')`);
    await page.getByLabel("Nom de la ligue").fill("Les Lanceurs du dimanche");
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Les Lanceurs du dimanche");
    await expect(page.getByText("1 / 4 participants · Privée")).toBeVisible();
    // The creator is its admin and first participant; the code invites the others.
    const participants = page.getByRole("list", { name: "Participants" });
    await expect(participants.getByRole("listitem")).toHaveCount(1);
    await expect(participants).toContainText(creator.pseudo);
    await expect(participants).toContainText("admin");
    await expect(page.getByText("Code d'invitation")).toBeVisible();
    // The mercato waits for the target, an even count from 4 to 10, 4 by default (#619).
    await expect(page.getByRole("status").filter({ hasText: "attendus" })).toContainText(
      "Encore 3 joueurs attendus.",
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
