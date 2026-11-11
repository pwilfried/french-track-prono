import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin prices an athlete, who then shows in the catalogue of a Manager league", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const name = `Lanceuse Catalogue ${tag}`;
  const slug = `lanceuse-catalogue-${tag}`;
  sql(
    `insert into athletes (slug, name, country_code, gender) values ('${slug}', '${name}', 'FRA', 'F')`,
  );
  sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
       select id, (select name from disciplines where family = 'throws' order by name limit 1), true
       from athletes where slug = '${slug}'`);
  const admin = newPlayer("catalogue");
  await page.goto("/manager/creer");
  await signUp(page, admin);
  await page.waitForURL(/\/manager\/creer$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);

  try {
    // The admin sets the price on the athlete's page of the back-office.
    await page.goto(`/admin/athletes/${slug}`);
    await page.getByLabel("Prix (crédits)").fill("2.5");
    await page
      .getByLabel("Prix (crédits)")
      .locator("xpath=ancestor::form")
      .getByRole("button")
      .click();
    // Scoped to <main> so Next.js's __next-route-announcer__ (also role="alert", outside main)
    // doesn't trip Playwright's strict mode.
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "nombre entier de crédits",
    );
    await page.getByLabel("Prix (crédits)").fill("14");
    await page
      .getByLabel("Prix (crédits)")
      .locator("xpath=ancestor::form")
      .getByRole("button")
      .click();
    await expect(page.getByLabel("Prix (crédits)")).toHaveValue("14");

    // A participant finds them in the catalogue of their league, with the filters.
    await page.goto("/manager/creer");
    await page.getByLabel("Nom de la ligue").fill(`Mercato ${tag}`);
    await page.getByRole("button", { name: "Créer la ligue" }).click();
    await page.getByRole("link", { name: "Catalogue du mercato" }).click();
    await page.getByLabel("Rechercher un athlète").fill(`lanceuse ${tag}`);
    await page.getByLabel("Famille").selectOption({ label: "Lancers" });
    await page.getByLabel("Sexe").selectOption({ label: "Femmes" });
    await page.getByText("Seulement les athlètes libres").click();
    await page.getByRole("button", { name: "Filtrer" }).click();
    const card = page.getByRole("article", { name });
    await expect(card).toContainText("14 cr.");
    // A free athlete shows no status label since #503: only a taken one says "Recruté".
    await expect(card).not.toContainText("Recruté");
    await expect(card).not.toContainText("Libre");
    await expect(page.getByRole("status")).toHaveText("1 athlète");

    await page.getByLabel("Sexe").selectOption({ label: "Hommes" });
    await page.getByRole("button", { name: "Filtrer" }).click();
    await expect(page.getByText("Aucun athlète ne correspond.")).toBeVisible();
  } finally {
    sql(`delete from athletes where slug = '${slug}'`);
  }
});
