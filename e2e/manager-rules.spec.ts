import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

test("the admin sets the French Track Manager rules and its eligible competitions", async ({
  page,
}) => {
  const rules = sql("select rules::text from manager_rules");
  const tag = `${Date.now() % 1000000}`;
  const meeting = `Meeting Manager ${tag}`;
  sql(`insert into competitions (slug, name, starts_on, ends_on)
       values ('manager-${tag}', '${meeting}', current_date + 30, current_date + 30)`);
  const admin = newPlayer("manager");
  await page.goto("/profil");
  await signUp(page, admin);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);

  try {
    await page.goto("/admin/tableau-de-bord");
    await openAdminSection(page, "Manager");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Règles Manager");

    await page.getByLabel("Budget de départ (crédits)").fill("150");
    await page.getByLabel("Sprint, Femmes, max").fill("4");
    await page.getByRole("checkbox", { name: new RegExp(meeting) }).check();
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect(page.getByRole("status")).toContainText("Règles enregistrées");
    expect(sql("select rules ->> 'budget' from manager_rules")).toBe("150");
    expect(
      sql(`select count(*) from manager_competitions mc join competitions c on c.id = mc.competition_id
           where c.slug = 'manager-${tag}'`),
    ).toBe("1");

    // The change is in the log of the back-office.
    await openAdminSection(page, "Historique");
    await expect(page.getByText("Règles Manager modifiées").first()).toBeVisible();

    // Rules a team cannot be lined up with are refused.
    await openAdminSection(page, "Manager");
    await page.getByLabel("Athlètes alignés au plus").fill("99");
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "ne permettent pas de jouer",
    );
    expect(sql("select rules ->> 'budget' from manager_rules")).toBe("150");
  } finally {
    sql(`update manager_rules set rules = '${rules.replaceAll("'", "''")}'`);
    sql(`delete from competitions where slug = 'manager-${tag}'`);
  }
});
