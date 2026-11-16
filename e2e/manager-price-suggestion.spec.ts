import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("the admin sees a suggested Manager price on the athlete page and takes it", async ({
  page,
}) => {
  // A failed run leaves its athlete behind (pre-production is never reset, #819).
  sql(`delete from athletes where slug like 'prix-propose-e2e-%'`);
  const tag = `${Date.now() % 1000000}`;
  const slug = `prix-propose-e2e-${tag}`;
  sql(
    `insert into athletes (slug, name, country_code, gender) values ('${slug}', 'Prix Proposé ${tag}', 'FRA', 'F')`,
  );
  sql(`insert into athlete_disciplines (athlete_id, discipline, is_primary)
       select id, '100 m', true from athletes where slug = '${slug}'`);
  sql(`insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, record_date)
       select id, '100 m', 'sb', '10.95', 10.95, current_date - 30 from athletes where slug = '${slug}'`);
  const admin = newPlayer("prix");
  await page.goto("/profil");
  await signUp(page, admin);
  await page.waitForURL(/\/profil$/);
  sql(`update profiles set is_admin = true where pseudo = '${admin.pseudo}'`);

  try {
    await page.goto(`/admin/athletes/${slug}`);
    const fitPrice = await page.getByText(/^Prix proposé : \d+$/).textContent();
    await expect(page.getByText(/Meilleure marque des 12 derniers mois : 10\.95/)).toBeVisible();

    // Injured: the suggestion changes, the typed price does not.
    await page.getByLabel("État").selectOption("doubtful");
    await page.getByRole("button", { name: "Enregistrer l'état et la présence" }).click();
    await expect(page.locator("main").getByRole("status")).toHaveText("✓ Enregistré.");
    await expect(page.getByLabel("État")).toHaveValue("doubtful");
    const suggested = page.getByText(/^Prix proposé : \d+$/);
    await expect(suggested).not.toHaveText(fitPrice ?? "");
    await expect(page.getByLabel("Prix (crédits)")).toHaveValue("");

    const price = (await suggested.textContent())?.replace(/\D/g, "") ?? "";
    await page.getByRole("button", { name: "Reprendre ce prix" }).click();
    await expect(page.getByLabel("Prix (crédits)")).toHaveValue(price);
    await expect(page.getByRole("button", { name: "Reprendre ce prix" })).toHaveCount(0);
  } finally {
    sql(`delete from athletes where slug = '${slug}'`);
  }
});
