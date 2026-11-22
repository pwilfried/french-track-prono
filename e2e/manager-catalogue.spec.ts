import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { chooseSeason, createLeague, seasonReady } from "./manager-season";
import { skipFirstMercatoGuide } from "./first-mercato";
import { newPlayer, signUp } from "./players";

test("the admin prices an athlete, who then shows in the catalogue of a Manager league", async ({
  page,
}) => {
  seasonReady();
  const tag = `${Date.now() % 1000000}`;
  const name = `Lanceuse Catalogue ${tag}`;
  const slug = `lanceuse-catalogue-${tag}`;
  sql(
    `insert into athletes (slug, name, country_code, gender) values ('${slug}', '${name}', 'FRA', 'F')`,
  );
  sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
       select id, (select name from disciplines where family = 'throws' order by name limit 1), true
       from athletes where slug = '${slug}'`);
  await skipFirstMercatoGuide(page);
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
    await chooseSeason(page);
    await createLeague(page);
    await page.getByRole("link", { name: "Catalogue du mercato" }).click();
    // The first athlete shows without scrolling on a phone (#497).
    await page.setViewportSize({ width: 390, height: 844 });
    const first = page.getByRole("list", { name: "Catalogue du mercato" }).getByRole("article");
    await expect(first.first()).toBeInViewport();
    // The search applies on Enter; each filter chip applies at once and keeps the others.
    await page.getByLabel("Rechercher un athlète").fill(`lanceuse ${tag}`);
    await page.getByLabel("Rechercher un athlète").press("Enter");
    const families = page.getByRole("navigation", { name: "Famille" });
    const sexes = page.getByRole("navigation", { name: "Sexe" });
    // The chip of a family says what the team still lacks in it (#1087).
    await families.getByRole("link", { name: /^Lancers/ }).click();
    await expect(families.getByRole("link", { name: /^Lancers/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await sexes.getByRole("link", { name: "F", exact: true }).click();
    await expect(sexes.getByRole("link", { name: "F", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The available athletes show by default.
    await expect(
      page
        .getByRole("navigation", { name: "Filtres du catalogue" })
        .getByRole("link", { name: "Disponibles" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/q=lanceuse.*sexe=F&famille=throws/);
    const card = page.getByRole("article", { name });
    await expect(card).toContainText("14 cr.");
    // A free athlete shows no status label since #503: only a taken one says "Recruté".
    await expect(card).not.toContainText("Recruté");
    await expect(card).not.toContainText("Libre");
    await expect(page.getByRole("status")).toHaveText("1 athlète");
    // Before the launch, a member sees the catalogue and who plays, without any bid (#620).
    const band = page.getByRole("region", { name: "Avant le mercato" });
    await expect(band).toContainText("1 participant");
    await expect(band).toContainText("Date d'ouverture à venir");
    await expect(card).toContainText("PB—");
    await expect(page.getByRole("button", { name: "Enchérir" })).toHaveCount(0);

    await sexes.getByRole("link", { name: "H", exact: true }).click();
    await expect(page.getByText("Aucun athlète ne correspond.")).toBeVisible();

    // The back link is named after the league and leads to its page (#987).
    await page.getByRole("link", { name: `‹ Mercato ${tag}` }).click();
    await expect(page).toHaveURL(/\/manager\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Mercato ${tag}`);
  } finally {
    sql(`delete from athletes where slug = '${slug}'`);
  }
});
