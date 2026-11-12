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
  const card = page.getByRole("region", { name: "Complète ton profil" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("checkbox")).toHaveCount(6);
  await expect(card.getByRole("link", { name: "Préciser les épreuves" })).toHaveAttribute(
    "href",
    "/profil/modifier",
  );

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
  await card.getByLabel("Cherche ton club").fill("songeville");
  await card.getByRole("button", { name: /Stade Imaginaire Athlétisme/ }).click();
  await card.getByText("Sprint", { exact: true }).click();
  await card.getByRole("button", { name: "Enregistrer" }).click();
  await expect(card).toHaveCount(0);
  expect(
    sql(`select disciplines @> '{100 m,200 m}'::text[] from player_details
      where ${where(player.email)}`),
  ).toBe("t");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);

  // « Préciser les épreuves »: the profile form lets the player take a discipline off.
  await page.goto("/profil/modifier");
  await page.getByText("200 m", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/profil\?enregistre=1$/);
  expect(
    sql(`select '200 m' = any(disciplines) from player_details where ${where(player.email)}`),
  ).toBe("f");
});
