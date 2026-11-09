import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin adjusts the tolerance of the 100 m", async ({ page }) => {
  const before = sql("select tolerance from disciplines where name = '100 m'");
  const player = newPlayer("tolerance");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await page.getByRole("link", { name: "Disciplines" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Disciplines");
  const field = page.getByLabel("Tolérance du 100 m", { exact: true });
  await field.fill("0,03");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("✓ Enregistré")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Tolérance du 100 m", { exact: true })).toHaveValue("0.03");

  sql(`update disciplines set tolerance = ${before} where name = '100 m'`);
});

test("an admin creates a discipline, then uses it for an event", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Mile E2E ${tag}`;
  const competition = `e2e-disc-${tag}`;
  sql(`insert into competitions (slug, name, starts_on, ends_on)
       values ('${competition}', 'Test discipline ${tag}', '2099-07-01', '2099-07-02')`);
  const player = newPlayer("disc");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set is_admin = true
       where id = (select id from auth.users where email = '${player.email}')`);

  await page.goto("/admin/disciplines");
  await page.getByText("+ Nouvelle discipline").click();
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Famille").selectOption("middle");
  await page.getByLabel("Unité").selectOption("time");
  await page.getByLabel("Le meilleur").selectOption("lower");
  await page.getByLabel("Tolérance du prono de performance").fill("0,5");
  await page.getByRole("button", { name: "Créer la discipline" }).click();
  await expect(page.getByRole("status")).toContainText(`${name} est créée`);
  await expect(page.getByLabel(`Tolérance du ${name}`)).toHaveValue("0.5");

  await page.goto(`/admin/competitions/${competition}`);
  await page.getByLabel("Discipline").selectOption(name);
  await page.getByLabel("Catégorie").selectOption("M");
  await page.getByLabel("Horaire (local)").fill("2099-07-01T20:00");
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click();
  await expect(page.getByRole("list", { name: "épreuves" })).toContainText(`${name} hommes`);

  sql(`delete from competitions where slug = '${competition}'`);
  sql(`delete from disciplines where name = '${name}'`);
});
