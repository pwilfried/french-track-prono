import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { newPlayer, signUp } from "./players";

test("a new player predicts a perfect podium, the admin enters the result and the player gets 12 points", async ({
  page,
}) => {
  // An event still open (run `npm run db:open-events` first).
  const slug = sql(
    `select e.slug from events e join competitions c on c.id = e.competition_id
     where c.slug = 'ultimate-championship-2026' and e.lock_at > now() + interval '5 minutes'
     order by e.starts_at limit 1`,
  );
  expect(slug, "no open event: run npm run db:open-events").not.toBe("");
  const player = newPlayer("prono");
  const email = player.email;

  // Visitor on the event: the sign-in prompt comes back to it.
  await page.goto(`/epreuves/${slug}`);
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(new RegExp(`/epreuves/${slug}$`));

  // Compose the podium with the first three athletes, then save.
  const athletes = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await athletes.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.getByRole("status")).toContainText("Podium enregistré");

  // Reopening the page shows the saved podium.
  await page.reload();
  await expect(page.getByRole("button", { name: /^1re place : (?!vide)/ })).toBeVisible();

  // The event locks; saving again is refused.
  sql(`update events set lock_at = now() - interval '1 second' where slug = '${slug}'`);
  await page.getByRole("button", { name: "Enregistrer mon podium" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Trop tard");

  // The player is made admin (from SQL, as documented) and enters the same podium.
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`,
  );
  await page.goto(`/admin/${slug}`);
  const official = page.locator("li > button[aria-pressed]");
  for (const index of [0, 1, 2]) await official.nth(index).click();
  await page.getByRole("button", { name: "Enregistrer le résultat" }).click();
  await expect(page.getByRole("status")).toContainText("Résultat enregistré");

  // A dry run shows the points before anything is stored; confirming stores them.
  const preview = page.getByRole("region", { name: "Aperçu du calcul" });
  await expect(preview).toContainText("Rien n'est encore enregistré");
  await expect(preview.getByRole("listitem").first()).toContainText("12");
  await page.getByRole("button", { name: "Confirmer le calcul" }).click();
  await expect(page.getByRole("status")).toContainText("Points calculés");

  // The admin log keeps both actions, newest first.
  await page.goto("/admin/historique");
  const log = page.getByRole("list", { name: "Actions" }).getByRole("listitem");
  await expect(log.nth(0)).toContainText("Points calculés");
  await expect(log.nth(1)).toContainText("Résultat saisi");
  await expect(log.nth(0)).toContainText(`par ${player.pseudo}`);
  await page.goto("/mes-points");
  await expect(page.locator("main")).toContainText("+12 pts");
  await expect(page.locator("main")).toContainText("Podium parfait");

  // The event page now shows the result and my podium against the official one.
  await page.goto(`/epreuves/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("s'impose");
  await expect(page.locator("main")).toContainText("+12 pts");
  await expect(page.getByRole("heading", { name: "Ton prono vs officiel" })).toBeVisible();

  // The perfect podium earns the Nostradamus badge on the profile.
  await page.goto("/profil");
  await expect(page.getByRole("listitem").filter({ hasText: "Nostradamus" })).toBeVisible();
});
