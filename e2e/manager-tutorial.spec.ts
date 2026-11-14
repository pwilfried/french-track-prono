import { expect, test } from "@playwright/test";

import { newPlayer, signUp } from "./players";

test("the Manager presentation has three screens, opens once, then on demand (#616, #802)", async ({
  page,
}) => {
  await page.goto("/manager");
  await signUp(page, newPlayer("mgr-tutorial"));
  await page.waitForURL(/\/manager$/);

  // First visit: three screens over the page, the arrow keys too, no figure in them.
  const tutorial = page.getByRole("dialog", { name: "Comment ça marche" });
  await expect(tutorial).toContainText("Comment ça marche · 1 / 3");
  await expect(tutorial).toContainText("Recrute des athlètes, aligne-les");
  await expect(tutorial).not.toContainText("crédits");
  // « Passer » does not open focused, with its focus ring on (#709).
  await expect(tutorial.getByRole("button", { name: "Passer la présentation" })).not.toBeFocused();
  // The navigation right under the content, without an empty gap (#709).
  const dots = await tutorial.getByRole("list").boundingBox();
  const navigation = await tutorial
    .getByRole("navigation", { name: "Étapes de la présentation" })
    .boundingBox();
  expect(navigation!.y - (dots!.y + dots!.height)).toBeLessThanOrEqual(32);
  await tutorial.getByRole("button", { name: "Suivant" }).click();
  await expect(tutorial).toContainText("D'abord le mercato");
  await page.keyboard.press("ArrowLeft");
  await expect(tutorial).toContainText("Comment ça marche · 1 / 3");
  await tutorial.getByRole("button", { name: "Passer la présentation" }).click();
  await expect(tutorial).toBeHidden();
  // Underneath, the ways in for a player without a Manager league.
  const start = page.getByRole("heading", { name: "Créer ou rejoindre une ligue" });
  await expect(start).toBeVisible();

  // Not shown again.
  await page.reload();
  await expect(start).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // « Comment ça marche ? » opens it again; the last screen leads to a league.
  await page.getByRole("link", { name: "Comment ça marche ?" }).click();
  await expect(tutorial).toContainText("Comment ça marche · 1 / 3");
  await tutorial.getByRole("button", { name: "Suivant" }).click();
  await tutorial.getByRole("button", { name: "Suivant" }).click();
  await expect(tutorial).toContainText("À toi de jouer");
  await expect(tutorial.getByRole("button", { name: "Suivant" })).toHaveCount(0);
  await tutorial.getByRole("link", { name: "Rejoindre avec un code" }).click();
  await page.waitForURL(/\/manager\/rejoindre$/);
  await page.goto("/manager");
  await expect(start).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
