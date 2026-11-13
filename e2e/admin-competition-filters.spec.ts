import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

test("an admin filters the competitions by scope, venue, level and status, kept on reload", async ({
  page,
}) => {
  const tag = `${Date.now() % 1000000}`;
  const level = `test-level-${tag}`;
  const names = {
    franceIndoor: `Test France salle ${tag}`,
    franceOutdoor: `Test France plein air ${tag}`,
    worldIndoor: `Test Monde salle ${tag}`,
  };
  sql(`
    insert into competitions (slug, name, scope, venue, level, starts_on, ends_on) values
      ('test-fr-salle-${tag}', '${names.franceIndoor}', 'france', 'indoor', '${level}', '2099-02-20', '2099-02-21'),
      ('test-fr-air-${tag}', '${names.franceOutdoor}', 'france', 'outdoor', '${level}', '2099-07-24', '2099-07-26'),
      ('test-monde-salle-${tag}', '${names.worldIndoor}', 'international', 'indoor', '${level}', '2099-03-05', '2099-03-07')
  `);
  const player = newPlayer("filters");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  await page.goto("/admin");
  await openAdminSection(page, "Compétitions");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: /Réinitialiser/ })).toHaveCount(0);

  // « France » then « Salle »: only the French indoor championships are left.
  await page
    .getByRole("navigation", { name: "Portée" })
    .getByRole("link", { name: "France", exact: true })
    .click();
  await expect(page).toHaveURL(/portee=france/);
  await page
    .getByRole("navigation", { name: "Lieu" })
    .getByRole("link", { name: "Salle", exact: true })
    .click();
  await expect(page).toHaveURL(/portee=france&lieu=indoor/);
  await expect(main.getByRole("link", { name: new RegExp(names.franceIndoor) })).toBeVisible();
  await expect(main.getByRole("link", { name: new RegExp(names.franceOutdoor) })).toHaveCount(0);
  await expect(main.getByRole("link", { name: new RegExp(names.worldIndoor) })).toHaveCount(0);

  // The level of the test narrows it to one, and a reload keeps the filters.
  await page
    .getByRole("navigation", { name: "Niveau" })
    .getByRole("link", { name: `Test Level ${tag}`, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`niveau=${level}`));
  await expect(main.getByRole("status")).toHaveText("1 compétition");
  await page.reload();
  await expect(main.getByRole("status")).toHaveText("1 compétition");
  await expect(main.getByRole("link", { name: new RegExp(names.franceIndoor) })).toBeVisible();

  // None of them is over: the empty state offers to reset.
  await page
    .getByRole("navigation", { name: "Statut" })
    .getByRole("link", { name: "Terminées", exact: true })
    .click();
  await expect(main).toContainText("Aucune compétition ne correspond à ces filtres");
  await main.getByRole("link", { name: "Réinitialiser" }).last().click();
  await expect(page).toHaveURL(/\/admin\/competitions$/);
  for (const name of Object.values(names)) {
    await expect(main.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }

  sql(`delete from competitions where level = '${level}'`);
});
