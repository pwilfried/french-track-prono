import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { chooseSeason, createLeague, seasonReady } from "./manager-season";
import { skipFirstMercatoGuide } from "./first-mercato";
import { newPlayer, signUp } from "./players";

test("two participants finish a mercato round: it closes at once and the next one opens (#1084)", async ({
  browser,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const league = `Tour fini ${tag}`;
  const athlete = `Fini Athlète ${tag}`;
  const slug = `fini-athlete-${tag}`;
  sql(`insert into athletes (slug, name, country_code, gender, manager_price)
       values ('${slug}', '${athlete}', 'FRA', 'F', 10)`);
  sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
       select id, '100 m', true from athletes where slug = '${slug}'`);
  const owner = newPlayer("finish-owner");
  const rival = newPlayer("finish-rival");
  const ownerPage = await (await browser.newContext()).newPage();
  const rivalPage = await (await browser.newContext()).newPage();
  await skipFirstMercatoGuide(ownerPage);
  await skipFirstMercatoGuide(rivalPage);

  try {
    await ownerPage.goto("/manager/creer");
    await signUp(ownerPage, owner);
    await ownerPage.waitForURL(/\/manager\/creer$/);
    await ownerPage.getByLabel("Nom de la ligue").fill(league);
    await chooseSeason(ownerPage);
    await createLeague(ownerPage);
    await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText(league);
    const code = sql(`select invite_code from manager_leagues where name = '${league}'`);
    await rivalPage.goto("/connexion?next=/manager");
    await signUp(rivalPage, rival);
    await rivalPage.waitForURL(/\/manager$/);
    await rivalPage.goto(`/manager/rejoindre?code=${code}`);
    await rivalPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
    await expect(rivalPage.getByRole("heading", { level: 1 })).toHaveText(league);

    // Round 1 opened a minute ago, for its planned 48 hours.
    sql(`update manager_leagues
         set rules = rules || '{"budget": 100, "closeModes": ["last_bidder"]}',
         mercato_opened_at = now() - interval '1 minute' where name = '${league}'`);
    const id = sql(`select id from manager_leagues where name = '${league}'`);
    const catalogue = `/manager/${id}/catalogue?q=${tag}`;

    // The owner bids, then finishes the round, after a confirmation: no more bids from them.
    await ownerPage.goto(catalogue);
    const card = ownerPage.getByRole("article", { name: athlete });
    await card.getByRole("button", { name: "Enchérir" }).click();
    await card.getByLabel(`Mon offre sur ${athlete}, en crédits`).fill("15");
    await card.getByRole("button", { name: "Valider" }).click();
    await expect(card).toContainText("Mon offre : 15 cr.");
    const budget = ownerPage.getByRole("region", { name: "Mon budget" });
    await budget.getByRole("button", { name: "J'ai fini ce tour" }).click();
    await expect(budget).toContainText("Tu ne pourras plus enchérir ni changer tes offres");
    await budget.getByRole("button", { name: "Oui, j'ai fini" }).click();
    await expect(budget.getByText("Tour terminé, en attente des autres (1/2)")).toBeVisible();
    await expect(card.getByRole("button", { name: "Modifier" })).toHaveCount(0);

    // The rival sees 1 of 2 done, and finishes too: the round closes without waiting its end.
    await rivalPage.goto(catalogue);
    const theirs = rivalPage.getByRole("region", { name: "Mon budget" });
    await theirs.getByRole("button", { name: "J'ai fini ce tour" }).click();
    await theirs.getByRole("button", { name: "Oui, j'ai fini" }).click();
    await rivalPage.waitForURL(/\/tour\/1$/);
    await expect(rivalPage.getByRole("heading", { level: 1 })).toHaveText("L'heure de vérité");
    // Back to the mercato: round 2, without the reveal again (#1120).
    await rivalPage.getByRole("button", { name: "Voir toutes les enchères du tour" }).click();
    await rivalPage.getByRole("button", { name: "Retour au mercato · tour suivant" }).click();
    await rivalPage.waitForURL(/\/catalogue$/);
    await expect(theirs.getByRole("button", { name: "J'ai fini ce tour" })).toBeVisible();

    // The owner gets the reveal too, then round 2 is under way, and they bid again.
    await ownerPage.goto(catalogue);
    await ownerPage.waitForURL(/\/tour\/1$/);
    await ownerPage.goto(`/manager/${id}`);
    await expect(ownerPage.getByText(/^Tour 2 en cours jusqu'au/).first()).toBeVisible();
    const calendar = ownerPage.getByRole("list", { name: "Calendrier des tours" });
    await expect(calendar.getByRole("listitem").first()).toContainText("terminé");
    await expect(calendar.getByRole("listitem").nth(1)).toContainText("en cours");
    await ownerPage.goto(catalogue);
    await expect(budget.getByRole("list", { name: "Mes athlètes" })).toContainText(athlete);
    await expect(budget.getByRole("button", { name: "J'ai fini ce tour" })).toBeVisible();
  } finally {
    sql(`delete from manager_leagues where name = '${league}'`);
    sql(`delete from athletes where slug = '${slug}'`);
  }
});
