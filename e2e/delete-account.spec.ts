import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player deletes his account and his profile is gone", async ({ page }) => {
  const player = newPlayer("bye");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.getByRole("link", { name: "Supprimer mon compte" }).click();
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByRole("alert")).toHaveText(/Coche la case/);

  await page.getByRole("checkbox", { name: /définitif/ }).check();
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await page.waitForURL(/\/au-revoir$/);

  expect(sql(`select count(*) from auth.users where email = '${player.email}'`)).toBe("0");
  expect(sql(`select count(*) from profiles where pseudo = '${player.pseudo}'`)).toBe("0");
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
});
