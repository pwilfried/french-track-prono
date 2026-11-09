import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { clearMailbox, latestCodeFromMailbox } from "../src/infra/contract/mailbox";
import { newPlayer } from "./players";

test("a new player gives sex, two sprint disciplines and a club found in the list", async ({
  page,
}) => {
  const player = newPlayer("signup");
  await clearMailbox(player.email);
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(player.email));
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/bienvenue/);

  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.locator("label", { hasText: "🦅" }).click();
  await page.locator("label", { hasText: "Femme" }).click();
  await page.locator("label", { hasText: /^100 m$/ }).click();
  await page.locator("label", { hasText: /^200 m$/ }).click();
  await page.getByLabel("Cherche ton club").fill("fictivil");
  await page.getByRole("button", { name: /Foulées de Fictiville/ }).click();
  await expect(page.getByRole("button", { name: "Changer" })).toBeVisible();
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await page.waitForURL(/\/profil$/);

  const profile = `(select id from profiles where pseudo = '${player.pseudo}')`;
  expect(sql(`select sex from player_details where profile_id = ${profile}`)).toBe("F");
  expect(
    sql(`select array_to_string(array(select unnest(disciplines) order by 1), ',')
         from player_details where profile_id = ${profile}`),
  ).toBe("100 m,200 m");
  expect(
    sql(`select c.name from profiles p join clubs c on c.id = p.club_id where p.id = ${profile}`),
  ).toBe("Foulées de Fictiville");
});

test("a club missing from the list is typed and waits for validation", async ({ page }) => {
  const player = newPlayer("club");
  await clearMailbox(player.email);
  await page.goto("/profil");
  await page.waitForURL(/\/connexion/);
  await page.getByLabel("Ton e-mail").fill(player.email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await page.getByLabel(/code/i).fill(await latestCodeFromMailbox(player.email));
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL(/\/bienvenue/);

  await page.getByLabel("Ton pseudo").fill(player.pseudo);
  await page.locator("label", { hasText: "🦅" }).click();
  await page.getByRole("button", { name: "Mon club n'est pas dans la liste" }).click();
  await page.getByLabel("Nom de ton club").fill("Club Officiel FFA");
  await page.getByRole("checkbox", { name: /15 ans/ }).check();
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("nom de club");

  const club = `Les Foulées ${player.pseudo.slice(-6)}`;
  await page.getByLabel("Nom de ton club").fill(club);
  await page.getByLabel("Ville du club").fill("Nulle-Part");
  await page.getByRole("button", { name: "Créer mon profil" }).click();
  await page.waitForURL(/\/profil$/);

  expect(
    sql(`select c.validated from profiles p join clubs c on c.id = p.club_id
         where p.pseudo = '${player.pseudo}'`),
  ).toBe("f");
});
