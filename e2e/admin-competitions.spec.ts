import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("an admin creates a French competition, an event and its entered athletes, used by the start list", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Test Élite ${tag}`;
  const slug = `test-elite-${tag}-2099`;
  const player = newPlayer("competition");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await page.getByRole("link", { name: "Compétitions", exact: true }).first().click();
  await page.getByRole("link", { name: "+ Nouvelle compétition" }).click();
  await page.getByLabel("Française").check();
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Début").fill("2099-06-25");
  await page.getByLabel("Fin").fill("2099-06-27");
  await page.getByRole("button", { name: "Créer la compétition" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/competitions/${slug}\\?enregistre=1$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);

  // An event at 20:35 local time.
  await page.getByLabel("Discipline").selectOption("100 m");
  await page.getByLabel("Catégorie").selectOption("F");
  await page.getByLabel("Horaire (local)").fill("2099-06-25T20:35");
  await page.getByRole("button", { name: "Ajouter l'épreuve" }).click();
  await expect(page.getByRole("list", { name: "épreuves" })).toContainText("100 m femmes · Finale");

  // Two entered athletes.
  await page.getByRole("link", { name: /Engagés/ }).click();
  for (const athlete of ["Sha'Carri Richardson", "Julien Alfred"]) {
    await page.getByRole("searchbox", { name: "Rechercher un athlète" }).fill(athlete);
    await page.getByRole("button", { name: "Filtrer" }).click();
    await page
      .getByRole("list", { name: "Athlètes trouvés" })
      .getByRole("button", { name: "Engager" })
      .first()
      .click();
    await expect(page.getByRole("list", { name: "Athlètes engagés" })).toContainText(athlete);
  }

  // The start list of the event offers the entered athletes only.
  await page
    .getByRole("navigation", { name: "Contenu de la compétition" })
    .getByRole("link", { name: /^Épreuves/ })
    .click();
  await page.getByRole("list", { name: "épreuves" }).getByRole("link").first().click();
  await page.getByRole("link", { name: /Liste de départ/ }).click();
  const matches = page.getByRole("list", { name: "Athlètes trouvés" }).getByRole("button");
  await page.getByRole("searchbox", { name: "Rechercher un athlète" }).fill("a");
  await expect(matches).toHaveCount(2);

  sql(`delete from competitions where slug = '${slug}'`);
});
