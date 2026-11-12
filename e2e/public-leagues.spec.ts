import { expect, test } from "@playwright/test";

import { newPlayer, signUp } from "./players";

test("a player creates a public league, another finds it in the list and joins without a code", async ({
  browser,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Gazelles ${tag}`;
  const creator = newPlayer("pubcreate");
  const walker = newPlayer("pubjoin");
  const creatorPage = await (await browser.newContext()).newPage();
  const walkerPage = await (await browser.newContext()).newPage();

  await creatorPage.goto("/ligues/creer?competition=ultimate-championship-2026");
  await signUp(creatorPage, creator);
  await creatorPage.waitForURL(/\/ligues\/creer/);
  await creatorPage.getByRole("checkbox", { name: /Ligue publique/ }).check();

  // A public league is seen by everyone: a banned name is refused.
  await creatorPage.getByLabel("Nom de la ligue").fill("Ligue officielle");
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.locator("main").getByRole("alert")).toContainText(
    "pas possible pour une ligue",
  );

  await creatorPage.getByLabel("Nom de la ligue").fill(name);
  await creatorPage.getByRole("checkbox", { name: /Ligue publique/ }).check();
  await creatorPage.getByRole("button", { name: "Créer la ligue" }).click();
  await expect(creatorPage.getByText("Ta ligue est prête")).toBeVisible();
  const leagueUrl = creatorPage.url().split("?")[0]!;

  // Another player finds it among the public leagues and joins in one tap.
  await walkerPage.goto("/ligues");
  await signUp(walkerPage, walker);
  await walkerPage.waitForURL(/\/ligues$/);
  const publics = walkerPage.getByRole("list", { name: "Autres ligues publiques" });
  await expect(publics.getByRole("listitem").filter({ hasText: name })).toContainText("1 / 200");
  await publics.getByRole("button", { name: `Rejoindre la ligue publique ${name}` }).click();
  await walkerPage.waitForURL(leagueUrl);
  await expect(walkerPage.getByRole("heading", { level: 1 })).toHaveText(name);

  // Now a member, he finds it among his leagues, no longer in the public list.
  await walkerPage.goto("/ligues");
  await expect(walkerPage.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await expect(publics.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
});
