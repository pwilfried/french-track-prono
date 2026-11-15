import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player votes in a poll of the home, then sees the results", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tag = `${Date.now() % 1000000}`;
  const question = `E2E Qui gagne le 100 m ? ${tag}`;
  const answers = [`Alpha ${tag}`, `Bravo ${tag}`];

  const player = newPlayer("poll");
  await page.goto("/connexion");
  await signUp(page, player);
  const playerId = sql(`select id from auth.users where email = '${player.email}'`);

  // The admin launches the poll from the back-office.
  sql(`update profiles set is_admin = true where id = '${playerId}'`);
  await page.goto("/admin/communaute");
  await page.getByLabel(/^Question/).fill(question);
  await page.getByLabel("Réponse 1", { exact: true }).fill(answers[0]);
  await page.getByLabel("Réponse 2", { exact: true }).fill(answers[1]);
  const closes = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Clôture (heure de Paris)").fill(`${closes}T20:00`);
  await page.getByRole("button", { name: "Lancer le sondage" }).click();
  await expect(page.getByText("Sondage lancé.")).toBeVisible();
  sql(`update profiles set is_admin = false where id = '${playerId}'`);

  // On the home, the poll shows its answers but no result before the vote.
  await page.goto("/");
  const block = page.getByRole("region", { name: "Dans ma communauté" });
  const poll = block.getByRole("article", { name: question });
  await expect(poll).toBeVisible();
  await expect(poll.getByText(/\d+ %/)).toHaveCount(0);

  // One tap votes; the results show at once, where the player is.
  await poll.getByRole("button", { name: answers[1] }).click();
  await expect(poll.getByRole("status")).toHaveText("Merci, ton vote est compté.");
  await expect(poll.getByLabel(`${answers[1]} : 100 %, ton vote`)).toBeVisible();
  await expect(poll.getByText("1 vote", { exact: true })).toBeVisible();

  // Back later, the vote is kept: the results, no answer to tap.
  await page.reload();
  await expect(poll.getByLabel(`${answers[0]} : 0 %`)).toBeVisible();
  await expect(poll.getByRole("button")).toHaveCount(0);

  sql(`delete from polls where question = '${question}'`);
});
