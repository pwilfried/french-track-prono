import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin creates an athlete, adds a discipline with a PR and an SB, shown on the public page", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Inventée E2E ${tag}`;
  const slug = `inventee-e2e-${tag}`;
  const player = newPlayer("athletes");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await page.getByRole("link", { name: "Athlètes" }).click();
  // The admin creates the athlete with her main discipline.
  await page.getByText("Nouvel athlète").click();
  await page.getByLabel("Nom").fill(name);
  await page.getByLabel("Pays").fill("fra");
  await page.getByLabel("Catégorie").selectOption("F");
  await page.getByLabel("Discipline principale").selectOption("100 m");
  await page.getByRole("button", { name: "Créer l'athlète" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/athletes/${slug}\\?enregistre=1$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  // She shows among the 100 m women of France, not among the men (#300).
  await page.goto("/admin/athletes");
  await page.getByLabel("Par discipline").selectOption("100 m");
  await page.getByLabel("Par sexe").selectOption("M");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByText(/^\d+ athlètes?$/)).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  await page.getByLabel("Par sexe").selectOption("F");
  await page.getByLabel("Par pays").selectOption("FRA");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/discipline=100\+m&sexe=F&pays=FRA/);
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

  // She shows in the list.
  await page.getByRole("searchbox", { name: "Rechercher un athlète" }).fill(tag);
  await page.getByRole("button", { name: "Filtrer" }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();

  await page.getByLabel("Ajouter une discipline").selectOption("200 m");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("✓ Enregistré.");

  // A mark that is not a time is refused with a clear message.
  await page.getByLabel("Record perso au 200 m").fill("2m10");
  await page.getByRole("button", { name: "Enregistrer PR et SB du 200 m" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "ne correspond pas à la discipline",
  );

  await page.getByLabel("Record perso au 200 m").fill("22.10");
  await page.getByLabel("Meilleure saison au 200 m").fill("22.45");
  await page.getByRole("button", { name: "Enregistrer PR et SB du 200 m" }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("✓ Enregistré.");

  await page.goto(`/athletes/${slug}`);
  const records = page.getByRole("region", { name: "Records" });
  await expect(records).toContainText("200 m");
  await expect(records).toContainText("22.10");
  await expect(records).toContainText("22.45");

  sql(`delete from athletes where slug = '${slug}'`);
});
