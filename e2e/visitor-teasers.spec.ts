import { expect, test } from "@playwright/test";

import { newPlayer, signUp } from "./players";

test("a visitor opens the Leagues tab, sees what it is with an example, and signs in to it", async ({
  page,
}) => {
  await page.goto("/ligues");
  await expect(page).toHaveURL(/\/ligues$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ligues");
  await expect(page.locator("main")).toContainText("Crée une ligue entre amis");
  const example = page.getByRole("figure", { name: "Exemple" });
  await expect(example).toContainText("Les copains du stade");
  await expect(example.getByRole("listitem")).toHaveCount(3);

  const signIn = page.locator("main").getByRole("link", { name: "Se connecter" });
  await expect(signIn).toHaveAttribute("href", "/connexion?next=%2Fligues");
  await signIn.click();
  await signUp(page, newPlayer("teaser-leagues"));
  await page.waitForURL(/\/ligues$/);
  await expect(page.getByRole("link", { name: "Créer une ligue" })).toBeVisible();
});

test("a visitor opens the Manager tab, sees what it is with an example, and signs in to it", async ({
  page,
}) => {
  await page.goto("/manager");
  await expect(page).toHaveURL(/\/manager$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("French Track Manager");
  await expect(page.locator("main")).toContainText("Recrute tes athlètes, aligne ton équipe");
  const example = page.getByRole("figure", { name: "Exemple" });
  await expect(example).toContainText("Ton équipe");
  await expect(example).toContainText("Les Fusées");

  const signIn = page.locator("main").getByRole("link", { name: "Se connecter" });
  await expect(signIn).toHaveAttribute("href", "/connexion?next=%2Fmanager");
  await signIn.click();
  await signUp(page, newPlayer("teaser-manager"));
  await page.waitForURL(/\/manager$/);
  await page.getByRole("dialog").getByRole("button", { name: "Passer la présentation" }).click();
  await expect(page.getByRole("link", { name: "Rejoindre avec un code" })).toBeVisible();
});
