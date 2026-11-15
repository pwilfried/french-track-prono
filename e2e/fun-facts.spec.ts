import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { openAdminSection } from "./admin";
import { newPlayer, signUp } from "./players";

// The switch is shared with pre-production, where the admin may have turned the card off.
const cardOn = () => sql("select enabled from fun_fact_settings") !== "f";

test("a player sees one fact, sees another, closes it and does not see it again the same day", async ({
  page,
}) => {
  test.skip(!cardOn(), "the admin switched « Le saviez-vous ? » off");
  const player = newPlayer("faits");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  await page.goto("/");
  const card = page.getByRole("region", { name: "Le saviez-vous ?" });
  await expect(card).toBeVisible();
  // Right under the next action, the first block of the home (#932).
  const blocks = await page
    .locator("main section[aria-labelledby]")
    .evaluateAll((sections) => sections.map((s) => s.getAttribute("aria-labelledby")));
  expect(blocks.slice(0, 2)).toEqual(["next-action-label", "fun-fact-heading"]);
  const title = card.getByRole("heading", { level: 3 });
  const first = await title.textContent();
  await card.getByRole("button", { name: "Un autre" }).click();
  await expect(title).not.toHaveText(first!);

  const close = card.getByRole("button", { name: "Fermer jusqu'à demain" });
  expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(card).toHaveCount(0);
  // The evening's predictions stay right there.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Bienvenue, ${player.pseudo}`);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Le saviez-vous ?" })).toHaveCount(0);
});

test("an admin adds a fact to the bank, edits it and deletes it", async ({ page }) => {
  const player = newPlayer("faits-admin");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  const title = `Fait E2E ${Date.now().toString(36)}`;

  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );
  try {
    await page.goto("/admin/tableau-de-bord");
    await openAdminSection(page, "Le saviez-vous");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Le saviez-vous ?");

    const add = page.getByRole("region", { name: "Ajouter un fait" });
    await add.getByLabel("Titre (60 caractères au plus)").fill(title);
    await add.getByLabel("Texte (280 caractères au plus)").fill("Un fait inventé pour le test.");
    await add.getByLabel("Étiquette").selectOption({ label: "Insolite" });
    await add.getByLabel("Source (pour l'admin seulement)").fill("https://example.test/source");
    await add.getByRole("button", { name: "Ajouter le fait" }).click();
    await expect(add.getByRole("status")).toHaveText("Fait ajouté.");

    const item = page.getByRole("listitem").filter({ hasText: title });
    await item.locator("summary").first().click();
    await item.getByLabel("Actif : les joueurs le voient").uncheck();
    await item.getByRole("button", { name: "Enregistrer" }).click();
    await expect(item.getByRole("status")).toHaveText("Fait enregistré.");
    await expect(item.locator("summary").first()).toContainText("Désactivé");

    await item.getByText("Supprimer…").click();
    await item.getByRole("button", { name: `Supprimer définitivement « ${title} »` }).click();
    await expect(page.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
  } finally {
    sql(`delete from fun_facts where title = '${title}'`);
    sql(
      `update profiles set is_admin = false where id = (select id from auth.users where email = '${player.email}')`,
    );
  }
});
