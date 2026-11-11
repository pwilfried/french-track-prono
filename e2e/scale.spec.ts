import { expect, test } from "@playwright/test";

import { sql } from "../src/infra/contract/database";
import { adminMenu } from "./admin";
import { newPlayer, signIn, signUp } from "./players";

test("an admin adjusts the points of a mark within the tolerance", async ({ page }) => {
  const before = sql("select value from scoring_rules where key = 'mark_exact'");
  const player = newPlayer("bareme");
  await page.goto("/epreuves/f-100m");
  await page.locator("main").getByRole("link", { name: "Se connecter", exact: true }).click();
  await signUp(page, player);
  await page.waitForURL(/\/epreuves\/f-100m$/);
  sql(
    `update profiles set is_admin = true where id = (select id from auth.users where email = '${player.email}')`,
  );

  // An admin may browse the player side: the header leads back to the back-office.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Back-office" }).click();
  await expect(page).toHaveURL(/\/admin\/tableau-de-bord$/);
  // The dashboard says what is left to do, each tile leading to its page.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Bonjour ${player.pseudo}`);
  await expect(page.getByRole("link", { name: /Clubs à valider/ })).toHaveAttribute(
    "href",
    "/admin/clubs",
  );
  await expect(page.getByRole("heading", { name: "Prochaine compétition" })).toBeVisible();
  // Every section of the back-office is one tap away, as on the board.
  // On a phone, the menu is a drop-down that names the current section.
  await expect(adminMenu(page).locator("summary")).toHaveText("Tableau de bord");
  await adminMenu(page).locator("summary").click();
  await expect(adminMenu(page).getByRole("link")).toHaveCount(11);
  await expect(adminMenu(page).getByText("Communauté")).toBeVisible();
  // The back-office has its own interface: no player navigation, and a way to the site.
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await adminMenu(page).getByRole("link", { name: "Barème" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Barème");
  const field = page.getByLabel("Perf dans la tolérance", { exact: true });
  await field.fill("6");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Enregistré");
  expect(sql("select value from scoring_rules where key = 'mark_exact'")).toBe("6");

  // A value that is not positive is refused.
  await field.fill("0");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("nombre positif");

  await page.getByRole("link", { name: "Voir le site" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("banner").getByRole("link", { name: "Back-office" }).click();

  // Signing in again leads an admin to the home page, like everyone (decision of 11 Nov 2026)…
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/connexion");
  await signIn(page, player.email);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // …unless they asked for a back-office page.
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/connexion?next=${encodeURIComponent("/admin/bareme")}`);
  await signIn(page, player.email);
  await expect(page).toHaveURL(/\/admin\/bareme$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Barème");

  sql(`update scoring_rules set value = ${before} where key = 'mark_exact'`);
});
