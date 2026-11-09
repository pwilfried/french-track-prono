import { expect, test } from "@playwright/test";

import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";
import { newPlayer, signIn, signUp } from "./players";

test("a player changes pseudo and club, then signs in with a new address", async ({ page }) => {
  const player = newPlayer("edit");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // Pseudo and club
  await page.getByRole("link", { name: "Modifier mon profil" }).click();
  await page.waitForURL(/\/profil\/modifier$/);
  const pseudo = `Nouveau ${player.pseudo.slice(-6)}`;
  await page.getByLabel("Ton pseudo").fill(pseudo);
  await page.getByLabel("Cherche ton club").fill("songeville");
  await page.getByRole("button", { name: /Stade Imaginaire Athlétisme/ }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/profil\?enregistre=1$/);
  await expect(page.getByText("Ton profil est à jour.")).toBeVisible();
  await expect(page.getByText(pseudo).first()).toBeVisible();
  // The club also shows in the header (validated clubs) and the club ranking: check the account.
  await expect(
    page.getByRole("region", { name: "Compte" }).getByText("Stade Imaginaire Athlétisme"),
  ).toBeVisible();

  // A banned pseudo is refused
  await page.getByRole("link", { name: "Modifier mon profil" }).click();
  await page.getByLabel("Ton pseudo").fill("SuperConnard");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("pseudo n'est pas possible");
  await page.getByRole("link", { name: "Retour au profil" }).click();

  // New sign-in address
  const moved = `moved-${player.email}`;
  await clearMailbox(moved);
  await page.getByRole("link", { name: "Changer d'e-mail" }).click();
  await page.getByLabel("Ta nouvelle adresse").fill(moved);
  await page.getByRole("button", { name: "Recevoir un code" }).click();
  await page.getByLabel("Code reçu").fill(await latestCodeFromMailbox(moved));
  await page.getByRole("button", { name: "Confirmer ma nouvelle adresse" }).click();
  await page.waitForURL(/\/profil\?email=1$/);
  await expect(page.getByText(moved)).toBeVisible();

  // Signs out, then back in with the new address: same player
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  await signIn(page, moved);
  await page.waitForURL(/\/profil$/);
  await expect(page.getByText(pseudo).first()).toBeVisible();
});
