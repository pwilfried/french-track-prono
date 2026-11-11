import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

// #501: one time zone for the whole app. The admin types an event time in Paris time, even for a
// competition abroad, and players read the very same time.
test("an event typed at 20:35 Paris time in the back-office reads 20:35 for players, even abroad", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Test Birmingham ${tag}`;
  const slug = `test-birmingham-${tag}-2099`;
  const player = newPlayer("paris-time");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await openAdminSection(page, "Compétitions");
  await page.getByRole("link", { name: "+ Nouvelle compétition" }).click();
  await expect(page.getByLabel("Fuseau horaire")).toHaveCount(0);
  await page.getByLabel("Internationale").check();
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Ville").fill("Birmingham");
  await page.getByLabel("Pays").fill("GBR");
  await page.getByLabel("Début").fill("2099-06-25");
  await page.getByLabel("Fin").fill("2099-06-27");
  await page.getByRole("button", { name: "Créer la compétition" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/competitions/${slug}\\?enregistre=1$`));

  await expect(page.getByText("Horaires en heure de Paris")).toBeVisible();
  await page.getByLabel("Discipline").selectOption("100 m");
  await page.getByLabel("Catégorie").selectOption("F");
  await page.getByLabel("Horaire (heure de Paris)").fill("2099-06-25T20:35");
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click();
  await expect(page.getByRole("list", { name: "épreuves" })).toContainText("20:35");

  // Stored as an instant: 20:35 in Paris in June is 18:35 UTC (19:35 in Birmingham).
  expect(
    sql(
      `select to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from events where slug = '${slug}-f-100-m'`,
    ),
  ).toBe("2099-06-25 18:35");

  // Players read the same time: the list of events and the event page.
  await page.goto(`/epreuves?competition=${slug}`);
  await expect(page.getByRole("link", { name: /^100 m, Femmes/ })).toContainText("20:35");
  await page.goto(`/epreuves/${slug}-f-100-m`);
  // The loading skeleton (`aria-busy`) can still sit next to the streamed page for a moment.
  await expect(page.locator("main:not([aria-busy='true'])")).toContainText("20:35");

  sql(`delete from competitions where slug = '${slug}'`);
});
