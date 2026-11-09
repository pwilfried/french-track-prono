import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a player is told once that the admin validated their club", async ({ page }) => {
  const tag = `${Date.now() % 1000000}`;
  const club = `Foulees Notice ${tag}`;
  const player = newPlayer("notice");
  await page.goto("/profil");
  await signUp(page, player);
  await page.waitForURL(/\/profil$/);
  const id = sql(`insert into clubs (name, source, created_by)
    select '${club}', 'player', id from profiles where pseudo = '${player.pseudo}' returning id`);
  sql(`update profiles set club_id = '${id}' where pseudo = '${player.pseudo}'`);
  // What the back-office « Valider » does (covered by admin-clubs.spec.ts).
  sql(`update clubs set validated = true where id = '${id}'`);

  await page.goto("/");
  const notice = page.getByRole("status").filter({ hasText: `Ton club « ${club} » est validé` });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "OK" }).click();
  await expect(notice).toHaveCount(0);
  await page.goto("/profil");
  await expect(page.getByText(`Ton club « ${club} » est validé`)).toHaveCount(0);

  sql(`delete from clubs where id = '${id}'`);
});
