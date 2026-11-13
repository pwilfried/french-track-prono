import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the Manager tutorial opens at the first visit only, then on demand (#616)", async ({
  page,
}) => {
  const budget = sql("select rules ->> 'budget' from manager_rules");
  await page.goto("/manager");
  await signUp(page, newPlayer("mgr-tutorial"));
  await page.waitForURL(/\/manager$/);

  // First visit: the tutorial over the page, its figures from the rules, the arrow keys too.
  const tutorial = page.getByRole("dialog", { name: "Comment ça marche" });
  await expect(tutorial).toContainText("Comment ça marche · 1 / 7");
  await tutorial.getByRole("button", { name: "Suivant" }).click();
  await expect(tutorial).toContainText(`Tu as ${budget} crédits`);
  await page.keyboard.press("ArrowRight");
  await expect(tutorial).toContainText("Comment ça marche · 3 / 7");
  await tutorial.getByRole("button", { name: "Passer le tutoriel" }).click();
  await expect(tutorial).toBeHidden();
  // Underneath, the presentation of the mode for a player without a Manager league (#618).
  const presentation = page.getByRole("list", { name: "Le Manager en 5 étapes" });
  await expect(presentation).toBeVisible();

  // Not shown again.
  await page.reload();
  await expect(presentation).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // « Comment ça marche ? » opens it again; « C'est parti » at the last step closes it.
  await page.getByRole("link", { name: "Passer la présentation" }).click();
  await page.waitForURL(/\/manager\?passer=1$/);
  await page.getByRole("link", { name: "Comment ça marche ?" }).click();
  await expect(tutorial).toContainText("Comment ça marche · 1 / 7");
  for (let step = 1; step < 7; step += 1) {
    await tutorial.getByRole("button", { name: "Suivant" }).click();
  }
  await expect(tutorial).toContainText("Deviens champion");
  await tutorial.getByRole("button", { name: "C'est parti" }).click();
  await expect(tutorial).toBeHidden();
  await page.waitForURL(/\/manager$/);
  await expect(presentation).toBeVisible();
});
