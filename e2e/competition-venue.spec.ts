import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

test("an admin creates an indoor competition and sees it marked « Salle »", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Test Salle ${tag}`;
  const slug = `test-salle-${tag}-2099`;
  const player = newPlayer("venue");
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
  // Outdoor unless the admin says otherwise.
  await expect(page.getByLabel("En plein air")).toBeChecked();
  await page.getByLabel("Internationale").check();
  await page.getByLabel("En salle").check();
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Début").fill("2099-03-05");
  await page.getByLabel("Fin").fill("2099-03-07");
  await page.getByRole("button", { name: "Créer la compétition" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/competitions/${slug}\\?enregistre=1$`));
  await expect(page.locator("main")).toContainText("Salle");

  // The edit form keeps the choice.
  await page.getByRole("link", { name: "Modifier", exact: true }).click();
  await expect(page.getByLabel("En salle")).toBeChecked();

  // Players see the chip on the competition card and page.
  await page.goto("/ligues/creer");
  await page.getByRole("searchbox", { name: "Rechercher une compétition" }).fill(name);
  await expect(page.getByRole("checkbox", { name: new RegExp(name) })).toBeVisible();
  await expect(page.locator("label", { hasText: name })).toContainText("Salle");
  await page.goto(`/competitions/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(
    page.locator("main section").first().getByText("Salle", { exact: true }),
  ).toBeVisible();

  sql(`delete from competitions where slug = '${slug}'`);
});
