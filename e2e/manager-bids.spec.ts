import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a participant bids secretly within the budget, changes and withdraws a bid", async ({
  browser,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const league = `Enchères ${tag}`;
  const first = `Enchère Une ${tag}`;
  const second = `Enchère Deux ${tag}`;
  const third = `Enchère Trois ${tag}`;
  const slugs = ["une", "deux", "trois", "quatre"].map((n) => `enchere-${n}-${tag}`);
  for (const [slug, name, price] of [
    [slugs[0], first, 30],
    [slugs[1], second, 20],
    [slugs[2], third, 10],
    [slugs[3], `Enchère Quatre ${tag}`, 10],
  ] as const) {
    sql(`insert into athletes (slug, name, country_code, gender, manager_price)
         values ('${slug}', '${name}', 'FRA', 'F', ${price})`);
    sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
         select id, '100 m', true from athletes where slug = '${slug}'`);
  }
  const owner = newPlayer("bid-owner");
  const rival = newPlayer("bid-rival");
  const ownerPage = await (await browser.newContext()).newPage();
  const rivalPage = await (await browser.newContext()).newPage();

  try {
    // Two participants in a league, before the mercato opens.
    await ownerPage.goto("/manager/creer");
    await signUp(ownerPage, owner);
    await ownerPage.waitForURL(/\/manager\/creer$/);
    await ownerPage.getByLabel("Nom de la ligue").fill(league);
    await ownerPage.getByRole("button", { name: "Créer la ligue" }).click();
    await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText(league);
    const code = sql(`select invite_code from manager_leagues where name = '${league}'`);
    await rivalPage.goto("/manager");
    await signUp(rivalPage, rival);
    await rivalPage.waitForURL(/\/manager$/);
    await rivalPage.goto(`/manager/rejoindre?code=${code}`);
    await rivalPage.getByRole("button", { name: "Rejoindre la ligue" }).click();
    await expect(rivalPage.getByRole("heading", { level: 1 })).toHaveText(league);

    const catalogue = `/manager/${sql(`select id from manager_leagues where name = '${league}'`)}/catalogue`;
    const search = `?q=${tag}`;
    await ownerPage.goto(catalogue + search);
    await expect(ownerPage.getByText("le mercato de cette ligue n'est pas ouvert")).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: "Enchérir" })).toHaveCount(0);

    sql(`update manager_leagues
         set rules = rules || '{"budget": 100, "closeModes": ["last_bidder"]}',
         mercato_opened_at = now() - interval '1 minute' where name = '${league}'`);

    // Bids on two athletes; below the price or over the budget is refused.
    await ownerPage.goto(catalogue + search);
    const budget = ownerPage.getByRole("region", { name: "Mon budget" });
    await expect(budget).toContainText("Disponible100 cr.");
    const firstCard = ownerPage.getByRole("article", { name: first });
    const secondCard = ownerPage.getByRole("article", { name: second });
    // The bid form stays folded behind « Enchérir » (#503); + and − move the amount by a credit.
    await firstCard.getByRole("button", { name: "Enchérir" }).click();
    const firstAmount = firstCard.getByLabel(`Mon offre sur ${first}, en crédits`);
    await expect(firstAmount).toHaveValue("30");
    await firstCard.getByRole("button", { name: "Monter mon offre d'un crédit" }).click();
    await expect(firstAmount).toHaveValue("31");
    await firstCard.getByRole("button", { name: "Baisser mon offre d'un crédit" }).click();
    await firstCard.getByRole("button", { name: "Baisser mon offre d'un crédit" }).click();
    await expect(firstAmount).toHaveValue("30");
    await firstAmount.fill("40");
    await firstCard.getByRole("button", { name: "Valider" }).click();
    await expect(firstCard).toContainText("Mon offre : 40 cr.");
    await expect(firstAmount).toHaveCount(0);
    await expect(budget).toContainText("Réservé40 cr.");

    await secondCard.getByRole("button", { name: "Enchérir" }).click();
    await secondCard.getByLabel(`Mon offre sur ${second}, en crédits`).fill("61");
    await secondCard.getByRole("button", { name: "Valider" }).click();
    await expect(secondCard.getByRole("alert")).toContainText("dépasseraient ton budget");
    await secondCard.getByLabel(`Mon offre sur ${second}, en crédits`).fill("60");
    await secondCard.getByRole("button", { name: "Valider" }).click();
    await expect(secondCard).toContainText("Mon offre : 60 cr.");
    await expect(budget).toContainText("Disponible0 cr.");

    // A change recomputes the reservation; a withdrawn bid frees its credits.
    await firstCard.getByRole("button", { name: "Modifier" }).click();
    await firstCard.getByLabel(`Mon offre sur ${first}, en crédits`).fill("35");
    await firstCard.getByRole("button", { name: "Valider" }).click();
    await expect(firstCard).toContainText("Mon offre : 35 cr.");
    await expect(budget).toContainText("Disponible5 cr.");
    await secondCard.getByRole("button", { name: "Modifier" }).click();
    await secondCard.getByRole("button", { name: "Retirer" }).click();
    await expect(secondCard).not.toContainText("Mon offre");
    await expect(budget).toContainText("Disponible65 cr.");
    await expect(budget.getByRole("list", { name: "Mes offres" })).toContainText(first);

    // The rival sees none of it: no bid, all of their budget.
    await rivalPage.goto(catalogue + search);
    const theirs = rivalPage.getByRole("region", { name: "Mon budget" });
    await expect(theirs).toContainText("Réservé0 cr.");
    await expect(theirs).toContainText("Aucune offre pour l'instant.");
    await expect(rivalPage.getByRole("article", { name: first })).not.toContainText("Mon offre");

    // The round closes (#423): each athlete goes to the best bid; the result shows in the budget.
    const rivalSecond = rivalPage.getByRole("article", { name: second });
    await rivalSecond.getByRole("button", { name: "Enchérir" }).click();
    await rivalSecond.getByLabel(`Mon offre sur ${second}, en crédits`).fill("30");
    await rivalSecond.getByRole("button", { name: "Valider" }).click();
    await expect(rivalSecond).toContainText("Mon offre : 30 cr.");
    sql(`update manager_leagues set mercato_opened_at = now() - interval '49 hours'
         where name = '${league}'`);
    sql(`select private.close_manager_rounds()`);

    await ownerPage.goto(catalogue + search);
    await expect(budget.getByRole("list", { name: "Mes athlètes" })).toContainText(first);
    await expect(budget).toContainText("Dépensé35 cr.");
    await expect(budget).toContainText("Disponible65 cr.");
    await expect(budget).toContainText("Aucune offre pour l'instant.");
    await expect(firstCard).toContainText("Recruté");
    await expect(firstCard.getByRole("button", { name: "Enchérir" })).toHaveCount(0);
    await rivalPage.goto(catalogue + search);
    await expect(theirs.getByRole("list", { name: "Mes athlètes" })).toContainText(second);
    await expect(theirs).toContainText("Disponible70 cr.");
    await expect(theirs.getByRole("button", { name: "Clore le mercato" })).toHaveCount(0);

    // The mercato closes (#424): once the rival has spent everything, the owner is the last
    // participant who can recruit; their bid under way is resolved, then nobody bids any more.
    const rivalId = sql(`select id from auth.users where email = '${rival.email}'`);
    sql(`insert into manager_awards (league_id, athlete_id, user_id, amount, round)
         select l.id, a.id, '${rivalId}', 70, 1 from manager_leagues l, athletes a
         where l.name = '${league}' and a.slug = '${slugs[3]}'`);
    await ownerPage.goto(catalogue + search);
    const thirdCard = ownerPage.getByRole("article", { name: third });
    await thirdCard.getByLabel(`Mon offre sur ${third}, en crédits`).fill("10");
    await thirdCard.getByRole("button", { name: "Enchérir" }).click();
    await expect(thirdCard).toContainText("Mon offre : 10 cr.");
    await budget.getByRole("button", { name: "Clore le mercato" }).click();
    await expect(budget.getByRole("status")).toContainText("Le mercato de cette ligue est clos");
    await expect(budget.getByRole("list", { name: "Mes athlètes" })).toContainText(third);
    await expect(ownerPage.getByRole("button", { name: "Enchérir" })).toHaveCount(0);
    await rivalPage.goto(catalogue + search);
    await expect(theirs.getByRole("status")).toContainText("Le mercato de cette ligue est clos");
  } finally {
    sql(`delete from manager_leagues where name = '${league}'`);
    sql(`delete from athletes where slug in ('${slugs.join("', '")}')`);
  }
});
