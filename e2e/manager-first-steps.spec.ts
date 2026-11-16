import { expect, test } from "@playwright/test";

import { chooseSeason, createLeague, seasonReady } from "./manager-season";
import { newPlayer, signUp } from "./players";

test("a new player sees the guide of the first mercato once, then on demand (#1037)", async ({
  page,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  await page.goto("/manager/creer");
  await signUp(page, newPlayer("mgr-first"));
  await page.waitForURL(/\/manager\/creer$/);
  await page.getByLabel("Nom de la ligue").fill(`Premier mercato ${tag}`);
  await chooseSeason(page);
  await createLeague(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Catalogue du mercato" }).click();

  // Four cards over the catalogue, Passer from any of them.
  const guide = page.getByRole("dialog", { name: "Premier mercato" });
  await expect(guide).toContainText("Premier mercato · 1 sur 4");
  await guide.getByRole("button", { name: "Suivant" }).click();
  await expect(guide).toContainText("Enchères secrètes");
  await guide.getByRole("button", { name: "Passer le guide du premier mercato" }).click();
  await expect(guide).toBeHidden();

  // « Mon équipe en construction » sits on top of the catalogue, empty.
  const build = page.getByRole("region", { name: "Mon équipe en construction" });
  await expect(build).toContainText("0/");
  await expect(build).toContainText("Il te manque");

  // Not shown again, but « Comment ça marche ? » opens it.
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Comment ça marche ?" }).click();
  await expect(guide).toContainText("Premier mercato · 1 sur 4");
});
