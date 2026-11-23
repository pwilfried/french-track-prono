import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

const where = (email: string) =>
  `profile_id = (select id from auth.users where email = '${email}')`;

test("a player without a club is asked to complete their profile, puts it off, then completes it", async ({
  page,
}) => {
  const player = newPlayer("complete");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);

  // The express profile asked neither the club nor the disciplines: the home asks for them.
  await page.goto("/");
  // A compact card, one line and a button; the form opens in a sheet over the home.
  const card = page.getByRole("region", { name: "Complète ton profil" });
  const sheet = page.getByRole("dialog", { name: "Complète ton profil" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("checkbox")).toHaveCount(0);
  await expect(sheet).toBeHidden();
  await card.getByRole("button", { name: "Compléter" }).click();
  await expect(sheet).toBeVisible();
  // Step 1, « Mon club »: the player's bib, the club search; the animals wait for step 2.
  await expect(sheet.getByRole("heading", { name: /Mon club/ })).toBeVisible();
  await expect(sheet.getByRole("img", { name: /^Dossard \d+, / })).toBeVisible();
  await expect(sheet.getByRole("checkbox")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Suivant" }).click();
  // Step 2, « Mes épreuves »: one animal per family, named under it.
  await expect(sheet.getByRole("heading", { name: /Mes épreuves/ })).toBeVisible();
  await expect(sheet.getByRole("checkbox")).toHaveCount(6);
  await expect(sheet.getByRole("checkbox", { name: /Guépard\s*Sprint/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Préciser les épreuves" })).toHaveAttribute(
    "href",
    "/profil/modifier",
  );
  await sheet.getByRole("button", { name: "Retour" }).click();
  await expect(sheet.getByRole("heading", { name: /Mon club/ })).toBeVisible();

  // Closing the sheet brings the player back to the home, the card still there.
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(card).toBeVisible();

  // « Plus tard » hides it, remembered for the player, not just on this device.
  const later = card.getByRole("button", { name: "Plus tard : masquer pendant 30 jours" });
  const box = (await later.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await later.click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(() =>
      sql(`select reminder_hidden_until > now() + interval '29 days'
      from player_details where ${where(player.email)}`),
    )
    .toBe("t");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);

  // Thirty days later (moved back in SQL), the card is back.
  sql(`update player_details set reminder_hidden_until = now() - interval '1 minute'
    where ${where(player.email)}`);
  await page.reload();
  await expect(card).toBeVisible();

  // A club and a family: every sprint discipline is saved, and the card goes for good.
  await card.getByRole("button", { name: "Compléter" }).click();
  await sheet.getByLabel("Cherche ton club").fill("songeville");
  await sheet.getByRole("button", { name: /Stade Imaginaire Athlétisme/ }).click();
  // The club prints at once on the bib.
  await expect(sheet.getByRole("img", { name: /Stade Imaginaire Athlétisme/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Suivant" }).click();
  await sheet.getByText("Sprint", { exact: true }).click();
  await expect(sheet.getByRole("checkbox", { name: /Guépard\s*Sprint/ })).toBeChecked();
  // « Retour » keeps the club chosen.
  await sheet.getByRole("button", { name: "Retour" }).click();
  await expect(sheet.getByRole("img", { name: /Stade Imaginaire Athlétisme/ })).toBeVisible();
  await sheet.getByRole("button", { name: "Suivant" }).click();
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  // The confirmation shows in the sheet; the card is gone behind it.
  await expect(sheet.getByRole("status")).toHaveText("C'est enregistré : ton profil est complet.");
  await expect(card).toHaveCount(0);
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await expect(sheet).toHaveCount(0);
  expect(
    sql(`select disciplines @> '{100 m,200 m}'::text[] from player_details
      where ${where(player.email)}`),
  ).toBe("t");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);

  // « Préciser les épreuves »: the profile form lets the player take a discipline off.
  await page.goto("/profil/modifier");
  await page.getByRole("button", { name: /Privé : sexe et disciplines/ }).click();
  await page.getByText("200 m", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/profil\?enregistre=1$/);
  expect(
    sql(`select '200 m' = any(disciplines) from player_details where ${where(player.email)}`),
  ).toBe("f");
});
